import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import { db, event, list, listMember } from '@todolist/db';
import { createEventSchema, updateEventSchema } from '@todolist/shared';
import { z } from 'zod';
import { assertListAccess } from '../access.js';
import { logActivity } from '../activity.js';
import { shareListWithHousehold } from '../household.js';
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

/**
 * Find (or create) the household's app-managed Events list.
 *
 * Same systemKey pattern as Birthdays, Reminders and Shopping, with one
 * deliberate difference: those are private and one per user, because what you
 * are reminded of is yours. A family calendar is not. So this is one list per
 * *household*, shared like an ordinary list, which is why the lookup is by
 * householdId rather than ownerId.
 *
 * The unique index is on (ownerId, systemKey), so two adults creating an event
 * at the same moment could each get one. Ordering by createdAt means every
 * later lookup converges on the older of the two rather than flip-flopping;
 * the loser is an empty list nobody can see, since `mine` hides systemKey lists.
 */
export async function eventsListId(householdId: string, userId: string): Promise<string> {
  const rows = await db
    .select({ id: list.id })
    .from(list)
    .where(
      and(eq(list.householdId, householdId), eq(list.systemKey, 'events'), isNull(list.deletedAt)),
    )
    .orderBy(asc(list.createdAt))
    .limit(1);
  if (rows[0]) return rows[0].id;
  const [created] = await db
    .insert(list)
    .values({
      ownerId: userId,
      name: 'Events',
      emojiIcon: '📅',
      systemKey: 'events',
      householdId,
      private: false,
    })
    .returning();
  if (!created) throw new Error('Failed to create the Events list');
  await db.insert(listMember).values({ listId: created.id, userId, role: 'owner' });
  await shareListWithHousehold(created.id, householdId);
  return created.id;
}

export const eventsRouter = router({
  create: protectedProcedure.input(createEventSchema).mutation(async ({ ctx, input }) => {
    // Only a caller-supplied list needs checking. The Events list is resolved
    // from the caller's own household, so there is nothing to authorise.
    if (input.listId) await assertListAccess(ctx.user.id, input.listId);
    const listId = input.listId ?? (await eventsListId(ctx.person.householdId, ctx.user.id));
    const [created] = await db
      .insert(event)
      .values({
        listId,
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
    if (created)
      await logActivity({
        householdId: ctx.person.householdId,
        actorId: ctx.person.id,
        kind: 'event.created',
        listId,
        targetId: created.id,
        title: created.title,
        meta: {
          startAt: created.startAt.toISOString(),
          allDay: created.allDay,
          assigneeId: created.assigneeId,
        },
      });
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
    const [after] = await db
      .select({ title: event.title, startAt: event.startAt, allDay: event.allDay })
      .from(event)
      .where(eq(event.id, seriesId(id)))
      .limit(1);
    if (after)
      await logActivity({
        householdId: ctx.person.householdId,
        actorId: ctx.person.id,
        kind: 'event.updated',
        listId,
        targetId: seriesId(id),
        title: after.title,
        meta: { startAt: after.startAt.toISOString(), allDay: after.allDay },
      });
    return { ok: true };
  }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const listId = await eventListId(input.id);
      if (!listId) return { ok: false };
      await assertListAccess(ctx.user.id, listId);
      const [gone] = await db
        .select({ title: event.title })
        .from(event)
        .where(eq(event.id, seriesId(input.id)))
        .limit(1);
      await db
        .update(event)
        .set({ deletedAt: new Date() })
        .where(eq(event.id, seriesId(input.id)));
      if (gone)
        await logActivity({
          householdId: ctx.person.householdId,
          actorId: ctx.person.id,
          kind: 'event.deleted',
          listId,
          targetId: seriesId(input.id),
          title: gone.title,
        });
      return { ok: true };
    }),
});
