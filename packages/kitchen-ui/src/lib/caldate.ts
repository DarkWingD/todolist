export const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/**
 * Start of the week containing `d`, at 00:00 local.
 *
 * `weekStartsOn` uses Date.getDay() numbering — 1 = Monday, 0 = Sunday — so the
 * stored preference needs no translation on the way in or out.
 */
export const startOfWeek = (d: Date, weekStartsOn: 0 | 1 = 1): Date => {
  const x = startOfDay(d);
  const dow = (x.getDay() - weekStartsOn + 7) % 7;
  return addDays(x, -dow);
};

/** Monday on or before the given date. For callers with no preference to hand. */
export const startOfWeekMon = (d: Date): Date => startOfWeek(d, 1);

export const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const INITIALS_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SHORT_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Weekday labels rotated so index 0 is whichever day the week starts on. */
export const weekdayShort = (weekStartsOn: 0 | 1 = 1): string[] =>
  weekStartsOn === 1 ? SHORT_MON : [SHORT_MON[6]!, ...SHORT_MON.slice(0, 6)];

export const weekdayInitials = (weekStartsOn: 0 | 1 = 1): string[] =>
  weekStartsOn === 1 ? INITIALS_MON : [INITIALS_MON[6]!, ...INITIALS_MON.slice(0, 6)];

export const WEEKDAY_INITIALS = INITIALS_MON;
export const WEEKDAY_SHORT = SHORT_MON;
