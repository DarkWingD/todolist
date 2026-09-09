import { and, asc, eq, gte, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { db, event, list, listMember, person, task } from '@todolist/db';
import { calendarRangeSchema } from '@todolist/shared';
import { protectedProcedure, router } from '../trpc.js';
import { expandEvent } from '../../lib/recurrence.js';

const withAssignee = {
  assigneeId: task.assigneeId,
  assigneeName: person.name,
  assigneeEmoji: person.avatarEmoji,
  assigneeColor: person.avatarColor,
  assigneeImage: person.image,
};

export const calendarRouter = router({
  // Dated tasks + events overlapping [from, to) across all the user's lists.
  range: protectedProcedure.input(calendarRangeSchema).query(async ({ ctx, input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);

    const tasks = await db
      .select({
        id: task.id,
        listId: task.listId,
        title: task.title,
        dueAt: task.dueAt,
        completedAt: task.completedAt,
        recurrenceRule: task.recurrenceRule,
        listEmoji: list.emojiIcon,
        listColor: list.color,
        ...withAssignee,
      })
      .from(task)
      .innerJoin(list, eq(list.id, task.listId))
      .innerJoin(listMember, eq(listMember.listId, list.id))
      .leftJoin(person, eq(person.id, task.assigneeId))
      .where(
        and(
          eq(listMember.userId, ctx.user.id),
          isNull(task.deletedAt),
          isNotNull(task.dueAt),
          gte(task.dueAt, from),
          lt(task.dueAt, to),
        ),
      );

    const events = await db
      .select({
        id: event.id,
        listId: event.listId,
        title: event.title,
        notes: event.notes,
        startAt: event.startAt,
        endAt: event.endAt,
        allDay: event.allDay,
        recurrenceRule: event.recurrenceRule,
        listColor: list.color,
        assigneeId: event.assigneeId,
        assigneeName: person.name,
        assigneeEmoji: person.avatarEmoji,
        assigneeColor: person.avatarColor,
      })
      .from(event)
      .innerJoin(list, eq(list.id, event.listId))
      .innerJoin(listMember, eq(listMember.listId, list.id))
      .leftJoin(person, eq(person.id, event.assigneeId))
      .where(
        and(
          eq(listMember.userId, ctx.user.id),
          isNull(event.deletedAt),
          or(
            and(lt(event.startAt, to), gte(event.endAt, from)),
            // Recurring series are filtered by expansion below, not by date:
            // a weekly lesson that began in February belongs in September.
            isNotNull(event.recurrenceRule),
          ),
        ),
      );

    // One row becomes many occurrences, each carrying the series it came from.
    const expanded = events.flatMap((ev) =>
      expandEvent(ev, from, to).map((o) => ({
        ...ev,
        id: o.occurrenceId,
        seriesId: ev.id,
        startAt: o.start,
        endAt: o.end,
      })),
    );

    return { tasks, events: expanded };
  }),

  // Everyone in the household, kids included: the calendar's filter chips and
  // every "who is this for" picker. userId lets a birthday linked to an
  // account find its person's colour.
  people: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: person.id,
        kind: person.kind,
        userId: person.userId,
        name: person.name,
        avatarEmoji: person.avatarEmoji,
        avatarColor: person.avatarColor,
        image: person.image,
      })
      .from(person)
      .where(eq(person.householdId, ctx.person.householdId))
      .orderBy(asc(person.kind), asc(person.createdAt));
  }),
});
