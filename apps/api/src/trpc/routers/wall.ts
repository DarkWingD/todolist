import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, lte, or } from 'drizzle-orm';
import {
  birthday,
  db,
  event,
  household,
  list,
  mealPlan,
  person,
  personWorkday,
  schoolPeriod,
  task,
} from '@todolist/db';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { expandEvent } from '../../lib/recurrence.js';
import { kidsToday } from './children.js';
import { readRange } from './mealPlan.js';
import { publicProcedure, router } from '../trpc.js';

const DAY = 86_400_000;

function keyOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
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
        // 1 = Monday, 0 = Sunday, matching the household's calendar preference.
        weekStartsOn: z.union([z.literal(0), z.literal(1)]).default(1),
      }),
    )
    .query(async ({ input }) => {
      const [hh] = await db
        .select({ id: household.id, name: household.name, anchor: household.fortnightAnchor })
        .from(household)
        .where(eq(household.wallToken, input.token))
        .limit(1);
      if (!hh) throw new TRPCError({ code: 'NOT_FOUND', message: 'No display with that link.' });

      const dayStart = new Date(input.dayStart);
      const dayEnd = new Date(dayStart.getTime() + DAY);
      const todayKey = keyOf(dayStart);
      const dow = dayStart.getDay();
      const back = (dow - input.weekStartsOn + 7) % 7;
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
        const parity = weekParity(hh.anchor, keyOf(d));
        return adults.filter((a) => {
          const mine = work.filter((w) => w.personId === a.id);
          if (mine.length === 0) return false;
          const fortnightly = mine.some((w) => w.week === 1);
          return !mine.some(
            (w) => w.weekday === d.getDay() && w.week === (fortnightly ? parity : 0),
          );
        });
      };
      const grownUps = adults
        .filter((a) => work.some((w) => w.personId === a.id))
        .map((a) => {
          const mine = work.filter((w) => w.personId === a.id);
          const fortnightly = mine.some((w) => w.week === 1);
          const today = mine.find(
            (w) =>
              w.weekday === dow && w.week === (fortnightly ? weekParity(hh.anchor, todayKey) : 0),
          );
          return {
            id: a.id,
            name: a.name,
            avatarEmoji: a.avatarEmoji,
            place: today?.place ?? null,
            startTime: today?.startTime ?? null,
            endTime: today?.endTime ?? null,
            off: !today,
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
      const kidsWhere = await kidsToday(childLists);
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
                lte(schoolPeriod.startDate, keyOf(aheadEnd)),
                gte(schoolPeriod.endDate, todayKey),
              ),
            )
        : [];

      const week = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart.getTime() + i * DAY);
        const e = new Date(d.getTime() + DAY);
        return {
          date: keyOf(d),
          isToday: keyOf(d) === todayKey,
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
          place: k.place,
          startTime: k.startTime,
          endTime: k.endTime,
          offReason: k.offReason,
        })),
        today: {
          events: occurrences
            .filter((o) => o.startAt < dayEnd && o.endAt >= dayStart)
            .map((o) => ({
              id: o.id,
              title: o.title,
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
              date: keyOf(o.startAt),
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
