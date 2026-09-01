import { useState } from 'react';
import { fromLocalInput, toLocalInput } from '../lib/datetime';
import { trpc } from '../lib/trpc';
import { Avatar } from './Avatar';

export interface EditableEvent {
  id: string;
  listId: string;
  title: string;
  notes?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  assigneeId: string | null;
}

interface Props {
  event: EditableEvent;
  lists: { id: string; name: string; emojiIcon: string }[];
  people: { id: string; name: string; avatarEmoji: string; avatarColor: string; image?: string | null }[];
  onClose: () => void;
  /** Called after a successful save or delete. */
  onDone: () => void;
}

export function EventEditSheet({ event, lists, people, onClose, onDone }: Props) {
  const update = trpc.events.update.useMutation({ onSuccess: onDone });
  const remove = trpc.events.remove.useMutation({ onSuccess: onDone });

  const [title, setTitle] = useState(event.title);
  const [listId, setListId] = useState(event.listId);
  const [allDay, setAllDay] = useState(event.allDay);
  const [start, setStart] = useState(() => toLocalInput(event.startAt));
  const [end, setEnd] = useState(() => toLocalInput(event.endAt));
  const [assignee, setAssignee] = useState<string | null>(event.assigneeId);
  const [confirmDel, setConfirmDel] = useState(false);

  const field = 'w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none';
  const fieldStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' };
  const label = 'mb-1.5 mt-3 block font-semibold text-muted';
  const labelStyle = { fontSize: 'var(--fs-sm)' };

  return (
    <>
      <div className="fixed inset-0 z-30" style={{ background: 'rgba(0,0,0,.4)' }} onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md overflow-y-auto p-4"
        style={{ background: 'var(--color-bg)', borderRadius: '22px 22px 0 0', maxHeight: '82%', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: 'var(--color-check-border)' }} />
        <h3 className="mb-2 font-head" style={{ fontSize: 18 }}>Edit event</h3>

        <input className={field} style={fieldStyle} placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className={label} style={labelStyle}>List</label>
        <select className={field} style={fieldStyle} value={listId} onChange={(e) => setListId(e.target.value)}>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.emojiIcon} {l.name}</option>)}
        </select>

        <label className="mt-3 flex items-center gap-2 font-semibold" style={{ fontSize: 'var(--fs-sm)' }}>
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
        </label>

        <label className={label} style={labelStyle}>Start</label>
        <input
          type={allDay ? 'date' : 'datetime-local'}
          className={field}
          style={fieldStyle}
          value={allDay ? start.slice(0, 10) : start}
          onChange={(e) => setStart(allDay ? e.target.value + 'T00:00' : e.target.value)}
        />
        <label className={label} style={labelStyle}>End</label>
        <input
          type={allDay ? 'date' : 'datetime-local'}
          className={field}
          style={fieldStyle}
          value={allDay ? end.slice(0, 10) : end}
          onChange={(e) => setEnd(allDay ? e.target.value + 'T23:59' : e.target.value)}
        />

        {people.length > 1 && (
          <>
            <label className={label} style={labelStyle}>For</label>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setAssignee((a) => (a === p.id ? null : p.id))}
                  className="rounded-full"
                  style={{ padding: 2, borderRadius: '50%', boxShadow: assignee === p.id ? '0 0 0 2px var(--color-accent)' : 'none' }}
                >
                  <Avatar emoji={p.avatarEmoji} color={p.avatarColor} image={p.image} size={30} />
                </button>
              ))}
            </div>
          </>
        )}

        <button
          disabled={!title.trim() || update.isPending}
          className="mt-4 w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-50"
          style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
          onClick={() => {
            const s = fromLocalInput(start);
            const e = fromLocalInput(end);
            if (!s || !e) return;
            update.mutate({ id: event.id, listId, title: title.trim(), startAt: s, endAt: e, allDay, assigneeId: assignee });
          }}
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>

        {!confirmDel ? (
          <button
            className="mt-3 w-full rounded-card py-3 font-semibold"
            style={{ fontSize: 'var(--fs-base)', color: 'var(--color-danger)', background: 'var(--color-danger-soft)' }}
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
              className="flex-1 rounded-card py-3 font-bold text-white disabled:opacity-60"
              style={{ fontSize: 'var(--fs-base)', background: 'var(--color-danger)' }}
              onClick={() => remove.mutate({ id: event.id })}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
