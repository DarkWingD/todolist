import { useState } from 'react';
import { BackButton } from '../components/BackButton';
import { trpc } from '../lib/trpc';

const KIND_LABEL = { term: 'Term', break: 'Holidays', closure: 'Day off' } as const;
const KIND_COLOR = {
  term: 'var(--color-accent)',
  break: 'var(--color-muted)',
  closure: '#f59e0b',
} as const;

/** Sunday-first, matching Date.getDay() so the index is the stored value. */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-d4">
      <h2
        className="mb-d2 font-bold uppercase text-muted"
        style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

export function ChildScreen({ listId, onBack }: { listId: string; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data: child, isLoading } = trpc.children.get.useQuery({ listId });
  const refresh = () => {
    utils.children.get.invalidate({ listId });
    utils.children.mine.invalidate();
  };

  const setDays = trpc.children.setDays.useMutation({ onSuccess: refresh });
  const upsertPeriod = trpc.children.upsertPeriod.useMutation({ onSuccess: refresh });
  const removePeriod = trpc.children.removePeriod.useMutation({ onSuccess: refresh });
  const updateProfile = trpc.children.updateProfile.useMutation({ onSuccess: refresh });

  const [editingDays, setEditingDays] = useState(false);
  const [draftDays, setDraftDays] = useState<
    Record<number, { place: string; from: string; to: string }>
  >({});
  const [addingPeriod, setAddingPeriod] = useState(false);
  const [pKind, setPKind] = useState<'term' | 'break' | 'closure'>('term');
  const [pName, setPName] = useState('');
  const [pStart, setPStart] = useState('');
  const [pEnd, setPEnd] = useState('');

  if (isLoading || !child) {
    return (
      <>
        <BackButton label="Lists" onClick={onBack} />
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Loading…
        </p>
      </>
    );
  }

  function startEditingDays() {
    const seed: Record<number, { place: string; from: string; to: string }> = {};
    for (const d of child!.days) {
      seed[d.weekday] = { place: d.place, from: d.startTime ?? '', to: d.endTime ?? '' };
    }
    setDraftDays(seed);
    setEditingDays(true);
  }

  function saveDays() {
    // A day with no place is a day off — the absence of a row is how "nowhere"
    // is stored, rather than a row saying "home".
    const days = Object.entries(draftDays)
      .filter(([, v]) => v.place.trim())
      .map(([weekday, v]) => ({
        weekday: Number(weekday),
        place: v.place.trim(),
        startTime: v.from || null,
        endTime: v.to || null,
      }));
    setDays.mutate({ listId, days });
    setEditingDays(false);
  }

  const byWeekday = new Map(child.days.map((d) => [d.weekday, d]));
  const profile = child.profile;

  return (
    <>
      <BackButton label="Lists" onClick={onBack} />

      <header className="mb-d3 flex items-center gap-d3">
        <span
          className="grid h-11 w-11 flex-none place-items-center rounded-emoji"
          style={{
            fontSize: 22,
            background: child.color
              ? `color-mix(in srgb, ${child.color} 22%, var(--color-surface))`
              : 'var(--color-emoji-bg)',
          }}
        >
          {child.emojiIcon}
        </span>
        <h1
          className="font-head"
          style={{
            fontSize: 'var(--fs-big)',
            fontWeight: 'var(--title-weight)',
            letterSpacing: 'var(--title-tracking)',
          }}
        >
          {child.name}
        </h1>
      </header>

      <Section title={`Where ${child.name} is`}>
        {editingDays ? (
          <div className="flex flex-col gap-d2">
            {DAY_NAMES.map((label, weekday) => {
              const v = draftDays[weekday] ?? { place: '', from: '', to: '' };
              const set = (patch: Partial<typeof v>) =>
                setDraftDays((d) => ({ ...d, [weekday]: { ...v, ...patch } }));
              return (
                <div key={weekday} className="flex items-center gap-2">
                  <span
                    className="w-10 flex-none font-bold uppercase text-muted"
                    style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.07em' }}
                  >
                    {label}
                  </span>
                  <input
                    value={v.place}
                    onChange={(e) => set({ place: e.target.value })}
                    placeholder="Nowhere"
                    className="min-w-0 flex-1 rounded-check border border-border bg-bg px-2 py-1.5 outline-none focus:border-accent"
                    style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}
                  />
                  <input
                    type="time"
                    value={v.from}
                    onChange={(e) => set({ from: e.target.value })}
                    aria-label={`${label} start time`}
                    className="w-24 flex-none rounded-check border border-border bg-bg px-2 py-1.5 outline-none focus:border-accent"
                    style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}
                  />
                  <input
                    type="time"
                    value={v.to}
                    onChange={(e) => set({ to: e.target.value })}
                    aria-label={`${label} end time`}
                    className="w-24 flex-none rounded-check border border-border bg-bg px-2 py-1.5 outline-none focus:border-accent"
                    style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}
                  />
                </div>
              );
            })}
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingDays(false)}
                className="text-muted"
                style={{ fontSize: 'var(--fs-sm)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDays}
                className="rounded-full px-4 py-2 font-bold text-accent-contrast"
                style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 md:grid-cols-7">
              {DAY_NAMES.map((label, weekday) => {
                const d = byWeekday.get(weekday);
                return (
                  <div
                    key={weekday}
                    className="flex flex-col items-center gap-1 rounded-card p-2 text-center"
                    style={{
                      background: d ? 'var(--color-surface)' : 'transparent',
                      border: d ? 'none' : '1.5px dashed var(--color-border)',
                      minHeight: 74,
                    }}
                  >
                    <span
                      className="font-bold uppercase text-muted"
                      style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.07em' }}
                    >
                      {label}
                    </span>
                    <span
                      className={d ? 'font-semibold' : 'text-muted'}
                      style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.25 }}
                    >
                      {d?.place ?? '—'}
                    </span>
                    {d?.startTime && (
                      <span className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                        {d.startTime}
                        {d.endTime ? `–${d.endTime}` : ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={startEditingDays}
              className="mt-d2 rounded-full px-3 py-1.5 font-semibold text-muted"
              style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-xs)' }}
            >
              Edit the week
            </button>
          </>
        )}
      </Section>

      <Section title="Term dates">
        <div className="flex flex-col gap-d2">
          {child.periods.length === 0 && !addingPeriod && (
            <p className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
              None yet. Without term dates the week above is assumed to run all year.
            </p>
          )}
          {child.periods.map((p) => (
            <div key={p.id} className="flex items-center gap-d3 rounded-card bg-surface p-d3">
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ background: KIND_COLOR[p.kind] }}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
                  {p.name}
                </span>
                <span className="block text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                  {KIND_LABEL[p.kind]} · {p.startDate}
                  {p.endDate !== p.startDate ? ` – ${p.endDate}` : ''}
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

          {addingPeriod ? (
            <div className="flex flex-col gap-2 rounded-card bg-surface p-d3">
              <div className="flex rounded-lg p-0.5" style={{ background: 'var(--color-chip-bg)' }}>
                {(['term', 'break', 'closure'] as const).map((k) => (
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
                className="rounded-check border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={pStart}
                  onChange={(e) => {
                    setPStart(e.target.value);
                    // A day off is one day; filling the end saves a step and is
                    // right far more often than it is wrong.
                    if (pKind === 'closure' || !pEnd) setPEnd(e.target.value);
                  }}
                  aria-label="Start date"
                  className="min-w-0 flex-1 rounded-check border border-border bg-bg px-2 py-2 outline-none focus:border-accent"
                  style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}
                />
                <input
                  type="date"
                  value={pEnd}
                  onChange={(e) => setPEnd(e.target.value)}
                  aria-label="End date"
                  className="min-w-0 flex-1 rounded-check border border-border bg-bg px-2 py-2 outline-none focus:border-accent"
                  style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddingPeriod(false)}
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
                    setAddingPeriod(false);
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
              onClick={() => setAddingPeriod(true)}
              className="self-start rounded-full px-3 py-1.5 font-semibold text-muted"
              style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-xs)' }}
            >
              + Add term, holidays or a day off
            </button>
          )}
        </div>
      </Section>

      <Section title="Details">
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
                defaultValue={profile?.[key] ?? ''}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value === (profile?.[key] ?? '')) return;
                  updateProfile.mutate({ listId, [key]: value || null });
                }}
                className="rounded-check border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
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
              defaultValue={profile?.medicalNotes ?? ''}
              rows={3}
              placeholder="Anything a carer would need in a hurry"
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value === (profile?.medicalNotes ?? '')) return;
                updateProfile.mutate({ listId, medicalNotes: value || null });
              }}
              className="rounded-check border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
              style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
            />
          </label>
        </div>
      </Section>
    </>
  );
}
