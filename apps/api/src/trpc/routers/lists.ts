import { and, eq, getTableColumns, isNotNull, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, list, listInvite, listMember, task, user } from '@todolist/db';
import { createListSchema, inviteToListSchema, updateListSchema } from '@todolist/shared';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { env } from '../../env.js';
import { sendEmail } from '../../email.js';
import { assertListAccess } from '../access.js';
import { groceriesListId } from './mealPlan.js';
import { remindersListId } from './reminders.js';
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
      .where(
        and(eq(listMember.userId, ctx.user.id), isNull(list.deletedAt), isNull(list.systemKey)),
      )
      .orderBy(list.sortOrder);
  }),

  // The user's always-there Reminders system list (created on first read), with
  // the same computed counts as `mine` so it can render as a pinned list card.
  reminders: protectedProcedure.query(async ({ ctx }) => {
    const id = await remindersListId(ctx.user.id);
    const rows = await db
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
      .where(eq(list.id, id))
      .limit(1);
    return rows[0]!;
  }),

  // The app-managed Shopping list, resolved exactly as Reminders is. Without
  // this it is unreachable: `mine` hides every list carrying a systemKey, so the
  // list "Send week to shopping list" writes into appeared nowhere in the UI.
  shopping: protectedProcedure.query(async ({ ctx }) => {
    const id = await groceriesListId(ctx.user.id);
    const rows = await db
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
      .where(eq(list.id, id))
      .limit(1);
    return rows[0]!;
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
          image: user.image,
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
        type: input.type,
      })
      .returning();
    if (!created) throw new Error('Failed to create list');
    await db.insert(listMember).values({ listId: created.id, userId: ctx.user.id, role: 'owner' });
    return created;
  }),

  update: protectedProcedure.input(updateListSchema).mutation(async ({ ctx, input }) => {
    await assertListAccess(ctx.user.id, input.listId);
    const { listId, ...rest } = input;
    await db
      .update(list)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(list.id, listId));
    return { ok: true };
  }),

  softDelete: protectedProcedure
    .input(z.object({ listId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertListAccess(ctx.user.id, input.listId);
      // Built-in lists can only be hidden, never deleted. This guard is the one
      // that matters: the get-or-create helpers filter on `deletedAt`, so a
      // deleted system list would come straight back as a duplicate with the
      // original's tasks stranded in the deleted row.
      const rows = await db
        .select({ systemKey: list.systemKey })
        .from(list)
        .where(eq(list.id, input.listId))
        .limit(1);
      const found = rows[0];
      if (!found) return { ok: false };
      if (found.systemKey)
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Built-in lists can be hidden but not deleted.',
        });
      await db.update(list).set({ deletedAt: new Date() }).where(eq(list.id, input.listId));
      return { ok: true };
    }),

  // Show or tuck away a built-in list. Display only — a hidden Shopping list
  // still receives meal-plan ingredients, and hidden Reminders still reach Today.
  setHidden: protectedProcedure
    .input(z.object({ listId: z.string().uuid(), hidden: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertListAccess(ctx.user.id, input.listId);
      const rows = await db
        .select({ systemKey: list.systemKey })
        .from(list)
        .where(eq(list.id, input.listId))
        .limit(1);
      const found = rows[0];
      if (!found) return { ok: false };
      if (!found.systemKey)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only built-in lists can be hidden.',
        });
      await db
        .update(list)
        .set({ hidden: input.hidden, updatedAt: new Date() })
        .where(eq(list.id, input.listId));
      return { ok: true };
    }),

  // Every built-in list the user owns, with the same counts as `mine`, so the
  // Manage lists screen can offer a show/hide switch for each. Birthdays is
  // created lazily, so it simply won't appear until something uses it.
  system: protectedProcedure.query(async ({ ctx }) => {
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
      .where(and(eq(list.ownerId, ctx.user.id), isNotNull(list.systemKey), isNull(list.deletedAt)))
      .orderBy(list.systemKey);
  }),

  // Directly add someone you already share a list with — no email round-trip.
  // Note: Better Auth user ids aren't uuids, so plain string here.
  addMember: protectedProcedure
    .input(z.object({ listId: z.string().uuid(), userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertListAccess(ctx.user.id, input.listId);
      const mine = alias(listMember, 'lm_mine');
      const theirs = alias(listMember, 'lm_theirs');
      const shared = await db
        .select({ listId: mine.listId })
        .from(mine)
        .innerJoin(theirs, eq(theirs.listId, mine.listId))
        .where(and(eq(mine.userId, ctx.user.id), eq(theirs.userId, input.userId)))
        .limit(1);
      if (shared.length === 0)
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only add people who already share a list with you.',
        });
      await db
        .insert(listMember)
        .values({ listId: input.listId, userId: input.userId, role: 'member' })
        .onConflictDoNothing();
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
