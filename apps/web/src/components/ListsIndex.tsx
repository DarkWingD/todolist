import { useEffect, useMemo, useState, type RefObject } from 'react';
import { listSubtitle } from '../lib/listSubtitle';
import { trpc } from '../lib/trpc';
import type { ListSummary } from '../types';

interface Props {
  selectedId: string | null;
  onSelect: (list: ListSummary) => void;
  onOpenTask: (id: string) => void;
  onOpenChild: (listId: string) => void;
  onNewList: () => void;
  /** Handed in so the workspace can focus search from a keyboard shortcut. */
  searchRef: RefObject<HTMLInputElement>;
}

function Tile({ list: l, size = 36 }: { list: ListSummary; size?: number }) {
  return (
    <span
      className="grid flex-none place-items-center rounded-emoji"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.53,
        background: l.color
          ? `color-mix(in srgb, ${l.color} 22%, var(--color-surface))`
          : 'var(--color-emoji-bg)',
        boxShadow: l.color
          ? `inset 0 0 0 1.5px color-mix(in srgb, ${l.color} 48%, transparent)`
          : 'none',
      }}
    >
      {l.emojiIcon}
    </span>
  );
}

function Row({
  list: l,
  selected,
  onSelect,
}: {
  list: ListSummary;
  selected: boolean;
  onSelect: (l: ListSummary) => void;
}) {
  const showCount = l.type !== 'note';
  return (
    <button
      type="button"
      onClick={() => onSelect(l)}
      aria-current={selected ? 'true' : undefined}
      className="flex w-full items-center gap-2.5 rounded-card px-2.5 py-2 text-left"
      style={selected ? { background: 'var(--color-accent-soft)' } : undefined}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'var(--color-chip-bg)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = '';
      }}
    >
      <Tile list={l} />
      <span className="min-w-0 flex-1">
        <span
          className="block truncate font-semibold"
          style={{
            fontSize: 'var(--fs-base)',
            color: selected ? 'var(--color-accent)' : 'var(--color-text)',
            fontWeight: selected ? 800 : undefined,
          }}
        >
          {l.name}
        </span>
        <span className="block truncate text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
          {listSubtitle(l)}
        </span>
      </span>
      {showCount && l.remaining > 0 && (
        <span
          className="tabular-nums"
          style={{
            fontSize: 'var(--fs-sm)',
            color: selected ? 'var(--color-accent)' : 'var(--color-muted)',
            fontWeight: selected ? 800 : 600,
          }}
        >
          {l.remaining}
        </span>
      )}
    </button>
  );
}

function Group({ label }: { label: string }) {
  return (
    <div
      className="px-2.5 pb-1 pt-3.5 font-bold uppercase text-muted"
      style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.08em' }}
    >
      {label}
    </div>
  );
}

/**
 * The left pane of Lists on a desktop: every list as a row, grouped, with
 * search at the top and New list at the foot. ↑/↓ move the selection while
 * nothing has keyboard focus.
 */
export function ListsIndex({
  selectedId,
  onSelect,
  onOpenTask,
  onOpenChild,
  onNewList,
  searchRef,
}: Props) {
  const [q, setQ] = useState('');
  const query = q.trim();
  const { data: results, isFetching } = trpc.search.query.useQuery(
    { q: query },
    { enabled: query.length > 0 },
  );
  const { data: lists = [], isLoading } = trpc.lists.mine.useQuery();
  const { data: reminders } = trpc.lists.reminders.useQuery();
  const { data: shopping } = trpc.lists.shopping.useQuery();

  const builtIn = useMemo<ListSummary[]>(() => {
    const out: ListSummary[] = [];
    for (const l of [reminders, shopping]) if (l && !l.hidden) out.push(l);
    return out;
  }, [reminders, shopping]);
  // Child lists open from Family, not here.
  const mine = useMemo<ListSummary[]>(() => lists.filter((l) => l.type !== 'child'), [lists]);
  const ordered = useMemo(() => [...builtIn, ...mine], [builtIn, mine]);

  // Arrow keys walk the index in the order it is drawn.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (ordered.length === 0) return;
      const i = ordered.findIndex((l) => l.id === selectedId);
      const nextIndex =
        e.key === 'ArrowDown' ? Math.min(ordered.length - 1, i + 1) : Math.max(0, i - 1);
      const next: ListSummary | undefined = ordered[nextIndex];
      if (next && next.id !== selectedId) {
        e.preventDefault();
        onSelect(next);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ordered, selectedId, onSelect]);

  const byId = (id: string): ListSummary | undefined => ordered.find((l) => l.id === id);

  return (
    <aside
      className="flex h-full w-[296px] flex-none flex-col border-r border-border"
      aria-label="Your lists"
    >
      <div className="px-4 pb-1 pt-5">
        <h1
          className="font-head"
          style={{
            fontSize: 'var(--fs-big)',
            fontWeight: 'var(--title-weight)',
            letterSpacing: 'var(--title-tracking)',
          }}
        >
          Lists
        </h1>
      </div>

      <div className="mx-3 mb-1 mt-2 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
        <span className="text-muted" style={{ fontSize: 15 }}>
          ⌕
        </span>
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQ('');
              e.currentTarget.blur();
            }
          }}
          placeholder="Search lists and tasks"
          aria-label="Search lists and tasks"
          className="min-w-0 flex-1 bg-transparent outline-none"
          style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="Clear search"
            className="text-muted"
          >
            ×
          </button>
        ) : (
          <kbd
            className="rounded px-1.5 text-muted"
            style={{ fontSize: 11, background: 'var(--color-chip-bg)' }}
          >
            /
          </kbd>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {query ? (
          isFetching && !results ? (
            <p className="p-3 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Searching…
            </p>
          ) : (
            <>
              {(results?.lists.length ?? 0) > 0 && (
                <>
                  <Group label="Lists" />
                  {results!.lists.map((l) => {
                    const full = byId(l.id);
                    return full ? (
                      <Row
                        key={l.id}
                        list={full}
                        selected={full.id === selectedId}
                        onSelect={onSelect}
                      />
                    ) : null;
                  })}
                </>
              )}
              {(results?.notes.length ?? 0) > 0 && (
                <>
                  <Group label="In notes" />
                  {results!.notes.map((n) => {
                    const full = byId(n.id);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => full && onSelect(full)}
                        className="flex w-full items-start gap-2.5 rounded-card px-2.5 py-2 text-left"
                      >
                        <span style={{ fontSize: 18, lineHeight: '22px' }}>{n.emojiIcon}</span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate font-semibold"
                            style={{ fontSize: 'var(--fs-sm)' }}
                          >
                            {n.name}
                          </span>
                          <span
                            className="block text-muted"
                            style={{
                              fontSize: 'var(--fs-xs)',
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {n.snippet}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
              {(results?.tasks.length ?? 0) > 0 && (
                <>
                  <Group label="Tasks" />
                  {results!.tasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        const full = byId(t.listId);
                        if (full) onSelect(full);
                        onOpenTask(t.id);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-card px-2.5 py-2 text-left"
                    >
                      <span style={{ fontSize: 16 }}>{t.listEmoji}</span>
                      <span
                        className={`min-w-0 flex-1 truncate ${t.completed ? 'text-muted line-through' : ''}`}
                        style={{ fontSize: 'var(--fs-sm)' }}
                      >
                        {t.title}
                      </span>
                    </button>
                  ))}
                </>
              )}
              {(results?.events.length ?? 0) > 0 && (
                <>
                  <Group label="Events" />
                  {results!.events.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => {
                        const full = byId(ev.listId);
                        if (full) onSelect(full);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-card px-2.5 py-2 text-left"
                    >
                      <span style={{ fontSize: 16, lineHeight: '22px' }}>📅</span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate font-semibold"
                          style={{ fontSize: 'var(--fs-sm)' }}
                        >
                          {ev.title}
                        </span>
                        <span
                          className="block truncate text-muted"
                          style={{ fontSize: 'var(--fs-xs)' }}
                        >
                          {new Date(ev.startAt as unknown as string).toLocaleDateString([], {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                          {' · '}
                          {ev.listEmoji} {ev.listName}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
              {(results?.people.length ?? 0) > 0 && (
                <>
                  <Group label="People" />
                  {results!.people.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!p.childListId}
                      onClick={() => p.childListId && onOpenChild(p.childListId)}
                      className="flex w-full items-start gap-2.5 rounded-card px-2.5 py-2 text-left"
                    >
                      <span style={{ fontSize: 16, lineHeight: '22px' }}>{p.avatarEmoji}</span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate font-semibold"
                          style={{ fontSize: 'var(--fs-sm)' }}
                        >
                          {p.name}
                        </span>
                        <span
                          className="block truncate text-muted"
                          style={{ fontSize: 'var(--fs-xs)' }}
                        >
                          {p.snippet ?? (p.kind === 'child' ? 'Child' : 'Grown-up')}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
              {results &&
                results.lists.length === 0 &&
                results.tasks.length === 0 &&
                results.notes.length === 0 &&
                results.events.length === 0 &&
                results.people.length === 0 && (
                  <p className="p-3 text-center text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                    No matches for “{query}”.
                  </p>
                )}
            </>
          )
        ) : isLoading ? (
          <p className="p-3 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Loading…
          </p>
        ) : (
          <>
            {builtIn.length > 0 && (
              <>
                <Group label="Built in" />
                {builtIn.map((l) => (
                  <Row key={l.id} list={l} selected={l.id === selectedId} onSelect={onSelect} />
                ))}
              </>
            )}
            <Group label="Your lists" />
            {mine.length === 0 ? (
              <p className="px-2.5 py-1 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                None yet. Make one below.
              </p>
            ) : (
              mine.map((l) => (
                <Row key={l.id} list={l} selected={l.id === selectedId} onSelect={onSelect} />
              ))
            )}
          </>
        )}
      </div>

      <div className="border-t border-border p-2.5">
        <button
          type="button"
          onClick={onNewList}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-bold text-accent"
          style={{ fontSize: 'var(--fs-sm)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-soft)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        >
          ＋ New list
        </button>
      </div>
    </aside>
  );
}
