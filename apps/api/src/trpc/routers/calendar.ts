import { and, eq, gte, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { db, event, list, listMember, task, user } from '@todolist/db';
import { calendarRangeSchema } from '@todolist/shared';
import { protectedProcedure, router } from '../trpc.js';
import { expandEvent } from '../../lib/recurrence.js';

const withAssignee = {
  assigneeId: task.assigneeId,
  assigneeName: user.name,
  assigneeEmoji: user.avatarEmoji,
  assigneeColor: user.avatarColor,
  assigneeImage: user.image,
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
      .leftJoin(user, eq(user.id, task.assigneeId))
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
        assigneeName: user.name,
        assigneeEmoji: user.avatarEmoji,
        assigneeColor: user.avatarColor,
      })
      .from(event)
      .innerJoin(list, eq(list.id, event.listId))
      .innerJoin(listMember, eq(listMember.listId, list.id))
      .leftJoin(user, eq(user.id, event.assigneeId))
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

  // The set of people across the user's lists — used for the calendar filter chips.
  people: protectedProcedure.query(async ({ ctx }) => {
    const listRows = await db
      .select({ id: listMember.listId })
      .from(listMember)
      .where(eq(listMember.userId, ctx.user.id));
    const listIds = listRows.map((r) => r.id);
    if (listIds.length === 0) return [];
    return db
      .selectDistinct({
        id: user.id,
        name: user.name,
        avatarEmoji: user.avatarEmoji,
        avatarColor: user.avatarColor,
        image: user.image,
      })
      .from(listMember)
      .innerJoin(user, eq(user.id, listMember.userId))
      .where(inArray(listMember.listId, listIds));
  }),
});
