import { useState } from 'react';
import { Avatar, AvatarStack } from '../components/Avatar';
import { BackButton } from '../components/BackButton';
import { EventEditSheet } from '../components/EventEditSheet';
import { ListSettingsSheet } from '../components/ListSettingsSheet';
import { TaskRow } from '../components/TaskRow';
import { toTaskRow } from '../lib/mapTask';
import { trpc } from '../lib/trpc';

interface DetailList {
  id: string;
  name: string;
  emojiIcon: string;
  type?: 'tasks' | 'checklist';
  systemKey?: string | null;
}

type RemindPreset = 'hour' | 'evening' | 'tomorrow' | 'custom';

const REMIND_PRESETS: { v: RemindPreset; label: string }[] = [
  { v: 'hour', label: 'In 1 hour' },
  { v: 'evening', label: 'Evening 6pm' },
  { v: 'tomorrow', label: 'Tomorrow 9am' },
  { v: 'custom', label: 'Custom…' },
];

function remindAtFrom(p: RemindPreset, custom: string): Date | null {
  const d = new Date();
  if (p === 'hour') return new Date(Date.now() + 60 * 60 * 1000);
  if (p === 'evening') {
    d.setHours(18, 0, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); // already evening → tomorrow 6pm
    return d;
  }
  if (p === 'tomorrow') {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  if (!custom) return null;
  const at = new Date(custom);
  return Number.isNaN(at.getTime()) ? null : at;
}

function fmtEventDate(startIso: string, endIso: string, allDay: boolean) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sameDay = s.toDateString() === e.toDateString();
  const d = (x: Date) => x.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const t = (x: Date) => x.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (allDay) return sameDay ? d(s) : `${d(s)} – ${d(e)}`;
  return sameDay ? `${d(s)} · ${t(s)}` : `${d(s)} ${t(s)} – ${d(e)} ${t(e)}`;
}

export function ListDetailScreen({
  list,
  onBack,
  onOpenTask,
}: {
  list: DetailList;
  onBack: () => void;
  onOpenTask: (id: string) => void;
}) {
  const utils = trpc.useUtils();
  const { data: tasks = [], isLoading } = trpc.tasks.byList.useQuery({ listId: list.id });
  const { data: members = [] } = trpc.lists.members.useQuery({ listId: list.id });
  const { data: allLists = [] } = trpc.lists.mine.useQuery();
  // Prefer live list data (reflects renames / type changes immediately).
  const live = allLists.find((l) => l.id === list.id);
  const displayName = live?.name ?? list.name;
  const displayEmoji = live?.emojiIcon ?? list.emojiIcon;
  const isChecklist = (live?.type ?? list.type ?? 'tasks') === 'checklist';
  const isReminders = list.systemKey === 'reminders';
  const [showSettings, setShowSettings] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [newItem, setNewItem] = useState('');
  const [remindPreset, setRemindPreset] = useState<RemindPreset>('hour');
  const [customRemindAt, setCustomRemindAt] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const invalidate = () => {
    utils.tasks.byList.invalidate({ listId: list.id });
    utils.tasks.agenda.invalidate();
    utils.tasks.highPriority.invalidate();
    utils.lists.mine.invalidate();
    utils.lists.reminders.invalidate();
  };
  const toggle = trpc.tasks.toggle.useMutation({ onSuccess: invalidate });
  const create = trpc.tasks.create.useMutation({ onSuccess: invalidate });
  const quickAddReminder = trpc.reminders.quickAdd.useMutation({ onSuccess: invalidate });
  const update = trpc.tasks.update.useMutation({ onSuccess: () => { invalidate(); setEditId(null); } });
  const remove = trpc.tasks.remove.useMutation({ onSuccess: () => { invalidate(); setEditId(null); } });
  const invite = trpc.lists.invite.useMutation({
    onSuccess: () => {
      setInviting(false);
      setEmail('');
      utils.lists.members.invalidate({ listId: list.id });
    },
  });
  // People you already share any list with can be added directly, no email needed.
  const { data: people = [] } = trpc.calendar.people.useQuery(undefined, { enabled: inviting });
  const { data: listEvents = [] } = trpc.events.byList.useQuery({ listId: list.id });
  const addMember = trpc.lists.addMember.useMutation({
    onSuccess: () => utils.lists.members.invalidate({ listId: list.id }),
  });
  const addable = people.filter((p) => !members.some((m) => m.id === p.id));

  const addOne = (title: string) => {
    const t = title.trim();
    if (!t) return;
    if (isReminders) {
      const at = remindAtFrom(remindPreset, customRemindAt);
      if (at) quickAddReminder.mutate({ title: t, remindAt: at.toISOString() });
    } else {
      create.mutate({ listId: list.id, title: t, priority: 'none' });
    }
  };

  const open = tasks.filter((t) => !t.completedAt);
  const done = tasks.filter((t) => t.completedAt);
  const editItem = tasks.find((t) => t.id === editId);

  function openItem(id: string) {
    if (isChecklist) {
      setEditId(id);
      setEditTitle(tasks.find((t) => t.id === id)?.title ?? '');
    } else {
      onOpenTask(id);
    }
  }

  return (
    <>
      <BackButton label="Lists" onClick={onBack} />

      <header className="flex items-center gap-d3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-emoji text-xl" style={{ background: 'var(--color-emoji-bg)' }}>
          {displayEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-head" style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}>
            {displayName}
          </h1>
          <div className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {open.length} {isReminders ? 'upcoming' : isChecklist ? 'left' : 'to do'} · {done.length} done
          </div>
        </div>
        {!isReminders && (
          <button
            aria-label="List settings"
            className="grid h-9 w-9 flex-none place-items-center rounded-full text-muted"
            style={{ background: 'var(--color-chip-bg)', fontSize: 18 }}
            onClick={() => setShowSettings(true)}
          >
            ⋯
          </button>
        )}
      </header>

      {!isReminders && (
        <div className="mt-d3 flex items-center gap-2">
          {members.length > 0 && (
            <AvatarStack users={members.map((m) => ({ id: m.id, emoji: m.avatarEmoji, color: m.avatarColor, image: m.image }))} size={28} />
          )}
          <button
            className="rounded-full px-3 py-1.5 font-bold text-accent"
            style={{ background: 'var(--color-accent-soft)', fontSize: 'var(--fs-sm)' }}
            onClick={() => setInviting((v) => !v)}
          >
            ＋ Invite
          </button>
        </div>
      )}

      {inviting && (
        <div className="mt-d2">
          {addable.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {addable.map((p) => (
                <button
                  key={p.id}
                  disabled={addMember.isPending}
                  onClick={() => addMember.mutate({ listId: list.id, userId: p.id })}
                  className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 font-bold disabled:opacity-50"
                  style={{ fontSize: 'var(--fs-sm)', background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                >
                  <Avatar emoji={p.avatarEmoji} color={p.avatarColor} image={p.image} size={22} />
                  ＋ {p.name.split(' ')[0]}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              autoFocus={addable.length === 0} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={addable.length ? 'or invite someone new by email' : 'email to invite'}
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 outline-none"
              style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}
            />
            <button
              disabled={!email.trim() || invite.isPending}
              className="rounded-lg px-3 font-bold text-accent-contrast disabled:opacity-50"
              style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
              onClick={() => invite.mutate({ listId: list.id, email: email.trim() })}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Rapid add — Enter to add and keep typing; paste multiple lines = multiple items. */}
      <div className="mt-d3 rounded-card bg-surface p-d3 shadow-card">
        <div className="flex items-center gap-2">
          <span className="text-accent" style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addOne(newItem);
                setNewItem('');
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (text.includes('\n')) {
                e.preventDefault();
                text.split('\n').map((s) => s.trim()).filter(Boolean).forEach(addOne);
                setNewItem('');
              }
            }}
            placeholder={isReminders ? 'Remind me to…' : isChecklist ? 'Add an item…' : 'Add a task…'}
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
          />
        </div>
        {isReminders && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {REMIND_PRESETS.map((p) => (
              <button
                key={p.v}
                onClick={() => setRemindPreset(p.v)}
                className="rounded-full px-3 py-1.5 font-semibold"
                style={{
                  fontSize: 'var(--fs-sm)',
                  background: remindPreset === p.v ? 'var(--color-accent-soft)' : 'var(--color-chip-bg)',
                  color: remindPreset === p.v ? 'var(--color-accent)' : 'var(--color-text)',
                }}
              >
                {p.label}
              </button>
            ))}
            {remindPreset === 'custom' && (
              <input
                type="datetime-local"
                value={customRemindAt}
                onChange={(e) => setCustomRemindAt(e.target.value)}
                className="rounded-lg border border-border bg-bg px-2 py-1.5 outline-none"
                style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}
              />
            )}
          </div>
        )}
      </div>

      <h2 className="mb-d2 mt-d4 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}>
        {isReminders ? 'Upcoming' : isChecklist ? 'To buy' : 'To do'}
      </h2>
      {isLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>Loading…</p>
      ) : open.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          {isReminders
            ? 'Nothing coming up — add a reminder above.'
            : isChecklist
              ? 'Empty — add an item above.'
              : 'All done — nice. 🎉'}
        </p>
      ) : (
        open.map((t) => (
          <TaskRow key={t.id} task={toTaskRow(t)} onToggle={(id, completed) => toggle.mutate({ id, completed })} onOpen={openItem} onDelete={(id) => remove.mutate({ id })} />
        ))
      )}

      {done.length > 0 && (
        <>
          <h2 className="mb-d2 mt-d4 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}>
            {isChecklist ? 'Bought' : 'Done'}
          </h2>
          {done.map((t) => (
            <TaskRow key={t.id} task={toTaskRow(t)} onToggle={(id, completed) => toggle.mutate({ id, completed })} onOpen={openItem} onDelete={(id) => remove.mutate({ id })} />
          ))}
        </>
      )}

      {listEvents.length > 0 && (
        <>
          <h2 className="mb-d2 mt-d4 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}>
            Upcoming events
          </h2>
          {listEvents.map((ev) => (
            <button
              key={ev.id}
              className="mb-d2 flex w-full items-center gap-3 rounded-card bg-surface p-d3 text-left shadow-card"
              onClick={() => setEditEventId(ev.id)}
            >
              <span style={{ fontSize: 18 }}>📅</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold" style={{ fontSize: 'var(--fs-base)' }}>{ev.title}</span>
                <span className="block text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                  {fmtEventDate(ev.startAt as unknown as string, ev.endAt as unknown as string, ev.allDay)}
                </span>
              </span>
              <span className="text-muted" style={{ fontSize: 18 }}>›</span>
            </button>
          ))}
        </>
      )}

      {/* Lightweight checklist item editor (rename / delete only). */}
      {editId && editItem && (
        <>
          <div className="fixed inset-0 z-30" style={{ background: 'rgba(0,0,0,.4)' }} onClick={() => setEditId(null)} />
          <div
            className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-4"
            style={{ background: 'var(--color-bg)', borderRadius: '22px 22px 0 0', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: 'var(--color-check-border)' }} />
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && editTitle.trim() && update.mutate({ id: editId, title: editTitle.trim() })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 outline-none"
              style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text)' }}
            />
            <div className="mt-3 flex items-center gap-2">
              <button className="font-semibold text-danger" style={{ fontSize: 'var(--fs-sm)' }} onClick={() => remove.mutate({ id: editId })}>
                Delete
              </button>
              <button
                disabled={!editTitle.trim()}
                className="ml-auto rounded-lg px-5 py-2 font-bold text-accent-contrast disabled:opacity-50"
                style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
                onClick={() => update.mutate({ id: editId, title: editTitle.trim() })}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}

      {editEventId && (() => {
        const ev = listEvents.find((e) => e.id === editEventId);
        if (!ev) return null;
        return (
          <EventEditSheet
            event={{
              id: ev.id,
              listId: ev.listId,
              title: ev.title,
              notes: ev.notes,
              startAt: ev.startAt as unknown as string,
              endAt: ev.endAt as unknown as string,
              allDay: ev.allDay,
              assigneeId: ev.assigneeId,
            }}
            lists={allLists}
            people={members}
            onClose={() => setEditEventId(null)}
            onDone={() => {
              utils.events.byList.invalidate({ listId: list.id });
              utils.calendar.range.invalidate();
              setEditEventId(null);
            }}
          />
        );
      })()}

      {showSettings && (
        <ListSettingsSheet
          list={{ id: list.id, name: displayName, emojiIcon: displayEmoji, color: live?.color ?? null, type: live?.type ?? list.type ?? 'tasks' }}
          onClose={() => setShowSettings(false)}
          onDeleted={onBack}
        />
      )}
    </>
  );
}
