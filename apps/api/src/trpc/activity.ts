import { and, desc, eq, gt } from 'drizzle-orm';
import { activity, db } from '@todolist/db';

/** The kinds of thing the family feed reports. Wording lives in the client. */
export type ActivityKind =
  | 'task.created'
  | 'task.completed'
  | 'task.reopened'
  | 'task.assigned'
  | 'task.deleted'
  | 'event.created'
  | 'event.updated'
  | 'event.deleted'
  | 'list.created'
  | 'note.edited'
  | 'meal.planned'
  | 'meal.cleared'
  | 'child.added'
  | 'dose.given'
  | 'person.joined';

export interface ActivityInput {
  householdId: string;
  actorId: string;
  kind: ActivityKind;
  listId?: string | null;
  targetId?: string | null;
  title: string;
  meta?: Record<string, unknown>;
}

/**
 * Record something someone did. Never throws: a feed row failing to write
 * must not fail the change it describes.
 */
export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    await db.insert(activity).values({
      householdId: input.householdId,
      actorId: input.actorId,
      kind: input.kind,
      listId: input.listId ?? null,
      targetId: input.targetId ?? null,
      title: input.title,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    });
  } catch (err) {
    console.error('activity log failed', err);
  }
}

/**
 * Typing in a note saves every second or so; one feed row per sitting is
 * plenty. Skip the write while the same person's last edit of this note is
 * recent, refreshing nothing — the first row's time is when they started.
 */
export async function logNoteEdit(input: Omit<ActivityInput, 'kind'>): Promise<void> {
  const recent = await db
    .select({ id: activity.id })
    .from(activity)
    .where(
      and(
        eq(activity.kind, 'note.edited'),
        eq(activity.listId, input.listId ?? ''),
        eq(activity.actorId, input.actorId),
        gt(activity.createdAt, new Date(Date.now() - 30 * 60 * 1000)),
      ),
    )
    .orderBy(desc(activity.createdAt))
    .limit(1);
  if (recent.length > 0) return;
  await logActivity({ ...input, kind: 'note.edited' });
}
