import { useEffect, useState } from 'react';
import { trpc } from '../lib/trpc';

const field = 'w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none';
const fieldStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' };

/** Candidate text as "Brisbane, Queensland, Australia" — only the parts that exist. */
function label(c: { name: string; admin1: string | null; country: string | null }): string {
  return [c.name, c.admin1, c.country].filter(Boolean).join(', ');
}

/**
 * Where the household lives, for weather and local time elsewhere in the app.
 * A plain text search against Open-Meteo's own place list — no map, just pick
 * from what it finds.
 */
export function HomeTownSettings({
  current,
  onDone,
}: {
  current: string | null;
  onDone: () => void;
}) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: results = [], isFetching } = trpc.household.searchTowns.useQuery(
    { q: debounced },
    { enabled: debounced.length >= 2 },
  );
  const setHomeTown = trpc.household.setHomeTown.useMutation({ onSuccess: onDone });

  return (
    <div>
      <p className="mb-d3 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
        {current
          ? `Currently ${current}. Search to change it, or clear it below.`
          : "Not set yet — weather won't show until it is."}
      </p>

      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search for a town"
        aria-label="Search for a town"
        className={field}
        style={fieldStyle}
      />

      {isFetching && debounced.length >= 2 && (
        <p className="mt-2 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          Searching…
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-d2 overflow-hidden rounded-card bg-surface shadow-card">
          {results.map((c, i) => (
            <button
              key={`${c.lat},${c.lon}`}
              type="button"
              disabled={setHomeTown.isPending}
              onClick={() =>
                setHomeTown.mutate({
                  name: label(c),
                  lat: c.lat,
                  lon: c.lon,
                  timezone: c.timezone,
                })
              }
              className={`block w-full px-3.5 py-3 text-left disabled:opacity-50 ${
                i > 0 ? 'border-t border-border' : ''
              }`}
              style={{ fontSize: 'var(--fs-base)' }}
            >
              {label(c)}
            </button>
          ))}
        </div>
      )}

      {!isFetching && debounced.length >= 2 && results.length === 0 && (
        <p className="mt-2 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          Nothing found for "{debounced}".
        </p>
      )}

      {current && (
        <button
          type="button"
          disabled={setHomeTown.isPending}
          onClick={() => setHomeTown.mutate(null)}
          className="mt-d3 w-full rounded-card py-3 font-bold text-danger disabled:opacity-50"
          style={{ background: 'var(--color-danger-soft)', fontSize: 'var(--fs-base)' }}
        >
          Clear home town
        </button>
      )}
    </div>
  );
}
