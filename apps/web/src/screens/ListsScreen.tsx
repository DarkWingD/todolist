import { useEffect, useRef, useState } from 'react';
import { ColorPicker, pickUnusedColor } from '../components/ColorPicker';
import { EmojiPicker } from '../components/EmojiPicker';
import { trpc } from '../lib/trpc';
import type { ListSummary } from '../types';

function ListCard({
  list: l,
  subtitle,
  onOpen,
}: {
  list: ListSummary;
  subtitle: string;
  onOpen: (list: ListSummary) => void;
}) {
  return (
    <button
      onClick={() => onOpen(l)}
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
          {subtitle}
        </span>
      </span>
      <span className="text-muted" style={{ fontSize: 18 }}>
        ›
      </span>
    </button>
  );
}

/** Search hits carry only enough to open a list, so the prop takes that shape. */
interface MinimalList {
  id: string;
  name: string;
  emojiIcon: string;
}

export function ListsScreen({
  onOpenList,
  createSignal,
}: {
  onOpenList: (list: MinimalList) => void;
  createSignal?: number;
}) {
  const utils = trpc.useUtils();
  const [q, setQ] = useState('');
  const query = q.trim();
  const { data: results, isFetching } = trpc.search.query.useQuery(
    { q: query },
    { enabled: query.length > 0 },
  );
  const { data: lists = [], isLoading } = trpc.lists.mine.useQuery();
  const { data: remindersList } = trpc.lists.reminders.useQuery();
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
      // Auto-assign the least-used colour; the picker still allows overriding.
      setColor(pickUnusedColor(lists.map((l) => l.color)));
    }
  }, [createSignal, lists]);

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

      {/* Search lives here rather than in its own tab — it is nearly always a
          list or a task inside one that you are looking for. */}
      <div className="mb-d3 flex items-center gap-2 rounded-card border border-border bg-surface px-3 py-3 shadow-card">
        <span className="text-muted" style={{ fontSize: 16 }}>
          ⌕
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tasks and lists…"
          aria-label="Search tasks and lists"
          className="flex-1 bg-transparent outline-none"
          style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="Clear search"
            className="text-muted"
            style={{ fontSize: 16 }}
          >
            ×
          </button>
        )}
      </div>

      {query.length > 0 ? (
        isFetching && !results ? (
          <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
            Searching…
          </p>
        ) : (
          <>
            {(results?.lists.length ?? 0) > 0 && (
              <>
                <h2
                  className="mb-d2 font-bold uppercase text-muted"
                  style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
                >
                  Lists
                </h2>
                {results!.lists.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onOpenList(l)}
                    className="mb-d2 flex w-full items-center gap-d3 rounded-card bg-surface p-d3 text-left shadow-card"
                  >
                    <span
                      className="grid h-9 w-9 flex-none place-items-center rounded-emoji text-lg"
                      style={{ background: 'var(--color-emoji-bg)' }}
                    >
                      {l.emojiIcon}
                    </span>
                    <span className="font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
                      {l.name}
                    </span>
                  </button>
                ))}
              </>
            )}
            {(results?.tasks.length ?? 0) > 0 && (
              <>
                <h2
                  className="mb-d2 mt-d3 font-bold uppercase text-muted"
                  style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
                >
                  Tasks
                </h2>
                {results!.tasks.map((t) => (
                  <div
                    key={t.id}
                    className="mb-d2 flex items-center gap-d3 rounded-card bg-surface p-d3 shadow-card"
                  >
                    <span>{t.listEmoji}</span>
                    <span
                      className={t.completed ? 'text-muted line-through' : ''}
                      style={{ fontSize: 'var(--fs-base)' }}
                    >
                      {t.title}
                    </span>
                  </div>
                ))}
              </>
            )}
            {results && results.lists.length === 0 && results.tasks.length === 0 && (
              <p className="mt-6 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
                No matches for “{query}”.
              </p>
            )}
          </>
        )
      ) : (
        <>
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

      {remindersList && (
        <ListCard
          list={remindersList}
          subtitle={`${remindersList.remaining} upcoming`}
          onOpen={onOpenList}
        />
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
          <ListCard
            key={l.id}
            list={l}
            subtitle={`${l.remaining} ${l.type === 'checklist' ? 'left' : 'to do'}${
              l.memberCount > 1 ? ` · Shared with ${l.memberCount}` : ''
            }`}
            onOpen={onOpenList}
          />
        ))
      )}
        </>
      )}
    </>
  );
}
