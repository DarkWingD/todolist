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
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');

  const invalidate = () => {
    utils.tasks.byList.invalidate({ listId: list.id });
    utils.tasks.agenda.invalidate();
    utils.lists.mine.invalidate();
  };
  const toggle = trpc.tasks.toggle.useMutation({ onSuccess: invalidate });
  const invite = trpc.lists.invite.useMutation({
    onSuccess: () => {
      setInviting(false);
      setEmail('');
      utils.lists.members.invalidate({ listId: list.id });
    },
  });

  const open = tasks.filter((t) => !t.completedAt);
  const done = tasks.filter((t) => t.completedAt);

  return (
    <>
      <BackButton label="Lists" onClick={onBack} />

      <header className="flex items-center gap-d3">
        <span
          className="grid h-10 w-10 flex-none place-items-center rounded-emoji text-xl"
          style={{ background: 'var(--color-emoji-bg)' }}
        >
          {list.emojiIcon}
        </span>
        <div className="min-w-0 flex-1">
          <h1
            className="font-head"
            style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}
          >
            {list.name}
          </h1>
          <div className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {open.length} to do · {done.length} done
          </div>
        </div>
      </header>

      <div className="mt-d3 flex items-center gap-2">
        {members.length > 0 && (
          <AvatarStack
            users={members.map((m) => ({ id: m.id, emoji: m.avatarEmoji, color: m.avatarColor }))}
            size={28}
          />
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
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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

      <h2
        className="mb-d2 mt-d4 font-bold uppercase text-muted"
        style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
      >
        To do
      </h2>
      {isLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>Loading…</p>
      ) : open.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>All done — nice. 🎉</p>
      ) : (
        open.map((t) => (
          <TaskRow key={t.id} task={toTaskRow(t)} onToggle={(id, completed) => toggle.mutate({ id, completed })} onOpen={onOpenTask} />
        ))
      )}

      {done.length > 0 && (
        <>
          <h2
            className="mb-d2 mt-d4 font-bold uppercase text-muted"
            style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
          >
            Completed
          </h2>
          {done.map((t) => (
            <TaskRow key={t.id} task={toTaskRow(t)} onToggle={(id, completed) => toggle.mutate({ id, completed })} onOpen={onOpenTask} />
          ))}
        </>
      )}
    </>
  );
}
