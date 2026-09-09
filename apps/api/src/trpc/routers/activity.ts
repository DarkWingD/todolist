import { and, desc, eq, exists, isNull, or } from 'drizzle-orm';
import { activity, db, list, listMember, person, userPrefs } from '@todolist/db';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';

export const activityRouter = router({
  /**
   * What the household has been doing, newest first. Rows about a list are
   * shown only to that list's members, so a private list stays private.
   * `seenAt` lets the client draw the line between new and already-read.
   */
  recent: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(60) }).default({}))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select({
          id: activity.id,
          kind: activity.kind,
          listId: activity.listId,
          targetId: activity.targetId,
          title: activity.title,
          meta: activity.meta,
          createdAt: activity.createdAt,
          actorId: activity.actorId,
          actorName: person.name,
          actorEmoji: person.avatarEmoji,
          actorColor: person.avatarColor,
          actorImage: person.image,
          listName: list.name,
          listEmoji: list.emojiIcon,
        })
        .from(activity)
        .leftJoin(person, eq(person.id, activity.actorId))
        .leftJoin(list, eq(list.id, activity.listId))
        .where(
          and(
            eq(activity.householdId, ctx.person.householdId),
            or(
              isNull(activity.listId),
              exists(
                db
                  .select({ one: listMember.listId })
                  .from(listMember)
                  .where(
                    and(eq(listMember.listId, activity.listId), eq(listMember.userId, ctx.user.id)),
                  ),
              ),
            ),
          ),
        )
        .orderBy(desc(activity.createdAt))
        .limit(input.limit);
      const prefs = await db
        .select({ seenAt: userPrefs.activitySeenAt })
        .from(userPrefs)
        .where(eq(userPrefs.userId, ctx.user.id))
        .limit(1);
      return {
        me: ctx.person.id,
        seenAt: prefs[0]?.seenAt ?? null,
        items: rows.map((r) => ({
          ...r,
          meta: r.meta ? (JSON.parse(r.meta) as Record<string, unknown>) : null,
          mine: r.actorId === ctx.person.id,
        })),
      };
    }),

  /** "I've looked": everything up to now stops counting as new. */
  markSeen: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date();
    await db
      .insert(userPrefs)
      .values({ userId: ctx.user.id, activitySeenAt: now })
      .onConflictDoUpdate({
        target: userPrefs.userId,
        set: { activitySeenAt: now, updatedAt: now },
      });
    return { seenAt: now };
  }),
});
