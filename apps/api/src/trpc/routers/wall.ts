import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, lte, or } from 'drizzle-orm';
import {
  birthday,
  childDay,
  db,
  event,
  household,
  list,
  mealPlan,
  person,
  personWorkday,
  schoolPeriod,
  task,
  userPrefs,
} from '@todolist/db';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { expandEvent } from '../../lib/recurrence.js';
import { kidsToday, statusFor } from './children.js';
import { doseStatusFor } from './doses.js';
import { readRange } from './mealPlan.js';
import { publicProcedure, router } from '../trpc.js';

const DAY = 86_400_000;

function keyOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Same, but reading the UTC fields — used with the display-offset shift below. */
function keyOfUtc(d: Date): string {
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

function weekParity(anchor: string, day: string): 0 | 1 {
  const a = Date.parse(`${anchor}T00:00:00Z`);
  const d = Date.parse(`${day}T00:00:00Z`);
  const weeks = Math.floor((d - a) / (7 * DAY));
  return (((weeks % 2) + 2) % 2) as 0 | 1;
}

/**
 * Everything a wall display shows, in one call, for a household identified by
 * its wall token rather than a sign-in. Private lists are left out: the wall
 * is the family's, not one person's.
 */
export const wallRouter = router({
  snapshot: publicProcedure
    .input(
      z.object({
        token: z.string().min(16).max(64),
        // The display's local midnight, so "today" is its today, not the server's.
        dayStart: z.string().datetime(),
        // The display's own calendar date for `dayStart`. Without it the server
        // names the day in ITS timezone: the API container runs UTC, so an
        // Australian local midnight (Tue 00:00 = Mon 14:00Z) was being labelled
        // Monday — "today" was a day behind for everyone east of UTC.
        dayKey: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        // Optional override. Left out — which is the normal case, since the
        // display has no session to read a preference from — the household's
        // own setting is used, so a family on Sunday weeks gets one here too.
        weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
      }),
    )
    .query(async ({ input }) => {
      const [hh] = await db
        .select({
          id: household.id,
          name: household.name,
          anchor: household.fortnightAnchor,
          createdBy: household.createdBy,
        })
        .from(household)
        .where(eq(household.wallToken, input.token))
        .limit(1);
      if (!hh) throw new TRPCError({ code: 'NOT_FOUND', message: 'No display with that link.' });

      // Whoever set the household up stands in for it: the wall has no session,
      // so without this the fridge shows a Monday week to a household that
      // chose Sunday everywhere else.
      let weekStartsOn = input.weekStartsOn;
      if (weekStartsOn === undefined && hh.createdBy) {
        const [p] = await db
          .select({ weekStartsOn: userPrefs.weekStartsOn })
          .from(userPrefs)
          .where(eq(userPrefs.userId, hh.createdBy))
          .limit(1);
        weekStartsOn = (p?.weekStartsOn ?? 1) as 0 | 1;
      }
      weekStartsOn ??= 1;

      const dayStart = new Date(input.dayStart);
      const dayEnd = new Date(dayStart.getTime() + DAY);
      // Shift every instant so that the display's local midnight sits on UTC
      // midnight; then UTC formatting yields the display's own calendar day,
      // whatever timezone this server happens to run in. Falls back to the old
      // server-local behaviour when an older client sends no dayKey.
      const shiftMs = input.dayKey
        ? Date.parse(`${input.dayKey}T00:00:00Z`) - dayStart.getTime()
        : 0;
      const localKey = (d: Date) => (shiftMs ? keyOfUtc(new Date(d.getTime() + shiftMs)) : keyOf(d));
      const localDow = (d: Date) =>
        shiftMs ? new Date(d.getTime() + shiftMs).getUTCDay() : d.getDay();
      const todayKey = localKey(dayStart);
      const dow = localDow(dayStart);
      const back = (dow - weekStartsOn + 7) % 7;
      const weekStart = new Date(dayStart.getTime() - back * DAY);
      const weekEnd = new Date(weekStart.getTime() + 7 * DAY);
      const aheadEnd = new Date(dayStart.getTime() + 22 * DAY);

      const lists = await db
        .select({
          id: list.id,
          name: list.name,
          emojiIcon: list.emojiIcon,
          color: list.color,
          type: list.type,
        })
        .from(list)
        .where(and(eq(list.householdId, hh.id), eq(list.private, false), isNull(list.deletedAt)));
      const listIds = lists.map((l) => l.id);
      const childLists = lists.filter((l) => l.type === 'child');

      const people = await db
        .select({
          id: person.id,
          kind: person.kind,
          name: person.name,
          avatarEmoji: person.avatarEmoji,
          avatarColor: person.avatarColor,
          childListId: person.childListId,
          note: person.note,
        })
        .from(person)
        .where(eq(person.householdId, hh.id))
        .orderBy(asc(person.kind), asc(person.createdAt));
      const kids = people.filter((p) => p.kind === 'child');
      const kidIds = new Set(kids.map((k) => k.id));
      const childListIds = new Set(childLists.map((l) => l.id));

      // ── where the grown-ups are ──
      const adults = people.filter((p) => p.kind === 'adult');
      const work = adults.length
        ? await db
            .select()
            .from(personWorkday)
            .where(
              inArray(
                personWorkday.personId,
                adults.map((a) => a.id),
              ),
            )
        : [];
      const offOn = (d: Date) => {
        const parity = weekParity(hh.anchor, localKey(d));
        return adults.filter((a) => {
          const mine = work.filter((w) => w.personId === a.id);
          if (mine.length === 0) return false;
          const fortnightly = mine.some((w) => w.week === 1);
          return !mine.some(
            (w) => w.weekday === localDow(d) && w.week === (fortnightly ? parity : 0),
          );
        });
      };
      // Every adult is returned, not only those with a work week: a screen that
      // silently omits a parent cannot answer "where is everyone". `hasSchedule`
      // separates "no work today" (a real day off) from "we were never told" —
      // without it an unconfigured adult reads as permanently off.
      const grownUps = adults.map((a) => {
        const mine = work.filter((w) => w.personId === a.id);
        const fortnightly = mine.some((w) => w.week === 1);
        const today = mine.find(
          (w) => w.weekday === dow && w.week === (fortnightly ? weekParity(hh.anchor, todayKey) : 0),
        );
        return {
          id: a.id,
          name: a.name,
          avatarEmoji: a.avatarEmoji,
          avatarColor: a.avatarColor,
          place: today?.place ?? null,
          startTime: today?.startTime ?? null,
          endTime: today?.endTime ?? null,
          off: !today,
          hasSchedule: mine.length > 0,
          note: a.note,
        };
      });

      // ── events across the week and the kids' three weeks ──
      const evRows = listIds.length
        ? await db
            .select({
              id: event.id,
              listId: event.listId,
              title: event.title,
              startAt: event.startAt,
              endAt: event.endAt,
              allDay: event.allDay,
              recurrenceRule: event.recurrenceRule,
              assigneeId: event.assigneeId,
              emoji: event.emoji,
            })
            .from(event)
            .where(
              and(
                inArray(event.listId, listIds),
                isNull(event.deletedAt),
                or(
                  and(lt(event.startAt, aheadEnd), gte(event.endAt, weekStart)),
                  isNotNull(event.recurrenceRule),
                ),
              ),
            )
        : [];
      const occurrences = evRows.flatMap((ev) =>
        expandEvent(ev, weekStart, aheadEnd).map((o) => ({
          id: o.occurrenceId,
          listId: ev.listId,
          title: ev.title,
          startAt: o.start,
          endAt: o.end,
          allDay: ev.allDay,
          assigneeId: ev.assigneeId,
          emoji: ev.emoji,
          who: people.find((p) => p.id === ev.assigneeId)?.name.split(' ')[0] ?? null,
          forKid:
            (ev.assigneeId !== null && kidIds.has(ev.assigneeId)) || childListIds.has(ev.listId),
        })),
      );
      occurrences.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

      // ── tasks: due this week, overdue, and the kids' jobs ──
      const taskRows = listIds.length
        ? await db
            .select({
              id: task.id,
              listId: task.listId,
              title: task.title,
              dueAt: task.dueAt,
              priority: task.priority,
              completedAt: task.completedAt,
              assigneeId: task.assigneeId,
            })
            .from(task)
            .where(
              and(
                inArray(task.listId, listIds),
                isNull(task.deletedAt),
                or(
                  and(isNotNull(task.dueAt), lt(task.dueAt, weekEnd), isNull(task.completedAt)),
                  and(isNotNull(task.dueAt), gte(task.dueAt, dayStart), lt(task.dueAt, dayEnd)),
                  and(isNotNull(task.assigneeId), isNull(task.completedAt)),
                ),
              ),
            )
            .orderBy(asc(task.dueAt))
        : [];
      const listById = new Map(lists.map((l) => [l.id, l]));
      const isShopping = (t: { listId: string }) => listById.get(t.listId)?.type === 'checklist';
      const dueToday = taskRows.filter(
        (t) =>
          t.dueAt && t.dueAt < dayEnd && !isShopping(t) && (!t.completedAt || t.dueAt >= dayStart),
      );
      const weekTasks = taskRows.filter(
        (t) =>
          t.dueAt && t.dueAt >= weekStart && t.dueAt < weekEnd && !t.completedAt && !isShopping(t),
      );
      const kidJobs = kids.map((k) => ({
        id: k.id,
        name: k.name,
        avatarEmoji: k.avatarEmoji,
        jobs: taskRows
          .filter((t) => t.assigneeId === k.id && !t.completedAt && !isShopping(t))
          .slice(0, 5)
          .map((t) => ({ id: t.id, title: t.title, done: false })),
      }));

      // ── birthdays this week, dinner tonight, kids today, school days off ──
      const bdays = listIds.length
        ? await db
            .select({
              id: birthday.id,
              name: birthday.name,
              day: birthday.day,
              month: birthday.month,
              year: birthday.year,
            })
            .from(birthday)
            .where(inArray(birthday.listId, listIds))
        : [];
      const [plan] = await db
        .select({ id: mealPlan.id })
        .from(mealPlan)
        .where(and(eq(mealPlan.householdId, hh.id), isNull(mealPlan.deletedAt)))
        .orderBy(asc(mealPlan.createdAt))
        .limit(1);
      const dinner = plan ? ((await readRange(plan.id, todayKey, todayKey))[0] ?? null) : null;
      const kidsWhere = await kidsToday(childLists, { dayKey: todayKey, weekday: dow });
      const doses = await doseStatusFor(
        hh.id,
        kids.map((k) => k.id),
      );
      const periods = childLists.length
        ? await db
            .select({
              listId: schoolPeriod.listId,
              kind: schoolPeriod.kind,
              name: schoolPeriod.name,
              startDate: schoolPeriod.startDate,
              endDate: schoolPeriod.endDate,
            })
            .from(schoolPeriod)
            .where(
              and(
                inArray(
                  schoolPeriod.listId,
                  childLists.map((l) => l.id),
                ),
                lte(schoolPeriod.startDate, localKey(aheadEnd)),
                gte(schoolPeriod.endDate, todayKey),
              ),
            )
        : [];

      // The children's weekly pattern (which weekday each is at daycare/kindy/school),
      // so the week view can show it — not just today's column. Crossed per-date with
      // term dates below, so a holiday week shows no attendance.
      const childDays = childLists.length
        ? await db
            .select({
              listId: childDay.listId,
              weekday: childDay.weekday,
              place: childDay.place,
              emoji: childDay.emoji,
            })
            .from(childDay)
            .where(
              inArray(
                childDay.listId,
                childLists.map((l) => l.id),
              ),
            )
        : [];
      const childListById = new Map(childLists.map((l) => [l.id, l]));

      const week = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart.getTime() + i * DAY);
        const e = new Date(d.getTime() + DAY);
        return {
          date: localKey(d),
          isToday: localKey(d) === todayKey,
          // Who is where on this weekday (daycare/kindy/school), if term is running.
          school: childDays.flatMap((cd) => {
            if (cd.weekday !== localDow(d)) return [];
            if (!statusFor(periods.filter((p) => p.listId === cd.listId), localKey(d)).attending) {
              return [];
            }
            const l = childListById.get(cd.listId);
            if (!l) return [];
            return [
              {
                id: `${cd.listId}:${cd.weekday}`,
                name: l.name.split(' ')[0],
                // The place's own emoji (🏫 daycare) is the glanceable one; fall
                // back to the child's icon until one is set.
                emoji: cd.emoji ?? l.emojiIcon,
                place: cd.place,
              },
            ];
          }),
          off: offOn(d).map((a) => ({
            id: a.id,
            name: a.name.split(' ')[0],
            avatarEmoji: a.avatarEmoji,
          })),
          events: occurrences
            .filter((o) => o.startAt < e && o.endAt >= d)
            .map((o) => ({
              id: o.id,
              title: o.title,
              emoji: o.emoji,
              time: o.allDay ? null : o.startAt.toISOString(),
              who: o.who,
              forKid: o.forKid,
            })),
          tasks: weekTasks
            .filter((t) => t.dueAt && t.dueAt >= d && t.dueAt < e)
            .map((t) => ({ id: t.id, title: t.title })),
          birthdays: bdays
            .filter((b) => b.month === d.getMonth() + 1 && b.day === d.getDate())
            .map((b) => ({
              id: b.id,
              name: b.name,
              age: b.year ? d.getFullYear() - b.year : null,
            })),
        };
      });

      return {
        household: hh.name,
        generatedAt: new Date().toISOString(),
        grownUps,
        kids: kidsWhere.map((k) => ({
          id: k.id,
          name: k.name,
          emojiIcon: k.emojiIcon,
          // Keys this child's colour across the whole display, so "whose is it"
          // is answerable without reading any text.
          color: k.color,
          place: k.place,
          startTime: k.startTime,
          endTime: k.endTime,
          offReason: k.offReason,
          doses: doses
            .filter((d) => d.personId === people.find((p) => p.childListId === k.id)?.id)
            .map((d) => ({
              medicine: d.medicine,
              givenAt: d.givenAt.toISOString(),
              nextFrom: d.nextFrom ? d.nextFrom.toISOString() : null,
            })),
        })),
        today: {
          events: occurrences
            .filter((o) => o.startAt < dayEnd && o.endAt >= dayStart)
            .map((o) => ({
              id: o.id,
              title: o.title,
              emoji: o.emoji,
              time: o.allDay ? null : o.startAt.toISOString(),
              who: o.who,
            })),
          birthdays: week.find((d) => d.isToday)?.birthdays ?? [],
          dinner: dinner
            ? { name: dinner.name, leftover: dinner.isLeftover, night: dinner.night }
            : null,
          due: dueToday.map((t) => ({
            id: t.id,
            title: t.title,
            done: Boolean(t.completedAt),
            overdue: Boolean(t.dueAt && t.dueAt < dayStart),
          })),
        },
        week,
        kidsAhead: [
          ...occurrences
            .filter((o) => o.forKid && o.startAt >= dayEnd && o.startAt < aheadEnd)
            .map((o) => ({
              id: o.id,
              date: localKey(o.startAt),
              title: o.title,
              who: o.who,
              time: o.allDay ? null : o.startAt.toISOString(),
              endDate: null as string | null,
            })),
          ...periods
            .filter((p) => p.kind !== 'term')
            .map((p) => ({
              id: `${p.listId}:${p.startDate}`,
              date: p.startDate < todayKey ? todayKey : p.startDate,
              title: p.name,
              who: people.find((k) => k.childListId === p.listId)?.name.split(' ')[0] ?? null,
              time: null,
              endDate: p.endDate,
            })),
        ]
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 8),
        kidJobs,
      };
    }),
});
