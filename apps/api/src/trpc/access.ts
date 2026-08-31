import { and, eq } from 'drizzle-orm';
import { db, listMember } from '@todolist/db';
import { TRPCError } from '@trpc/server';

/** Throws FORBIDDEN unless the user is a member (or owner) of the list. */
export async function assertListAccess(userId: string, listId: string) {
  const rows = await db
    .select({ role: listMember.role })
    .from(listMember)
    .where(and(eq(listMember.listId, listId), eq(listMember.userId, userId)))
    .limit(1);
  const membership = rows[0];
  if (!membership) throw new TRPCError({ code: 'FORBIDDEN', message: 'No access to this list' });
  return membership;
}
