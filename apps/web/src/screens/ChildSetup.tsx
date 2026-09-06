import { useState } from 'react';
import { trpc } from '../lib/trpc';

/**
 * Setup, folded behind one row on the child screen.
 *
 * The weekly pattern is entered PLACE-FIRST — "School, which days?" — rather
 * than day-first. Day-first means seven rows of text inputs and time pickers to
 * express a fact the parent could say in six words, which is what made this
 * feel like configuring a router. Place-first is usually one sheet and one tap.
 *
 * Holiday breaks are never entered: the gap between two terms is derived as
 * one, server-side. That halves the typing and removes the off-by-one where a
 * hand-typed break overlaps the term it follows.
 */

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KIND_LABEL = { term: 'Term', break: 'Holidays', closure: 'Day off' } as const;

/** Times most places keep, so the common case needs no picker at all. */
function guessTimes(place: string): { from: string; to: string } {
  const p = place.toLowerCase();
  if (/school/.test(p)) return { from: '09:00', to: '15:00' };
  if (/care|kindy|kinder|creche|crèche/.test(p)) return { from: '08:00', to: '17:00' };
  return { from: '', to: '' };
}

/** "Mon–Fri" for a run, "Mon, Wed, Fri" when scattered. */
function describeDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const d of sorted) {
    const last = runs[runs.length - 1];
    if (last && d === last[last.length - 1]! + 1) last.push(d);
    else runs.push([d]);
  }
  return runs
    .map((r) =>
      r.length >= 3
        ? `${DAY_SHORT[r[0]!]}–${DAY_SHORT[r[r.length - 1]!]}`
        : r.map((d) => DAY_SHORT[d]).join(', '),
    )
    .join(', ');
}

type ChildData = {
  days: { weekday: number; place: string; startTime: string | null; endTime: string | null }[];
  periods: {
    id: string;
    kind: 'term' | 'break' | 'closure';
    name: string;
    startDate: string;
    endDate: string;
  }[];
  profile: {
    className: string | null;
    room: string | null;
    teacher: string | null;
    officePhone: string | null;
    medicalNotes: string | null;
  } | null;
};

export function ChildSetup({
  child,
  listId,
  onChanged,
}: {
  child: ChildData;
  listId: string;
  onChanged: () => void;
}) {
  const setDays = trpc.children.setDays.useMutation({ onSuccess: onChanged });
  const upsertPeriod = trpc.children.upsertPeriod.useMutation({ onSuccess: onChanged });
  const removePeriod = trpc.children.removePeriod.useMutation({ onSuccess: onChanged });
  const updateProfile = trpc.children.updateProfile.useMutation({ onSuccess: onChanged });

  // Place sheet
  const [placeOpen, setPlaceOpen] = useState(false);
  const [place, setPlace] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editingPlace, setEditingPlace] = useState<string | null>(null);

  // Period form
  const [periodOpen, setPeriodOpen] = useState(false);
  const [pKind, setPKind] = useState<'term' | 'closure'>('term');
  const [pName, setPName] = useState('');
  const [pStart, setPStart] = useState('');
  const [pEnd, setPEnd] = useState('');

  // Days sharing a place collapse to one row, which is how people describe it.
  const byPlace = new Map<string, typeof child.days>();
  for (const d of child.days) byPlace.set(d.place, [...(byPlace.get(d.place) ?? []), d]);

  function openPlace(existing?: string) {
    if (existing) {
      const rows = byPlace.get(existing)!;
      setPlace(existing);
      setPicked(rows.map((r) => r.weekday));
      setFrom(rows[0]?.startTime ?? '');
      setTo(rows[0]?.endTime ?? '');
      setEditingPlace(existing);
    } else {
      setPlace('');
      // The first place a child gets is nearly always the school week.
      setPicked(child.days.length === 0 ? [1, 2, 3, 4, 5] : []);
      setFrom('');
      setTo('');
      setEditingPlace(null);
    }
    setPlaceOpen(true);
  }

  function savePlace() {
    const name = place.trim();
    if (!name) return;
    // Days claimed by this place are taken from whatever held them before, so
    // the last edit wins rather than a day belonging to two places at once.
    const kept = child.days.filter((d) => !picked.includes(d.weekday) && d.place !== editingPlace);
    const mine = picked.map((weekday) => ({
      weekday,
      place: name,
      startTime: from || null,
      endTime: to || null,
    }));
    setDays.mutate({
      listId,
      days: [...kept, ...mine].map((d) => ({
        weekday: d.weekday,
        place: d.place,
        startTime: d.startTime,
        endTime: d.endTime,
      })),
    });
    setPlaceOpen(false);
  }

  function clearPlace(name: string) {
    setDays.mutate({
      listId,
      days: child.days
        .filter((d) => d.place !== name)
        .map((d) => ({
          weekday: d.weekday,
          place: d.place,
          startTime: d.startTime,
          endTime: d.endTime,
        })),
    });
  }

  const field =
    'rounded-check border border-border bg-bg px-3 py-2 outline-none focus:border-accent';
  const fieldStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' } as const;
  const terms = child.periods.filter((p) => p.kind === 'term');

  return (
    <div className="mb-d4 flex flex-col gap-d4 rounded-card bg-surface p-d3">
      {/* ── the week ── */}
      <div>
        <h3
          className="mb-d2 font-bold uppercase text-muted"
          style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
        >
          The week
        </h3>

        {byPlace.size === 0 && !placeOpen && (
          <div className="flex flex-wrap gap-d2">
            {['School', 'Daycare', 'Kindy'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  const t = guessTimes(p);
                  setPlace(p);
                  setPicked([1, 2, 3, 4, 5]);
                  setFrom(t.from);
                  setTo(t.to);
                  setEditingPlace(null);
                  setPlaceOpen(true);
                }}
                className="rounded-full px-4 py-2.5 font-semibold"
                style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-sm)' }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {[...byPlace.entries()].map(([name, rows]) => (
          <div
            key={name}
            className="mb-d2 flex items-center gap-d3 rounded-card p-d3"
            style={{ background: 'var(--color-bg)' }}
          >
            <span
              className="h-8 w-1 flex-none rounded-full"
              style={{ background: 'var(--color-accent)' }}
            />
            <button
              type="button"
              onClick={() => openPlace(name)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
                {name} · {describeDays(rows.map((r) => r.weekday))}
              </span>
              <span className="block text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                {rows[0]?.startTime
                  ? `${rows[0].startTime}${rows[0].endTime ? `–${rows[0].endTime}` : ''}`
                  : 'No times set'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => clearPlace(name)}
              aria-label={`Remove ${name}`}
              className="flex-none text-muted"
              style={{ fontSize: 16 }}
            >
              ×
            </button>
          </div>
        ))}

        {placeOpen ? (
          <div
            className="flex flex-col gap-d2 rounded-card p-d3"
            style={{ background: 'var(--color-bg)' }}
          >
            <input
              autoFocus
              value={place}
              onChange={(e) => {
                setPlace(e.target.value);
                if (!from && !to) {
                  const t = guessTimes(e.target.value);
                  setFrom(t.from);
                  setTo(t.to);
                }
              }}
              placeholder="School, Daycare, Kindy…"
              className={field}
              style={fieldStyle}
            />
            <div className="flex justify-between gap-1">
              {DAY_INITIALS.map((d, i) => {
                const on = picked.includes(i);
                const taken = child.days.find((x) => x.weekday === i && x.place !== place);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    aria-label={DAY_SHORT[i]}
                    onClick={() => setPicked((v) => (on ? v.filter((x) => x !== i) : [...v, i]))}
                    className="grid h-10 w-10 place-items-center rounded-full font-bold"
                    style={{
                      fontSize: 'var(--fs-sm)',
                      background: on ? 'var(--color-accent)' : 'transparent',
                      color: on ? 'var(--color-accent-contrast)' : 'var(--color-text)',
                      border: on ? 'none' : '1px solid var(--color-border)',
                      opacity: !on && taken ? 0.5 : 1,
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            {/* Say what a day change costs before it is committed, not after. */}
            {picked.some((i) => child.days.find((x) => x.weekday === i && x.place !== place)) && (
              <p className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                {picked
                  .map((i) => child.days.find((x) => x.weekday === i && x.place !== place))
                  .filter(Boolean)
                  .map((d) => `${DAY_SHORT[d!.weekday]} replaces ${d!.place}`)
                  .join(' · ')}
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="Start time"
                className={`flex-1 ${field}`}
                style={fieldStyle}
              />
              <span className="text-muted">–</span>
              <input
                type="time"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="End time"
                className={`flex-1 ${field}`}
                style={fieldStyle}
              />
            </div>
            <p className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
              One time for all of these days. A day that finishes early can be split out afterwards
              by tapping it.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPlaceOpen(false)}
                className="text-muted"
                style={{ fontSize: 'var(--fs-sm)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!place.trim() || picked.length === 0}
                onClick={savePlace}
                className="rounded-full px-4 py-2 font-bold text-accent-contrast disabled:opacity-50"
                style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          byPlace.size > 0 && (
            <button
              type="button"
              onClick={() => openPlace()}
              className="rounded-full px-3 py-1.5 font-semibold text-muted"
              style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-xs)' }}
            >
              + Add a place
            </button>
          )
        )}
      </div>

      {/* ── terms ── */}
      <div>
        <h3
          className="mb-d2 font-bold uppercase text-muted"
          style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
        >
          Term dates
        </h3>

        {child.periods.length === 0 && !periodOpen && (
          <p className="mb-d2 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            None yet, so the week above is assumed to run all year.
          </p>
        )}

        {terms.length > 1 && (
          <p className="mb-d2 text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
            Holidays are worked out from the gaps between terms — no need to enter them.
          </p>
        )}

        {child.periods.map((p) => (
          <div
            key={p.id}
            className="mb-d2 flex items-center gap-d3 rounded-card p-d3"
            style={{ background: 'var(--color-bg)' }}
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
                {p.name}
              </span>
              <span className="block text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                {KIND_LABEL[p.kind]} ·{' '}
                {new Date(`${p.startDate}T00:00:00`).toLocaleDateString([], {
                  day: 'numeric',
                  month: 'short',
                })}
                {p.endDate !== p.startDate
                  ? ` – ${new Date(`${p.endDate}T00:00:00`).toLocaleDateString([], {
                      day: 'numeric',
                      month: 'short',
                    })}`
                  : ''}
              </span>
            </span>
            <button
              type="button"
              onClick={() => removePeriod.mutate({ listId, id: p.id })}
              aria-label={`Remove ${p.name}`}
              className="flex-none text-muted"
              style={{ fontSize: 16 }}
            >
              ×
            </button>
          </div>
        ))}

        {periodOpen ? (
          <div
            className="flex flex-col gap-2 rounded-card p-d3"
            style={{ background: 'var(--color-bg)' }}
          >
            <div className="flex rounded-lg p-0.5" style={{ background: 'var(--color-chip-bg)' }}>
              {(['term', 'closure'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPKind(k)}
                  className="flex-1 rounded-md py-1.5 font-semibold"
                  style={{
                    fontSize: 'var(--fs-sm)',
                    background: pKind === k ? 'var(--color-surface)' : 'transparent',
                    color: pKind === k ? 'var(--color-text)' : 'var(--color-muted)',
                  }}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <input
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              placeholder={pKind === 'closure' ? 'Pupil-free day' : 'Term 4'}
              className={field}
              style={fieldStyle}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={pStart}
                onChange={(e) => {
                  setPStart(e.target.value);
                  // A day off is one day; filling the end is right far more
                  // often than it is wrong, and saves a tap either way.
                  if (pKind === 'closure' || !pEnd) setPEnd(e.target.value);
                }}
                aria-label="Start date"
                className={`min-w-0 flex-1 ${field}`}
                style={fieldStyle}
              />
              {pKind === 'term' && (
                <input
                  type="date"
                  value={pEnd}
                  onChange={(e) => setPEnd(e.target.value)}
                  aria-label="End date"
                  className={`min-w-0 flex-1 ${field}`}
                  style={fieldStyle}
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPeriodOpen(false)}
                className="text-muted"
                style={{ fontSize: 'var(--fs-sm)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!pName.trim() || !pStart || !pEnd}
                onClick={() => {
                  upsertPeriod.mutate({
                    listId,
                    kind: pKind,
                    name: pName.trim(),
                    startDate: pStart,
                    endDate: pEnd,
                  });
                  setPeriodOpen(false);
                  setPName('');
                  setPStart('');
                  setPEnd('');
                }}
                className="rounded-full px-4 py-2 font-bold text-accent-contrast disabled:opacity-50"
                style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPeriodOpen(true)}
            className="rounded-full px-3 py-1.5 font-semibold text-muted"
            style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-xs)' }}
          >
            + Add a term or a day off
          </button>
        )}
      </div>

      {/* ── details ── */}
      <div>
        <h3
          className="mb-d2 font-bold uppercase text-muted"
          style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
        >
          Details
        </h3>
        <div className="flex flex-col gap-d2">
          {(
            [
              ['className', 'Class'],
              ['room', 'Room'],
              ['teacher', 'Teacher or educator'],
              ['officePhone', 'Office phone'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span
                className="font-bold uppercase text-muted"
                style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
              >
                {label}
              </span>
              <input
                defaultValue={child.profile?.[key] ?? ''}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value === (child.profile?.[key] ?? '')) return;
                  updateProfile.mutate({ listId, [key]: value || null });
                }}
                className={field}
                style={fieldStyle}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span
              className="font-bold uppercase text-muted"
              style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
            >
              Medical &amp; allergies
            </span>
            <textarea
              defaultValue={child.profile?.medicalNotes ?? ''}
              rows={3}
              placeholder="Anything a carer would need in a hurry"
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value === (child.profile?.medicalNotes ?? '')) return;
                updateProfile.mutate({ listId, medicalNotes: value || null });
              }}
              className={field}
              style={fieldStyle}
            />
            <span className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
              Shown at the top of this screen, never hidden behind a tap.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
