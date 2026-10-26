import { and, eq } from 'drizzle-orm';
import { db, pushSubscription } from '@todolist/db';
import { pushSubscribeSchema } from '@todolist/shared';
import { z } from 'zod';
import { env } from '../../env.js';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

export const pushRouter = router({
  // The VAPID public key the browser needs to subscribe (null = push disabled).
  publicKey: publicProcedure.query(() => env.VAPID_PUBLIC_KEY ?? null),

  // Whether this person has ever subscribed, on any device — not just this browser's own
  // local memory of it, which an installed Home Screen app on iOS can lose (Safari/WebKit
  // has been known to clear a standalone web app's storage under its own tracking-prevention
  // rules, dropping the "I've already seen the welcome tour" flag and asking for notification
  // permission again every time it happens). The welcome screen checks this first so a wiped
  // flag doesn't repeat the whole tour for someone who already has it working.
  hasSubscribed: protectedProcedure.query(async ({ ctx }) => {
    const row = await db
      .select({ id: pushSubscription.endpoint })
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, ctx.user.id))
      .limit(1);
    return row.length > 0;
  }),

  subscribe: protectedProcedure.input(pushSubscribeSchema).mutation(async ({ ctx, input }) => {
    await db
      .insert(pushSubscription)
      .values({
        userId: ctx.user.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: { userId: ctx.user.id, p256dh: input.p256dh, auth: input.auth },
      });
    return { ok: true };
  }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(pushSubscription)
        .where(
          and(
            eq(pushSubscription.endpoint, input.endpoint),
            eq(pushSubscription.userId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),
});
