import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, household, householdInvite, list, person, personWorkday, user } from '@todolist/db';
import {
  addChildSchema,
  inviteToHouseholdSchema,
  renameHouseholdSchema,
  setWorkWeekSchema,
  updatePersonSchema,
} from '@todolist/shared';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { env } from '../../env.js';
import { sendEmail } from '../../email.js';
import { createChild } from '../household.js';
import { logActivity } from '../activity.js';
import { protectedProcedure, router } from '../trpc.js';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/** Local calendar day as "YYYY-MM-DD". */
function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 0 in the week that starts on the anchor (and every other week after), 1 between. */
function weekParity(anchor: string, day: string): 0 | 1 {
  const a = Date.parse(`${anchor}T00:00:00Z`);
  const d = Date.parse(`${day}T00:00:00Z`);
  const weeks = Math.floor((d - a) / (7 * 86_400_000));
  return (((weeks % 2) + 2) % 2) as 0 | 1;
}

async function assertHouseholdPerson(householdId: string, personId: string) {
  const rows = await db
    .select({ id: person.id, kind: person.kind })
    .from(person)
    .where(and(eq(person.id, personId), eq(person.householdId, householdId)))
    .limit(1);
  if (!rows[0]) throw new TRPCError({ code: 'NOT_FOUND' });
  return rows[0];
}

export const householdRouter = router({
  /** The family: its name, and everyone in it, adults first. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const [hh] = await db
      .select({ id: household.id, name: household.name })
      .from(household)
      .where(eq(household.id, ctx.person.householdId))
      .limit(1);
    const people = await db
      .select({
        id: person.id,
        kind: person.kind,
        name: person.name,
        avatarEmoji: person.avatarEmoji,
        avatarColor: person.avatarColor,
        image: person.image,
        userId: person.userId,
        childListId: person.childListId,
        email: user.email,
      })
      .from(person)
      .leftJoin(user, eq(user.id, person.userId))
      .where(eq(person.householdId, ctx.person.householdId))
      .orderBy(asc(person.kind), asc(person.createdAt));
    const pending = await db
      .select({ id: householdInvite.id, email: householdInvite.email })
      .from(householdInvite)
      .where(
        and(
          eq(householdInvite.householdId, ctx.person.householdId),
          eq(householdInvite.status, 'pending'),
        ),
      );
    return {
      id: hh?.id ?? ctx.person.householdId,
      name: hh?.name ?? 'Family',
      me: ctx.person.id,
      people,
      pendingInvites: pending.filter((i) => i.email),
    };
  }),

  rename: protectedProcedure.input(renameHouseholdSchema).mutation(async ({ ctx, input }) => {
    await db
      .update(household)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(household.id, ctx.person.householdId));
    return { ok: true };
  }),

  /** Ask another adult in. One link; accepting it joins everything shared. */
  invite: protectedProcedure.input(inviteToHouseholdSchema).mutation(async ({ ctx, input }) => {
    const token = crypto.randomUUID();
    await db.insert(householdInvite).values({
      householdId: ctx.person.householdId,
      email: input.email,
      token,
      invitedBy: ctx.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    const url = `${env.WEB_ORIGIN}/invite/${token}`;
    await sendEmail({
      to: input.email,
      subject: `${ctx.user.name} invited you to their family on Sorted`,
      text: `Open this link to join: ${url}`,
      html: `<p>${ctx.user.name} has invited you to join their family on Sorted — shared lists, the calendar, the meal plan and the kids' weeks, all in one place.</p><p><a href="${url}">Accept the invite</a></p>`,
    });
    return { ok: true };
  }),

  addChild: protectedProcedure.input(addChildSchema).mutation(async ({ ctx, input }) => {
    const { person: kid, list: created } = await createChild(
      { userId: ctx.user.id, householdId: ctx.person.householdId },
      input,
    );
    await logActivity({
      householdId: ctx.person.householdId,
      actorId: ctx.person.id,
      kind: 'child.added',
      targetId: kid.id,
      title: kid.name,
      meta: { emoji: kid.avatarEmoji, color: kid.avatarColor, listId: created.id },
    });
    return { personId: kid.id, listId: created.id };
  }),

  /**
   * Rename or re-colour a child. Adults edit themselves through their account;
   * their person row follows automatically.
   */
  updatePerson: protectedProcedure.input(updatePersonSchema).mutation(async ({ ctx, input }) => {
    const rows = await db
      .select({ kind: person.kind, childListId: person.childListId })
      .from(person)
      .where(and(eq(person.id, input.id), eq(person.householdId, ctx.person.householdId)))
      .limit(1);
    const found = rows[0];
    if (!found) throw new TRPCError({ code: 'NOT_FOUND' });
    if (found.kind !== 'child')
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Adults change their own name and avatar under Account.',
      });
    const patch: Partial<typeof person.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.emojiIcon !== undefined) patch.avatarEmoji = input.emojiIcon;
    if (input.color !== undefined) patch.avatarColor = input.color ?? '#F59E0B';
    await db.update(person).set(patch).where(eq(person.id, input.id));
    // The child's list wears the same name, icon and colour.
    if (found.childListId) {
      const listPatch: Partial<typeof list.$inferInsert> = { updatedAt: new Date() };
      if (input.name !== undefined) listPatch.name = input.name;
      if (input.emojiIcon !== undefined) listPatch.emojiIcon = input.emojiIcon;
      if (input.color !== undefined) listPatch.color = input.color;
      await db.update(list).set(listPatch).where(eq(list.id, found.childListId));
    }
    return { ok: true };
  }),

  /** An adult's working pattern, plus which week the fortnight is on right now. */
  workWeek: protectedProcedure
    .input(z.object({ personId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertHouseholdPerson(ctx.person.householdId, input.personId);
      const [hh] = await db
        .select({ anchor: household.fortnightAnchor })
        .from(household)
        .where(eq(household.id, ctx.person.householdId))
        .limit(1);
      const [p] = await db
        .select({ note: person.note })
        .from(person)
        .where(eq(person.id, input.personId))
        .limit(1);
      const days = await db
        .select({
          week: personWorkday.week,
          weekday: personWorkday.weekday,
          place: personWorkday.place,
          startTime: personWorkday.startTime,
          endTime: personWorkday.endTime,
        })
        .from(personWorkday)
        .where(eq(personWorkday.personId, input.personId));
      const anchor = hh?.anchor ?? '2026-01-05';
      return {
        days,
        note: p?.note ?? null,
        fortnightly: days.some((d) => d.week === 1),
        currentWeek: weekParity(anchor, todayKey()),
      };
    }),

  /** Replace the whole pattern. Anyone in the household can set anyone's: a partner usually knows. */
  setWorkWeek: protectedProcedure.input(setWorkWeekSchema).mutation(async ({ ctx, input }) => {
    await assertHouseholdPerson(ctx.person.householdId, input.personId);
    await db.transaction(async (tx) => {
      await tx.delete(personWorkday).where(eq(personWorkday.personId, input.personId));
      const rows = input.days
        .filter((d) => input.fortnightly || d.week === 0)
        .map((d) => ({
          personId: input.personId,
          week: d.week,
          weekday: d.weekday,
          place: d.place,
          startTime: d.startTime ?? null,
          endTime: d.endTime ?? null,
        }));
      if (rows.length > 0) await tx.insert(personWorkday).values(rows);
      if (input.note !== undefined)
        await tx
          .update(person)
          .set({ note: input.note, updatedAt: new Date() })
          .where(eq(person.id, input.personId));
    });
    return { ok: true };
  }),

  /** "This is actually week B": move the anchor a week so A and B swap for everyone. */
  swapFortnight: protectedProcedure.mutation(async ({ ctx }) => {
    const [hh] = await db
      .select({ anchor: household.fortnightAnchor })
      .from(household)
      .where(eq(household.id, ctx.person.householdId))
      .limit(1);
    const cur = Date.parse(`${hh?.anchor ?? '2026-01-05'}T00:00:00Z`);
    const next = new Date(cur + 7 * 86_400_000).toISOString().slice(0, 10);
    await db
      .update(household)
      .set({ fortnightAnchor: next, updatedAt: new Date() })
      .where(eq(household.id, ctx.person.householdId));
    return { ok: true };
  }),

  /**
   * Where each grown-up is today. Only adults with a pattern are listed; a day
   * with no row is a day off. Feeds Today's "Where everyone is".
   */
  whereToday: protectedProcedure.query(async ({ ctx }) => {
    const [hh] = await db
      .select({ anchor: household.fortnightAnchor })
      .from(household)
      .where(eq(household.id, ctx.person.householdId))
      .limit(1);
    const day = todayKey();
    const week = weekParity(hh?.anchor ?? '2026-01-05', day);
    const weekday = new Date().getDay();
    const adults = await db
      .select({
        id: person.id,
        name: person.name,
        avatarEmoji: person.avatarEmoji,
        avatarColor: person.avatarColor,
        image: person.image,
        note: person.note,
        userId: person.userId,
      })
      .from(person)
      .where(and(eq(person.householdId, ctx.person.householdId), eq(person.kind, 'adult')))
      .orderBy(asc(person.createdAt));
    if (adults.length === 0) return [];
    const rows = await db
      .select()
      .from(personWorkday)
      .where(
        inArray(
          personWorkday.personId,
          adults.map((a) => a.id),
        ),
      );
    return adults
      .filter((a) => rows.some((r) => r.personId === a.id))
      .map((a) => {
        const fortnightly = rows.some((r) => r.personId === a.id && r.week === 1);
        const today = rows.find(
          (r) =>
            r.personId === a.id && r.weekday === weekday && r.week === (fortnightly ? week : 0),
        );
        return {
          ...a,
          place: today?.place ?? null,
          startTime: today?.startTime ?? null,
          endTime: today?.endTime ?? null,
          off: !today,
        };
      });
  }),

  /** Every grown-up's pattern at once, for shading the calendar. */
  workPatterns: protectedProcedure.query(async ({ ctx }) => {
    const [hh] = await db
      .select({ anchor: household.fortnightAnchor })
      .from(household)
      .where(eq(household.id, ctx.person.householdId))
      .limit(1);
    const adults = await db
      .select({
        id: person.id,
        name: person.name,
        avatarEmoji: person.avatarEmoji,
        avatarColor: person.avatarColor,
        userId: person.userId,
      })
      .from(person)
      .where(and(eq(person.householdId, ctx.person.householdId), eq(person.kind, 'adult')))
      .orderBy(asc(person.createdAt));
    if (adults.length === 0) return { anchor: hh?.anchor ?? '2026-01-05', adults: [] };
    const rows = await db
      .select({
        personId: personWorkday.personId,
        week: personWorkday.week,
        weekday: personWorkday.weekday,
      })
      .from(personWorkday)
      .where(
        inArray(
          personWorkday.personId,
          adults.map((a) => a.id),
        ),
      );
    return {
      anchor: hh?.anchor ?? '2026-01-05',
      adults: adults
        .filter((a) => rows.some((r) => r.personId === a.id))
        .map((a) => {
          const mine = rows.filter((r) => r.personId === a.id);
          return {
            ...a,
            fortnightly: mine.some((r) => r.week === 1),
            days: mine.map((r) => ({ week: r.week, weekday: r.weekday })),
          };
        }),
    };
  }),

  /** The wall display's link, made on first ask. */
  wallLink: protectedProcedure.query(async ({ ctx }) => {
    const [hh] = await db
      .select({ token: household.wallToken })
      .from(household)
      .where(eq(household.id, ctx.person.householdId))
      .limit(1);
    let token = hh?.token ?? null;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, '');
      await db
        .update(household)
        .set({ wallToken: token, updatedAt: new Date() })
        .where(eq(household.id, ctx.person.householdId));
    }
    return { url: `${env.WEB_ORIGIN}/wall?token=${token}` };
  }),

  /** A new link; the old one stops working. */
  rotateWallToken: protectedProcedure.mutation(async ({ ctx }) => {
    const token = crypto.randomUUID().replace(/-/g, '');
    await db
      .update(household)
      .set({ wallToken: token, updatedAt: new Date() })
      .where(eq(household.id, ctx.person.householdId));
    return { url: `${env.WEB_ORIGIN}/wall?token=${token}` };
  }),

  /** Remove a child. Their list is put away, not destroyed; tasks they held stay, unassigned. */
  removePerson: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select({ kind: person.kind, childListId: person.childListId })
        .from(person)
        .where(and(eq(person.id, input.id), eq(person.householdId, ctx.person.householdId)))
        .limit(1);
      const found = rows[0];
      if (!found) throw new TRPCError({ code: 'NOT_FOUND' });
      if (found.kind !== 'child')
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'An adult leaves by deleting their account.',
        });
      if (found.childListId)
        await db.update(list).set({ deletedAt: new Date() }).where(eq(list.id, found.childListId));
      await db.delete(person).where(eq(person.id, input.id));
      return { ok: true };
    }),
});
