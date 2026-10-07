import { useEffect, useState } from 'react';
import type { WeekProposal } from '../adapter';
import { Sheet } from './Sheet';
import { ChipButton, PrimaryButton } from './ui';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayOf = (d: string) => DAY[new Date(`${d}T00:00:00`).getDay()]!;

/**
 * The suggested week, before anything is planned: each night's pick and why,
 * a tick to keep it, "shuffle" for another go. Only kept nights are planned.
 */
export function SuggestSheet({
  open,
  proposals,
  catalogSize,
  loading,
  applying,
  error,
  onShuffle,
  onApply,
  onClose,
}: {
  open: boolean;
  proposals: WeekProposal[];
  catalogSize: number;
  loading: boolean;
  applying: boolean;
  error: string | null;
  onShuffle: () => void;
  onApply: (kept: WeekProposal[]) => void;
  onClose: () => void;
}) {
  const [skip, setSkip] = useState<Set<string>>(new Set());
  useEffect(() => setSkip(new Set()), [proposals]);
  const kept = proposals.filter((p) => !skip.has(p.date));

  return (
    <Sheet open={open} onClose={onClose} title="Suggest the week">
      <div className="flex flex-col gap-d3 p-d4">
        <h2 className="font-head font-bold" style={{ fontSize: 'var(--fs-lg)' }}>
          ✨ Suggested for this week
        </h2>
        <p className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          Picked from your recipes: favourites and things you haven't had in a while, and meals that
          use up what another night is already buying.
        </p>
        {error && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--fs-sm)' }}>
            {error}
          </p>
        )}
        {loading ? (
          <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
            Thinking…
          </p>
        ) : proposals.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
            {catalogSize < 2
              ? 'Add a few recipes first; the suggestions come from meals you already have.'
              : 'Every night this week is already planned, or there is nothing left to suggest.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-d2">
            {proposals.map((p) => {
              const off = skip.has(p.date);
              return (
                <li key={p.date}>
                  <button
                    type="button"
                    onClick={() =>
                      setSkip((s) => {
                        const n = new Set(s);
                        if (n.has(p.date)) n.delete(p.date);
                        else n.add(p.date);
                        return n;
                      })
                    }
                    aria-pressed={!off}
                    className="flex w-full items-start gap-d3 rounded-card bg-surface p-d3 text-left shadow-card"
                    style={{ opacity: off ? 0.45 : 1 }}
                  >
                    <span
                      className="flex-none font-bold uppercase text-muted"
                      style={{ fontSize: 'var(--fs-xs)', minWidth: 32, paddingTop: 3 }}
                    >
                      {dayOf(p.date)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold" style={{ fontSize: 'var(--fs-base)' }}>
                        {p.name}
                      </span>
                      {p.reasons.length > 0 && (
                        <span className="block text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                          {p.reasons.join(' · ')}
                        </span>
                      )}
                    </span>
                    <span aria-hidden="true">{off ? '⬜' : '✅'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex gap-d2 pb-d2">
          <PrimaryButton
            className="flex-1 py-3"
            disabled={kept.length === 0 || applying || loading}
            onClick={() => onApply(kept)}
          >
            {applying
              ? 'Planning…'
              : `Plan ${kept.length} ${kept.length === 1 ? 'night' : 'nights'}`}
          </PrimaryButton>
          <ChipButton
            onClick={onShuffle}
            disabled={loading || applying}
            style={{ fontSize: 'var(--fs-sm)', padding: '0.6rem 1rem' }}
          >
            🔀 Shuffle
          </ChipButton>
        </div>
      </div>
    </Sheet>
  );
}
