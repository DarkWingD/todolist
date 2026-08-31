export interface DueInfo {
  label: string;
  variant: 'due' | 'over';
}

/** Human-friendly due label + overdue/normal variant from an ISO string. */
export function formatDue(iso: string | null | undefined): DueInfo | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);
  const startDayAfter = new Date(startTomorrow);
  startDayAfter.setDate(startDayAfter.getDate() + 1);

  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (d < startToday) {
    return { label: `Overdue · ${d.toLocaleDateString([], { weekday: 'short' })}`, variant: 'over' };
  }
  if (d < startTomorrow) {
    return { label: time, variant: d < now ? 'over' : 'due' };
  }
  if (d < startDayAfter) {
    return { label: 'Tomorrow', variant: 'due' };
  }
  return {
    label: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    variant: 'due',
  };
}

/** Turn a recurrence RRULE into a short label (best-effort). */
export function recurrenceLabel(rule: string | null | undefined): string | null {
  if (!rule) return null;
  const freq = /FREQ=(\w+)/.exec(rule)?.[1];
  switch (freq) {
    case 'DAILY':
      return 'Daily';
    case 'WEEKLY':
      return 'Weekly';
    case 'MONTHLY':
      return 'Monthly';
    case 'YEARLY':
      return 'Yearly';
    default:
      return 'Repeats';
  }
}
