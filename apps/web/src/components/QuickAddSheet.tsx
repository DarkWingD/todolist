import { Sheet } from '@todolist/kitchen-ui';
import { useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { trpc } from '../lib/trpc';
import { freqToRule, type Freq } from '../lib/datetime';

const REPEATS: { v: Freq | ''; label: string }[] = [
  { v: '', label: 'Once' },
  { v: 'DAILY', label: 'Daily' },
  { v: 'WEEKLY', label: 'Weekly' },
  { v: 'FORTNIGHTLY', label: 'Fortnightly' },
  { v: 'MONTHLY', label: 'Monthly' },
];
import type { ListSummary } from '../types';

type DuePreset = 'none' | 'today' | 'tomorrow';

function dueFromPreset(p: DuePreset): string | undefined {
  if (p === 'none') return undefined;
  const d = new Date();
  if (p === 'today') d.setHours(17, 0, 0, 0);
  else {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  }
  return d.toISOString();
}

interface Props {
  open: boolean;
  onClose: () => void;
  lists: ListSummary[];
  defaultListId?: string;
}

export function QuickAddSheet({ open, onClose, lists, defaultListId }: Props) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState('');
  const [listId, setListId] = useState(defaultListId ?? lists[0]?.id ?? '');
  const [due, setDue] = useState<DuePreset>('none');
  const [priority, setPriority] = useState<'none' | 'high'>('none');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<Freq | ''>('');

  const { data: household } = trpc.household.get.useQuery();
  const members = household?.people ?? [];

  useEffect(() => {
    if (open) setListId(defaultListId ?? lists[0]?.id ?? '');
  }, [open, defaultListId, lists]);

  // Clear a stale assignee when the list changes.
  useEffect(() => {
    setAssigneeId(null);
  }, [listId]);

  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.byList.invalidate({ listId });
      utils.tasks.agenda.invalidate();
      utils.tasks.highPriority.invalidate();
      utils.lists.mine.invalidate();
      setTitle('');
      setPriority('none');
      setAssigneeId(null);
      setRepeat('');
      onClose();
    },
  });

  function submit() {
    // The guard lives here rather than only on the button: Enter reaches this
    // directly, and two quick presses would otherwise make two tasks.
    if (!title.trim() || !listId || create.isPending) return;
    // A repeat needs a first date to count from; today if none was picked.
    create.mutate({
      listId,
      title: title.trim(),
      dueAt: dueFromPreset(due) ?? (repeat ? dueFromPreset('today') : undefined),
      priority,
      assigneeId: assigneeId ?? undefined,
      recurrenceRule: freqToRule(repeat) ?? undefined,
    });
  }

  const optClass = (_on: boolean) =>
    'inline-flex items-center gap-1.5 rounded-full px-3 py-2 font-semibold';
  const optStyle = (on: boolean) => ({
    fontSize: 'var(--fs-sm)',
    background: on ? 'var(--color-accent-soft)' : 'var(--color-chip-bg)',
    color: on ? 'var(--color-accent)' : 'var(--color-text)',
  });

  return (
    <Sheet open={open} onClose={onClose} title="Add a task" keepMounted>
      <input
        data-autofocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="What needs doing?"
        aria-label="What needs doing?"
        className="mb-4 w-full bg-transparent font-head outline-none"
        style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text)' }}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {lists.length > 0 && (
          <select
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            className={optClass(true)}
            style={optStyle(false)}
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.emojiIcon} {l.name}
              </option>
            ))}
          </select>
        )}
        <button
          className={optClass(due !== 'none')}
          style={optStyle(due !== 'none')}
          onClick={() =>
            setDue((d) => (d === 'today' ? 'tomorrow' : d === 'tomorrow' ? 'none' : 'today'))
          }
        >
          📅 {due === 'none' ? 'No date' : due === 'today' ? 'Today' : 'Tomorrow'}
        </button>
        <button
          className={optClass(repeat !== '')}
          onClick={() =>
            setRepeat((r) => {
              const i = REPEATS.findIndex((o) => o.v === r);
              return REPEATS[(i + 1) % REPEATS.length]!.v;
            })
          }
          title="Repeats"
          // Sized for the longest label so cycling it never reflows the row.
          style={{ ...optStyle(repeat !== ''), minWidth: '8.5em', justifyContent: 'center' }}
        >
          ↻ {REPEATS.find((o) => o.v === repeat)?.label}
        </button>
        <button
          className={optClass(priority === 'high')}
          style={optStyle(priority === 'high')}
          onClick={() => setPriority((p) => (p === 'high' ? 'none' : 'high'))}
        >
          🚩 Priority
        </button>
      </div>

      {members.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Assign:
          </span>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => setAssigneeId((a) => (a === m.id ? null : m.id))}
              className="rounded-full"
              style={{
                padding: 2,
                boxShadow: assigneeId === m.id ? '0 0 0 2px var(--color-accent)' : 'none',
                borderRadius: '50%',
              }}
              // The avatar is decorative, so the name has to be said here —
              // and a title attribute is nothing at all on a touchscreen.
              aria-label={m.name}
              aria-pressed={assigneeId === m.id}
            >
              <Avatar emoji={m.avatarEmoji} color={m.avatarColor} image={m.image} size={30} />
            </button>
          ))}
        </div>
      )}

      <button
        disabled={!title.trim() || !listId || create.isPending}
        onClick={submit}
        className="w-full rounded-card py-3.5 font-bold text-accent-contrast disabled:opacity-50"
        style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
      >
        {create.isPending ? 'Adding…' : 'Add task'}
      </button>
      {lists.length === 0 && (
        <p className="mt-2 text-center text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          Create a list first (Lists tab).
        </p>
      )}
    </Sheet>
  );
}
