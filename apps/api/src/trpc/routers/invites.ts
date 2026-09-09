import { eq } from 'drizzle-orm';
import {
  db,
  household,
  householdInvite,
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
import { joinHousehold } from '../household.js';
import { logActivity } from '../activity.js';
import { protectedProcedure, router } from '../trpc.js';

/**
 * One invite link handles every kind of shared thing. Tokens are unique across
 * the tables, so a link is looked up in each in turn and the result carries a
 * `kind` the accept screen words itself with.
 */
type Kind = 'list' | 'mealPlan' | 'household';

interface Found {
  kind: Kind;
  id: string;
  targetId: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  expiresAt: Date;
  name: string;
  emoji: string;
  inviterName: string | null;
}

async function findInvite(token: string): Promise<Found | undefined> {
  const [hh] = await db
    .select({
      id: householdInvite.id,
      targetId: householdInvite.householdId,
      status: householdInvite.status,
      expiresAt: householdInvite.expiresAt,
      name: household.name,
      inviterName: user.name,
    })
    .from(householdInvite)
    .innerJoin(household, eq(household.id, householdInvite.householdId))
    .innerJoin(user, eq(user.id, householdInvite.invitedBy))
    .where(eq(householdInvite.token, token))
    .limit(1);
  if (hh) return { kind: 'household', emoji: '🏠', ...hh };

  const [li] = await db
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
  if (li) return { kind: 'list', ...li };

  const [mp] = await db
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
  if (mp) return { kind: 'mealPlan', ...mp };
  return undefined;
}

export const invitesRouter = router({
  info: protectedProcedure.input(acceptInviteSchema).query(async ({ input }) => {
    const inv = await findInvite(input.token);
    if (!inv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite not found' });
    return {
      kind: inv.kind,
      name: inv.name,
      emoji: inv.emoji,
      inviterName: inv.inviterName,
      status: inv.status,
      expired: inv.expiresAt < new Date(),
    };
  }),

  accept: protectedProcedure.input(acceptInviteSchema).mutation(async ({ ctx, input }) => {
    const inv = await findInvite(input.token);
    if (!inv) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite not found' });
    if (inv.status !== 'pending')
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This invite has already been used.' });
    if (inv.expiresAt < new Date())
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'This invite has expired.' });

    if (inv.kind === 'household') {
      try {
        await joinHousehold(ctx.user.id, ctx.person.id, inv.targetId);
      } catch (e) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e instanceof Error ? e.message : 'Couldn’t join this household.',
        });
      }
      await db
        .update(householdInvite)
        .set({ status: 'accepted' })
        .where(eq(householdInvite.id, inv.id));
      await logActivity({
        householdId: inv.targetId,
        actorId: ctx.person.id,
        kind: 'person.joined',
        targetId: ctx.person.id,
        title: ctx.user.name,
      });
      return { kind: 'household' as const, id: inv.targetId };
    }

    if (inv.kind === 'list') {
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
