// `rrule` is CommonJS — import the default and destructure (no named ESM export).
import rrulePkg from 'rrule';

const { RRule } = rrulePkg;

/**
 * Expanding a recurring event across a window.
 *
 * A recurring *task* spawns its next instance when you complete it, which works
 * because completing it is the signal. Nobody completes a swimming lesson, so
 * events are stored once and expanded when a range is read. That also means
 * editing the series edits every occurrence, which is what people expect of a
 * weekly lesson, and it costs no rows.
 */

export interface Occurrence<T> {
  /** `${id}:${startISO}` — stable per occurrence, so React keys and edits work. */
  occurrenceId: string;
  start: Date;
  end: Date;
  source: T;
}

/** A cap on how many occurrences one series can contribute to one window. */
const MAX_PER_SERIES = 400;

export function expandEvent<
  T extends { id: string; startAt: Date; endAt: Date; recurrenceRule: string | null },
>(ev: T, from: Date, to: Date): Occurrence<T>[] {
  if (!ev.recurrenceRule) {
    // A one-off still has to overlap the window to count.
    if (ev.endAt < from || ev.startAt > to) return [];
    return [{ occurrenceId: ev.id, start: ev.startAt, end: ev.endAt, source: ev }];
  }

  const durationMs = Math.max(0, ev.endAt.getTime() - ev.startAt.getTime());
  let rule;
  try {
    rule = RRule.fromString(
      ev.recurrenceRule.startsWith('RRULE:') ? ev.recurrenceRule : `RRULE:${ev.recurrenceRule}`,
    );
  } catch {
    // A malformed rule should not take the whole calendar down with it; fall
    // back to treating the series as the single event it was created from.
    return ev.endAt < from || ev.startAt > to
      ? []
      : [{ occurrenceId: ev.id, start: ev.startAt, end: ev.endAt, source: ev }];
  }

  // rrule works from the rule's own DTSTART, which we do not store — so anchor
  // the series on the event's start and generate from there.
  const anchored = new RRule({ ...rule.origOptions, dtstart: ev.startAt });

  // Widen the search by the event's duration: a lesson that began before the
  // window but runs into it still belongs in the window.
  const searchFrom = new Date(from.getTime() - durationMs);
  return anchored
    .between(searchFrom, to, true)
    .slice(0, MAX_PER_SERIES)
    .map((start) => ({
      occurrenceId: `${ev.id}:${start.toISOString()}`,
      start,
      end: new Date(start.getTime() + durationMs),
      source: ev,
    }))
    .filter((o) => o.end >= from && o.start <= to);
}
