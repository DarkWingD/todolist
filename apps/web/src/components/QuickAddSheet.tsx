import { useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { trpc } from '../lib/trpc';
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
  const [due, setDue] = useState<DuePreset>('today');
  const [priority, setPriority] = useState<'none' | 'high'>('none');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);

  const { data: members = [] } = trpc.lists.members.useQuery(
    { listId },
    { enabled: !!listId },
  );

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
      onClose();
    },
  });

  function submit() {
    if (!title.trim() || !listId) return;
    create.mutate({
      listId,
      title: title.trim(),
      dueAt: dueFromPreset(due),
      priority,
      assigneeId: assigneeId ?? undefined,
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
    <>
      <div
        className="absolute inset-0 z-10 transition-opacity"
        style={{
          background: 'rgba(0,0,0,.4)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 z-20 p-5"
        style={{
          background: 'var(--color-bg)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,.25)',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform .28s cubic-bezier(.32,.72,0,1)',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        }}
      >
        <div
          className="mx-auto mb-4 h-1.5 w-10 rounded-full"
          style={{ background: 'var(--color-check-border)' }}
        />
        <input
          autoFocus={open}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="What needs doing?"
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
            onClick={() => setDue((d) => (d === 'today' ? 'tomorrow' : d === 'tomorrow' ? 'none' : 'today'))}
          >
            📅 {due === 'none' ? 'No date' : due === 'today' ? 'Today' : 'Tomorrow'}
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
            <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>Assign:</span>
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
                title={m.name}
              >
                <Avatar emoji={m.avatarEmoji} color={m.avatarColor} size={30} />
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
      </div>
    </>
  );
}
