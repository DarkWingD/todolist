import { eq } from 'drizzle-orm';
import { db, userPrefs } from '@todolist/db';
import { DEFAULT_PREFS, userPrefsSchema } from '@todolist/shared';
import { protectedProcedure, router } from '../trpc.js';

export const prefsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.select().from(userPrefs).where(eq(userPrefs.userId, ctx.user.id)).limit(1);
    return rows[0] ?? { userId: ctx.user.id, ...DEFAULT_PREFS };
  }),

  update: protectedProcedure.input(userPrefsSchema).mutation(async ({ ctx, input }) => {
    await db
      .insert(userPrefs)
      .values({ userId: ctx.user.id, ...input })
      .onConflictDoUpdate({
        target: userPrefs.userId,
        set: { ...input, updatedAt: new Date() },
      });
    return { ok: true };
  }),
});
