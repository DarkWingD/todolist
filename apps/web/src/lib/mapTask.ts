import type { TaskRowData } from '../components/TaskRow';
import { formatDue, recurrenceLabel } from './format';

export interface ServerTask {
  id: string;
  title: string;
  completedAt: string | Date | null;
  dueAt: string | Date | null;
  recurrenceRule: string | null;
  priority?: string;
  assigneeId: string | null;
  assigneeEmoji?: string | null;
  assigneeColor?: string | null;
  assigneeImage?: string | null;
  listEmoji?: string;
}

export function toTaskRow(t: ServerTask, opts: { withLeadEmoji?: boolean } = {}): TaskRowData {
  const due = formatDue(t.dueAt as string | null);
  return {
    id: t.id,
    title: t.title,
    completed: !!t.completedAt,
    flagged: t.priority === 'high',
    leadEmoji: opts.withLeadEmoji ? t.listEmoji : undefined,
    due: due?.label,
    dueVariant: due?.variant,
    recurrence: recurrenceLabel(t.recurrenceRule) ?? undefined,
    assignee: t.assigneeId
      ? { id: t.assigneeId, emoji: t.assigneeEmoji ?? '🙂', color: t.assigneeColor ?? '#888', image: t.assigneeImage }
      : undefined,
  };
}
