import { and, eq, isNull, ne } from 'drizzle-orm';
import { db, household, list, listMember, mealPlan, mealPlanMember, person } from '@todolist/db';

/** What the signed-in user looks like to the household model. */
export interface Me {
  id: string;
  name: string;
  image?: string | null;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
}

export interface PersonCtx {
  id: string;
  householdId: string;
}

/**
 * Every signed-in user has a person row in some household. Accounts made
 * before the household model, or created since by a magic link, get one here
 * on their first request. The adult's name and avatar are copied from the
 * account whenever they drift, so profile edits made through Better Auth show
 * up wherever a person is drawn.
 */
export async function ensurePerson(me: Me): Promise<PersonCtx> {
  const rows = await db
    .select({
      id: person.id,
      householdId: person.householdId,
      name: person.name,
      avatarEmoji: person.avatarEmoji,
      avatarColor: person.avatarColor,
      image: person.image,
    })
    .from(person)
    .where(eq(person.userId, me.id))
    .limit(1);
  const found = rows[0];
  const emoji = me.avatarEmoji ?? '🙂';
  const color = me.avatarColor ?? '#8B5CF6';
  const image = me.image ?? null;

  if (found) {
    if (
      found.name !== me.name ||
      found.avatarEmoji !== emoji ||
      found.avatarColor !== color ||
      found.image !== image
    ) {
      await db
        .update(person)
        .set({
          name: me.name,
          avatarEmoji: emoji,
          avatarColor: color,
          image,
          updatedAt: new Date(),
        })
        .where(eq(person.id, found.id));
    }
    return { id: found.id, householdId: found.householdId };
  }

  const [hh] = await db.insert(household).values({ createdBy: me.id }).returning();
  const [created] = await db
    .insert(person)
    .values({
      householdId: hh!.id,
      userId: me.id,
      kind: 'adult',
      name: me.name,
      avatarEmoji: emoji,
      avatarColor: color,
      image,
    })
    .returning();
  return { id: created!.id, householdId: hh!.id };
}

/** The accounts of every adult in a household. */
export async function householdUserIds(householdId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: person.userId })
    .from(person)
    .where(and(eq(person.householdId, householdId), eq(person.kind, 'adult')));
  return rows.map((r) => r.userId).filter((id): id is string => Boolean(id));
}

/**
 * Give every adult in the household a membership row on a list. Existing rows
 * (the owner's, anyone added by hand) are left alone.
 */
export async function shareListWithHousehold(listId: string, householdId: string) {
  const userIds = await householdUserIds(householdId);
  if (userIds.length === 0) return;
  await db
    .insert(listMember)
    .values(userIds.map((userId) => ({ listId, userId, role: 'member' as const })))
    .onConflictDoNothing();
}

/**
 * Making a list private takes it back from the household. The person doing it
 * keeps their seat; so does anyone from outside the household who was invited
 * by hand, since the household never put them there.
 */
export async function unshareListFromHousehold(
  listId: string,
  householdId: string,
  keepUserId: string,
) {
  const userIds = (await householdUserIds(householdId)).filter((id) => id !== keepUserId);
  for (const userId of userIds) {
    await db
      .delete(listMember)
      .where(and(eq(listMember.listId, listId), eq(listMember.userId, userId)));
  }
}

/** Give one account a seat on everything the household shares. */
export async function shareHouseholdWithUser(householdId: string, userId: string) {
  const lists = await db
    .select({ id: list.id })
    .from(list)
    .where(and(eq(list.householdId, householdId), eq(list.private, false), isNull(list.deletedAt)));
  if (lists.length > 0) {
    await db
      .insert(listMember)
      .values(lists.map((l) => ({ listId: l.id, userId, role: 'member' as const })))
      .onConflictDoNothing();
  }
  const plans = await db
    .select({ id: mealPlan.id })
    .from(mealPlan)
    .where(and(eq(mealPlan.householdId, householdId), isNull(mealPlan.deletedAt)));
  if (plans.length > 0) {
    await db
      .insert(mealPlanMember)
      .values(plans.map((p) => ({ planId: p.id, userId, role: 'member' as const })))
      .onConflictDoNothing();
  }
}

/**
 * Move a user (and the children in their household) into another household.
 *
 * Only allowed while their current household has no other adult — merging two
 * real families is not a thing this app does. Their own lists come along but
 * turn private, so joining never exposes anything they hadn't already shared;
 * they can open each one up afterwards. Their meal plan comes along as-is.
 */
export async function joinHousehold(userId: string, personId: string, targetId: string) {
  const mine = await db
    .select({ householdId: person.householdId })
    .from(person)
    .where(eq(person.id, personId))
    .limit(1);
  const fromId = mine[0]?.householdId;
  if (!fromId || fromId === targetId) return { moved: false };

  const otherAdults = await db
    .select({ id: person.id })
    .from(person)
    .where(and(eq(person.householdId, fromId), eq(person.kind, 'adult'), ne(person.id, personId)))
    .limit(1);
  if (otherAdults.length > 0) {
    throw new Error('You’re already in a household with other people.');
  }

  await db.transaction(async (tx) => {
    await tx.update(person).set({ householdId: targetId }).where(eq(person.householdId, fromId));
    await tx
      .update(list)
      .set({ householdId: targetId, private: true })
      .where(eq(list.householdId, fromId));
    await tx
      .update(mealPlan)
      .set({ householdId: targetId })
      .where(eq(mealPlan.householdId, fromId));
    await tx.delete(household).where(eq(household.id, fromId));
  });
  await shareHouseholdWithUser(targetId, userId);
  return { moved: true };
}

/**
 * A child is a person plus a child list (their week, terms and profile). The
 * list is shared with the household like any other, so both parents see it.
 */
export async function createChild(
  me: { userId: string; householdId: string },
  input: { name: string; emojiIcon: string; color?: string | null },
) {
  const [created] = await db
    .insert(list)
    .values({
      ownerId: me.userId,
      name: input.name,
      emojiIcon: input.emojiIcon,
      color: input.color ?? undefined,
      type: 'child',
      householdId: me.householdId,
    })
    .returning();
  if (!created) throw new Error('Failed to create child');
  await db.insert(listMember).values({ listId: created.id, userId: me.userId, role: 'owner' });
  await shareListWithHousehold(created.id, me.householdId);
  const [kid] = await db
    .insert(person)
    .values({
      householdId: me.householdId,
      kind: 'child',
      name: input.name,
      avatarEmoji: input.emojiIcon,
      avatarColor: input.color ?? '#F59E0B',
      childListId: created.id,
    })
    .returning();
  return { list: created, person: kid! };
}
