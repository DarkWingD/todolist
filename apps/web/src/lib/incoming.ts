/**
 * A task handed to Sorted by another app on the same box.
 *
 * Today that is danchat: long-pressing a message there offers "Send to Sorted", which opens
 * `/add?title=…&due=…`. The handover is a link on purpose — Sorted never gives another app a
 * key to its API, and nothing is created until the person confirms it in the normal add sheet.
 * The two apps share a machine, not an account.
 */
export interface IncomingTask {
  title: string;
  /** ISO 8601, already in the sender's local offset. Absent if no date was detected. */
  dueAt?: string;
  allDay: boolean;
  from?: string;
}

const MAX_TITLE = 200;

/**
 * Read the handover out of the URL, exactly once.
 *
 * The URL is cleared as it is read: a PWA restores the tab it was last on, and a refresh must
 * not offer to add the same thing a second time an hour later.
 */
export function takeIncomingTask(): IncomingTask | null {
  if (window.location.pathname !== '/add') return null;
  const q = new URLSearchParams(window.location.search);
  const clear = () => window.history.replaceState(null, '', '/');

  const title = (q.get('title') ?? '').trim().slice(0, MAX_TITLE);
  if (!title) {
    clear();
    return null;
  }
  // A due date that does not parse is dropped rather than guessed at; the task is still worth
  // having, and the sheet will simply open with no date on it.
  const raw = q.get('due');
  const due = raw ? new Date(raw) : null;
  const dueAt = due && !Number.isNaN(due.getTime()) ? due.toISOString() : undefined;
  const from = q.get('from') ?? undefined;

  clear();
  return { title, dueAt, allDay: q.get('allday') === '1', from };
}
