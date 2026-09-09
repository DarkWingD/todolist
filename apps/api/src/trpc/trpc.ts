import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context.js';
import { ensurePerson } from './household.js';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure;

/**
 * Requires an authenticated session; narrows ctx.user to non-null and attaches
 * the user's person and household, creating both on their first request.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  const u = ctx.user as typeof ctx.user & {
    avatarEmoji?: string | null;
    avatarColor?: string | null;
  };
  const person = await ensurePerson({
    id: u.id,
    name: u.name,
    image: u.image,
    avatarEmoji: u.avatarEmoji,
    avatarColor: u.avatarColor,
  });
  return next({ ctx: { ...ctx, user: ctx.user, person } });
});
