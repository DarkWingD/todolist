import type { Priority } from '@todolist/shared';
import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { BackButton } from '../components/BackButton';
import {
  formatDateTime,
  freqToRule,
  fromLocalInput,
  ruleToFreq,
  toLocalInput,
  type Freq,
} from '../lib/datetime';
import { trpc } from '../lib/trpc';

export function TaskDetailScreen({ taskId, onBack }: { taskId: string; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data: task, isLoading } = trpc.tasks.get.useQuery({ id: taskId });
  const { data: reminders = [] } = trpc.reminders.byTask.useQuery({ taskId });
  const { data: members = [] } = trpc.lists.members.useQuery(
    { listId: task?.listId ?? '' },
    { enabled: !!task?.listId },
  );

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>('none');
  const [freq, setFreq] = useState<Freq | ''>('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [newReminder, setNewReminder] = useState('');
  const [showCustomReminder, setShowCustomReminder] = useState(false);

  // Seed local state once the task loads.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes ?? '');
    setDue(toLocalInput(task.dueAt as unknown as string));
    setPriority(task.priority);
    setFreq(ruleToFreq(task.recurrenceRule));
    setAssigneeId(task.assigneeId);
  }, [task]);

  const invalidateTask = () => {
    utils.tasks.get.invalidate({ id: taskId });
    if (task) utils.tasks.byList.invalidate({ listId: task.listId });
    utils.tasks.agenda.invalidate();
    utils.tasks.highPriority.invalidate();
    utils.lists.mine.invalidate();
  };

  const save = trpc.tasks.update.useMutation({ onSuccess: invalidateTask });
  const remove = trpc.tasks.remove.useMutation({
    onSuccess: () => {
      invalidateTask();
      onBack();
    },
  });
  const toggle = trpc.tasks.toggle.useMutation({ onSuccess: invalidateTask });
  const addReminder = trpc.reminders.create.useMutation({
    onSuccess: () => {
      setNewReminder('');
      utils.reminders.byTask.invalidate({ taskId });
    },
  });
  const removeReminder = trpc.reminders.remove.useMutation({
    onSuccess: () => utils.reminders.byTask.invalidate({ taskId }),
  });

  function onSave() {
    save.mutate({
      id: taskId,
      title: title.trim() || 'Untitled',
      notes: notes.trim() || undefined,
      dueAt: fromLocalInput(due),
      priority,
      recurrenceRule: freqToRule(freq),
      assigneeId,
    });
  }

  if (isLoading || !task) {
    return (
      <>
        <BackButton label="Back" onClick={onBack} />
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>Loading…</p>
      </>
    );
  }

  const completed = !!task.completedAt;
  const sectionH = 'mb-d2 mt-d4 font-bold uppercase text-muted';
  const sectionStyle = { fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' };
  const fieldClass = 'w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none';
  const fieldStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' };

  return (
    <>
      <div className="flex items-center justify-between">
        <BackButton label="Back" onClick={onBack} />
        <button
          className="font-semibold text-danger"
          style={{ fontSize: 'var(--fs-sm)' }}
          onClick={() => remove.mutate({ id: taskId })}
        >
          Delete
        </button>
      </div>

      <button
        className="mb-d3 flex items-center gap-2 font-semibold"
        style={{ fontSize: 'var(--fs-sm)', color: completed ? 'var(--color-accent)' : 'var(--color-muted)' }}
        onClick={() => toggle.mutate({ id: taskId, completed: !completed })}
      >
        <span
          className="grid h-5 w-5 place-items-center rounded-check text-xs"
          style={{
            background: completed ? 'var(--color-accent)' : 'transparent',
            color: 'var(--color-accent-contrast)',
            boxShadow: completed ? 'none' : 'inset 0 0 0 2px var(--color-check-border)',
          }}
        >
          {completed ? '✓' : ''}
        </span>
        {completed ? 'Completed' : 'Mark complete'}
      </button>

      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={onSave}
        rows={1}
        className="w-full resize-none bg-transparent font-head outline-none"
        style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--title-weight)', color: 'var(--color-text)' }}
      />

      <h2 className={sectionH} style={sectionStyle}>Due</h2>
      <div className="flex items-center gap-2">
        <input
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          onBlur={onSave}
          className={fieldClass}
          style={fieldStyle}
        />
        {due && (
          <button className="text-muted" style={{ fontSize: 'var(--fs-sm)' }} onClick={() => { setDue(''); setTimeout(onSave, 0); }}>
            Clear
          </button>
        )}
      </div>

      <h2 className={sectionH} style={sectionStyle}>Priority</h2>
      <button
        onClick={() => {
          setPriority((p) => (p === 'high' ? 'none' : 'high'));
          setTimeout(onSave, 0);
        }}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 font-semibold"
        style={{
          fontSize: 'var(--fs-base)',
          background: priority === 'high' ? 'var(--color-danger-soft)' : 'var(--color-chip-bg)',
          color: priority === 'high' ? 'var(--color-danger)' : 'var(--color-muted)',
        }}
      >
        <span>⚑</span> {priority === 'high' ? 'High priority' : 'Flag as priority'}
      </button>

      <h2 className={sectionH} style={sectionStyle}>Repeat</h2>
      <select
        value={freq}
        onChange={(e) => { setFreq(e.target.value as Freq | ''); setTimeout(onSave, 0); }}
        className={fieldClass}
        style={fieldStyle}
      >
        <option value="">Never</option>
        <option value="DAILY">Daily</option>
        <option value="WEEKLY">Weekly</option>
        <option value="MONTHLY">Monthly</option>
        <option value="YEARLY">Yearly</option>
      </select>

      {members.length > 1 && (
        <>
          <h2 className={sectionH} style={sectionStyle}>Assignee</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setAssigneeId(null); setTimeout(onSave, 0); }}
              className="rounded-full px-3 py-1.5 font-semibold"
              style={{
                fontSize: 'var(--fs-sm)',
                background: assigneeId === null ? 'var(--color-accent-soft)' : 'var(--color-chip-bg)',
                color: assigneeId === null ? 'var(--color-accent)' : 'var(--color-muted)',
              }}
            >
              Unassigned
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => { setAssigneeId(m.id); setTimeout(onSave, 0); }}
                className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 font-semibold"
                style={{
                  fontSize: 'var(--fs-sm)',
                  background: assigneeId === m.id ? 'var(--color-accent-soft)' : 'var(--color-chip-bg)',
                  color: assigneeId === m.id ? 'var(--color-accent)' : 'var(--color-text)',
                }}
              >
                <Avatar emoji={m.avatarEmoji} color={m.avatarColor} image={m.image} size={22} />
                {m.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </>
      )}

      <h2 className={sectionH} style={sectionStyle}>Notes</h2>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={onSave}
        rows={3}
        placeholder="Add notes…"
        className={fieldClass}
        style={fieldStyle}
      />

      <h2 className={sectionH} style={sectionStyle}>Reminders</h2>
      {reminders.map((r) => (
        <div key={r.id} className="mb-d2 flex items-center gap-2 rounded-card bg-surface p-d3 shadow-card">
          <span style={{ fontSize: 'var(--fs-base)' }}>⏰ {reminderLabel(r.sendAt as unknown as string, fromLocalInput(due))}</span>
          <button
            className="ml-auto text-muted"
            style={{ fontSize: 'var(--fs-sm)' }}
            onClick={() => removeReminder.mutate({ id: r.id })}
          >
            Remove
          </button>
        </div>
      ))}
      {due ? (
        <div className="flex flex-wrap gap-2">
          {REMINDER_OFFSETS.map((o) => {
            const dueIso = fromLocalInput(due);
            const at = dueIso ? new Date(new Date(dueIso).getTime() - o.mins * 60_000) : null;
            const unusable =
              !at ||
              at.getTime() < Date.now() ||
              reminders.some((r) => new Date(r.sendAt as unknown as string).getTime() === at.getTime());
            return (
              <button
                key={o.mins}
                disabled={unusable || addReminder.isPending}
                onClick={() => at && addReminder.mutate({ taskId, sendAt: at.toISOString(), channel: 'email' })}
                className="rounded-full px-3 py-1.5 font-semibold disabled:opacity-40"
                style={{ fontSize: 'var(--fs-sm)', background: 'var(--color-chip-bg)', color: 'var(--color-text)' }}
              >
                ＋ {o.label}
              </button>
            );
          })}
          <button
            onClick={() => setShowCustomReminder((v) => !v)}
            className="rounded-full px-3 py-1.5 font-semibold"
            style={{
              fontSize: 'var(--fs-sm)',
              background: showCustomReminder ? 'var(--color-accent-soft)' : 'var(--color-chip-bg)',
              color: showCustomReminder ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          >
            Custom…
          </button>
        </div>
      ) : (
        <p className="mb-d2 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          Set a due date to use quick reminders, or pick an exact time below.
        </p>
      )}
      {(showCustomReminder || !due) && (
        <div className="mt-d2 flex items-center gap-2">
          <input
            type="datetime-local"
            value={newReminder}
            onChange={(e) => setNewReminder(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          />
          <button
            disabled={!newReminder || addReminder.isPending}
            className="rounded-lg px-3 py-2 font-bold text-accent-contrast disabled:opacity-50"
            style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
            onClick={() => {
              const iso = fromLocalInput(newReminder);
              if (iso) addReminder.mutate({ taskId, sendAt: iso, channel: 'email' });
            }}
          >
            Add
          </button>
        </div>
      )}

      <button
        onClick={() => {
          onSave();
          onBack();
        }}
        className="mt-d4 w-full rounded-card py-3 font-bold text-accent-contrast"
        style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
      >
        Save
      </button>

      <div className="h-8" />
    </>
  );
}

const REMINDER_OFFSETS = [
  { label: 'At due time', mins: 0 },
  { label: '5 min', mins: 5 },
  { label: '10 min', mins: 10 },
  { label: '30 min', mins: 30 },
  { label: '1 hour', mins: 60 },
  { label: '1 day', mins: 1440 },
];

// "10 min before · Tue 3:50 pm" when the reminder aligns before the due date,
// otherwise just the absolute time.
function reminderLabel(sendAtIso: string, dueIso: string | null | undefined) {
  const abs = formatDateTime(sendAtIso);
  if (!dueIso) return abs;
  const diffMins = Math.round((new Date(dueIso).getTime() - new Date(sendAtIso).getTime()) / 60_000);
  if (diffMins < 0) return abs;
  if (diffMins === 0) return `At due time · ${abs}`;
  const rel =
    diffMins % 1440 === 0
      ? `${diffMins / 1440} day${diffMins / 1440 > 1 ? 's' : ''}`
      : diffMins % 60 === 0
        ? `${diffMins / 60} hr`
        : `${diffMins} min`;
  return `${rel} before · ${abs}`;
}
