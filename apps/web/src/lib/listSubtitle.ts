import type { ListSummary } from '../types';

/** The first line of a note that has any text, for a list row. */
export function notePreviewLine(preview: string | null | undefined): string | null {
  if (!preview) return null;
  const line = preview
    .split('\n')
    .map((s) => s.trim())
    .find(Boolean);
  return line ?? null;
}

/**
 * The one line under a list's name. The built-in lists say what they are,
 * a note shows how it starts, and everything else counts what's left.
 */
export function listSubtitle(l: ListSummary & { notePreview?: string | null }): string {
  if (l.systemKey === 'reminders') return `${l.remaining} upcoming`;
  // Says which Shopping list this is: nothing else distinguishes it from one
  // you made yourself with the same name and icon.
  if (l.systemKey === 'groceries') return `${l.remaining} left · from your meal plan`;

  let base: string;
  if (l.type === 'note') base = notePreviewLine(l.notePreview) ?? 'Empty note';
  else if (l.type === 'checklist') base = `${l.remaining} left`;
  else base = `${l.remaining} to do`;

  const others = l.memberCount - 1;
  if (others === 1) return `${base} · Shared with 1 other`;
  if (others > 1) return `${base} · Shared with ${others} others`;
  return base;
}
