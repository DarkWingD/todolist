import { eq } from 'drizzle-orm';
import {
  db,
  list,
  listInvite,
  listMember,
  mealPlan,
  mealPlanInvite,
  mealPlanMember,
  user,
} from '@todolist/db';
import { acceptInviteSchema } from '@todolist/shared';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../trpc.js';

/**
 * One invite link handles both kinds of shared thing. Tokens are unique across
 * both tables, so a link is looked up in each in turn and the result carries a
 * `kind` the accept screen words itself with.
 */
async function findListInvite(token: string) {
  const rows = await db
    .select({
      id: listInvite.id,
      targetId: listInvite.listId,
      status: listInvite.status,
      expiresAt: listInvite.expiresAt,
      name: list.name,
      emoji: list.emojiIcon,
      inviterName: user.name,
    })
    .from(listInvite)
    .innerJoin(list, eq(list.id, listInvite.listId))
    .innerJoin(user, eq(user.id, listInvite.invitedBy))
    .where(eq(listInvite.token, token))
    .limit(1);
  return rows[0];
}

async function findMealPlanInvite(token: string) {
  const rows = await db
    .select({
      id: mealPlanInvite.id,
      targetId: mealPlanInvite.planId,
      status: mealPlanInvite.status,
      expiresAt: mealPlanInvite.expiresAt,
      name: mealPlan.name,
      emoji: mealPlan.emojiIcon,
      inviterName: user.name,
    })
    .from(mealPlanInvite)
    .innerJoin(mealPlan, eq(mealPlan.id, mealPlanInvite.planId))
    .innerJoin(user, eq(user.id, mealPlanInvite.invitedBy))
    .where(eq(mealPlanInvite.token, token))
    .limit(1);
  return rows[0];
}

export const invitesRouter = router({
  info: protectedProcedure.input(acceptInviteSchema).query(async ({ input }) => {
    const listInv = await findListInvite(input.token);
    const inv = listInv ?? (await findMealPlanInvite(input.token));
    if (!inv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite not found' });
    return {
      kind: listInv ? ('list' as const) : ('mealPlan' as const),
      name: inv.name,
      emoji: inv.emoji,
      inviterName: inv.inviterName,
      status: inv.status,
      expired: inv.expiresAt < new Date(),
    };
  }),

  accept: protectedProcedure.input(acceptInviteSchema).mutation(async ({ ctx, input }) => {
    const listInv = await findListInvite(input.token);
    const inv = listInv ?? (await findMealPlanInvite(input.token));
    if (!inv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite not found' });
    if (inv.status !== 'pending')
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This invite has already been used.' });
    if (inv.expiresAt < new Date())
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This invite has expired.' });

    if (listInv) {
      await db
        .insert(listMember)
        .values({ listId: inv.targetId, userId: ctx.user.id, role: 'member' })
        .onConflictDoNothing();
      await db.update(listInvite).set({ status: 'accepted' }).where(eq(listInvite.id, inv.id));
      return { kind: 'list' as const, id: inv.targetId };
    }

    await db
      .insert(mealPlanMember)
      .values({ planId: inv.targetId, userId: ctx.user.id, role: 'member' })
      .onConflictDoNothing();
    await db
      .update(mealPlanInvite)
      .set({ status: 'accepted' })
      .where(eq(mealPlanInvite.id, inv.id));
    return { kind: 'mealPlan' as const, id: inv.targetId };
  }),
});
