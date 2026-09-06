import { eq } from 'drizzle-orm';
import { db, userPrefs } from '@todolist/db';
import { CALENDAR_VIEWS, DEFAULT_PREFS, userPrefsSchema } from '@todolist/shared';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';

export const prefsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(userPrefs)
      .where(eq(userPrefs.userId, ctx.user.id))
      .limit(1);
    return rows[0] ?? { userId: ctx.user.id, ...DEFAULT_PREFS, calendarView: 'month' as const };
  }),

  setCalendarView: protectedProcedure
    .input(z.object({ view: z.enum(CALENDAR_VIEWS) }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(userPrefs)
        .values({ userId: ctx.user.id, calendarView: input.view })
        .onConflictDoUpdate({
          target: userPrefs.userId,
          set: { calendarView: input.view, updatedAt: new Date() },
        });
      return { ok: true };
    }),

  setNotifications: protectedProcedure
    .input(z.object({ notifyEmail: z.boolean(), notifyPush: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(userPrefs)
        .values({ userId: ctx.user.id, ...input })
        .onConflictDoUpdate({
          target: userPrefs.userId,
          set: { ...input, updatedAt: new Date() },
        });
      return { ok: true };
    }),

  /** Hiding Meals removes the tab, not the plan — the data stays untouched. */
  setMealsVisible: protectedProcedure
    .input(z.object({ showMeals: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(userPrefs)
        .values({ userId: ctx.user.id, showMeals: input.showMeals })
        .onConflictDoUpdate({
          target: userPrefs.userId,
          set: { showMeals: input.showMeals, updatedAt: new Date() },
        });
      return { ok: true };
    }),

  /** 1 = Monday, 0 = Sunday. Applies to the meal week and the calendar alike. */
  setWeekStart: protectedProcedure
    .input(z.object({ weekStartsOn: z.union([z.literal(0), z.literal(1)]) }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(userPrefs)
        .values({ userId: ctx.user.id, weekStartsOn: input.weekStartsOn })
        .onConflictDoUpdate({
          target: userPrefs.userId,
          set: { weekStartsOn: input.weekStartsOn, updatedAt: new Date() },
        });
      return { ok: true };
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
