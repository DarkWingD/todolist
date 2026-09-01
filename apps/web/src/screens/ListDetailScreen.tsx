import { useState } from 'react';
import { AvatarStack } from '../components/Avatar';
import { BackButton } from '../components/BackButton';
import { TaskRow } from '../components/TaskRow';
import { toTaskRow } from '../lib/mapTask';
import { trpc } from '../lib/trpc';

interface DetailList {
  id: string;
  name: string;
  emojiIcon: string;
  type?: 'tasks' | 'checklist';
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
  const isChecklist = (list.type ?? 'tasks') === 'checklist';
  const utils = trpc.useUtils();
  const { data: tasks = [], isLoading } = trpc.tasks.byList.useQuery({ listId: list.id });
  const { data: members = [] } = trpc.lists.members.useQuery({ listId: list.id });
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [newItem, setNewItem] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const invalidate = () => {
    utils.tasks.byList.invalidate({ listId: list.id });
    utils.tasks.agenda.invalidate();
    utils.tasks.highPriority.invalidate();
    utils.lists.mine.invalidate();
  };
  const toggle = trpc.tasks.toggle.useMutation({ onSuccess: invalidate });
  const create = trpc.tasks.create.useMutation({ onSuccess: invalidate });
  const update = trpc.tasks.update.useMutation({ onSuccess: () => { invalidate(); setEditId(null); } });
  const remove = trpc.tasks.remove.useMutation({ onSuccess: () => { invalidate(); setEditId(null); } });
  const invite = trpc.lists.invite.useMutation({
    onSuccess: () => {
      setInviting(false);
      setEmail('');
      utils.lists.members.invalidate({ listId: list.id });
    },
  });

  const addOne = (title: string) => {
    const t = title.trim();
    if (t) create.mutate({ listId: list.id, title: t, priority: 'none' });
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
          {list.emojiIcon}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-head" style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}>
            {list.name}
          </h1>
          <div className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {open.length} {isChecklist ? 'left' : 'to do'} · {done.length} done
          </div>
        </div>
      </header>

      <div className="mt-d3 flex items-center gap-2">
        {members.length > 0 && (
          <AvatarStack users={members.map((m) => ({ id: m.id, emoji: m.avatarEmoji, color: m.avatarColor }))} size={28} />
        )}
        <button
          className="rounded-full px-3 py-1.5 font-bold text-accent"
          style={{ background: 'var(--color-accent-soft)', fontSize: 'var(--fs-sm)' }}
          onClick={() => setInviting((v) => !v)}
        >
          ＋ Invite
        </button>
      </div>

      {inviting && (
        <div className="mt-d2 flex gap-2">
          <input
            autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="email to invite"
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
      )}

      {/* Rapid add — Enter to add and keep typing; paste multiple lines = multiple items. */}
      <div className="mt-d3 flex items-center gap-2 rounded-card bg-surface p-d3 shadow-card">
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
          placeholder={isChecklist ? 'Add an item…' : 'Add a task…'}
          className="flex-1 bg-transparent outline-none"
          style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
        />
      </div>

      <h2 className="mb-d2 mt-d4 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}>
        {isChecklist ? 'Items' : 'To do'}
      </h2>
      {isLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>Loading…</p>
      ) : open.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          {isChecklist ? 'Empty — add an item above.' : 'All done — nice. 🎉'}
        </p>
      ) : (
        open.map((t) => (
          <TaskRow key={t.id} task={toTaskRow(t)} onToggle={(id, completed) => toggle.mutate({ id, completed })} onOpen={openItem} />
        ))
      )}

      {done.length > 0 && (
        <>
          <h2 className="mb-d2 mt-d4 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}>
            Done
          </h2>
          {done.map((t) => (
            <TaskRow key={t.id} task={toTaskRow(t)} onToggle={(id, completed) => toggle.mutate({ id, completed })} onOpen={openItem} />
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
    </>
  );
}
