import { and, eq } from 'drizzle-orm';
import { db, pushSubscription } from '@todolist/db';
import { pushSubscribeSchema } from '@todolist/shared';
import { z } from 'zod';
import { env } from '../../env.js';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

export const pushRouter = router({
  // The VAPID public key the browser needs to subscribe (null = push disabled).
  publicKey: publicProcedure.query(() => env.VAPID_PUBLIC_KEY ?? null),

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
        .where(and(eq(pushSubscription.endpoint, input.endpoint), eq(pushSubscription.userId, ctx.user.id)));
      return { ok: true };
    }),
});
