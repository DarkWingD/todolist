import { useEffect, useState } from 'react';
import { trpc } from '../lib/trpc';

const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// Monday-first order, in Date.getDay() numbers.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

interface DayCell {
  week: 0 | 1;
  weekday: number;
}
const key = (d: DayCell) => `${d.week}:${d.weekday}`;

/**
 * An adult's working pattern: which days over a week (or a fortnight), one
 * set of hours, a place, and a note for whatever a grid can't say.
 */
export function WorkWeekSheet({
  person: p,
  onClose,
  onDone,
}: {
  person: { id: string; name: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.household.workWeek.useQuery({ personId: p.id });
  const [fortnightly, setFortnightly] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [place, setPlace] = useState('Work');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!data || seeded) return;
    setSeeded(true);
    setFortnightly(data.fortnightly);
    setPicked(new Set(data.days.map((d) => key({ week: d.week as 0 | 1, weekday: d.weekday }))));
    const first = data.days[0];
    if (first) {
      setPlace(first.place);
      setFrom(first.startTime ?? '');
      setTo(first.endTime ?? '');
    }
    setNote(data.note ?? '');
  }, [data, seeded]);

  const save = trpc.household.setWorkWeek.useMutation({
    onSuccess: () => {
      utils.household.workWeek.invalidate({ personId: p.id });
      utils.household.whereToday.invalidate();
      utils.household.get.invalidate();
      onDone();
    },
  });
  const swap = trpc.household.swapFortnight.useMutation({
    onSuccess: () => {
      utils.household.workWeek.invalidate();
      utils.household.whereToday.invalidate();
    },
  });

  const toggle = (d: DayCell) =>
    setPicked((prev) => {
      const n = new Set(prev);
      const k = key(d);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const count = [...picked].filter((k) => fortnightly || k.startsWith('0:')).length;
  const field = 'w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none';
  const fieldStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' };
  const label = 'mb-1.5 mt-3 block font-semibold text-muted';
  const labelStyle = { fontSize: 'var(--fs-sm)' };

  const weekRow = (week: 0 | 1) => (
    <div className="flex gap-1.5">
      {ORDER.map((weekday) => {
        const on = picked.has(key({ week, weekday }));
        return (
          <button
            key={weekday}
            type="button"
            aria-pressed={on}
            aria-label={`${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday]}${
              fortnightly ? `, week ${week === 0 ? 'A' : 'B'}` : ''
            }`}
            onClick={() => toggle({ week, weekday })}
            className="grid h-10 flex-1 place-items-center rounded-lg font-bold"
            style={{
              fontSize: 'var(--fs-sm)',
              background: on ? 'var(--color-accent)' : 'var(--color-chip-bg)',
              color: on ? 'var(--color-accent-contrast)' : 'var(--color-muted)',
            }}
          >
            {DAY_SHORT[weekday]}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div
        className="fixed inset-0 z-30"
        style={{ background: 'rgba(0,0,0,.4)' }}
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md overflow-y-auto p-4"
        style={{
          background: 'var(--color-bg)',
          borderRadius: '22px 22px 0 0',
          maxHeight: '88%',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        }}
      >
        <div
          className="mx-auto mb-3 h-1.5 w-10 rounded-full"
          style={{ background: 'var(--color-check-border)' }}
        />
        <h3 className="font-head" style={{ fontSize: 18 }}>
          {p.name.split(' ')[0]}'s week
        </h3>
        <p className="mb-3 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          Tap the days they work. Anything unticked is a day off.
        </p>

        {isLoading ? (
          <p className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Loading…
          </p>
        ) : (
          <>
            <div
              className="mb-3 flex rounded-lg p-0.5"
              style={{ background: 'var(--color-chip-bg)' }}
            >
              {[
                { v: false, label: 'Every week' },
                { v: true, label: 'Fortnight' },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  onClick={() => setFortnightly(o.v)}
                  className="flex-1 rounded-md py-1.5 font-semibold"
                  style={{
                    fontSize: 'var(--fs-sm)',
                    background: fortnightly === o.v ? 'var(--color-surface)' : 'transparent',
                    color: fortnightly === o.v ? 'var(--color-text)' : 'var(--color-muted)',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {fortnightly ? (
              <>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="font-semibold text-muted" style={labelStyle}>
                    Week A{data?.currentWeek === 0 ? ' · this week' : ''}
                  </span>
                </div>
                {weekRow(0)}
                <div className="mb-1 mt-3 flex items-baseline justify-between">
                  <span className="font-semibold text-muted" style={labelStyle}>
                    Week B{data?.currentWeek === 1 ? ' · this week' : ''}
                  </span>
                  <button
                    type="button"
                    disabled={swap.isPending}
                    onClick={() => swap.mutate()}
                    className="font-semibold text-accent"
                    style={{ fontSize: 'var(--fs-xs)' }}
                  >
                    Swap A and B
                  </button>
                </div>
                {weekRow(1)}
              </>
            ) : (
              weekRow(0)
            )}

            <label className={label} style={labelStyle}>
              Where
            </label>
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Work"
              className={field}
              style={fieldStyle}
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={label} style={labelStyle}>
                  From
                </label>
                <input
                  type="time"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className={field}
                  style={fieldStyle}
                />
              </div>
              <div className="flex-1">
                <label className={label} style={labelStyle}>
                  To
                </label>
                <input
                  type="time"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={field}
                  style={fieldStyle}
                />
              </div>
            </div>
            <label className={label} style={labelStyle}>
              Note
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="WFH Fridays, on call every third weekend…"
              className={field}
              style={fieldStyle}
            />

            <button
              type="button"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  personId: p.id,
                  fortnightly,
                  note: note.trim() || null,
                  days: [...picked].map((k) => {
                    const [w, d] = k.split(':');
                    return {
                      week: Number(w) as 0 | 1,
                      weekday: Number(d),
                      place: place.trim() || 'Work',
                      startTime: from || null,
                      endTime: to || null,
                    };
                  }),
                })
              }
              className="mt-4 w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-50"
              style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
            >
              {save.isPending
                ? 'Saving…'
                : `Save · ${count} ${count === 1 ? 'day' : 'days'} ${fortnightly ? 'a fortnight' : 'a week'}`}
            </button>
          </>
        )}
      </div>
    </>
  );
}
