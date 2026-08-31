import { eq } from 'drizzle-orm';
import { birthday, db, listMember } from '@todolist/db';
import { createBirthdaySchema } from '@todolist/shared';
import { z } from 'zod';
import { assertListAccess } from '../access.js';
import { protectedProcedure, router } from '../trpc.js';

export const birthdaysRouter = router({
  // All birthdays across the user's lists (client computes which fall in view).
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: birthday.id,
        listId: birthday.listId,
        name: birthday.name,
        day: birthday.day,
        month: birthday.month,
        year: birthday.year,
        linkedUserId: birthday.linkedUserId,
      })
      .from(birthday)
      .innerJoin(listMember, eq(listMember.listId, birthday.listId))
      .where(eq(listMember.userId, ctx.user.id));
  }),

  create: protectedProcedure.input(createBirthdaySchema).mutation(async ({ ctx, input }) => {
    await assertListAccess(ctx.user.id, input.listId);
    const [created] = await db
      .insert(birthday)
      .values({
        listId: input.listId,
        name: input.name,
        day: input.day,
        month: input.month,
        year: input.year,
        linkedUserId: input.linkedUserId,
        createdBy: ctx.user.id,
      })
      .returning();
    return created;
  }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select({ listId: birthday.listId })
        .from(birthday)
        .where(eq(birthday.id, input.id))
        .limit(1);
      const found = rows[0];
      if (!found) return { ok: false };
      await assertListAccess(ctx.user.id, found.listId);
      await db.delete(birthday).where(eq(birthday.id, input.id));
      return { ok: true };
    }),
});
