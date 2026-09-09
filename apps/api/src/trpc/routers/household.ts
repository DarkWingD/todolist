import { and, asc, eq } from 'drizzle-orm';
import { db, household, householdInvite, list, person, user } from '@todolist/db';
import {
  addChildSchema,
  inviteToHouseholdSchema,
  renameHouseholdSchema,
  updatePersonSchema,
} from '@todolist/shared';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { env } from '../../env.js';
import { sendEmail } from '../../email.js';
import { createChild } from '../household.js';
import { logActivity } from '../activity.js';
import { protectedProcedure, router } from '../trpc.js';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const householdRouter = router({
  /** The family: its name, and everyone in it, adults first. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const [hh] = await db
      .select({ id: household.id, name: household.name })
      .from(household)
      .where(eq(household.id, ctx.person.householdId))
      .limit(1);
    const people = await db
      .select({
        id: person.id,
        kind: person.kind,
        name: person.name,
        avatarEmoji: person.avatarEmoji,
        avatarColor: person.avatarColor,
        image: person.image,
        userId: person.userId,
        childListId: person.childListId,
        email: user.email,
      })
      .from(person)
      .leftJoin(user, eq(user.id, person.userId))
      .where(eq(person.householdId, ctx.person.householdId))
      .orderBy(asc(person.kind), asc(person.createdAt));
    const pending = await db
      .select({ id: householdInvite.id, email: householdInvite.email })
      .from(householdInvite)
      .where(
        and(
          eq(householdInvite.householdId, ctx.person.householdId),
          eq(householdInvite.status, 'pending'),
        ),
      );
    return {
      id: hh?.id ?? ctx.person.householdId,
      name: hh?.name ?? 'Family',
      me: ctx.person.id,
      people,
      pendingInvites: pending.filter((i) => i.email),
    };
  }),

  rename: protectedProcedure.input(renameHouseholdSchema).mutation(async ({ ctx, input }) => {
    await db
      .update(household)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(household.id, ctx.person.householdId));
    return { ok: true };
  }),

  /** Ask another adult in. One link; accepting it joins everything shared. */
  invite: protectedProcedure.input(inviteToHouseholdSchema).mutation(async ({ ctx, input }) => {
    const token = crypto.randomUUID();
    await db.insert(householdInvite).values({
      householdId: ctx.person.householdId,
      email: input.email,
      token,
      invitedBy: ctx.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    const url = `${env.WEB_ORIGIN}/invite/${token}`;
    await sendEmail({
      to: input.email,
      subject: `${ctx.user.name} invited you to their family on Sorted`,
      text: `Open this link to join: ${url}`,
      html: `<p>${ctx.user.name} has invited you to join their family on Sorted — shared lists, the calendar, the meal plan and the kids' weeks, all in one place.</p><p><a href="${url}">Accept the invite</a></p>`,
    });
    return { ok: true };
  }),

  addChild: protectedProcedure.input(addChildSchema).mutation(async ({ ctx, input }) => {
    const { person: kid, list: created } = await createChild(
      { userId: ctx.user.id, householdId: ctx.person.householdId },
      input,
    );
    await logActivity({
      householdId: ctx.person.householdId,
      actorId: ctx.person.id,
      kind: 'child.added',
      targetId: kid.id,
      title: kid.name,
      meta: { emoji: kid.avatarEmoji, color: kid.avatarColor, listId: created.id },
    });
    return { personId: kid.id, listId: created.id };
  }),

  /**
   * Rename or re-colour a child. Adults edit themselves through their account;
   * their person row follows automatically.
   */
  updatePerson: protectedProcedure.input(updatePersonSchema).mutation(async ({ ctx, input }) => {
    const rows = await db
      .select({ kind: person.kind, childListId: person.childListId })
      .from(person)
      .where(and(eq(person.id, input.id), eq(person.householdId, ctx.person.householdId)))
      .limit(1);
    const found = rows[0];
    if (!found) throw new TRPCError({ code: 'NOT_FOUND' });
    if (found.kind !== 'child')
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Adults change their own name and avatar under Account.',
      });
    const patch: Partial<typeof person.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.emojiIcon !== undefined) patch.avatarEmoji = input.emojiIcon;
    if (input.color !== undefined) patch.avatarColor = input.color ?? '#F59E0B';
    await db.update(person).set(patch).where(eq(person.id, input.id));
    // The child's list wears the same name, icon and colour.
    if (found.childListId) {
      const listPatch: Partial<typeof list.$inferInsert> = { updatedAt: new Date() };
      if (input.name !== undefined) listPatch.name = input.name;
      if (input.emojiIcon !== undefined) listPatch.emojiIcon = input.emojiIcon;
      if (input.color !== undefined) listPatch.color = input.color;
      await db.update(list).set(listPatch).where(eq(list.id, found.childListId));
    }
    return { ok: true };
  }),

  /** Remove a child. Their list is put away, not destroyed; tasks they held stay, unassigned. */
  removePerson: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select({ kind: person.kind, childListId: person.childListId })
        .from(person)
        .where(and(eq(person.id, input.id), eq(person.householdId, ctx.person.householdId)))
        .limit(1);
      const found = rows[0];
      if (!found) throw new TRPCError({ code: 'NOT_FOUND' });
      if (found.kind !== 'child')
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'An adult leaves by deleting their account.',
        });
      if (found.childListId)
        await db.update(list).set({ deletedAt: new Date() }).where(eq(list.id, found.childListId));
      await db.delete(person).where(eq(person.id, input.id));
      return { ok: true };
    }),
});
