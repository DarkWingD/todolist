import { eq } from 'drizzle-orm';
import { birthday, db, event, list, listMember, task, user, userPrefs } from '@todolist/db';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';

// Small square photo shipped as a data URL (~25KB after client-side resize).
const photoSchema = z
  .string()
  .regex(/^data:image\/(jpeg|png|webp);base64,/, 'Must be an image data URL')
  .max(300_000);

export const accountRouter = router({
  // Set or clear the user's profile photo (null clears back to emoji avatar).
  setPhoto: protectedProcedure
    .input(z.object({ image: photoSchema.nullable() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(user)
        .set({ image: input.image, updatedAt: new Date() })
        .where(eq(user.id, ctx.user.id));
      return { ok: true };
    }),

  // A downloadable copy of everything this user owns/created.
  exportMe: protectedProcedure.query(async ({ ctx }) => {
    const uid = ctx.user.id;
    const [profile] = await db.select().from(user).where(eq(user.id, uid));
    const [prefs] = await db.select().from(userPrefs).where(eq(userPrefs.userId, uid));
    const lists = await db.select().from(list).where(eq(list.ownerId, uid));
    const tasks = await db.select().from(task).where(eq(task.createdBy, uid));
    const events = await db.select().from(event).where(eq(event.createdBy, uid));
    const birthdays = await db.select().from(birthday).where(eq(birthday.createdBy, uid));
    const memberships = await db
      .select({ listId: listMember.listId, role: listMember.role })
      .from(listMember)
      .where(eq(listMember.userId, uid));
    return {
      exportedAt: new Date().toISOString(),
      profile,
      prefs: prefs ?? null,
      lists,
      tasks,
      events,
      birthdays,
      memberships,
    };
  }),

  // Permanently delete the account. FK cascades remove owned lists (and their
  // tasks/events/birthdays), memberships, prefs, and sessions.
  deleteMe: protectedProcedure.mutation(async ({ ctx }) => {
    await db.delete(user).where(eq(user.id, ctx.user.id));
    return { ok: true };
  }),
});
