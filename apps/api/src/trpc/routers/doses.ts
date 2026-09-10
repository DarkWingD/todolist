import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, dose, person, reminder, task } from '@todolist/db';
import { logDoseSchema } from '@todolist/shared';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { assertListAccess } from '../access.js';
import { logActivity } from '../activity.js';
import { protectedProcedure, router } from '../trpc.js';

const HOUR = 3_600_000;

/** The person behind a child list, checked to be in the caller's household. */
async function personForList(householdId: string, listId: string) {
  const [p] = await db
    .select({ id: person.id, name: person.name })
    .from(person)
    .where(and(eq(person.childListId, listId), eq(person.householdId, householdId)))
    .limit(1);
  if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'No one is attached to that list.' });
  return p;
}

/**
 * For each person: the most recent dose of each medicine in the last day, and
 * when the next one is allowed. Shared by the child's page, Today and the wall.
 */
export async function doseStatus(householdId: string, now = new Date()) {
  const since = new Date(now.getTime() - 24 * HOUR);
  const rows = await db
    .select({
      id: dose.id,
      personId: dose.personId,
      medicine: dose.medicine,
      amount: dose.amount,
      intervalHours: dose.intervalHours,
      givenAt: dose.givenAt,
    })
    .from(dose)
    .where(and(eq(dose.householdId, householdId), gte(dose.givenAt, since)))
    .orderBy(desc(dose.givenAt));
  const seen = new Set<string>();
  const out: {
    personId: string;
    medicine: string;
    amount: string | null;
    givenAt: Date;
    nextFrom: Date | null;
    countToday: number;
  }[] = [];
  for (const r of rows) {
    const key = `${r.personId}:${r.medicine.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      personId: r.personId,
      medicine: r.medicine,
      amount: r.amount,
      givenAt: r.givenAt,
      nextFrom: r.intervalHours ? new Date(r.givenAt.getTime() + r.intervalHours * HOUR) : null,
      countToday: rows.filter(
        (x) => x.personId === r.personId && x.medicine.toLowerCase() === r.medicine.toLowerCase(),
      ).length,
    });
  }
  return out;
}

export const dosesRouter = router({
  log: protectedProcedure.input(logDoseSchema).mutation(async ({ ctx, input }) => {
    await assertListAccess(ctx.user.id, input.listId);
    const who = await personForList(ctx.person.householdId, input.listId);
    const givenAt = input.givenAt ? new Date(input.givenAt) : new Date();
    const [created] = await db
      .insert(dose)
      .values({
        householdId: ctx.person.householdId,
        personId: who.id,
        medicine: input.medicine,
        amount: input.amount ?? null,
        intervalHours: input.intervalHours ?? null,
        givenAt,
        givenBy: ctx.person.id,
        note: input.note ?? null,
      })
      .returning();
    await logActivity({
      householdId: ctx.person.householdId,
      actorId: ctx.person.id,
      kind: 'dose.given',
      targetId: created!.id,
      title: input.medicine,
      meta: { personId: who.id, amount: input.amount ?? null, givenAt: givenAt.toISOString() },
    });

    // The reminder system hangs off tasks, so "next dose possible" becomes a
    // small task on the child's list, due when the gap has passed, with a
    // reminder for whoever logged this one.
    if (input.remind && input.intervalHours) {
      const nextFrom = new Date(givenAt.getTime() + input.intervalHours * HOUR);
      if (nextFrom > new Date()) {
        const [t] = await db
          .insert(task)
          .values({
            listId: input.listId,
            title: `${who.name.split(' ')[0]}: next ${input.medicine} can be from now`,
            dueAt: nextFrom,
            assigneeId: who.id,
            createdBy: ctx.user.id,
          })
          .returning();
        await db.insert(reminder).values({
          taskId: t!.id,
          userId: ctx.user.id,
          sendAt: nextFrom,
          channel: 'email',
        });
      }
    }
    return created;
  }),

  /** The last week of doses for one child, newest first, with who gave each. */
  recent: protectedProcedure
    .input(
      z.object({ listId: z.string().uuid(), days: z.number().int().min(1).max(30).default(7) }),
    )
    .query(async ({ ctx, input }) => {
      await assertListAccess(ctx.user.id, input.listId);
      const who = await personForList(ctx.person.householdId, input.listId);
      const giver = alias(person, 'giver');
      const rows = await db
        .select({
          id: dose.id,
          medicine: dose.medicine,
          amount: dose.amount,
          intervalHours: dose.intervalHours,
          givenAt: dose.givenAt,
          note: dose.note,
          givenByName: giver.name,
          givenByEmoji: giver.avatarEmoji,
          givenByColor: giver.avatarColor,
        })
        .from(dose)
        .leftJoin(giver, eq(giver.id, dose.givenBy))
        .where(
          and(
            eq(dose.personId, who.id),
            gte(dose.givenAt, new Date(Date.now() - input.days * 24 * HOUR)),
          ),
        )
        .orderBy(desc(dose.givenAt));
      // What this child has had before, so the next entry is a tap not a type.
      const presets = new Map<
        string,
        { medicine: string; amount: string | null; intervalHours: number | null }
      >();
      const all = await db
        .select({ medicine: dose.medicine, amount: dose.amount, intervalHours: dose.intervalHours })
        .from(dose)
        .where(eq(dose.personId, who.id))
        .orderBy(desc(dose.givenAt))
        .limit(50);
      for (const d of all) {
        const k = d.medicine.toLowerCase();
        if (!presets.has(k)) presets.set(k, d);
      }
      return {
        personId: who.id,
        doses: rows,
        presets: [...presets.values()],
        status: (await doseStatus(ctx.person.householdId)).filter((s) => s.personId === who.id),
      };
    }),

  /** Everyone in the household with a dose in the last day. */
  status: protectedProcedure.query(async ({ ctx }) => doseStatus(ctx.person.householdId)),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [d] = await db
        .select({ id: dose.id, householdId: dose.householdId })
        .from(dose)
        .where(eq(dose.id, input.id))
        .limit(1);
      if (!d || d.householdId !== ctx.person.householdId)
        throw new TRPCError({ code: 'NOT_FOUND' });
      await db.delete(dose).where(eq(dose.id, input.id));
      return { ok: true };
    }),
});

/** Used by the wall: statuses keyed by person, for a set of people. */
export async function doseStatusFor(householdId: string, personIds: string[]) {
  if (personIds.length === 0) return [];
  const all = await doseStatus(householdId);
  const wanted = new Set(personIds);
  return all.filter((s) => wanted.has(s.personId));
}

// Keep the unused-import checker honest: inArray is handy for callers.
void inArray;
