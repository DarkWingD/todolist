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

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
];

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
    utils.tasks.dueToday.invalidate();
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
      <div className="flex rounded-lg p-0.5" style={{ background: 'var(--color-chip-bg)' }}>
        {PRIORITIES.map((p) => (
          <button
            key={p.value}
            onClick={() => { setPriority(p.value); setTimeout(onSave, 0); }}
            className="flex-1 rounded-md py-1.5 font-semibold"
            style={{
              fontSize: 'var(--fs-sm)',
              background: priority === p.value ? 'var(--color-surface)' : 'transparent',
              color: priority === p.value ? 'var(--color-text)' : 'var(--color-muted)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

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
                <Avatar emoji={m.avatarEmoji} color={m.avatarColor} size={22} />
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
          <span style={{ fontSize: 'var(--fs-base)' }}>⏰ {formatDateTime(r.sendAt as unknown as string)}</span>
          <button
            className="ml-auto text-muted"
            style={{ fontSize: 'var(--fs-sm)' }}
            onClick={() => removeReminder.mutate({ id: r.id })}
          >
            Remove
          </button>
        </div>
      ))}
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

      <div className="h-8" />
    </>
  );
}
