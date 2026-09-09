import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import {
  childDay,
  childProfile,
  db,
  event,
  list,
  listMember,
  schoolPeriod,
  task,
} from '@todolist/db';
import {
  createChildSchema,
  setChildDaysSchema,
  updateChildProfileSchema,
  upsertSchoolPeriodSchema,
} from '@todolist/shared';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { assertListAccess } from '../access.js';
import { createChild } from '../household.js';
import { protectedProcedure, router } from '../trpc.js';
import { expandEvent } from '../../lib/recurrence.js';

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
function derivedBreaks(
  periods: { kind: 'term' | 'break' | 'closure'; startDate: string; endDate: string }[],
): { startDate: string; endDate: string }[] {
  const terms = periods
    .filter((p) => p.kind === 'term')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const gaps: { startDate: string; endDate: string }[] = [];
  for (let i = 0; i < terms.length - 1; i++) {
    const end = terms[i]!.endDate;
    const next = terms[i + 1]!.startDate;
    const from = shiftDay(end, 1);
    const to = shiftDay(next, -1);
    if (from <= to) gaps.push({ startDate: from, endDate: to });
  }
  return gaps;
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function statusFor(
  periods: {
    kind: 'term' | 'break' | 'closure';
    name: string;
    startDate: string;
    endDate: string;
  }[],
  day: string,
): { attending: boolean; reason: string | null } {
  const all = [
    ...periods,
    ...derivedBreaks(periods).map((g) => ({
      ...g,
      kind: 'break' as const,
      name: 'School holidays',
    })),
  ];
  const covering = all.filter((p) => p.startDate <= day && p.endDate >= day);
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
      db.select().from(schoolPeriod).where(inArray(schoolPeriod.listId, ids)),
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

      const [days, periods, profile, tasks, events] = await Promise.all([
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
        db
          .select({
            id: task.id,
            title: task.title,
            dueAt: task.dueAt,
            completedAt: task.completedAt,
            recurrenceRule: task.recurrenceRule,
            assigneeId: task.assigneeId,
          })
          .from(task)
          .where(and(eq(task.listId, input.listId), isNull(task.deletedAt)))
          .orderBy(asc(task.dueAt), asc(task.sortOrder)),
        db
          .select({
            id: event.id,
            title: event.title,
            startAt: event.startAt,
            endAt: event.endAt,
            allDay: event.allDay,
            recurrenceRule: event.recurrenceRule,
          })
          .from(event)
          .where(and(eq(event.listId, input.listId), isNull(event.deletedAt)))
          .orderBy(asc(event.startAt)),
      ]);

      const day = todayKey();
      const weekday = new Date().getDay();
      const status = statusFor(periods, day);
      const todayDay = days.find((d) => d.weekday === weekday) ?? null;

      return {
        ...row,
        days,
        periods,
        profile: profile[0] ?? null,
        tasks,
        events: (() => {
          const from = new Date();
          from.setHours(0, 0, 0, 0);
          const to = new Date(from);
          to.setDate(to.getDate() + 120);
          return events
            .flatMap((ev) =>
              expandEvent(ev, from, to).map((o) => ({
                ...ev,
                id: o.occurrenceId,
                startAt: o.start,
                endAt: o.end,
              })),
            )
            .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
        })(),
        today: {
          date: day,
          place: status.attending ? (todayDay?.place ?? null) : null,
          startTime: status.attending ? (todayDay?.startTime ?? null) : null,
          endTime: status.attending ? (todayDay?.endTime ?? null) : null,
          offReason: status.attending ? null : status.reason,
        },
      };
    }),

  // A child is a person in the household as well as a list; the helper makes both.
  create: protectedProcedure.input(createChildSchema).mutation(async ({ ctx, input }) => {
    const { list: created } = await createChild(
      { userId: ctx.user.id, householdId: ctx.person.householdId },
      input,
    );
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
