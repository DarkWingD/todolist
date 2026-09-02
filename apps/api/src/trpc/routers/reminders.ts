import { and, asc, eq, isNull } from 'drizzle-orm';
import { db, list, listMember, reminder, task } from '@todolist/db';
import { createReminderSchema, quickAddReminderSchema } from '@todolist/shared';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { assertListAccess } from '../access.js';
import { protectedProcedure, router } from '../trpc.js';

async function assertTaskAccess(userId: string, taskId: string) {
  const rows = await db.select({ listId: task.listId }).from(task).where(eq(task.id, taskId)).limit(1);
  const found = rows[0];
  if (!found) throw new TRPCError({ code: 'NOT_FOUND' });
  await assertListAccess(userId, found.listId);
}

// Find (or create) the user's always-there Reminders list (mirrors the Birthdays pattern).
export async function remindersListId(userId: string): Promise<string> {
  const rows = await db
    .select({ id: list.id })
    .from(list)
    .where(and(eq(list.ownerId, userId), eq(list.systemKey, 'reminders'), isNull(list.deletedAt)))
    .limit(1);
  if (rows[0]) return rows[0].id;
  const [created] = await db
    .insert(list)
    .values({ ownerId: userId, name: 'Reminders', emojiIcon: '⏰', systemKey: 'reminders' })
    .returning();
  await db.insert(listMember).values({ listId: created!.id, userId, role: 'owner' });
  return created!.id;
}

export const remindersRouter = router({
  // One-step capture into the Reminders list: task due at the remind time + a
  // reminder at that time, so it shows on Today and actually notifies.
  quickAdd: protectedProcedure.input(quickAddReminderSchema).mutation(async ({ ctx, input }) => {
    const listId = await remindersListId(ctx.user.id);
    const at = new Date(input.remindAt);
    const [created] = await db
      .insert(task)
      .values({ listId, title: input.title, dueAt: at, createdBy: ctx.user.id })
      .returning();
    await db
      .insert(reminder)
      .values({ taskId: created!.id, userId: ctx.user.id, sendAt: at, channel: 'email' });
    return created;
  }),

  byTask: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertTaskAccess(ctx.user.id, input.taskId);
      return db
        .select()
        .from(reminder)
        .where(and(eq(reminder.taskId, input.taskId), eq(reminder.userId, ctx.user.id)))
        .orderBy(asc(reminder.sendAt));
    }),

  create: protectedProcedure.input(createReminderSchema).mutation(async ({ ctx, input }) => {
    await assertTaskAccess(ctx.user.id, input.taskId);
    const [created] = await db
      .insert(reminder)
      .values({
        taskId: input.taskId,
        userId: ctx.user.id,
        sendAt: new Date(input.sendAt),
        channel: input.channel,
      })
      .returning();
    return created;
  }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(reminder)
        .where(and(eq(reminder.id, input.id), eq(reminder.userId, ctx.user.id)));
      return { ok: true };
    }),
});
