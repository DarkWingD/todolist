import { useEffect, useRef, useState } from 'react';
import { ColorPicker } from '../components/ColorPicker';
import { EmojiPicker } from '../components/EmojiPicker';
import { trpc } from '../lib/trpc';
import type { ListSummary } from '../types';

export function ListsScreen({
  onOpenList,
  createSignal,
}: {
  onOpenList: (list: ListSummary) => void;
  createSignal?: number;
}) {
  const utils = trpc.useUtils();
  const { data: lists = [], isLoading } = trpc.lists.mine.useQuery();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📝');
  const [color, setColor] = useState<string | null>(null);
  const [type, setType] = useState<'tasks' | 'checklist'>('tasks');

  // The floating + button opens the create form — but only when actually tapped
  // (signal changes), not on mount when returning to the tab.
  const lastCreateSignal = useRef(createSignal);
  useEffect(() => {
    if (createSignal !== lastCreateSignal.current) {
      lastCreateSignal.current = createSignal;
      setCreating(true);
    }
  }, [createSignal]);

  const create = trpc.lists.create.useMutation({
    onSuccess: () => {
      utils.lists.mine.invalidate();
      setCreating(false);
      setName('');
      setEmoji('📝');
      setColor(null);
      setType('tasks');
    },
  });

  return (
    <>
      <header className="mb-d3">
        <h1
          className="font-head"
          style={{ fontSize: 'var(--fs-big)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}
        >
          Lists
        </h1>
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
          <div className="mb-3 flex rounded-lg p-0.5" style={{ background: 'var(--color-chip-bg)' }}>
            {([
              { v: 'tasks', label: '✓ Tasks' },
              { v: 'checklist', label: '🛒 Shopping' },
            ] as const).map((o) => (
              <button
                key={o.v}
                onClick={() => {
                  setType(o.v);
                  // Give a sensible default icon for a shopping list.
                  if (o.v === 'checklist' && emoji === '📝') setEmoji('🛒');
                  if (o.v === 'tasks' && emoji === '🛒') setEmoji('📝');
                }}
                className="flex-1 rounded-md py-1.5 font-semibold"
                style={{
                  fontSize: 'var(--fs-sm)',
                  background: type === o.v ? 'var(--color-surface)' : 'transparent',
                  color: type === o.v ? 'var(--color-text)' : 'var(--color-muted)',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <EmojiPicker value={emoji} onChange={setEmoji} />
          <div className="mb-1 mt-3 font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Calendar colour
          </div>
          <ColorPicker value={color} onChange={setColor} />
          <div className="mt-3 flex justify-end gap-2">
            <button className="text-muted" style={{ fontSize: 'var(--fs-sm)' }} onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button
              disabled={!name.trim() || create.isPending}
              className="rounded-lg px-4 py-2 font-bold text-accent-contrast disabled:opacity-50"
              style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
              onClick={() => create.mutate({ name: name.trim(), emojiIcon: emoji, color: color ?? undefined, type })}
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
              style={{
                background: l.color
                  ? `color-mix(in srgb, ${l.color} 22%, var(--color-surface))`
                  : 'var(--color-emoji-bg)',
                boxShadow: l.color ? `inset 0 0 0 1.5px color-mix(in srgb, ${l.color} 48%, transparent)` : 'none',
              }}
            >
              {l.emojiIcon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold" style={{ fontSize: 'var(--fs-lg)' }}>
                {l.name}
              </span>
              <span className="block text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                {l.remaining} {l.type === 'checklist' ? 'left' : 'to do'}
                {l.memberCount > 1 ? ` · Shared with ${l.memberCount}` : ''}
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
