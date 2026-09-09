import { and, eq, gte, ilike, isNull, or } from 'drizzle-orm';
import { childProfile, db, event, list, listMember, listNote, person, task } from '@todolist/db';
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

      // Events: title or notes. Past ones too — "when was the dentist" is a
      // real question — but only back a year, and newest first.
      const yearAgo = new Date(Date.now() - 365 * 86_400_000);
      const events = await db
        .select({
          id: event.id,
          title: event.title,
          startAt: event.startAt,
          allDay: event.allDay,
          recurrenceRule: event.recurrenceRule,
          listId: event.listId,
          listEmoji: list.emojiIcon,
          listName: list.name,
        })
        .from(event)
        .innerJoin(list, eq(list.id, event.listId))
        .innerJoin(listMember, eq(listMember.listId, list.id))
        .where(
          and(
            eq(listMember.userId, ctx.user.id),
            isNull(event.deletedAt),
            gte(event.endAt, yearAgo),
            or(ilike(event.title, pattern), ilike(event.notes, pattern)),
          ),
        )
        .orderBy(event.startAt)
        .limit(15);

      // People: a child's teacher, room, class, school phone or medical notes,
      // and anyone's name. Opens the child's page.
      const peopleRows = await db
        .select({
          id: person.id,
          kind: person.kind,
          name: person.name,
          avatarEmoji: person.avatarEmoji,
          avatarColor: person.avatarColor,
          childListId: person.childListId,
          className: childProfile.className,
          room: childProfile.room,
          teacher: childProfile.teacher,
          officePhone: childProfile.officePhone,
          medicalNotes: childProfile.medicalNotes,
        })
        .from(person)
        .leftJoin(childProfile, eq(childProfile.listId, person.childListId))
        .where(
          and(
            eq(person.householdId, ctx.person.householdId),
            or(
              ilike(person.name, pattern),
              ilike(childProfile.className, pattern),
              ilike(childProfile.room, pattern),
              ilike(childProfile.teacher, pattern),
              ilike(childProfile.officePhone, pattern),
              ilike(childProfile.medicalNotes, pattern),
            ),
          ),
        )
        .limit(10);
      const q = input.q.toLowerCase();
      const people = peopleRows.map((p) => {
        const fields: [string, string | null][] = [
          ['Class', p.className],
          ['Room', p.room],
          ['Teacher', p.teacher],
          ['School', p.officePhone],
          ['Medical', p.medicalNotes],
        ];
        const hit = fields.find(([, v]) => v && v.toLowerCase().includes(q));
        return {
          id: p.id,
          kind: p.kind,
          name: p.name,
          avatarEmoji: p.avatarEmoji,
          avatarColor: p.avatarColor,
          childListId: p.childListId,
          snippet: hit ? `${hit[0]}: ${snippetFor(hit[1]!, input.q)}` : null,
        };
      });

      return { tasks, lists, notes, events, people };
    }),
});
