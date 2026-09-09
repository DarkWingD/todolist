/** One feed row as the API hands it over. */
export interface ActivityItem {
  id: string;
  kind: string;
  listId: string | null;
  targetId: string | null;
  title: string;
  meta: Record<string, unknown> | null;
  createdAt: string | Date;
  actorId: string | null;
  actorName: string | null;
  actorEmoji: string | null;
  actorColor: string | null;
  actorImage: string | null;
  listName: string | null;
  listEmoji: string | null;
  mine: boolean;
}

interface PersonLike {
  id: string;
  name: string;
}

function first(name: string | null | undefined): string {
  return (name ?? 'Someone').split(' ')[0] || 'Someone';
}

function dayWord(iso: unknown): string {
  if (typeof iso !== 'string') return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((that.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 1 && diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * "Sam ticked off Book the dentist." Actor and verb are separate so the
 * actor can be drawn as an avatar and the rest as text.
 */
export function describeActivity(
  it: ActivityItem,
  people: PersonLike[],
): { icon: string; text: string } {
  const who = (id: unknown) =>
    typeof id === 'string' ? first(people.find((p) => p.id === id)?.name) : '';
  const t = it.title;
  switch (it.kind) {
    case 'task.created': {
      const a = who(it.meta?.assigneeId);
      return { icon: '＋', text: a ? `added ${t} for ${a}` : `added ${t}` };
    }
    case 'task.completed':
      return { icon: '✓', text: `ticked off ${t}` };
    case 'task.reopened':
      return { icon: '↺', text: `reopened ${t}` };
    case 'task.assigned':
      return { icon: '→', text: `gave ${t} to ${who(it.meta?.assigneeId) || 'someone'}` };
    case 'task.deleted':
      return { icon: '🗑', text: `deleted ${t}` };
    case 'event.created': {
      const d = dayWord(it.meta?.startAt);
      return { icon: '📅', text: d ? `added ${t}, ${d}` : `added ${t}` };
    }
    case 'event.updated':
      return { icon: '📅', text: `changed ${t}` };
    case 'event.deleted':
      return { icon: '📅', text: `removed ${t}` };
    case 'list.created':
      return it.meta?.type === 'note'
        ? { icon: '📄', text: `started a note, ${t}` }
        : { icon: '🗂️', text: `made a new list, ${t}` };
    case 'note.edited':
      return { icon: '✎', text: `wrote in ${t}` };
    case 'meal.planned': {
      const d = dayWord(it.meta?.date);
      return { icon: '🍽️', text: d ? `planned ${t} for ${d}` : `planned ${t}` };
    }
    case 'meal.cleared': {
      const d = dayWord(it.meta?.date);
      return { icon: '🍽️', text: d ? `took ${t} off ${d}` : `took ${t} off the plan` };
    }
    case 'dose.given': {
      const amt = typeof it.meta?.amount === 'string' && it.meta.amount ? ` (${it.meta.amount})` : '';
      return { icon: '💊', text: `gave ${who(it.meta?.personId) || 'someone'} ${t}${amt}` };
    }
    case 'child.added':
      return { icon: '🧒', text: `added ${t} to the family` };
    case 'person.joined':
      return { icon: '🏠', text: 'joined the family' };
    default:
      return { icon: '•', text: t };
  }
}

export function actorLabel(it: ActivityItem): string {
  return it.mine ? 'You' : first(it.actorName);
}

/** "just now", "5 min ago", "yesterday", "3 Sep". */
export function relativeTime(iso: string | Date): string {
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
