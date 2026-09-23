import { eq } from 'drizzle-orm';
import { birthday, db, event, list, listMember, person, task, user, userPrefs } from '@todolist/db';
import { z } from 'zod';
import { photoSchema } from '@todolist/shared';
import { protectedProcedure, router } from '../trpc.js';

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
  /**
   * Your own display name, emoji and colour.
   *
   * Written to the ACCOUNT first and the person row to match. That order matters:
   * ensurePerson() copies the account's name onto the person on every request, so
   * updating only the person would be silently reverted on the next page load.
   *
   * Names exist at all because a magic-link signup carries none — auth.ts falls
   * back to the email's local part, which is how people end up called "dan-w".
   */
  setProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(80).optional(),
        emojiIcon: z.string().min(1).max(24).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch: {
        name?: string;
        avatarEmoji?: string;
        avatarColor?: string;
        updatedAt: Date;
      } = { updatedAt: new Date() };
      if (input.name !== undefined) patch.name = input.name;
      if (input.emojiIcon !== undefined) patch.avatarEmoji = input.emojiIcon;
      if (input.color !== undefined) patch.avatarColor = input.color;
      await db.update(user).set(patch).where(eq(user.id, ctx.user.id));
      await db.update(person).set(patch).where(eq(person.id, ctx.person.id));
      return { ok: true };
    }),

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
