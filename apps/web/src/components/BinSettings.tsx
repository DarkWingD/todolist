import { useEffect, useState } from 'react';
import { EmojiPicker } from './EmojiPicker';
import { trpc } from '../lib/trpc';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const field = 'w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none';
const fieldStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' };

type Row = {
  name: string;
  emoji: string;
  weekday: number;
  fortnightly: boolean;
  anchorDate: string;
  assigneeId: string | null;
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Bin night as a household pattern rather than a repeating chore.
 *
 * A list, not a fixed rubbish/recycling/green triple: plenty of households have
 * only a weekly rubbish bin. Each row says which day and how often, so the wall
 * works out which bin it is this week instead of anyone maintaining it.
 */
export function BinSettings({
  people,
  onDone,
}: {
  people: { id: string; name: string; kind: 'adult' | 'child' }[];
  onDone: () => void;
}) {
  const { data: saved } = trpc.household.bins.useQuery();
  const save = trpc.household.setBins.useMutation({ onSuccess: onDone });
  const [rows, setRows] = useState<Row[]>([]);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!saved || seeded) return;
    setSeeded(true);
    setRows(
      saved.map((b) => ({
        name: b.name,
        emoji: b.emoji,
        weekday: b.weekday,
        fortnightly: b.fortnightly,
        anchorDate: b.anchorDate,
        assigneeId: b.assigneeId,
      })),
    );
  }, [saved, seeded]);

  const set = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <div>
      <p className="mb-d3 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
        The wall display says which bin to put out the evening before it's collected. Add only the
        bins you actually have.
      </p>

      {rows.map((r, i) => (
        <div key={i} className="mb-d3 rounded-card bg-surface p-d3 shadow-card">
          <div className="flex gap-2">
            <input
              value={r.name}
              onChange={(e) => set(i, { name: e.target.value })}
              placeholder="Rubbish"
              aria-label="Bin name"
              className={field}
              style={fieldStyle}
            />
            <button
              type="button"
              aria-label={`Remove ${r.name || 'bin'}`}
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              className="flex-none rounded-full px-3 font-bold text-danger"
              style={{ background: 'var(--color-danger-soft)', fontSize: 'var(--fs-sm)' }}
            >
              Remove
            </button>
          </div>

          <div className="mb-1 mt-3 font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Its emoji
          </div>
          <EmojiPicker value={r.emoji} onChange={(emoji) => set(i, { emoji })} />

          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={r.weekday}
              onChange={(e) => set(i, { weekday: Number(e.target.value) })}
              aria-label="Collection day"
              className={field}
              style={{ ...fieldStyle, width: 'auto', flex: '1 1 8rem' }}
            >
              {DAYS.map((d, n) => (
                <option key={d} value={n}>
                  Collected {d}
                </option>
              ))}
            </select>
            <select
              value={r.fortnightly ? '2' : '1'}
              onChange={(e) => set(i, { fortnightly: e.target.value === '2' })}
              aria-label="How often"
              className={field}
              style={{ ...fieldStyle, width: 'auto', flex: '1 1 8rem' }}
            >
              <option value="1">Every week</option>
              <option value="2">Every 2 weeks</option>
            </select>
          </div>

          {/* Only a fortnightly bin needs to be told which of the two weeks it
              falls on; for a weekly one the date would be noise. */}
          {r.fortnightly && (
            <>
              <div
                className="mb-1 mt-3 font-semibold text-muted"
                style={{ fontSize: 'var(--fs-sm)' }}
              >
                A date it's next collected
              </div>
              <input
                type="date"
                value={r.anchorDate}
                onChange={(e) => set(i, { anchorDate: e.target.value })}
                aria-label="A date it is collected"
                className={field}
                style={fieldStyle}
              />
            </>
          )}

          <div className="mb-1 mt-3 font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Who puts it out
          </div>
          <select
            value={r.assigneeId ?? ''}
            onChange={(e) => set(i, { assigneeId: e.target.value || null })}
            aria-label="Who puts it out"
            className={field}
            style={fieldStyle}
          >
            <option value="">Nobody in particular</option>
            {people
              .filter((p) => p.kind === 'adult')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setRows((r) => [
            ...r,
            {
              name: '',
              emoji: '🗑️',
              weekday: 4,
              fortnightly: false,
              anchorDate: todayKey(),
              assigneeId: rows[0]?.assigneeId ?? null,
            },
          ])
        }
        className="mb-d3 rounded-full px-3 py-1.5 font-bold text-accent"
        style={{ background: 'var(--color-accent-soft)', fontSize: 'var(--fs-sm)' }}
      >
        + Add a bin
      </button>

      <button
        type="button"
        disabled={save.isPending || rows.some((r) => !r.name.trim())}
        onClick={() => save.mutate({ bins: rows.map((r) => ({ ...r, name: r.name.trim() })) })}
        className="w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-50"
        style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
      >
        {save.isPending ? 'Saving…' : 'Save bins'}
      </button>
    </div>
  );
}
