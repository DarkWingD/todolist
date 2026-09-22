import { Sheet } from '@todolist/kitchen-ui';
import { useState } from 'react';
import { endForNewStart, fromLocalInput, toLocalInput } from '../lib/datetime';
import { trpc } from '../lib/trpc';
import { Avatar } from './Avatar';
import { EmojiPicker } from './EmojiPicker';

export interface EditableEvent {
  id: string;
  listId: string;
  title: string;
  notes?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  assigneeId: string | null;
  recurrenceRule?: string | null;
  emoji?: string | null;
}

interface Props {
  event: EditableEvent;
  lists: { id: string; name: string; emojiIcon: string }[];
  /**
   * The household's app-managed Events list. `lists.mine` hides systemKey lists,
   * so without it every event filed under Events — which is now the default —
   * would open this sheet with nothing selected, and could never be put back.
   */
  eventsList?: { id: string; name: string; emojiIcon: string } | null;
  people: {
    id: string;
    name: string;
    avatarEmoji: string;
    avatarColor: string;
    image?: string | null;
  }[];
  onClose: () => void;
  /** Called after a successful save or delete. */
  onDone: () => void;
}

export function EventEditSheet({ event, lists, eventsList, people, onClose, onDone }: Props) {
  const update = trpc.events.update.useMutation({ onSuccess: onDone });
  const remove = trpc.events.remove.useMutation({ onSuccess: onDone });

  const [title, setTitle] = useState(event.title);
  const [listId, setListId] = useState(event.listId);
  const [allDay, setAllDay] = useState(event.allDay);
  const [start, setStart] = useState(() => toLocalInput(event.startAt));
  const [end, setEnd] = useState(() => toLocalInput(event.endAt));
  const [assignee, setAssignee] = useState<string | null>(event.assigneeId);
  const [emoji, setEmoji] = useState(event.emoji ?? '');
  // `min` stops the picker offering an earlier end; a typed one still needs this.
  const endsAfterStart = (() => {
    const a = new Date(start);
    const b = new Date(end);
    return isNaN(a.getTime()) || isNaN(b.getTime()) ? false : b.getTime() > a.getTime();
  })();

  // Weekly is the only repeat worth offering here: swimming, music, sport. A
  // full recurrence editor is a different feature, and none of the events
  // people attach to a child need one.
  // 0 never, 1 weekly, 2 fortnightly: weekly with an interval of two.
  const [repeatEvery, setRepeatEvery] = useState<0 | 1 | 2>(() => {
    if (!event.recurrenceRule) return 0;
    return /INTERVAL=2/.test(event.recurrenceRule) ? 2 : 1;
  });
  const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [confirmDel, setConfirmDel] = useState(false);

  const field = 'w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none';
  const fieldStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' };
  const label = 'mb-1.5 mt-3 block font-semibold text-muted';
  const labelStyle = { fontSize: 'var(--fs-sm)' };

  return (
    <Sheet open onClose={onClose} title="Edit event">
      <h3 className="mb-2 font-head" style={{ fontSize: 'var(--fs-lg)' }}>
        Edit event
      </h3>

      <input
        data-autofocus
        className={field}
        style={fieldStyle}
        placeholder="Event title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label className={label} style={labelStyle}>
        Emoji <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>— shown on the wall</span>
      </label>
      <EmojiPicker value={emoji} onChange={setEmoji} />

      <label className={label} style={labelStyle}>
        List
      </label>
      <select
        className={field}
        style={fieldStyle}
        value={listId}
        onChange={(e) => setListId(e.target.value)}
      >
        {(eventsList && !lists.some((l) => l.id === eventsList.id)
          ? [eventsList, ...lists]
          : lists
        ).map((l) => (
          <option key={l.id} value={l.id}>
            {l.emojiIcon} {l.name}
          </option>
        ))}
      </select>

      <label
        className="mt-3 flex items-center gap-2 font-semibold"
        style={{ fontSize: 'var(--fs-sm)' }}
      >
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All
        day
      </label>

      <label className={label} style={labelStyle}>
        Start
      </label>
      <input
        type={allDay ? 'date' : 'datetime-local'}
        className={field}
        style={fieldStyle}
        value={allDay ? start.slice(0, 10) : start}
        onChange={(e) => {
          // Moving an existing event keeps its length rather than its end time.
          const next = allDay ? e.target.value + 'T00:00' : e.target.value;
          setEnd(endForNewStart(start, end, next, allDay));
          setStart(next);
        }}
      />
      <label className={label} style={labelStyle}>
        End
      </label>
      <input
        type={allDay ? 'date' : 'datetime-local'}
        className={field}
        style={fieldStyle}
        min={allDay ? start.slice(0, 10) : start}
        value={allDay ? end.slice(0, 10) : end}
        onChange={(e) => setEnd(allDay ? e.target.value + 'T23:59' : e.target.value)}
      />

      {people.length > 1 && (
        <>
          <label className={label} style={labelStyle}>
            For
          </label>
          <div className="flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => setAssignee((a) => (a === p.id ? null : p.id))}
                className="rounded-full"
                style={{
                  padding: 2,
                  borderRadius: '50%',
                  boxShadow: assignee === p.id ? '0 0 0 2px var(--color-accent)' : 'none',
                }}
                // The avatar is decorative, so the name has to be said here.
                aria-label={p.name}
                aria-pressed={assignee === p.id}
              >
                <Avatar emoji={p.avatarEmoji} color={p.avatarColor} image={p.image} size={30} />
              </button>
            ))}
          </div>
        </>
      )}

      <label className={label} style={labelStyle}>
        Repeats
      </label>
      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            { v: 0, l: 'Never' },
            { v: 1, l: 'Weekly' },
            { v: 2, l: 'Fortnightly' },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setRepeatEvery(o.v)}
            className="rounded-full px-3 py-1.5 font-semibold"
            style={{
              fontSize: 'var(--fs-sm)',
              background: repeatEvery === o.v ? 'var(--color-accent-soft)' : 'var(--color-chip-bg)',
              color: repeatEvery === o.v ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            {o.l}
          </button>
        ))}
        {repeatEvery > 0 && start && (
          <span className="self-center text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            every {repeatEvery === 2 ? 'second ' : ''}
            {DAY_LONG[new Date(start).getDay()]}
          </span>
        )}
      </div>
      <button
        disabled={!title.trim() || !endsAfterStart || update.isPending}
        className="mt-4 w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-50"
        style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
        onClick={() => {
          const s = fromLocalInput(start);
          const e = fromLocalInput(end);
          if (!s || !e) return;
          update.mutate({
            id: event.id,
            listId,
            title: title.trim(),
            startAt: s,
            endAt: e,
            allDay,
            assigneeId: assignee,
            emoji: emoji || null,
            // Anchored to the day the event actually starts, so moving the
            // event moves the whole series with it.
            recurrenceRule:
              repeatEvery > 0
                ? `FREQ=WEEKLY;INTERVAL=${repeatEvery};BYDAY=${DAYS[new Date(s).getDay()]}`
                : null,
          });
        }}
      >
        {update.isPending ? 'Saving…' : 'Save'}
      </button>

      {!confirmDel ? (
        <button
          className="mt-3 w-full rounded-card py-3 font-semibold"
          style={{
            fontSize: 'var(--fs-base)',
            color: 'var(--color-danger)',
            background: 'var(--color-danger-soft)',
          }}
          onClick={() => setConfirmDel(true)}
        >
          🗑 Delete event
        </button>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            className="flex-1 rounded-card py-3 font-semibold"
            style={{ fontSize: 'var(--fs-base)', background: 'var(--color-chip-bg)' }}
            onClick={() => setConfirmDel(false)}
          >
            Cancel
          </button>
          <button
            disabled={remove.isPending}
            className="flex-1 rounded-card py-3 font-bold disabled:opacity-60"
            // Not white: in the dark themes --color-danger is a light salmon, and
            // white on it is about 1.9:1 — on a "Delete forever" button.
            style={{
              fontSize: 'var(--fs-base)',
              background: 'var(--color-danger)',
              color: 'var(--color-danger-contrast)',
            }}
            onClick={() => remove.mutate({ id: event.id })}
          >
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
