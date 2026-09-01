import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import { db, event } from '@todolist/db';
import { createEventSchema, updateEventSchema } from '@todolist/shared';
import { z } from 'zod';
import { assertListAccess } from '../access.js';
import { protectedProcedure, router } from '../trpc.js';

async function eventListId(id: string): Promise<string | null> {
  const rows = await db.select({ listId: event.listId }).from(event).where(eq(event.id, id)).limit(1);
  return rows[0]?.listId ?? null;
}

export const eventsRouter = router({
  create: protectedProcedure.input(createEventSchema).mutation(async ({ ctx, input }) => {
    await assertListAccess(ctx.user.id, input.listId);
    const [created] = await db
      .insert(event)
      .values({
        listId: input.listId,
        title: input.title,
        notes: input.notes,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        allDay: input.allDay,
        assigneeId: input.assigneeId,
        createdBy: ctx.user.id,
      })
      .returning();
    return created;
  }),

  // Upcoming (and currently running) events for a list.
  byList: protectedProcedure
    .input(z.object({ listId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertListAccess(ctx.user.id, input.listId);
      // -24h so "today's" events show regardless of the user's timezone offset.
      const cutoff = new Date(Date.now() - 86_400_000);
      return db
        .select()
        .from(event)
        .where(and(eq(event.listId, input.listId), isNull(event.deletedAt), gte(event.endAt, cutoff)))
        .orderBy(asc(event.startAt));
    }),

  update: protectedProcedure.input(updateEventSchema).mutation(async ({ ctx, input }) => {
    const listId = await eventListId(input.id);
    if (!listId) return { ok: false };
    await assertListAccess(ctx.user.id, listId);
    if (input.listId && input.listId !== listId) await assertListAccess(ctx.user.id, input.listId);
    const { id, startAt, endAt, ...rest } = input;
    await db
      .update(event)
      .set({
        ...rest,
        ...(startAt !== undefined ? { startAt: new Date(startAt) } : {}),
        ...(endAt !== undefined ? { endAt: new Date(endAt) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(event.id, id));
    return { ok: true };
  }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const listId = await eventListId(input.id);
      if (!listId) return { ok: false };
      await assertListAccess(ctx.user.id, listId);
      await db.update(event).set({ deletedAt: new Date() }).where(eq(event.id, input.id));
      return { ok: true };
    }),
});
