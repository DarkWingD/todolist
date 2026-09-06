import { and, asc, eq, inArray, isNull, lte, gte } from 'drizzle-orm';
import { childDay, childProfile, db, list, listMember, schoolPeriod } from '@todolist/db';
import {
  createChildSchema,
  setChildDaysSchema,
  updateChildProfileSchema,
  upsertSchoolPeriodSchema,
} from '@todolist/shared';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { assertListAccess } from '../access.js';
import { protectedProcedure, router } from '../trpc.js';

/** Local calendar day as "YYYY-MM-DD" — never via toISOString, which shifts by UTC. */
function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Refuses anything that isn't a child list the user belongs to. */
async function assertChild(userId: string, listId: string) {
  await assertListAccess(userId, listId);
  const rows = await db
    .select({ type: list.type })
    .from(list)
    .where(and(eq(list.id, listId), isNull(list.deletedAt)))
    .limit(1);
  if (rows[0]?.type !== 'child') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not a child list' });
  }
}

/**
 * What a period means for a given day.
 *
 * A closure beats a term — a pupil-free day sits inside term time and is the
 * whole point of recording it. A break beats a term for the same reason.
 */
function statusFor(
  periods: {
    kind: 'term' | 'break' | 'closure';
    name: string;
    startDate: string;
    endDate: string;
  }[],
  day: string,
): { attending: boolean; reason: string | null } {
  const covering = periods.filter((p) => p.startDate <= day && p.endDate >= day);
  const off =
    covering.find((p) => p.kind === 'closure') ?? covering.find((p) => p.kind === 'break');
  if (off) return { attending: false, reason: off.name };
  const term = covering.find((p) => p.kind === 'term');
  // No terms recorded at all means the pattern is all we have, so trust it
  // rather than claiming everything is a holiday.
  if (term) return { attending: true, reason: term.name };
  return { attending: periods.length === 0, reason: periods.length === 0 ? null : 'Outside term' };
}

export const childrenRouter = router({
  /** Every child the user can see, with where they are today. */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const lists = await db
      .select({
        id: list.id,
        name: list.name,
        emojiIcon: list.emojiIcon,
        color: list.color,
      })
      .from(list)
      .innerJoin(listMember, eq(listMember.listId, list.id))
      .where(
        and(eq(listMember.userId, ctx.user.id), eq(list.type, 'child'), isNull(list.deletedAt)),
      )
      .orderBy(asc(list.sortOrder), asc(list.name));

    if (lists.length === 0) return [];
    const ids = lists.map((l) => l.id);
    const day = todayKey();
    const weekday = new Date().getDay();

    const [days, periods] = await Promise.all([
      db
        .select()
        .from(childDay)
        .where(and(inArray(childDay.listId, ids), eq(childDay.weekday, weekday))),
      db
        .select()
        .from(schoolPeriod)
        .where(
          and(
            inArray(schoolPeriod.listId, ids),
            lte(schoolPeriod.startDate, day),
            gte(schoolPeriod.endDate, day),
          ),
        ),
    ]);

    return lists.map((l) => {
      const today = days.find((d) => d.listId === l.id) ?? null;
      const status = statusFor(
        periods.filter((p) => p.listId === l.id),
        day,
      );
      return {
        ...l,
        // Null place means nowhere scheduled today; null attending means the
        // pattern says somewhere but term dates say otherwise.
        place: status.attending ? (today?.place ?? null) : null,
        startTime: status.attending ? (today?.startTime ?? null) : null,
        endTime: status.attending ? (today?.endTime ?? null) : null,
        offReason: status.attending ? null : status.reason,
      };
    });
  }),

  /** One child, with everything its screen needs. */
  get: protectedProcedure
    .input(z.object({ listId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertChild(ctx.user.id, input.listId);
      const [row] = await db
        .select({
          id: list.id,
          name: list.name,
          emojiIcon: list.emojiIcon,
          color: list.color,
        })
        .from(list)
        .where(eq(list.id, input.listId))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });

      const [days, periods, profile] = await Promise.all([
        db
          .select()
          .from(childDay)
          .where(eq(childDay.listId, input.listId))
          .orderBy(asc(childDay.weekday)),
        db
          .select()
          .from(schoolPeriod)
          .where(eq(schoolPeriod.listId, input.listId))
          .orderBy(asc(schoolPeriod.startDate)),
        db.select().from(childProfile).where(eq(childProfile.listId, input.listId)).limit(1),
      ]);

      return { ...row, days, periods, profile: profile[0] ?? null };
    }),

  create: protectedProcedure.input(createChildSchema).mutation(async ({ ctx, input }) => {
    const [created] = await db
      .insert(list)
      .values({
        ownerId: ctx.user.id,
        name: input.name,
        emojiIcon: input.emojiIcon,
        color: input.color,
        type: 'child',
      })
      .returning();
    if (!created) throw new Error('Failed to create child');
    await db.insert(listMember).values({ listId: created.id, userId: ctx.user.id, role: 'owner' });
    return created;
  }),

  /** Replaces the whole week — see the note on setChildDaysSchema. */
  setDays: protectedProcedure.input(setChildDaysSchema).mutation(async ({ ctx, input }) => {
    await assertChild(ctx.user.id, input.listId);
    await db.delete(childDay).where(eq(childDay.listId, input.listId));
    if (input.days.length > 0) {
      await db.insert(childDay).values(
        input.days.map((d) => ({
          listId: input.listId,
          weekday: d.weekday,
          place: d.place,
          startTime: d.startTime ?? null,
          endTime: d.endTime ?? null,
        })),
      );
    }
    return { ok: true };
  }),

  upsertPeriod: protectedProcedure
    .input(upsertSchoolPeriodSchema)
    .mutation(async ({ ctx, input }) => {
      await assertChild(ctx.user.id, input.listId);
      const { id, listId, ...rest } = input;
      if (id) {
        await db
          .update(schoolPeriod)
          .set(rest)
          .where(and(eq(schoolPeriod.id, id), eq(schoolPeriod.listId, listId)));
        return { ok: true };
      }
      await db.insert(schoolPeriod).values({ listId, ...rest });
      return { ok: true };
    }),

  removePeriod: protectedProcedure
    .input(z.object({ listId: z.string().uuid(), id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertChild(ctx.user.id, input.listId);
      await db
        .delete(schoolPeriod)
        .where(and(eq(schoolPeriod.id, input.id), eq(schoolPeriod.listId, input.listId)));
      return { ok: true };
    }),

  updateProfile: protectedProcedure
    .input(updateChildProfileSchema)
    .mutation(async ({ ctx, input }) => {
      await assertChild(ctx.user.id, input.listId);
      const { listId, ...rest } = input;
      await db
        .insert(childProfile)
        .values({ listId, ...rest })
        .onConflictDoUpdate({
          target: childProfile.listId,
          set: { ...rest, updatedAt: new Date() },
        });
      return { ok: true };
    }),
});
