import { useEffect, useRef, useState } from 'react';
import { CreateListForm } from '../components/CreateListForm';
import { listSubtitle } from '../lib/listSubtitle';
import { trpc } from '../lib/trpc';
import type { ListSummary, ListType } from '../types';

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
      className="mb-d2 flex w-full items-center gap-d3 rounded-card bg-surface p-d3 text-left shadow-card md:mb-0"
    >
      <span
        className="grid h-10 w-10 flex-none place-items-center rounded-emoji text-xl"
        style={{
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
      <span className="min-w-0 flex-1">
        <span className="block font-semibold" style={{ fontSize: 'var(--fs-lg)' }}>
          {l.name}
        </span>
        <span className="block truncate text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
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
  type?: ListType;
}

export function ListsScreen({
  onOpenList,
  createSignal,
}: {
  onOpenList: (list: MinimalList) => void;
  createSignal?: number;
}) {
  const [q, setQ] = useState('');
  const query = q.trim();
  const { data: results, isFetching } = trpc.search.query.useQuery(
    { q: query },
    { enabled: query.length > 0 },
  );
  const { data: allLists = [], isLoading } = trpc.lists.mine.useQuery();
  // Kids have their own tab now; their lists open from there.
  const lists = allLists.filter((l) => l.type !== 'child');
  const { data: remindersList } = trpc.lists.reminders.useQuery();
  const { data: shoppingList } = trpc.lists.shopping.useQuery();
  const [creating, setCreating] = useState(false);

  // The floating + button opens the create form — but only when actually tapped
  // (signal changes), not on mount when returning to the tab.
  const lastCreateSignal = useRef(createSignal);
  useEffect(() => {
    if (createSignal !== lastCreateSignal.current) {
      lastCreateSignal.current = createSignal;
      setCreating(true);
    }
  }, [createSignal]);

  const hitRow = (l: { id: string; name: string; emojiIcon: string }, sub?: string) => (
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
      <span className="min-w-0 flex-1">
        <span className="block font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
          {l.name}
        </span>
        {sub && (
          <span className="block truncate text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {sub}
          </span>
        )}
      </span>
    </button>
  );

  const sectionH = (label: string, top?: boolean) => (
    <h2
      className={`mb-d2 font-bold uppercase text-muted ${top ? '' : 'mt-d3'}`}
      style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
    >
      {label}
    </h2>
  );

  return (
    <>
      <header className="mb-d3">
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
      </header>

      {/* Search lives here rather than in its own tab — it is nearly always a
          list or a task inside one that you are looking for. */}
      <div className="mb-d3 flex items-center gap-2 rounded-card border border-border bg-surface px-3 py-3 shadow-card md:max-w-lg">
        <span className="text-muted" style={{ fontSize: 16 }}>
          ⌕
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tasks, lists and notes…"
          aria-label="Search tasks, lists and notes"
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
                {sectionH('Lists', true)}
                {results!.lists.map((l) => hitRow(l))}
              </>
            )}
            {(results?.notes.length ?? 0) > 0 && (
              <>
                {sectionH('In notes')}
                {results!.notes.map((n) => hitRow(n, n.snippet))}
              </>
            )}
            {(results?.tasks.length ?? 0) > 0 && (
              <>
                {sectionH('Tasks')}
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
            {results &&
              results.lists.length === 0 &&
              results.tasks.length === 0 &&
              results.notes.length === 0 && (
                <p className="mt-6 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
                  No matches for “{query}”.
                </p>
              )}
          </>
        )
      ) : (
        <>
          {creating && (
            <div className="mb-d3 md:max-w-lg">
              <CreateListForm
                usedColors={lists.map((l) => l.color)}
                onCreated={() => setCreating(false)}
                onCancel={() => setCreating(false)}
              />
            </div>
          )}

          {isLoading ? (
            <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
              Loading…
            </p>
          ) : lists.length === 0 && !creating && !remindersList && !shoppingList ? (
            <div className="mt-8 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
              <div className="mb-2 text-4xl">🗂️</div>
              No lists yet. Tap + to make your first.
            </div>
          ) : (
            /* A list card is a compact row, not prose, so it tiles rather than
               stretches. The cards keep a readable size and the window's width
               buys more of them on screen instead of longer lines. */
            <div className="md:grid md:grid-cols-2 md:items-start md:gap-d2 xl:grid-cols-3">
              {remindersList && !remindersList.hidden && (
                <ListCard
                  list={remindersList}
                  subtitle={listSubtitle(remindersList)}
                  onOpen={onOpenList}
                />
              )}

              {shoppingList && !shoppingList.hidden && (
                <ListCard
                  list={shoppingList}
                  subtitle={listSubtitle(shoppingList)}
                  onOpen={onOpenList}
                />
              )}

              {lists.map((l) => (
                <ListCard key={l.id} list={l} subtitle={listSubtitle(l)} onOpen={onOpenList} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
