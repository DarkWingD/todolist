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
  task,
} from '@todolist/db';
import {
  COOK_SPAN_MAX,
  createMealSchema,
  inviteToMealPlanSchema,
  mealPlanRangeSchema,
  moveMealDaySchema,
  planDateSchema,
  sendToShoppingListSchema,
  setMealDaySchema,
  updateMealSchema,
} from '@todolist/shared';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { env } from '../../env.js';
import { sendEmail } from '../../email.js';
import { assertMealPlanAccess } from '../access.js';
import { protectedProcedure, router } from '../trpc.js';

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

export interface MealPlanEntry {
  date: string;
  mealId: string;
  name: string;
  recipeUrl: string | null;
  notes: string | null;
  isFavourite: boolean;
  /** Nights this cook feeds, on the cook's own day. */
  cookSpan: number;
  /** True when this day is eating an earlier day's cook. */
  isLeftover: boolean;
  /** The cook's date — equals `date` unless `isLeftover`. */
  cookDate: string;
  /** 1-based night within the cook, so night 2 of 3 can be labelled. */
  night: number;
}

export const mealPlanRouter = router({
  /**
   * The plan the user lands on: their first membership, or a new plan if they
   * have none. Someone who accepted an invite gets that shared plan rather than
   * a second empty one, so there is no setup step for either person.
   */
  ensure: protectedProcedure.mutation(async ({ ctx }) => {
    const mine = await db
      .select({ id: mealPlan.id })
      .from(mealPlan)
      .innerJoin(mealPlanMember, eq(mealPlanMember.planId, mealPlan.id))
      .where(and(eq(mealPlanMember.userId, ctx.user.id), isNull(mealPlan.deletedAt)))
      .orderBy(asc(mealPlan.createdAt))
      .limit(1);
    if (mine[0]) return mine[0];
    const [created] = await db.insert(mealPlan).values({ ownerId: ctx.user.id }).returning();
    await db
      .insert(mealPlanMember)
      .values({ planId: created!.id, userId: ctx.user.id, role: 'owner' });
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
    const lookback = addDays(input.from, -(COOK_SPAN_MAX - 1));
    const rows = await db
      .select({
        date: mealPlanDay.date,
        cookSpan: mealPlanDay.cookSpan,
        mealId: meal.id,
        name: meal.name,
        recipeUrl: meal.recipeUrl,
        notes: meal.notes,
        isFavourite: meal.isFavourite,
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
        isFavourite: cook.isFavourite,
        cookSpan: cook.cookSpan,
        isLeftover: night > 1,
        cookDate: cook.date,
        night,
      });
    }
    return out;
  }),

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
    return { ok: true };
  }),

  clearDay: protectedProcedure
    .input(z.object({ planId: z.string().uuid(), date: planDateSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertMealPlanAccess(ctx.user.id, input.planId);
      await db
        .delete(mealPlanDay)
        .where(and(eq(mealPlanDay.planId, input.planId), eq(mealPlanDay.date, input.date)));
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
          isFavourite: meal.isFavourite,
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
    const [created] = await db
      .insert(meal)
      .values({
        planId: input.planId,
        name: input.name,
        recipeUrl: sanitizeRecipeUrl(input.recipeUrl),
        notes: input.notes,
        isFavourite: input.isFavourite ?? false,
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
      subject: `You've been invited to a meal plan on ToDoList`,
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
  sendToShoppingList: protectedProcedure
    .input(sendToShoppingListSchema)
    .mutation(async ({ ctx, input }) => {
      await assertMealPlanAccess(ctx.user.id, input.planId);
      const rows = await db
        .select({ name: meal.name })
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

      const listId = await groceriesListId(ctx.user.id);
      const open = await db
        .select({ title: task.title })
        .from(task)
        .where(and(eq(task.listId, listId), isNull(task.completedAt), isNull(task.deletedAt)));
      const already = new Set(open.map((t) => t.title.trim().toLowerCase()));

      const titles: string[] = [];
      for (const r of rows) {
        const key = r.name.trim().toLowerCase();
        if (already.has(key)) continue;
        already.add(key);
        titles.push(r.name.trim());
      }
      if (titles.length === 0) return { listId, added: 0 };

      // A single multi-row insert. The repo inserts one row at a time elsewhere,
      // but a whole week at once is worth the one statement.
      await db
        .insert(task)
        .values(titles.map((title) => ({ listId, title, createdBy: ctx.user.id })));
      return { listId, added: titles.length };
    }),
});
