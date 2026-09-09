import { and, eq, ilike, isNull } from 'drizzle-orm';
import { db, list, listMember, listNote, task } from '@todolist/db';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';

/**
 * The line of a note the match sits on, so a hit reads like the note rather
 * than as a wall of its opening. Falls back to the start when the match is
 * somewhere odd (it can't be, given the ilike filter, but stay defensive).
 */
function snippetFor(body: string, q: string): string {
  const at = body.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return body.slice(0, 120);
  const lineStart = body.lastIndexOf('\n', at) + 1;
  const lineEndRaw = body.indexOf('\n', at);
  const lineEnd = lineEndRaw < 0 ? body.length : lineEndRaw;
  const line = body.slice(lineStart, lineEnd).trim();
  return line.length > 140 ? `${line.slice(0, 137)}…` : line;
}

export const searchRouter = router({
  query: protectedProcedure
    .input(z.object({ q: z.string().trim().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const pattern = `%${input.q}%`;
      const tasks = await db
        .select({
          id: task.id,
          title: task.title,
          listId: task.listId,
          listEmoji: list.emojiIcon,
          completed: task.completedAt,
        })
        .from(task)
        .innerJoin(list, eq(list.id, task.listId))
        .innerJoin(listMember, eq(listMember.listId, list.id))
        .where(
          and(
            eq(listMember.userId, ctx.user.id),
            isNull(task.deletedAt),
            ilike(task.title, pattern),
          ),
        )
        .limit(20);

      const lists = await db
        .select({ id: list.id, name: list.name, emojiIcon: list.emojiIcon, type: list.type })
        .from(list)
        .innerJoin(listMember, eq(listMember.listId, list.id))
        .where(
          and(
            eq(listMember.userId, ctx.user.id),
            isNull(list.deletedAt),
            ilike(list.name, pattern),
          ),
        )
        .limit(10);

      // Notes match on their text as well as their name.
      const noteRows = await db
        .select({ id: list.id, name: list.name, emojiIcon: list.emojiIcon, body: listNote.body })
        .from(listNote)
        .innerJoin(list, eq(list.id, listNote.listId))
        .innerJoin(listMember, eq(listMember.listId, list.id))
        .where(
          and(
            eq(listMember.userId, ctx.user.id),
            isNull(list.deletedAt),
            ilike(listNote.body, pattern),
          ),
        )
        .limit(10);
      const notes = noteRows.map(({ body, ...l }) => ({
        ...l,
        snippet: snippetFor(body, input.q),
      }));

      return { tasks, lists, notes };
    }),
});
