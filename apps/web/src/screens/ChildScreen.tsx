import { useEffect, useMemo, useRef, useState } from 'react';
import { BackButton } from '../components/BackButton';
import { trpc } from '../lib/trpc';
import { ChildSetup } from './ChildSetup';

/**
 * A child, on day 30 rather than day 1.
 *
 * Setting up the weekly pattern and term dates happens once; after that the
 * screen is a working list of this child's things, and the whole of that setup
 * shows as a single derived line at the top — "Today · Primary school 9:00–3:00".
 * The setup surfaces themselves fold into one row at the foot. Nothing is
 * removed as the child fills up; the weight shifts.
 */

const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** RRULE day codes, indexed by Date.getDay(). */
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

interface Item {
  id: string;
  title: string;
  when: Date;
  kind: 'task' | 'event';
  done: boolean;
  timeLabel: string | null;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "Today", "Tomorrow", the weekday within the week, then a full date. */
function dayHeading(d: Date): string {
  const days = Math.round((d.getTime() - startOfToday().getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1 && days < 7) return DAY_LONG[d.getDay()]!;
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

export function ChildScreen({
  listId,
  onBack,
  addSignal,
}: {
  listId: string;
  onBack: () => void;
  /** Bumped when the floating + is tapped, so it opens this form. */
  addSignal?: number;
}) {
  const utils = trpc.useUtils();
  const { data: child, isLoading } = trpc.children.get.useQuery({ listId });
  const [setupOpen, setSetupOpen] = useState(false);

  const refresh = () => {
    utils.children.get.invalidate({ listId });
    utils.children.mine.invalidate();
  };
  const toggleTask = trpc.tasks.toggle.useMutation({ onSuccess: refresh });

  // Capture lives on the screen, not only behind the floating button — and the
  // presence of a time decides task or event, rather than asking. Nobody
  // holding a note from school wants to answer a taxonomy question first.
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [weekly, setWeekly] = useState(false);

  const todayInput = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Opened by the floating +, but only when it is actually tapped — not on
  // mount, which would spring the form open every time you enter the screen.
  const lastAddSignal = useRef(addSignal);
  useEffect(() => {
    if (addSignal !== lastAddSignal.current) {
      lastAddSignal.current = addSignal;
      setDate((d) => d || todayInput());
      setAdding(true);
    }
  }, [addSignal]);

  const closeAdd = () => {
    setAdding(false);
    setTitle('');
    setDate('');
    setTime('');
    setWeekly(false);
  };
  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      refresh();
      closeAdd();
    },
  });
  const createEvent = trpc.events.create.useMutation({
    onSuccess: () => {
      refresh();
      closeAdd();
    },
  });
  const saving = createTask.isPending || createEvent.isPending;

  function save() {
    const t = title.trim();
    if (!t || !date) return;
    if (time) {
      // A time makes it an event, and an event can repeat weekly.
      const start = new Date(`${date}T${time}`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const RR = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      createEvent.mutate({
        listId,
        title: t,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        allDay: false,
        ...(weekly ? { recurrenceRule: `FREQ=WEEKLY;BYDAY=${RR[start.getDay()]}` } : {}),
      });
      return;
    }
    createTask.mutate({
      listId,
      title: t,
      dueAt: new Date(`${date}T09:00`).toISOString(),
      ...(weekly
        ? { recurrenceRule: `FREQ=WEEKLY;BYDAY=${RRULE_DAYS[new Date(`${date}T09:00`).getDay()]}` }
        : {}),
    });
  }

  // Dated one-offs and events interleave by date. A weekly recurring task would
  // otherwise generate a dozen identical rows a term and drown every real one,
  // so recurring items surface only on the day they actually fire.
  const { groups, todayRoutine } = useMemo(() => {
    if (!child) return { groups: [], todayRoutine: [] as Item[] };
    const weekday = new Date().getDay();
    const routine: Item[] = [];
    const dated: Item[] = [];

    for (const t of child.tasks) {
      const base = {
        id: t.id,
        title: t.title,
        kind: 'task' as const,
        done: Boolean(t.completedAt),
        timeLabel: null,
      };
      if (t.recurrenceRule) {
        if (t.recurrenceRule.includes(RRULE_DAYS[weekday]!)) {
          routine.push({ ...base, when: startOfToday() });
        }
        continue;
      }
      if (t.dueAt) dated.push({ ...base, when: new Date(t.dueAt) });
    }

    for (const e of child.events) {
      const start = new Date(e.startAt);
      dated.push({
        id: e.id,
        title: e.title,
        when: start,
        kind: 'event',
        done: false,
        timeLabel: e.allDay
          ? null
          : start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      });
    }

    // Past items are kept, not dropped — an overdue form is the thing you most
    // need to see. Sorting puts them first.
    dated.sort((a, b) => a.when.getTime() - b.when.getTime());

    const byDay = new Map<string, Item[]>();
    for (const it of dated) {
      const key = it.when.toDateString();
      byDay.set(key, [...(byDay.get(key) ?? []), it]);
    }
    return {
      groups: [...byDay.entries()].map(([key, items]) => ({ date: new Date(key), items })),
      todayRoutine: routine,
    };
  }, [child]);

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

  const hasPattern = child.days.length > 0;
  const t = child.today;
  const contextLine = t.offReason
    ? t.offReason
    : t.place
      ? `${t.place}${t.startTime ? ` ${t.startTime}${t.endTime ? `–${t.endTime}` : ''}` : ''}`
      : hasPattern
        ? 'Nothing on today'
        : null;

  const isOverdue = (d: Date) => d.getTime() < startOfToday().getTime();

  const checkbox = (done: boolean, onClick: () => void, label: string) => (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-5 w-5 flex-none place-items-center rounded-check border"
      style={{
        borderColor: done ? 'var(--color-accent)' : 'var(--color-check-border)',
        background: done ? 'var(--color-accent)' : 'transparent',
        color: 'var(--color-accent-contrast)',
        fontSize: 12,
      }}
    >
      {done ? '✓' : ''}
    </button>
  );

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
        <div className="min-w-0">
          <h1
            className="font-head truncate"
            style={{
              fontSize: 'var(--fs-big)',
              fontWeight: 'var(--title-weight)',
              letterSpacing: 'var(--title-tracking)',
            }}
          >
            {child.name}
          </h1>
          {/* The whole visible payoff of the weekly pattern and the term dates. */}
          {contextLine && (
            <div className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Today · {contextLine}
            </div>
          )}
        </div>
      </header>

      {/* Emergency information does not live behind a chevron. */}
      {child.profile?.medicalNotes && (
        <div
          className="mb-d3 flex items-start gap-2 rounded-card p-d3"
          style={{ background: 'var(--color-danger-soft)' }}
        >
          <span style={{ fontSize: 15, lineHeight: 1.3 }}>⚠️</span>
          <span style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.45 }}>
            {child.profile.medicalNotes}
          </span>
        </div>
      )}

      {!hasPattern && !setupOpen && (
        <div className="mb-d3 rounded-card bg-surface p-d4 shadow-card">
          <p className="font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
            Let&rsquo;s set up {child.name}&rsquo;s week.
          </p>
          <p className="mt-1 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            About a minute. You can change anything later.
          </p>
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="mt-d3 w-full rounded-full py-2.5 font-bold text-accent-contrast"
            style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
          >
            Set up the week
          </button>
        </div>
      )}

      {/* Today's routine: present, but calmer than the dated items. */}
      {todayRoutine.length > 0 && (
        <div className="mb-d3">
          <h2
            className="mb-d2 font-bold uppercase text-muted"
            style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
          >
            Today
          </h2>
          <div className="flex flex-col gap-d2">
            {todayRoutine.map((it) => (
              <div key={it.id} className="flex items-center gap-d3 rounded-card bg-surface p-d3">
                {checkbox(
                  it.done,
                  () => toggleTask.mutate({ id: it.id, completed: !it.done }),
                  it.done ? 'Mark not done' : 'Mark done',
                )}
                <span
                  className={it.done ? 'flex-1 text-muted line-through' : 'flex-1 text-muted'}
                  style={{ fontSize: 'var(--fs-base)' }}
                >
                  {it.title}
                </span>
                <span className="flex-none text-muted" style={{ fontSize: 12 }} title="Every week">
                  ↻
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2
        className="mb-d2 font-bold uppercase text-muted"
        style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
      >
        Coming up
      </h2>

      {groups.length === 0 ? (
        <p className="mb-d3 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          Nothing dated yet. Anything you add to {child.name} with a due date turns up here.
        </p>
      ) : (
        <div className="mb-d3 flex flex-col gap-d3">
          {groups.map((g) => (
            <div key={g.date.toDateString()}>
              <div
                className="mb-1 font-semibold"
                style={{
                  fontSize: 'var(--fs-xs)',
                  color: isOverdue(g.date) ? 'var(--color-danger)' : 'var(--color-muted)',
                }}
              >
                {isOverdue(g.date) ? 'Overdue · ' : ''}
                {dayHeading(g.date)}
              </div>
              <div className="flex flex-col gap-d2">
                {g.items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-d3 rounded-card bg-surface p-d3 shadow-card"
                    style={
                      isOverdue(g.date)
                        ? { boxShadow: 'inset 3px 0 0 0 var(--color-danger)' }
                        : undefined
                    }
                  >
                    {it.kind === 'task' ? (
                      checkbox(
                        it.done,
                        () => toggleTask.mutate({ id: it.id, completed: !it.done }),
                        it.done ? 'Mark not done' : 'Mark done',
                      )
                    ) : (
                      // No checkbox on an event: you do not tick a concert.
                      <span
                        className="w-12 flex-none text-muted"
                        style={{ fontSize: 'var(--fs-xs)' }}
                      >
                        {it.timeLabel ?? 'All day'}
                      </span>
                    )}
                    <span
                      className={it.done ? 'flex-1 text-muted line-through' : 'flex-1'}
                      style={{ fontSize: 'var(--fs-base)' }}
                    >
                      {it.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="mb-d3 flex flex-col gap-d2 rounded-card bg-surface p-d3 shadow-card">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Something for ${child.name}…`}
            className="rounded-check border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
            style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date"
              className="min-w-0 flex-1 rounded-check border border-border bg-bg px-2 py-2 outline-none focus:border-accent"
              style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Time, if it has one"
              className="min-w-0 flex-1 rounded-check border border-border bg-bg px-2 py-2 outline-none focus:border-accent"
              style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}
            />
          </div>
          <label className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)' }}>
            <input
              type="checkbox"
              checked={weekly}
              onChange={(e) => setWeekly(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)', width: 16, height: 16 }}
            />
            Repeats weekly
          </label>
          <p className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
            {time
              ? 'With a time it goes on the calendar as an event.'
              : 'With no time it is a task you can tick off.'}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeAdd}
              className="text-muted"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!title.trim() || !date || saving}
              onClick={save}
              className="rounded-full px-4 py-2 font-bold text-accent-contrast disabled:opacity-50"
              style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDate((d) => d || todayInput());
            setAdding(true);
          }}
          className="mb-d3 w-full rounded-card border border-dashed border-border py-3 font-semibold text-muted"
          style={{ fontSize: 'var(--fs-sm)' }}
        >
          + Add for {child.name}
        </button>
      )}

      {/* Everything setup built, folded away once it has been answered. */}
      <button
        type="button"
        onClick={() => setSetupOpen((v) => !v)}
        aria-expanded={setupOpen}
        className="mb-d2 flex w-full items-center gap-2 rounded-card bg-surface p-d3 text-left"
      >
        <span className="flex-1 font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
          Week &amp; school
        </span>
        <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          {hasPattern ? `${child.days.length} days · ${child.periods.length} dates` : 'Not set up'}
        </span>
        <span className="text-muted" style={{ fontSize: 16 }}>
          {setupOpen ? '⌃' : '⌄'}
        </span>
      </button>

      {setupOpen && <ChildSetup child={child} listId={listId} onChanged={refresh} />}
    </>
  );
}
