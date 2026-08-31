export interface AgendaSection<T> {
  key: string;
  label: string;
  overdue: boolean;
  tasks: T[];
}

/**
 * Group dated tasks (ordered by dueAt) into Overdue / Today / Tomorrow /
 * per-upcoming-day sections, using the browser's local timezone.
 */
export function groupAgenda<T extends { dueAt: string | Date | null }>(
  tasks: T[],
): AgendaSection<T>[] {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);
  const startDayAfter = new Date(startTomorrow);
  startDayAfter.setDate(startDayAfter.getDate() + 1);

  const sections = new Map<string, AgendaSection<T> & { order: number }>();
  const add = (key: string, order: number, label: string, overdue: boolean, task: T) => {
    let s = sections.get(key);
    if (!s) {
      s = { key, order, label, overdue, tasks: [] };
      sections.set(key, s);
    }
    s.tasks.push(task);
  };

  for (const t of tasks) {
    if (!t.dueAt) continue;
    const d = new Date(t.dueAt);
    if (d < startToday) {
      add('overdue', 0, 'Overdue', true, t);
    } else if (d < startTomorrow) {
      add('today', 1, 'Today', false, t);
    } else if (d < startDayAfter) {
      add('tomorrow', 2, 'Tomorrow', false, t);
    } else {
      const key = d.toDateString();
      const order = 3 + Math.floor((d.getTime() - startDayAfter.getTime()) / 86_400_000);
      const label = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
      add(key, order, label, false, t);
    }
  }

  return [...sections.values()].sort((a, b) => a.order - b.order);
}
