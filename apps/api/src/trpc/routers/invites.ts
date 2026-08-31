import { eq } from 'drizzle-orm';
import { db, list, listInvite, listMember, user } from '@todolist/db';
import { acceptInviteSchema } from '@todolist/shared';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../trpc.js';

export const invitesRouter = router({
  info: protectedProcedure.input(acceptInviteSchema).query(async ({ input }) => {
    const rows = await db
      .select({
        listId: listInvite.listId,
        status: listInvite.status,
        expiresAt: listInvite.expiresAt,
        listName: list.name,
        listEmoji: list.emojiIcon,
        inviterName: user.name,
      })
      .from(listInvite)
      .innerJoin(list, eq(list.id, listInvite.listId))
      .innerJoin(user, eq(user.id, listInvite.invitedBy))
      .where(eq(listInvite.token, input.token))
      .limit(1);
    const inv = rows[0];
    if (!inv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite not found' });
    return { ...inv, expired: inv.expiresAt < new Date() };
  }),

  accept: protectedProcedure.input(acceptInviteSchema).mutation(async ({ ctx, input }) => {
    const rows = await db.select().from(listInvite).where(eq(listInvite.token, input.token)).limit(1);
    const inv = rows[0];
    if (!inv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite not found' });
    if (inv.status !== 'pending')
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This invite has already been used.' });
    if (inv.expiresAt < new Date())
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This invite has expired.' });

    await db
      .insert(listMember)
      .values({ listId: inv.listId, userId: ctx.user.id, role: 'member' })
      .onConflictDoNothing();
    await db.update(listInvite).set({ status: 'accepted' }).where(eq(listInvite.id, inv.id));
    return { listId: inv.listId };
  }),
});
