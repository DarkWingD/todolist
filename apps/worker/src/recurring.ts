import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db, task } from '@todolist/db';
// `rrule` is CommonJS — import the default and destructure (no named ESM export).
import rrulePkg from 'rrule';

const { RRule } = rrulePkg;

/** Compute the next occurrence strictly after `after`, or null if the series ended. */
function nextOccurrence(rule: string, after: Date): Date | null {
  const rrule = RRule.fromString(rule.startsWith('RRULE:') ? rule : `RRULE:${rule}`);
  return rrule.after(after, false);
}

/**
 * First-pass recurrence: when a recurring task is completed, spawn its next
 * instance (if not already spawned). The completed task remains as history.
 * De-dup via (parentTaskId, dueAt).
 */
export async function materializeRecurring() {
  const candidates = await db
    .select()
    .from(task)
    .where(
      and(isNotNull(task.recurrenceRule), isNotNull(task.completedAt), isNull(task.deletedAt)),
    );

  let created = 0;
  for (const t of candidates) {
    if (!t.recurrenceRule || !t.dueAt) continue;
    const next = nextOccurrence(t.recurrenceRule, t.dueAt);
    if (!next) continue;

    const seriesRoot = t.parentTaskId ?? t.id;
    const exists = await db
      .select({ id: task.id })
      .from(task)
      .where(and(eq(task.parentTaskId, seriesRoot), eq(task.dueAt, next)))
      .limit(1);
    if (exists.length) continue;

    await db.insert(task).values({
      listId: t.listId,
      title: t.title,
      notes: t.notes,
      dueAt: next,
      priority: t.priority,
      assigneeId: t.assigneeId,
      recurrenceRule: t.recurrenceRule,
      parentTaskId: seriesRoot,
      createdBy: t.createdBy,
      sortOrder: t.sortOrder,
    });
    created++;
  }

  if (created) console.log(`Materialized ${created} recurring task instance(s).`);
}
