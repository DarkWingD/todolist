import { and, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import { db, list, listInvite, listMember, task, user } from '@todolist/db';
import { createListSchema, inviteToListSchema } from '@todolist/shared';
import { z } from 'zod';
import { env } from '../../env.js';
import { sendEmail } from '../../email.js';
import { assertListAccess } from '../access.js';
import { protectedProcedure, router } from '../trpc.js';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const listsRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        ...getTableColumns(list),
        remaining: sql<number>`(
          select count(*)::int from ${task}
          where ${task.listId} = ${list.id}
            and ${task.completedAt} is null
            and ${task.deletedAt} is null
        )`,
        memberCount: sql<number>`(
          select count(*)::int from ${listMember} lm where lm.list_id = ${list.id}
        )`,
      })
      .from(list)
      .innerJoin(listMember, eq(listMember.listId, list.id))
      .where(and(eq(listMember.userId, ctx.user.id), isNull(list.deletedAt)))
      .orderBy(list.sortOrder);
  }),

  members: protectedProcedure
    .input(z.object({ listId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertListAccess(ctx.user.id, input.listId);
      return db
        .select({
          id: user.id,
          name: user.name,
          avatarEmoji: user.avatarEmoji,
          avatarColor: user.avatarColor,
          role: listMember.role,
        })
        .from(listMember)
        .innerJoin(user, eq(user.id, listMember.userId))
        .where(eq(listMember.listId, input.listId));
    }),

  create: protectedProcedure.input(createListSchema).mutation(async ({ ctx, input }) => {
    const [created] = await db
      .insert(list)
      .values({
        ownerId: ctx.user.id,
        name: input.name,
        emojiIcon: input.emojiIcon,
        color: input.color,
      })
      .returning();
    if (!created) throw new Error('Failed to create list');
    await db.insert(listMember).values({ listId: created.id, userId: ctx.user.id, role: 'owner' });
    return created;
  }),

  softDelete: protectedProcedure
    .input(z.object({ listId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertListAccess(ctx.user.id, input.listId);
      await db.update(list).set({ deletedAt: new Date() }).where(eq(list.id, input.listId));
      return { ok: true };
    }),

  invite: protectedProcedure.input(inviteToListSchema).mutation(async ({ ctx, input }) => {
    await assertListAccess(ctx.user.id, input.listId);
    const token = crypto.randomUUID();
    await db.insert(listInvite).values({
      listId: input.listId,
      email: input.email,
      token,
      invitedBy: ctx.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    const url = `${env.WEB_ORIGIN}/invite/${token}`;
    await sendEmail({
      to: input.email,
      subject: `You've been invited to a list on ToDoList`,
      text: `Open this link to join the list: ${url}`,
      html: `<p>You've been invited to collaborate on a list.</p><p><a href="${url}">Accept the invite</a></p>`,
    });
    return { ok: true };
  }),
});
