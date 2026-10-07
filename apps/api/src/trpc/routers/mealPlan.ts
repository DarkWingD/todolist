import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  db,
  list,
  listMember,
  meal,
  mealPlan,
  mealPlanDay,
  mealPlanInvite,
  mealPlanMember,
  person,
  task,
} from '@todolist/db';
import {
  COOK_SPAN_MAX,
  createMealSchema,
  inviteToMealPlanSchema,
  mealPlanRangeSchema,
  moveMealDaySchema,
  planDateSchema,
  copyWeekSchema,
  sendToShoppingListSchema,
  setMealDaySchema,
  updateMealSchema,
  importRecipeSchema,
  mealPlanSettingsSchema,
  suggestWeekSchema,
  DEFAULT_PANTRY,
  AISLES,
  extractRecipe,
  ingredientKey,
  mergeForShopping,
  pantryKeys,
  suggestWeek,
} from '@todolist/shared';
import { fetchPage, PageError } from '../../lib/fetchPage.js';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { env } from '../../env.js';
import { sendEmail } from '../../email.js';
import { assertMealPlanAccess } from '../access.js';
import { householdUserIds } from '../household.js';
import { logActivity } from '../activity.js';
import { mergeRouters, protectedProcedure, router } from '../trpc.js';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// ─────────────────────────── date helpers ───────────────────────────
// Plan dates are plain "YYYY-MM-DD" calendar days. All arithmetic goes through
// UTC midnight so it can never be shifted by a timezone or a DST boundary.
const DAY_MS = 86_400_000;
const toMs = (d: string): number => Date.parse(`${d}T00:00:00Z`);
const toDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const addDays = (d: string, n: number): string => toDate(toMs(d) + n * DAY_MS);
const daysBetween = (a: string, b: string): number => Math.round((toMs(b) - toMs(a)) / DAY_MS);

/** Only http(s) recipe links are stored; anything else becomes null. */
function sanitizeRecipeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Find (or create) the user's app-managed Shopping list — the same idempotent
 * pattern as `remindersListId` / `birthdaysListId`. `systemKey` keeps it out of
 * the normal Lists view, and `type: 'checklist'` makes it render as 🛒 Shopping.
 */
export async function groceriesListId(userId: string): Promise<string> {
  const rows = await db
    .select({ id: list.id })
    .from(list)
    .where(and(eq(list.ownerId, userId), eq(list.systemKey, 'groceries'), isNull(list.deletedAt)))
    .limit(1);
  if (rows[0]) return rows[0].id;
  const [created] = await db
    .insert(list)
    .values({
      ownerId: userId,
      name: 'Shopping',
      emojiIcon: '🛒',
      type: 'checklist',
      systemKey: 'groceries',
      private: true,
    })
    .returning();
  await db.insert(listMember).values({ listId: created!.id, userId, role: 'owner' });
  return created!.id;
}

/** Resolve an existing catalog meal by name (case-insensitive) or create one. */
async function resolveMealId(planId: string, userId: string, name: string): Promise<string> {
  const trimmed = name.trim();
  // `ilike` with no wildcards is an exact case-insensitive match, so "Tacos" and
  // "tacos" resolve to the same catalog row rather than creating a duplicate.
  const existing = await db
    .select({ id: meal.id })
    .from(meal)
    .where(and(eq(meal.planId, planId), ilike(meal.name, trimmed), isNull(meal.deletedAt)))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [created] = await db
    .insert(meal)
    .values({ planId, name: trimmed, createdBy: userId })
    .returning();
  return created!.id;
}

/**
 * Shorten any earlier cook whose leftovers would run into `date`.
 * Called before writing a day, so the newest entry always wins the slot.
 */
async function truncateOverlappingCook(planId: string, date: string): Promise<void> {
  const earliest = addDays(date, -(COOK_SPAN_MAX - 1));
  const rows = await db
    .select({ id: mealPlanDay.id, date: mealPlanDay.date, cookSpan: mealPlanDay.cookSpan })
    .from(mealPlanDay)
    .where(
      and(
        eq(mealPlanDay.planId, planId),
        gte(mealPlanDay.date, earliest),
        lte(mealPlanDay.date, addDays(date, -1)),
      ),
    )
    .orderBy(desc(mealPlanDay.date))
    .limit(1);
  const prev = rows[0];
  if (!prev) return;
  const gap = daysBetween(prev.date, date); // ≥ 1
  if (prev.cookSpan > gap) {
    await db
      .update(mealPlanDay)
      .set({ cookSpan: gap, updatedAt: new Date() })
      .where(eq(mealPlanDay.id, prev.id));
  }
}

/** The recipe-book columns, selected wherever a meal is read. */
const RECIPE_FIELDS = {
  servings: meal.servings,
  method: meal.method,
  prepMinutes: meal.prepMinutes,
  cookMinutes: meal.cookMinutes,
  tags: meal.tags,
};

export interface MealPlanEntry {
  date: string;
  mealId: string;
  name: string;
  recipeUrl: string | null;
  notes: string | null;
  ingredients: string | null;
  isFavourite: boolean;
  servings: number | null;
  method: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string[] | null;
  /** Nights this cook feeds, on the cook's own day. */
  cookSpan: number;
  /** True when this day is eating an earlier day's cook. */
  isLeftover: boolean;
  /** The cook's date — equals `date` unless `isLeftover`. */
  cookDate: string;
  /** 1-based night within the cook, so night 2 of 3 can be labelled. */
  night: number;
}

const mealPlanHead = router({
  /**
   * The plan the user lands on: their first membership, or a new plan if they
   * have none. Someone who accepted an invite gets that shared plan rather than
   * a second empty one, so there is no setup step for either person.
   */
  ensure: protectedProcedure.mutation(async ({ ctx }) => {
    const mine = await db
      .select({ id: mealPlan.id, householdId: mealPlan.householdId })
      .from(mealPlan)
      .innerJoin(mealPlanMember, eq(mealPlanMember.planId, mealPlan.id))
      .where(and(eq(mealPlanMember.userId, ctx.user.id), isNull(mealPlan.deletedAt)))
      .orderBy(asc(mealPlan.createdAt))
      .limit(1);
    if (mine[0]) {
      if (!mine[0].householdId)
        await db
          .update(mealPlan)
          .set({ householdId: ctx.person.householdId })
          .where(eq(mealPlan.id, mine[0].id));
      return { id: mine[0].id };
    }
    // The household's plan is the family's plan: join it rather than start a
    // second one nobody else can see.
    const theirs = await db
      .select({ id: mealPlan.id })
      .from(mealPlan)
      .where(and(eq(mealPlan.householdId, ctx.person.householdId), isNull(mealPlan.deletedAt)))
      .orderBy(asc(mealPlan.createdAt))
      .limit(1);
    if (theirs[0]) {
      await db
        .insert(mealPlanMember)
        .values({ planId: theirs[0].id, userId: ctx.user.id, role: 'member' })
        .onConflictDoNothing();
      return { id: theirs[0].id };
    }
    const [created] = await db
      .insert(mealPlan)
      .values({ ownerId: ctx.user.id, householdId: ctx.person.householdId })
      .returning();
    await db
      .insert(mealPlanMember)
      .values({ planId: created!.id, userId: ctx.user.id, role: 'owner' });
    const adults = await householdUserIds(ctx.person.householdId);
    const others = adults.filter((id) => id !== ctx.user.id);
    if (others.length > 0)
      await db
        .insert(mealPlanMember)
        .values(others.map((userId) => ({ planId: created!.id, userId, role: 'member' as const })))
        .onConflictDoNothing();
    return { id: created!.id };
  }),

  mine: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: mealPlan.id,
        ownerId: mealPlan.ownerId,
        name: mealPlan.name,
        emojiIcon: mealPlan.emojiIcon,
        memberCount: sql<number>`(
          select count(*)::int from ${mealPlanMember} mpm where mpm.plan_id = ${mealPlan.id}
        )`,
      })
      .from(mealPlan)
      .innerJoin(mealPlanMember, eq(mealPlanMember.planId, mealPlan.id))
      .where(and(eq(mealPlanMember.userId, ctx.user.id), isNull(mealPlan.deletedAt)))
      .orderBy(asc(mealPlan.createdAt));
  }),

  /**
   * Every day in [from, to], with leftover days expanded from each cook's span
   * so the client renders exactly what it is given. Reads back an extra
   * COOK_SPAN_MAX-1 days before `from` so a cook started just before the window
   * still colours the days inside it.
   */
  range: protectedProcedure.input(mealPlanRangeSchema).query(async ({ ctx, input }) => {
    await assertMealPlanAccess(ctx.user.id, input.planId);
    return readRange(input.planId, input.from, input.to);
  }),
});

/** Every day in [from, to] with leftovers expanded; see `range`. */
export async function readRange(planId: string, from: string, to: string) {
  const input = { planId, from, to };
  {
    const lookback = addDays(input.from, -(COOK_SPAN_MAX - 1));
    const rows = await db
      .select({
        date: mealPlanDay.date,
        cookSpan: mealPlanDay.cookSpan,
        mealId: meal.id,
        name: meal.name,
        recipeUrl: meal.recipeUrl,
        notes: meal.notes,
        ingredients: meal.ingredients,
        isFavourite: meal.isFavourite,
        ...RECIPE_FIELDS,
      })
      .from(mealPlanDay)
      .innerJoin(meal, eq(meal.id, mealPlanDay.mealId))
      .where(
        and(
          eq(mealPlanDay.planId, input.planId),
          gte(mealPlanDay.date, lookback),
          lte(mealPlanDay.date, input.to),
        ),
      )
      .orderBy(asc(mealPlanDay.date));

    const byDate = new Map(rows.map((r) => [r.date, r]));
    const out: MealPlanEntry[] = [];
    // Walk day by day carrying the active cook forward. A day with its own row
    // always starts a new cook, which is what truncates an overrunning one.
    let cook: (typeof rows)[number] | null = null;
    let night = 0;
    for (let d = lookback; daysBetween(d, input.to) >= 0; d = addDays(d, 1)) {
      const row = byDate.get(d);
      if (row) {
        cook = row;
        night = 1;
      } else if (cook && night < cook.cookSpan) {
        night += 1;
      } else {
        cook = null;
        night = 0;
      }
      if (!cook || daysBetween(input.from, d) < 0) continue;
      out.push({
        date: d,
        mealId: cook.mealId,
        name: cook.name,
        recipeUrl: cook.recipeUrl,
        notes: cook.notes,
        ingredients: cook.ingredients,
        isFavourite: cook.isFavourite,
        servings: cook.servings,
        method: cook.method,
        prepMinutes: cook.prepMinutes,
        cookMinutes: cook.cookMinutes,
        tags: cook.tags,
        cookSpan: cook.cookSpan,
        isLeftover: night > 1,
        cookDate: cook.date,
        night,
      });
    }
    return out;
  }
}

// The procedures below are re-attached to the router by the export at the end.
const _mealPlanRest = router({
  /** Plan a dinner. Naming a meal that isn't in the catalog adds it. */
  setDay: protectedProcedure.input(setMealDaySchema).mutation(async ({ ctx, input }) => {
    await assertMealPlanAccess(ctx.user.id, input.planId);
    let mealId = input.mealId;
    if (mealId) {
      const owned = await db
        .select({ id: meal.id })
        .from(meal)
        .where(and(eq(meal.id, mealId), eq(meal.planId, input.planId), isNull(meal.deletedAt)))
        .limit(1);
      if (!owned[0]) throw new TRPCError({ code: 'NOT_FOUND' });
    } else {
      mealId = await resolveMealId(input.planId, ctx.user.id, input.name!);
    }
    await truncateOverlappingCook(input.planId, input.date);
    await db
      .insert(mealPlanDay)
      .values({
        planId: input.planId,
        date: input.date,
        mealId,
        cookSpan: input.cookSpan,
        createdBy: ctx.user.id,
      })
      .onConflictDoUpdate({
        target: [mealPlanDay.planId, mealPlanDay.date],
        set: { mealId, cookSpan: input.cookSpan, updatedAt: new Date() },
      });
    const [named] = await db
      .select({ name: meal.name })
      .from(meal)
      .where(eq(meal.id, mealId))
      .limit(1);
    await logActivity({
      householdId: ctx.person.householdId,
      actorId: ctx.person.id,
      kind: 'meal.planned',
      targetId: mealId,
      title: named?.name ?? input.name ?? 'dinner',
      meta: { date: input.date },
    });
    return { ok: true };
  }),

  clearDay: protectedProcedure
    .input(z.object({ planId: z.string().uuid(), date: planDateSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertMealPlanAccess(ctx.user.id, input.planId);
      const [was] = await db
        .select({ name: meal.name })
        .from(mealPlanDay)
        .innerJoin(meal, eq(meal.id, mealPlanDay.mealId))
        .where(and(eq(mealPlanDay.planId, input.planId), eq(mealPlanDay.date, input.date)))
        .limit(1);
      await db
        .delete(mealPlanDay)
        .where(and(eq(mealPlanDay.planId, input.planId), eq(mealPlanDay.date, input.date)));
      if (was)
        await logActivity({
          householdId: ctx.person.householdId,
          actorId: ctx.person.id,
          kind: 'meal.cleared',
          title: was.name,
          meta: { date: input.date },
        });
      return { ok: true };
    }),

  /**
   * Move a planned dinner to another date — this is what "Push to next week"
   * and dragging a card both call. If the target day is already taken the two
   * swap places, so a drag can never silently destroy the meal it lands on.
   */
  moveDay: protectedProcedure.input(moveMealDaySchema).mutation(async ({ ctx, input }) => {
    await assertMealPlanAccess(ctx.user.id, input.planId);
    if (input.from === input.to) return { ok: true };
    const rows = await db
      .select({
        id: mealPlanDay.id,
        date: mealPlanDay.date,
        mealId: mealPlanDay.mealId,
        cookSpan: mealPlanDay.cookSpan,
      })
      .from(mealPlanDay)
      .where(
        and(
          eq(mealPlanDay.planId, input.planId),
          inArray(mealPlanDay.date, [input.from, input.to]),
        ),
      );
    const source = rows.find((r) => r.date === input.from);
    if (!source) return { ok: false };
    const target = rows.find((r) => r.date === input.to);
    if (target) {
      await db
        .update(mealPlanDay)
        .set({ mealId: source.mealId, cookSpan: source.cookSpan, updatedAt: new Date() })
        .where(eq(mealPlanDay.id, target.id));
      await db
        .update(mealPlanDay)
        .set({ mealId: target.mealId, cookSpan: target.cookSpan, updatedAt: new Date() })
        .where(eq(mealPlanDay.id, source.id));
    } else {
      await db
        .update(mealPlanDay)
        .set({ date: input.to, updatedAt: new Date() })
        .where(eq(mealPlanDay.id, source.id));
    }
    return { ok: true };
  }),

  // ─────────────────────────── the meal catalog ───────────────────────────
  meals: protectedProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMealPlanAccess(ctx.user.id, input.planId);
      return db
        .select({
          id: meal.id,
          name: meal.name,
          recipeUrl: meal.recipeUrl,
          notes: meal.notes,
          ingredients: meal.ingredients,
          isFavourite: meal.isFavourite,
          ...RECIPE_FIELDS,
          lastCooked: sql<string | null>`(
            select max(mpd.date) from ${mealPlanDay} mpd where mpd.meal_id = ${meal.id}
          )`,
        })
        .from(meal)
        .where(and(eq(meal.planId, input.planId), isNull(meal.deletedAt)))
        .orderBy(desc(meal.isFavourite), asc(meal.name));
    }),

  createMeal: protectedProcedure.input(createMealSchema).mutation(async ({ ctx, input }) => {
    await assertMealPlanAccess(ctx.user.id, input.planId);
    // Names are unique per plan; say so, rather than surface a constraint error.
    const clash = await db
      .select({ id: meal.id })
      .from(meal)
      .where(
        and(
          eq(meal.planId, input.planId),
          ilike(meal.name, input.name.trim()),
          isNull(meal.deletedAt),
        ),
      )
      .limit(1);
    if (clash[0])
      throw new TRPCError({
        code: 'CONFLICT',
        message: `There's already a recipe called "${input.name.trim()}".`,
      });
    const [created] = await db
      .insert(meal)
      .values({
        planId: input.planId,
        name: input.name,
        recipeUrl: sanitizeRecipeUrl(input.recipeUrl),
        notes: input.notes,
        ingredients: input.ingredients,
        isFavourite: input.isFavourite ?? false,
        servings: input.servings ?? null,
        method: input.method ?? null,
        prepMinutes: input.prepMinutes ?? null,
        cookMinutes: input.cookMinutes ?? null,
        tags: input.tags ?? null,
        createdBy: ctx.user.id,
      })
      .returning();
    return created;
  }),

  updateMeal: protectedProcedure.input(updateMealSchema).mutation(async ({ ctx, input }) => {
    const rows = await db
      .select({ planId: meal.planId })
      .from(meal)
      .where(eq(meal.id, input.id))
      .limit(1);
    const found = rows[0];
    if (!found) return { ok: false };
    await assertMealPlanAccess(ctx.user.id, found.planId);
    const { id, recipeUrl, ...rest } = input;
    if (rest.name !== undefined) {
      const clash = await db
        .select({ id: meal.id })
        .from(meal)
        .where(
          and(
            eq(meal.planId, found.planId),
            ilike(meal.name, rest.name.trim()),
            isNull(meal.deletedAt),
          ),
        )
        .limit(1);
      if (clash[0] && clash[0].id !== id)
        throw new TRPCError({
          code: 'CONFLICT',
          message: `There's already a recipe called "${rest.name.trim()}".`,
        });
    }
    await db
      .update(meal)
      .set({
        ...rest,
        ...(recipeUrl !== undefined ? { recipeUrl: sanitizeRecipeUrl(recipeUrl) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(meal.id, id));
    return { ok: true };
  }),

  removeMeal: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select({ planId: meal.planId })
        .from(meal)
        .where(eq(meal.id, input.id))
        .limit(1);
      const found = rows[0];
      if (!found) return { ok: false };
      await assertMealPlanAccess(ctx.user.id, found.planId);
      // Planned days cascade with the meal, so deleting one clears the days it
      // was planned on rather than leaving them pointing at nothing.
      await db.delete(mealPlanDay).where(eq(mealPlanDay.mealId, input.id));
      await db.update(meal).set({ deletedAt: new Date() }).where(eq(meal.id, input.id));
      return { ok: true };
    }),

  toggleFavourite: protectedProcedure
    .input(z.object({ id: z.string().uuid(), isFavourite: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select({ planId: meal.planId })
        .from(meal)
        .where(eq(meal.id, input.id))
        .limit(1);
      const found = rows[0];
      if (!found) return { ok: false };
      await assertMealPlanAccess(ctx.user.id, found.planId);
      await db
        .update(meal)
        .set({ isFavourite: input.isFavourite, updatedAt: new Date() })
        .where(eq(meal.id, input.id));
      return { ok: true };
    }),

  // ─────────────────────────── sharing ───────────────────────────
  addMember: protectedProcedure
    .input(z.object({ planId: z.string().uuid(), userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertMealPlanAccess(ctx.user.id, input.planId);
      const mine = alias(listMember, 'lm_mine');
      const theirs = alias(listMember, 'lm_theirs');
      const shared = await db
        .select({ listId: mine.listId })
        .from(mine)
        .innerJoin(theirs, eq(theirs.listId, mine.listId))
        .where(and(eq(mine.userId, ctx.user.id), eq(theirs.userId, input.userId)))
        .limit(1);
      if (shared.length === 0)
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only add people who already share a list with you.',
        });
      await db
        .insert(mealPlanMember)
        .values({ planId: input.planId, userId: input.userId, role: 'member' })
        .onConflictDoNothing();
      return { ok: true };
    }),

  invite: protectedProcedure.input(inviteToMealPlanSchema).mutation(async ({ ctx, input }) => {
    await assertMealPlanAccess(ctx.user.id, input.planId);
    const token = crypto.randomUUID();
    await db.insert(mealPlanInvite).values({
      planId: input.planId,
      email: input.email,
      token,
      invitedBy: ctx.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    const url = `${env.WEB_ORIGIN}/invite/${token}`;
    await sendEmail({
      to: input.email,
      subject: `You've been invited to a meal plan on Sorted`,
      text: `Open this link to join the meal plan: ${url}`,
      html: `<p>You've been invited to share a meal plan.</p><p><a href="${url}">Accept the invite</a></p>`,
    });
    return { ok: true };
  }),

  // ─────────────────────────── shopping list ───────────────────────────
  /**
   * Add the week's dinners to the app-managed Shopping list. Leftover days are
   * derived rather than stored, so nothing is ever added twice for a cook that
   * feeds several nights; anything already on the list and unticked is skipped.
   */
  /**
   * Fill this week from the previous one.
   *
   * Only empty days are written: a week you have already planned should never
   * be silently overwritten by a button labelled "copy". Clearing a day first is
   * the way to ask for it to be replaced.
   *
   * Cook spans copy across as they are, then each is truncated so it cannot run
   * past the end of the week or over a day that is already planned.
   */
  copyWeek: protectedProcedure.input(copyWeekSchema).mutation(async ({ ctx, input }) => {
    await assertMealPlanAccess(ctx.user.id, input.planId);

    const shift = (iso: string, days: number) => {
      const d = new Date(`${iso}T00:00:00`);
      d.setDate(d.getDate() + days);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${m}-${day}`;
    };

    const sourceFrom = shift(input.from, -7);
    const sourceTo = shift(input.to, -7);

    const [source, existing] = await Promise.all([
      db
        .select({
          date: mealPlanDay.date,
          mealId: mealPlanDay.mealId,
          cookSpan: mealPlanDay.cookSpan,
        })
        .from(mealPlanDay)
        .where(
          and(
            eq(mealPlanDay.planId, input.planId),
            gte(mealPlanDay.date, sourceFrom),
            lte(mealPlanDay.date, sourceTo),
          ),
        ),
      db
        .select({ date: mealPlanDay.date })
        .from(mealPlanDay)
        .where(
          and(
            eq(mealPlanDay.planId, input.planId),
            gte(mealPlanDay.date, input.from),
            lte(mealPlanDay.date, input.to),
          ),
        ),
    ]);

    if (source.length === 0) return { copied: 0, skipped: 0 };

    const taken = new Set(existing.map((r) => r.date));
    const rows = [];
    let skipped = 0;
    for (const row of source) {
      const date = shift(row.date, 7);
      if (taken.has(date)) {
        skipped++;
        continue;
      }
      // A span may not reach past the end of the week, nor over a day that is
      // already planned — otherwise leftovers would claim days it never owned.
      let span = row.cookSpan;
      for (let n = 1; n < span; n++) {
        const night = shift(date, n);
        if (night > input.to || taken.has(night)) {
          span = n;
          break;
        }
      }
      rows.push({
        planId: input.planId,
        date,
        mealId: row.mealId,
        cookSpan: span,
        createdBy: ctx.user.id,
      });
      taken.add(date);
    }

    if (rows.length > 0) await db.insert(mealPlanDay).values(rows);
    return { copied: rows.length, skipped };
  }),

  /**
   * The week's dinners into the Shopping list, the way you walk the shop: every
   * cook's ingredients read and added up across meals (2 onions + 1 onion is 3),
   * scaled to how many the plan cooks for when the recipe says how many it
   * serves, what the pantry always has left off, and grouped under aisles.
   * Each line says what it is for, "Coriander — 1 bunch (Tue + Thu)", so the
   * meal context a heading-per-meal list gave is not lost.
   *
   * Leftover nights are not cooks, so they add nothing. Sending again updates
   * the amounts of what is still unticked rather than adding it twice.
   */
  sendToShoppingList: protectedProcedure
    .input(sendToShoppingListSchema)
    .mutation(async ({ ctx, input }) => {
      await assertMealPlanAccess(ctx.user.id, input.planId);
      const [plan] = await db
        .select({ servings: mealPlan.servings, pantry: mealPlan.pantry })
        .from(mealPlan)
        .where(eq(mealPlan.id, input.planId))
        .limit(1);
      const rows = await db
        .select({
          date: mealPlanDay.date,
          cookSpan: mealPlanDay.cookSpan,
          name: meal.name,
          ingredients: meal.ingredients,
          servings: meal.servings,
        })
        .from(mealPlanDay)
        .innerJoin(meal, eq(meal.id, mealPlanDay.mealId))
        .where(
          and(
            eq(mealPlanDay.planId, input.planId),
            gte(mealPlanDay.date, input.from),
            lte(mealPlanDay.date, input.to),
          ),
        )
        .orderBy(asc(mealPlanDay.date));

      const people = plan?.servings ?? (await householdSize(ctx.person.householdId));
      // Scaled only when the recipe says how many it serves; a meal whose
      // ingredients were typed in for this family is taken as written.
      const cooks = rows.map((r) => ({
        mealName: r.name.trim(),
        date: r.date,
        ingredients: r.ingredients,
        factor: r.servings ? (people * r.cookSpan) / r.servings : 1,
      }));
      const merged = mergeForShopping(cooks, pantryKeys(plan?.pantry));

      const listId = await groceriesListId(ctx.user.id);
      const existing = await db
        .select({ id: task.id, title: task.title, parentTaskId: task.parentTaskId })
        .from(task)
        .where(and(eq(task.listId, listId), isNull(task.completedAt), isNull(task.deletedAt)));

      // Aisle headings, made once and reused.
      const headingTitle = (id: string) => {
        const a = AISLES.find((x) => x.id === id)!;
        return `${a.emoji} ${a.label}`;
      };
      const headingByTitle = new Map<string, string>();
      for (const t of existing) if (!t.parentTaskId) headingByTitle.set(t.title, t.id);
      const missingHeadings = merged.aisles
        .map((a) => headingTitle(a.id))
        .filter((t) => !headingByTitle.has(t));
      let headings = 0;
      if (missingHeadings.length > 0) {
        const made = await db
          .insert(task)
          .values(missingHeadings.map((title) => ({ listId, title, createdBy: ctx.user.id })))
          .returning({ id: task.id, title: task.title });
        for (const h of made) headingByTitle.set(h.title, h.id);
        headings = made.length;
      }

      // An unticked line already under an aisle heading is the same item when
      // its name reads the same; its amount is brought up to date.
      const aisleHeadingIds = new Set(
        merged.aisles.map((a) => headingByTitle.get(headingTitle(a.id))!),
      );
      const keyOfTitle = (title: string) => ingredientKey(title.split(' — ')[0]!.split(' (')[0]!);
      const existingByKey = new Map<string, { id: string; title: string }>();
      for (const t of existing)
        if (t.parentTaskId && aisleHeadingIds.has(t.parentTaskId))
          existingByKey.set(keyOfTitle(t.title), t);

      const toAdd: { listId: string; title: string; parentTaskId: string; createdBy: string }[] =
        [];
      let updated = 0;
      for (const a of merged.aisles) {
        const parentTaskId = headingByTitle.get(headingTitle(a.id))!;
        for (const item of a.items) {
          const have = existingByKey.get(item.key);
          if (have) {
            if (have.title !== item.title) {
              await db
                .update(task)
                .set({ title: item.title, updatedAt: new Date() })
                .where(eq(task.id, have.id));
              updated++;
            }
            continue;
          }
          toAdd.push({ listId, title: item.title, parentTaskId, createdBy: ctx.user.id });
        }
      }
      if (toAdd.length > 0) await db.insert(task).values(toAdd);

      return {
        listId,
        added: toAdd.length,
        updated,
        headings,
        pantry: merged.pantry,
        spare: merged.spare,
      };
    }),
});

// ─────────────────────────── the recipe book ───────────────────────────
/** How many people the household cooks for: everyone in it, adults and children. */
async function householdSize(householdId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(person)
    .where(eq(person.householdId, householdId));
  return Math.max(1, row?.n ?? 1);
}

const _mealPlanRecipes = router({
  /** One meal with its recipe, for cook mode opened from the wall or a link. */
  meal: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await db
        .select({
          id: meal.id,
          planId: meal.planId,
          name: meal.name,
          recipeUrl: meal.recipeUrl,
          notes: meal.notes,
          ingredients: meal.ingredients,
          isFavourite: meal.isFavourite,
          ...RECIPE_FIELDS,
        })
        .from(meal)
        .where(and(eq(meal.id, input.id), isNull(meal.deletedAt)))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertMealPlanAccess(ctx.user.id, row.planId);
      return row;
    }),

  /** How many a cook feeds and what the pantry has; with the defaults for the editor. */
  settings: protectedProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMealPlanAccess(ctx.user.id, input.planId);
      const [plan] = await db
        .select({ servings: mealPlan.servings, pantry: mealPlan.pantry })
        .from(mealPlan)
        .where(eq(mealPlan.id, input.planId))
        .limit(1);
      return {
        servings: plan?.servings ?? null,
        pantry: plan?.pantry ?? null,
        defaultPantry: DEFAULT_PANTRY,
        householdSize: await householdSize(ctx.person.householdId),
      };
    }),

  updateSettings: protectedProcedure
    .input(mealPlanSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      await assertMealPlanAccess(ctx.user.id, input.planId);
      await db
        .update(mealPlan)
        .set({
          ...(input.servings !== undefined ? { servings: input.servings } : {}),
          ...(input.pantry !== undefined ? { pantry: input.pantry } : {}),
          updatedAt: new Date(),
        })
        .where(eq(mealPlan.id, input.planId));
      return { ok: true };
    }),

  /**
   * Read the recipe on a page. Nothing is saved: the draft comes back for the
   * editor, so a page that reads oddly is fixed before it becomes a recipe.
   */
  importRecipe: protectedProcedure.input(importRecipeSchema).mutation(async ({ ctx, input }) => {
    await assertMealPlanAccess(ctx.user.id, input.planId);
    try {
      const page = await fetchPage(input.url);
      const draft = extractRecipe(page.html);
      if (!draft || (draft.ingredients.length === 0 && draft.method.length === 0))
        throw new PageError("Couldn't find a recipe on that page. Paste the recipe in instead.");
      return { ...draft, recipeUrl: page.url };
    } catch (err) {
      if (err instanceof PageError)
        throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
      throw new TRPCError({ code: 'BAD_REQUEST', message: "Couldn't read that page." });
    }
  }),

  /**
   * Proposals for the week's empty nights, from meals the family already has,
   * favouring ones that share perishables with what is planned. Nothing is
   * written: the screen shows the proposals and plans the ones that are kept.
   */
  suggestWeek: protectedProcedure.input(suggestWeekSchema).mutation(async ({ ctx, input }) => {
    await assertMealPlanAccess(ctx.user.id, input.planId);
    const [catalog, entries] = await Promise.all([
      db
        .select({
          id: meal.id,
          name: meal.name,
          ingredients: meal.ingredients,
          isFavourite: meal.isFavourite,
          lastCooked: sql<string | null>`(
            select max(mpd.date) from ${mealPlanDay} mpd where mpd.meal_id = ${meal.id}
          )`,
        })
        .from(meal)
        .where(and(eq(meal.planId, input.planId), isNull(meal.deletedAt))),
      readRange(input.planId, input.from, input.to),
    ]);
    const taken = new Set(entries.map((e) => e.date));
    const empty: string[] = [];
    for (let d = input.from; daysBetween(d, input.to) >= 0; d = addDays(d, 1))
      if (!taken.has(d)) empty.push(d);
    const planned = entries
      .filter((e) => !e.isLeftover)
      .map((e) => ({ date: e.date, mealId: e.mealId }));
    return {
      proposals: suggestWeek({ catalog, planned, empty, seed: input.seed }),
      catalogSize: catalog.length,
    };
  }),
});

export const mealPlanRouter = mergeRouters(mealPlanHead, _mealPlanRest, _mealPlanRecipes);
