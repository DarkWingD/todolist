import { and, eq, gte, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { db, event, list, listMember, task, user } from '@todolist/db';
import { calendarRangeSchema } from '@todolist/shared';
import { protectedProcedure, router } from '../trpc.js';

const withAssignee = {
  assigneeId: task.assigneeId,
  assigneeName: user.name,
  assigneeEmoji: user.avatarEmoji,
  assigneeColor: user.avatarColor,
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
          lt(event.startAt, to),
          gte(event.endAt, from),
        ),
      );

    return { tasks, events };
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
      })
      .from(listMember)
      .innerJoin(user, eq(user.id, listMember.userId))
      .where(inArray(listMember.listId, listIds));
  }),
});
