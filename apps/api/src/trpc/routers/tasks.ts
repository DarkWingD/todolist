import { and, asc, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { db, list, listMember, task, user } from '@todolist/db';
import { createTaskSchema, updateTaskSchema } from '@todolist/shared';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { assertListAccess } from '../access.js';
import { protectedProcedure, router } from '../trpc.js';

// Task columns plus the assignee's identity (nullable).
const taskWithAssignee = {
  id: task.id,
  listId: task.listId,
  title: task.title,
  notes: task.notes,
  dueAt: task.dueAt,
  priority: task.priority,
  completedAt: task.completedAt,
  recurrenceRule: task.recurrenceRule,
  sortOrder: task.sortOrder,
  assigneeId: task.assigneeId,
  assigneeName: user.name,
  assigneeEmoji: user.avatarEmoji,
  assigneeColor: user.avatarColor,
};

export const tasksRouter = router({
  byList: protectedProcedure
    .input(z.object({ listId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertListAccess(ctx.user.id, input.listId);
      return db
        .select(taskWithAssignee)
        .from(task)
        .leftJoin(user, eq(user.id, task.assigneeId))
        .where(and(eq(task.listId, input.listId), isNull(task.deletedAt)))
        .orderBy(asc(task.sortOrder), asc(task.createdAt));
    }),

  // Dated, not-completed tasks up to `until` (the client's local horizon), across
  // the user's lists. Ordered by due date so the client can group into
  // Overdue / Today / Tomorrow / upcoming days in its own timezone.
  agenda: protectedProcedure
    .input(z.object({ until: z.string().datetime() }))
    .query(async ({ ctx, input }) => {
      return db
        .select({ ...taskWithAssignee, listEmoji: list.emojiIcon, listName: list.name })
        .from(task)
        .innerJoin(list, eq(list.id, task.listId))
        .innerJoin(listMember, eq(listMember.listId, list.id))
        .leftJoin(user, eq(user.id, task.assigneeId))
        .where(
          and(
            eq(listMember.userId, ctx.user.id),
            isNull(task.completedAt),
            isNull(task.deletedAt),
            isNotNull(task.dueAt),
            lt(task.dueAt, new Date(input.until)),
          ),
        )
        .orderBy(asc(task.dueAt));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select(taskWithAssignee)
        .from(task)
        .leftJoin(user, eq(user.id, task.assigneeId))
        .where(eq(task.id, input.id))
        .limit(1);
      const found = rows[0];
      if (!found) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertListAccess(ctx.user.id, found.listId);
      return found;
    }),

  // High-priority, not-completed tasks across all the user's lists.
  highPriority: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({ ...taskWithAssignee, listEmoji: list.emojiIcon })
      .from(task)
      .innerJoin(list, eq(list.id, task.listId))
      .innerJoin(listMember, eq(listMember.listId, list.id))
      .leftJoin(user, eq(user.id, task.assigneeId))
      .where(
        and(
          eq(listMember.userId, ctx.user.id),
          eq(task.priority, 'high'),
          isNull(task.completedAt),
          isNull(task.deletedAt),
        ),
      )
      .orderBy(asc(task.dueAt));
  }),

  create: protectedProcedure.input(createTaskSchema).mutation(async ({ ctx, input }) => {
    await assertListAccess(ctx.user.id, input.listId);
    const [created] = await db
      .insert(task)
      .values({
        listId: input.listId,
        title: input.title,
        notes: input.notes,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        priority: input.priority,
        assigneeId: input.assigneeId,
        recurrenceRule: input.recurrenceRule,
        createdBy: ctx.user.id,
      })
      .returning();
    return created;
  }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string().uuid(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db.select({ listId: task.listId }).from(task).where(eq(task.id, input.id)).limit(1);
      const found = rows[0];
      if (!found) return { ok: false };
      await assertListAccess(ctx.user.id, found.listId);
      await db
        .update(task)
        .set({ completedAt: input.completed ? new Date() : null, updatedAt: new Date() })
        .where(eq(task.id, input.id));
      return { ok: true };
    }),

  update: protectedProcedure.input(updateTaskSchema).mutation(async ({ ctx, input }) => {
    const rows = await db.select({ listId: task.listId }).from(task).where(eq(task.id, input.id)).limit(1);
    const found = rows[0];
    if (!found) return { ok: false };
    await assertListAccess(ctx.user.id, found.listId);
    const { id, dueAt, completed, tagIds: _tagIds, ...rest } = input;
    await db
      .update(task)
      .set({
        ...rest,
        ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
        ...(completed !== undefined ? { completedAt: completed ? new Date() : null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(task.id, id));
    return { ok: true };
  }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select({ listId: task.listId })
        .from(task)
        .where(eq(task.id, input.id))
        .limit(1);
      const found = rows[0];
      if (!found) return { ok: false };
      await assertListAccess(ctx.user.id, found.listId);
      await db.update(task).set({ deletedAt: new Date() }).where(eq(task.id, input.id));
      return { ok: true };
    }),
});
