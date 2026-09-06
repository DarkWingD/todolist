import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import { db, event } from '@todolist/db';
import { createEventSchema, updateEventSchema } from '@todolist/shared';
import { z } from 'zod';
import { assertListAccess } from '../access.js';
import { protectedProcedure, router } from '../trpc.js';

/**
 * An occurrence of a recurring event is identified as "<seriesId>:<startISO>",
 * because the occurrence itself has no row. Editing or deleting one edits the
 * series — which is what people mean by changing a weekly lesson — so the id is
 * normalised here rather than trusting every caller to send the right half.
 */
export function seriesId(id: string): string {
  const cut = id.indexOf(':');
  return cut === -1 ? id : id.slice(0, cut);
}

async function eventListId(id: string): Promise<string | null> {
  const rows = await db
    .select({ listId: event.listId })
    .from(event)
    .where(eq(event.id, seriesId(id)))
    .limit(1);
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
        recurrenceRule: input.recurrenceRule,
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
        .where(
          and(eq(event.listId, input.listId), isNull(event.deletedAt), gte(event.endAt, cutoff)),
        )
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
      .where(eq(event.id, seriesId(id)));
    return { ok: true };
  }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const listId = await eventListId(input.id);
      if (!listId) return { ok: false };
      await assertListAccess(ctx.user.id, listId);
      await db
        .update(event)
        .set({ deletedAt: new Date() })
        .where(eq(event.id, seriesId(input.id)));
      return { ok: true };
    }),
});
