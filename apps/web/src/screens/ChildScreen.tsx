import { useEffect, useMemo, useRef, useState } from 'react';
import { BackButton } from '../components/BackButton';
import { QueryState } from '../components/QueryState';
import { trpc } from '../lib/trpc';
import { ChildSetup } from './ChildSetup';
import { DoseSheet } from '../components/DoseSheet';
import { relativeTime } from '../lib/activityText';
import { recursOn } from '../lib/datetime';
import { ChildTodayCard } from '../components/ChildTodayCard';
import { TaskRow } from '../components/TaskRow';
import { EventEditSheet } from '../components/EventEditSheet';
import { Sheet } from '@todolist/kitchen-ui';

/**
 * A child, on day 30 rather than day 1.
 *
 * One card says where they are, who to ring and any medicine still in its
 * window. Under it, one Today — a repeating chore and a form due this
 * afternoon are the same kind of fact — then anything overdue above it and
 * everything later below.
 *
 * Medicine is episodic: intense for three days in ninety, and nothing the rest
 * of the time. It is one quiet row until a dose is live, and then it is the
 * strip at the top of the card. Setup opens over the screen rather than
 * unfolding into the middle of it.
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
  /** A recurring chore, so the row can say so rather than repeat itself. */
  repeats?: boolean;
}

interface DayGroup {
  date: Date;
  items: Item[];
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
  onOpenTask,
  addSignal,
  embedded,
}: {
  listId: string;
  onBack: () => void;
  /** Opens the task's own screen, the way a task row does everywhere else. */
  onOpenTask: (id: string) => void;
  /** Drawn in the Lists workspace's pane, where the index is the way back. */
  embedded?: boolean;
  /** Bumped when the floating + is tapped, so it opens this form. */
  addSignal?: number;
}) {
  const utils = trpc.useUtils();
  const { data: child, isLoading, isError, refetch } = trpc.children.get.useQuery({ listId });
  const [setupOpen, setSetupOpen] = useState(false);
  const [dosing, setDosing] = useState(false);
  const [confirmDose, setConfirmDose] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const { data: meds } = trpc.doses.recent.useQuery({ listId });
  const removeDose = trpc.doses.remove.useMutation({
    onSuccess: () => {
      utils.doses.recent.invalidate({ listId });
      utils.doses.status.invalidate();
    },
  });

  const refresh = () => {
    utils.children.get.invalidate({ listId });
    utils.children.mine.invalidate();
  };
  const toggleTask = trpc.tasks.toggle.useMutation({ onSuccess: refresh });
  const removeTask = trpc.tasks.remove.useMutation({ onSuccess: refresh });

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
  const addFormRef = useRef<HTMLDivElement>(null);
  const lastAddSignal = useRef(addSignal);
  useEffect(() => {
    if (addSignal !== lastAddSignal.current) {
      lastAddSignal.current = addSignal;
      setDate((d) => d || todayInput());
      setAdding(true);
    }
  }, [addSignal]);

  // The form lives at the foot of a long page, so opening it from the floating
  // + used to change nothing you could see.
  useEffect(() => {
    if (!adding) return;
    const id = requestAnimationFrame(() => {
      addFormRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [adding]);

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
  const { overdue, todayItems, laterGroups } = useMemo(() => {
    const empty = {
      overdue: [] as Item[],
      todayItems: [] as Item[],
      laterGroups: [] as DayGroup[],
    };
    if (!child) return empty;
    const all: Item[] = [];

    for (const t of child.tasks) {
      const base = {
        id: t.id,
        title: t.title,
        kind: 'task' as const,
        done: Boolean(t.completedAt),
        timeLabel: null,
      };
      if (t.recurrenceRule) {
        // A weekly chore would otherwise generate a dozen identical rows a
        // term and drown every real one, so it surfaces on the day it fires.
        if (recursOn(t.recurrenceRule, new Date(), t.dueAt as unknown as string | null)) {
          all.push({ ...base, when: startOfToday(), repeats: true });
        }
        continue;
      }
      if (t.dueAt) all.push({ ...base, when: new Date(t.dueAt) });
    }

    for (const e of child.events) {
      const start = new Date(e.startAt);
      all.push({
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

    all.sort((a, b) => a.when.getTime() - b.when.getTime());

    // Three buckets rather than two lists and a heading. A repeating chore and
    // a form due today are both things due today, and were landing in separate
    // sections either side of everything else.
    const startToday = startOfToday().getTime();
    const startTomorrow = startToday + 86_400_000;
    const od: Item[] = [];
    const now: Item[] = [];
    const later: Item[] = [];
    for (const it of all) {
      const t = it.when.getTime();
      // A finished item is not overdue, whatever its date says.
      if (t < startToday) (it.done ? now : od).push(it);
      else if (t < startTomorrow) now.push(it);
      else later.push(it);
    }

    const byDay = new Map<string, Item[]>();
    for (const it of later) {
      const key = it.when.toDateString();
      byDay.set(key, [...(byDay.get(key) ?? []), it]);
    }
    return {
      overdue: od,
      todayItems: now,
      laterGroups: [...byDay.entries()].map(([key, items]) => ({ date: new Date(key), items })),
    };
  }, [child]);

  if (!child) {
    return (
      <>
        {!embedded && <BackButton label="Back" onClick={onBack} />}
        <QueryState isLoading={isLoading} isError={isError} onRetry={() => void refetch()}>
          {null}
        </QueryState>
      </>
    );
  }

  const hasPattern = child.days.length > 0;
  const first = child.name.split(' ')[0];
  const sectionH = 'mb-d2 mt-d4 font-bold uppercase text-muted';
  const sectionStyle = { fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' };

  /**
   * A task here is a task everywhere else in the app.
   *
   * These rows used to be a checkbox and a run of dead text: nothing on this
   * screen could be opened, rescheduled or deleted, so a form added for the
   * wrong day could only be ticked or left. TaskRow brings tap-to-open and the
   * swipe gestures with it. An event is not a task — you do not tick a concert
   * — so it keeps its own row, and opens its editor.
   */
  const itemRow = (it: Item) => {
    if (it.kind === 'event') {
      return (
        <button
          key={it.id}
          type="button"
          onClick={() => setEditEventId(it.id)}
          // mb-d2 rather than a gap on the container: TaskRow carries its own
          // bottom margin, and the two lists interleave.
          className="mb-d2 flex w-full items-center gap-d3 rounded-card bg-surface p-d3 text-left shadow-card"
        >
          <span
            className="flex-none whitespace-nowrap text-muted"
            style={{ fontSize: 'var(--fs-xs)', minWidth: '3rem' }}
          >
            {it.timeLabel ?? 'All day'}
          </span>
          <span className="min-w-0 flex-1" style={{ fontSize: 'var(--fs-base)' }}>
            {it.title}
          </span>
          <span className="flex-none text-muted" style={{ fontSize: 16 }}>
            ›
          </span>
        </button>
      );
    }
    return (
      <TaskRow
        key={it.id}
        task={{
          id: it.id,
          title: it.title,
          completed: it.done,
          recurrence: it.repeats ? 'Weekly' : undefined,
        }}
        onToggle={(id, completed) => toggleTask.mutate({ id, completed })}
        onOpen={onOpenTask}
        onDelete={(id) => removeTask.mutate({ id })}
      />
    );
  };

  const doseRow = (d: NonNullable<typeof meds>['doses'][number]) => (
    <div
      key={d.id}
      className="flex items-center gap-d3 border-b border-border px-3.5 py-2.5 last:border-0"
    >
      <span
        className="flex-none whitespace-nowrap text-muted"
        style={{ fontSize: 'var(--fs-xs)', minWidth: '3.4rem' }}
      >
        {new Date(d.givenAt as unknown as string).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block" style={{ fontSize: 'var(--fs-sm)' }}>
          <b>{d.medicine}</b>
          {d.amount ? ` · ${d.amount}` : ''}
          {d.note ? <span className="text-muted"> · {d.note}</span> : null}
        </span>
        <span className="block text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
          {relativeTime(d.givenAt as unknown as string)}
          {d.givenByName ? ` · ${d.givenByName.split(' ')[0]}` : ''}
        </span>
      </span>
      {/* A dose is a medical record — the app's own copy says everyone sees
          when the next one is due — so removing one asks first. */}
      <button
        type="button"
        aria-label={
          confirmDose === d.id
            ? `Remove the ${d.medicine} dose for good?`
            : `Remove this ${d.medicine} dose`
        }
        onClick={() =>
          confirmDose === d.id ? removeDose.mutate({ id: d.id }) : setConfirmDose(d.id)
        }
        onBlur={() => setConfirmDose((c) => (c === d.id ? null : c))}
        className="grid h-11 w-11 flex-none place-items-center rounded-full"
        style={{
          fontSize: confirmDose === d.id ? 'var(--fs-xs)' : 16,
          color: confirmDose === d.id ? 'var(--color-danger)' : 'var(--color-muted)',
          background: confirmDose === d.id ? 'var(--color-danger-soft)' : 'transparent',
        }}
      >
        {confirmDose === d.id ? 'Sure?' : '×'}
      </button>
    </div>
  );

  // Today's doses are the ones you are counting; the rest of the week is
  // history, and sits behind a disclosure rather than on the screen.
  const startToday = startOfToday().getTime();
  const allDoses = meds?.doses ?? [];
  const dosesToday = allDoses.filter(
    (d) => new Date(d.givenAt as unknown as string).getTime() >= startToday,
  );
  const dosesEarlier = allDoses.filter(
    (d) => new Date(d.givenAt as unknown as string).getTime() < startToday,
  );

  return (
    <>
      {!embedded && <BackButton label="Back" onClick={onBack} />}

      <ChildTodayCard
        name={child.name}
        emojiIcon={child.emojiIcon}
        color={child.color}
        today={child.today}
        profile={child.profile}
        periods={child.periods}
        doses={meds?.status ?? []}
        onLogDose={() => setDosing(true)}
      />

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

      {overdue.length > 0 && (
        <>
          <h2 className={sectionH} style={{ ...sectionStyle, color: 'var(--color-danger)' }}>
            Overdue · since {dayHeading(overdue[0]!.when)}
          </h2>
          <div className="mb-d3">{overdue.map(itemRow)}</div>
        </>
      )}

      {/* One Today. A repeating chore and a form due this afternoon are both
          things due today; they used to sit in separate sections with the
          whole of Medicine and Coming up between them. */}
      <h2 className={sectionH} style={sectionStyle}>
        Today
      </h2>
      {todayItems.length === 0 ? (
        <p className="mb-d3 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          Nothing for {first} today.
        </p>
      ) : (
        <div className="mb-d3">{todayItems.map(itemRow)}</div>
      )}

      {laterGroups.length > 0 && (
        <>
          <h2 className={sectionH} style={sectionStyle}>
            Later
          </h2>
          <div className="mb-d3 flex flex-col gap-d3">
            {laterGroups.map((g) => (
              <div key={g.date.toDateString()}>
                <div className="mb-1 font-semibold text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                  {dayHeading(g.date)}
                </div>
                <div>{g.items.map(itemRow)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Medicine is episodic — it matters intensely for three days in ninety.
          With nothing in the last 24 hours it is one quiet row; the live status
          rides in the card at the top, and the week's history stays folded. */}
      {(meds?.status.length ?? 0) === 0 ? (
        <button
          type="button"
          onClick={() => setDosing(true)}
          className="mb-d3 flex w-full items-center gap-d3 rounded-card bg-surface p-d3 text-left shadow-card"
        >
          <span className="flex-none" style={{ fontSize: 15 }}>
            💊
          </span>
          <span className="min-w-0 flex-1 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            No medicine in the last 24 hours
          </span>
          <span
            className="flex-none font-semibold text-accent"
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            Log a dose
          </span>
        </button>
      ) : (
        <>
          <div className="mb-d2 flex items-baseline justify-between">
            <h2 className={sectionH} style={{ ...sectionStyle, marginTop: 0 }}>
              Medicine · today
            </h2>
            <button
              type="button"
              onClick={() => setDosing(true)}
              className="font-semibold text-accent"
              style={{ fontSize: 'var(--fs-xs)' }}
            >
              ＋ Log a dose
            </button>
          </div>
          {dosesToday.length > 0 && (
            <div className="mb-d2 overflow-hidden rounded-card bg-surface shadow-card">
              {dosesToday.map(doseRow)}
            </div>
          )}
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            className="mb-d3 font-semibold text-accent"
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            {historyOpen ? 'Hide earlier doses' : 'Earlier this week →'}
          </button>
          {historyOpen && (
            <div className="mb-d3 overflow-hidden rounded-card bg-surface shadow-card">
              {dosesEarlier.length > 0 ? (
                dosesEarlier.map(doseRow)
              ) : (
                <p className="p-d3 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                  Nothing before today.
                </p>
              )}
            </div>
          )}
        </>
      )}
      {adding ? (
        <div
          ref={addFormRef}
          className="mb-d3 flex flex-col gap-d2 rounded-card bg-surface p-d3 shadow-card"
        >
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

      {/* Setup opens over the screen rather than unfolding six hundred lines of
          forms into the middle of it. Configuring a child and reading a child
          are different jobs, and this is the boundary. */}
      <button
        type="button"
        onClick={() => setSetupOpen(true)}
        className="mb-d2 flex w-full items-center gap-2 rounded-card bg-surface p-d3 text-left"
      >
        <span className="flex-1 font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
          Week, terms &amp; details
        </span>
        <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          {hasPattern ? `${child.days.length} days · ${child.periods.length} dates` : 'Not set up'}
        </span>
        <span className="text-muted" style={{ fontSize: 16 }}>
          ›
        </span>
      </button>

      <Sheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        title={`${first}'s week, terms and details`}
        maxHeight="88%"
      >
        <h3 className="mb-2 font-head" style={{ fontSize: 'var(--fs-lg)' }}>
          {first}&rsquo;s week &amp; school
        </h3>
        {setupOpen && <ChildSetup child={child} listId={listId} onChanged={refresh} />}
      </Sheet>

      {editEventId &&
        (() => {
          const ev = child.events.find((e) => e.id === editEventId);
          if (!ev) return null;
          return (
            <EventEditSheet
              event={{
                id: ev.id,
                listId,
                title: ev.title,
                startAt: new Date(ev.startAt as unknown as string).toISOString(),
                endAt: new Date(ev.endAt as unknown as string).toISOString(),
                allDay: ev.allDay,
                assigneeId: null,
                recurrenceRule: ev.recurrenceRule,
              }}
              lists={[{ id: listId, name: child.name, emojiIcon: child.emojiIcon }]}
              people={[]}
              onClose={() => setEditEventId(null)}
              onDone={() => {
                setEditEventId(null);
                refresh();
              }}
            />
          );
        })()}

      {dosing && (
        <DoseSheet
          listId={listId}
          childName={child.name}
          presets={meds?.presets ?? []}
          onClose={() => setDosing(false)}
          onDone={() => {
            setDosing(false);
            utils.doses.recent.invalidate({ listId });
            utils.doses.status.invalidate();
            utils.activity.recent.invalidate();
            utils.children.get.invalidate({ listId });
          }}
        />
      )}
    </>
  );
}
