/** ISO string -> value for <input type="datetime-local"> (local time). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value -> ISO string (interprets input as local time). */
export function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// FORTNIGHTLY is ours: it is stored as weekly with an interval of two, which
// is what bins, pay and shared custody actually run on.
const FREQS = ['DAILY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'YEARLY'] as const;
export type Freq = (typeof FREQS)[number];

export function ruleToFreq(rule: string | null | undefined): Freq | '' {
  const m = /FREQ=(\w+)/.exec(rule ?? '');
  const f = m?.[1];
  const interval = Number(/INTERVAL=(\d+)/.exec(rule ?? '')?.[1] ?? 1);
  if (f === 'WEEKLY' && interval === 2) return 'FORTNIGHTLY';
  return (FREQS as readonly string[]).includes(f ?? '') ? (f as Freq) : '';
}

export function freqToRule(freq: Freq | ''): string | null {
  if (!freq) return null;
  return freq === 'FORTNIGHTLY' ? 'FREQ=WEEKLY;INTERVAL=2' : `FREQ=${freq}`;
}

export function formatDateTime(iso: string | Date): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Days since the epoch for a local calendar date, so day arithmetic never goes
// through UTC and slips a day either side of midnight.
function dayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

// Monday-aligned week index, for counting the "every second week" in a
// fortnightly rule.
function weekNumber(d: Date): number {
  return Math.floor((dayNumber(d) + 3) / 7);
}

const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

/**
 * Does a recurring task fall on `date`?
 *
 * Tests the parts of the rule rather than the text of it. Matching the whole
 * string against a two-letter day is a trap: "FREQ=WEEKLY" contains WE, so a
 * plain weekly chore would only ever show on Wednesdays, "FREQ=MONTHLY"
 * contains MO and would show every Monday, and "FREQ=DAILY" contains no day at
 * all, so a daily one would never show up.
 *
 * `anchor` is the task's first due date — a repeat is counted from somewhere,
 * and it also stands in for the day of the week when the rule doesn't name one.
 */
export function recursOn(
  rule: string | null | undefined,
  date: Date,
  anchor?: string | Date | null,
): boolean {
  if (!rule) return false;
  const freq = /FREQ=([A-Z]+)/.exec(rule)?.[1];
  if (!freq) return false;
  const interval = Math.max(1, Number(/INTERVAL=(\d+)/.exec(rule)?.[1] ?? 1));
  const byDay = /BYDAY=([A-Z,]+)/.exec(rule)?.[1]?.split(',').filter(Boolean);

  const from = anchor ? new Date(anchor) : null;
  const start = from && !isNaN(from.getTime()) ? from : null;
  // Not started yet: a chore added for next Monday shouldn't appear today.
  if (start && dayNumber(date) < dayNumber(start)) return false;

  switch (freq) {
    case 'DAILY':
      return !start || (dayNumber(date) - dayNumber(start)) % interval === 0;
    case 'WEEKLY': {
      const days = byDay?.length ? byDay : start ? [RRULE_DAYS[start.getDay()]!] : null;
      if (days && !days.includes(RRULE_DAYS[date.getDay()]!)) return false;
      if (!days) return false;
      if (interval === 1 || !start) return true;
      return (weekNumber(date) - weekNumber(start)) % interval === 0;
    }
    case 'MONTHLY': {
      if (!start) return false;
      if (date.getDate() !== start.getDate()) return false;
      const months =
        (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
      return months % interval === 0;
    }
    case 'YEARLY': {
      if (!start) return false;
      if (date.getDate() !== start.getDate() || date.getMonth() !== start.getMonth()) return false;
      return (date.getFullYear() - start.getFullYear()) % interval === 0;
    }
    default:
      return false;
  }
}
