import { and, asc, eq } from 'drizzle-orm';
import { db, reminder, task } from '@todolist/db';
import { createReminderSchema } from '@todolist/shared';
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

export const remindersRouter = router({
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
