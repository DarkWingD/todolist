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
