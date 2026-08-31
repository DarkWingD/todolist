import { useState } from 'react';
import { trpc } from '../lib/trpc';

interface MinimalList {
  id: string;
  name: string;
  emojiIcon: string;
}

export function SearchScreen({ onOpenList }: { onOpenList: (list: MinimalList) => void }) {
  const [q, setQ] = useState('');
  const query = q.trim();
  const { data, isFetching } = trpc.search.query.useQuery(
    { q: query },
    { enabled: query.length > 0 },
  );

  return (
    <>
      <div className="mb-d3 flex items-center gap-2 rounded-card border border-border bg-surface px-3 py-3 shadow-card">
        <span className="text-muted" style={{ fontSize: 16 }}>
          ⌕
        </span>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tasks and lists…"
          className="flex-1 bg-transparent outline-none"
          style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
        />
      </div>

      {query.length === 0 ? (
        <p className="mt-6 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Search across everything you can see.
        </p>
      ) : isFetching && !data ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>Searching…</p>
      ) : (
        <>
          {(data?.lists.length ?? 0) > 0 && (
            <>
              <h2 className="mb-d2 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}>
                Lists
              </h2>
              {data!.lists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onOpenList(l)}
                  className="mb-d2 flex w-full items-center gap-d3 rounded-card bg-surface p-d3 text-left shadow-card"
                >
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-emoji text-lg" style={{ background: 'var(--color-emoji-bg)' }}>
                    {l.emojiIcon}
                  </span>
                  <span className="font-semibold" style={{ fontSize: 'var(--fs-base)' }}>{l.name}</span>
                </button>
              ))}
            </>
          )}
          {(data?.tasks.length ?? 0) > 0 && (
            <>
              <h2 className="mb-d2 mt-d3 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}>
                Tasks
              </h2>
              {data!.tasks.map((t) => (
                <div key={t.id} className="mb-d2 flex items-center gap-d3 rounded-card bg-surface p-d3 shadow-card">
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
          {data && data.lists.length === 0 && data.tasks.length === 0 && (
            <p className="mt-6 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
              No matches for “{query}”.
            </p>
          )}
        </>
      )}
    </>
  );
}
