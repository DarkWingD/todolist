import { useState } from 'react';
import { EmojiPicker } from '../components/EmojiPicker';
import { trpc } from '../lib/trpc';
import type { ListSummary } from '../types';

export function ListsScreen({ onOpenList }: { onOpenList: (list: ListSummary) => void }) {
  const utils = trpc.useUtils();
  const { data: lists = [], isLoading } = trpc.lists.mine.useQuery();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📝');

  const create = trpc.lists.create.useMutation({
    onSuccess: () => {
      utils.lists.mine.invalidate();
      setCreating(false);
      setName('');
      setEmoji('📝');
    },
  });

  return (
    <>
      <header className="mb-d3 flex items-center justify-between">
        <h1
          className="font-head"
          style={{ fontSize: 'var(--fs-big)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}
        >
          Lists
        </h1>
        <button
          className="grid h-9 w-9 place-items-center rounded-full text-accent"
          style={{ background: 'var(--color-accent-soft)', fontSize: 20 }}
          onClick={() => setCreating((v) => !v)}
          aria-label="New list"
        >
          +
        </button>
      </header>

      {creating && (
        <div className="mb-d3 rounded-card bg-surface p-4 shadow-card">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="List name"
            className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none"
            style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
          />
          <EmojiPicker value={emoji} onChange={setEmoji} />
          <div className="mt-3 flex justify-end gap-2">
            <button className="text-muted" style={{ fontSize: 'var(--fs-sm)' }} onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button
              disabled={!name.trim() || create.isPending}
              className="rounded-lg px-4 py-2 font-bold text-accent-contrast disabled:opacity-50"
              style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
              onClick={() => create.mutate({ name: name.trim(), emojiIcon: emoji })}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Loading…
        </p>
      ) : lists.length === 0 && !creating ? (
        <div className="mt-8 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          <div className="mb-2 text-4xl">🗂️</div>
          No lists yet. Tap + to make your first.
        </div>
      ) : (
        lists.map((l) => (
          <button
            key={l.id}
            onClick={() => onOpenList(l)}
            className="mb-d2 flex w-full items-center gap-d3 rounded-card bg-surface p-d3 text-left shadow-card"
          >
            <span
              className="grid h-10 w-10 flex-none place-items-center rounded-emoji text-xl"
              style={{ background: 'var(--color-emoji-bg)' }}
            >
              {l.emojiIcon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold" style={{ fontSize: 'var(--fs-lg)' }}>
                {l.name}
              </span>
              <span className="block text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                {l.remaining} to do{l.memberCount > 1 ? ` · Shared with ${l.memberCount}` : ''}
              </span>
            </span>
            <span className="text-muted" style={{ fontSize: 18 }}>
              ›
            </span>
          </button>
        ))
      )}
    </>
  );
}
