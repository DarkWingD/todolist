import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db, task } from '@todolist/db';
// `rrule` is CommonJS — import the default and destructure (no named ESM export).
import rrulePkg from 'rrule';

const { RRule } = rrulePkg;

/**
 * Compute the next occurrence strictly after `after`, or null if the series ended.
 *
 * `dtstart` is required and must be the series' anchor. RRule.fromString() on a rule with no
 * DTSTART silently anchors the series to `new Date()` — the moment it was parsed. So "the
 * next fortnightly occurrence" was computed as "a fortnight from now", which resolves to
 * roughly now, and every worker run produced another task due immediately. A fortnight only
 * means anything relative to a fixed point; this is that point.
 *
 * It matters for rules like FREQ=WEEKLY;INTERVAL=2;BYDAY=TH too, where the anchor is what
 * decides *which* alternate Thursdays belong to the series.
 */
function nextOccurrence(rule: string, dtstart: Date, after: Date): Date | null {
  const options = RRule.parseString(rule.replace(/^RRULE:/, ''));
  options.dtstart = dtstart;
  return new RRule(options).after(after, false);
}

/**
 * When a recurring task is completed, spawn its next instance. The completed task remains as
 * history.
 *
 * Two things keep this from running away:
 *  - the series is anchored to its root's due date (see nextOccurrence), so occurrences land
 *    on real future dates instead of on "now";
 *  - a series is skipped while it still has an open instance. That invariant — at most one
 *    outstanding copy of a repeating task — is what makes a runaway structurally impossible,
 *    rather than depending on a de-dup key being exactly right. The old de-dup compared
 *    (parentTaskId, dueAt) and never matched, because every generated dueAt was a slightly
 *    different "now".
 */
export async function materializeRecurring() {
  const candidates = await db
    .select()
    .from(task)
    .where(
      and(isNotNull(task.recurrenceRule), isNotNull(task.completedAt), isNull(task.deletedAt)),
    );

  // One decision per series, taken from its latest-due completed instance. Walking every
  // completed instance ever meant reconsidering the whole history on each run.
  type Candidate = (typeof candidates)[number];
  const latestBySeries = new Map<string, Candidate>();
  for (const t of candidates) {
    if (!t.recurrenceRule || !t.dueAt) continue;
    const seriesRoot = t.parentTaskId ?? t.id;
    const held = latestBySeries.get(seriesRoot);
    if (!held || t.dueAt > held.dueAt!) latestBySeries.set(seriesRoot, t);
  }

  let created = 0;
  for (const [seriesRoot, t] of latestBySeries) {
    // Something is already outstanding for this series — nothing to do until it is ticked off.
    const open = await db
      .select({ id: task.id })
      .from(task)
      .where(
        and(eq(task.parentTaskId, seriesRoot), isNull(task.completedAt), isNull(task.deletedAt)),
      )
      .limit(1);
    if (open.length) continue;

    // The root anchors the series; for the root itself that is its own due date.
    let anchor = t.dueAt!;
    if (t.id !== seriesRoot) {
      const rootRow = await db
        .select({ dueAt: task.dueAt })
        .from(task)
        .where(eq(task.id, seriesRoot))
        .limit(1);
      if (rootRow[0]?.dueAt) anchor = rootRow[0].dueAt;
    }

    const next = nextOccurrence(t.recurrenceRule!, anchor, t.dueAt!);
    if (!next) continue;

    // Belt and braces: an occurrence in the past would be overdue the moment it is created,
    // which is exactly the shape the old bug took. Skip rather than backfill history.
    if (next.getTime() <= Date.now()) continue;

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
