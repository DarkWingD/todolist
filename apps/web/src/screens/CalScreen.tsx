import type { CalendarView } from '@todolist/shared';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { addDays, sameDay, startOfDay, startOfWeekMon, WEEKDAY_INITIALS } from '../lib/caldate';
import { fromLocalInput, toLocalInput } from '../lib/datetime';
import { trpc } from '../lib/trpc';

const NEUTRAL = '#9aa3b8';
const BIRTHDAY_COLOR = '#EC4899';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const VIEWS: { v: CalendarView; label: string }[] = [
  { v: 'month', label: 'Month' },
  { v: 'week', label: 'Week' },
  { v: 'agenda', label: 'Agenda' },
  { v: 'list', label: 'List' },
];
const isWeekendCol = (i: number) => i === 5 || i === 6;

type SheetMode = null | 'day' | 'choose' | 'event' | 'birthday';

interface CalItem {
  key: string;
  kind: 'event' | 'task' | 'birthday';
  title: string;
  color: string;
  time?: string;
  emoji?: string;
  id?: string;
}

export function CalScreen({
  onOpenTask,
  createSignal,
}: {
  onOpenTask: (id: string) => void;
  createSignal?: number;
}) {
  const utils = trpc.useUtils();
  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return startOfDay(d);
  });
  const [selDay, setSelDay] = useState<Date>(() => startOfDay(new Date()));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<SheetMode>(null);

  const { data: prefs } = trpc.prefs.get.useQuery();
  const setCalView = trpc.prefs.setCalendarView.useMutation();
  const seededView = useRef(false);
  useEffect(() => {
    if (prefs && !seededView.current) {
      seededView.current = true;
      if (prefs.calendarView) setView(prefs.calendarView);
    }
  }, [prefs]);

  function changeView(v: CalendarView) {
    setView(v);
    setCalView.mutate({ view: v });
  }

  // Range covers the month grid AND ~45 days forward (for List), in one query.
  const gridStart = startOfWeekMon(cursor);
  const gridEnd = addDays(gridStart, 42);
  const startToday = startOfDay(new Date());
  const listEnd = addDays(startToday, 46);
  const from = gridStart < startToday ? gridStart : startToday;
  const to = gridEnd > listEnd ? gridEnd : listEnd;

  const { data: people = [] } = trpc.calendar.people.useQuery();
  const { data: birthdays = [] } = trpc.birthdays.list.useQuery();
  const { data: lists = [] } = trpc.lists.mine.useQuery();
  const { data: range } = trpc.calendar.range.useQuery({ from: from.toISOString(), to: to.toISOString() });

  const lastCreateSignal = useRef(createSignal);
  useEffect(() => {
    if (createSignal !== lastCreateSignal.current) {
      lastCreateSignal.current = createSignal;
      setSheet('choose');
    }
  }, [createSignal]);

  const colorFor = (id: string | null | undefined) =>
    (id && people.find((p) => p.id === id)?.avatarColor) || NEUTRAL;
  const isHidden = (id: string | null | undefined) => !!id && hidden.has(id);
  const toggleHidden = (id: string) =>
    setHidden((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const events = range?.events ?? [];
  const tasks = range?.tasks ?? [];

  function itemsFor(day: Date): CalItem[] {
    const out: CalItem[] = [];
    for (const ev of events) {
      const s = startOfDay(new Date(ev.startAt as unknown as string));
      const e = startOfDay(new Date(ev.endAt as unknown as string));
      if (day >= s && day <= e && !isHidden(ev.assigneeId)) {
        out.push({
          key: 'e' + ev.id + day.getDate(),
          kind: 'event',
          title: ev.title,
          color: colorFor(ev.assigneeId),
          time: ev.allDay
            ? undefined
            : new Date(ev.startAt as unknown as string).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          emoji: ev.assigneeEmoji ?? undefined,
        });
      }
    }
    for (const b of birthdays) {
      if (b.month === day.getMonth() + 1 && b.day === day.getDate() && !isHidden(b.linkedUserId)) {
        out.push({
          key: 'b' + b.id,
          kind: 'birthday',
          title: `${b.name}${b.year ? ` (${day.getFullYear() - b.year})` : ''}`,
          color: colorFor(b.linkedUserId) === NEUTRAL ? BIRTHDAY_COLOR : colorFor(b.linkedUserId),
        });
      }
    }
    for (const t of tasks) {
      if (t.dueAt && sameDay(startOfDay(new Date(t.dueAt as unknown as string)), day) && !isHidden(t.assigneeId)) {
        out.push({ key: 't' + t.id, kind: 'task', title: t.title, color: colorFor(t.assigneeId), id: t.id });
      }
    }
    return out;
  }

  const today = startOfDay(new Date());
  const FULLBLEED = { marginLeft: 'calc(-1 * var(--space-4))', marginRight: 'calc(-1 * var(--space-4))' };

  // ─────────── an item row (agenda/list/day sheet) ───────────
  function evtRow(it: CalItem) {
    return (
      <div
        key={it.key}
        className="mb-d2 flex items-center gap-3 rounded-card bg-surface p-d3 shadow-card"
        style={{ fontSize: 'var(--fs-base)' }}
        onClick={() => it.kind === 'task' && it.id && onOpenTask(it.id)}
      >
        <span className="self-stretch rounded-full" style={{ width: 4, background: it.color, minHeight: 28 }} />
        <span className="min-w-0 flex-1">
          <span className="block">{it.kind === 'birthday' ? '🎂 ' : ''}{it.title}</span>
        </span>
        {it.time && <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>{it.time}</span>}
      </div>
    );
  }

  // ─────────── MONTH ───────────
  function monthView() {
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const day = addDays(gridStart, i);
      const inMonth = day.getMonth() === cursor.getMonth();
      const items = itemsFor(day);
      const isToday = sameDay(day, today);
      const col = i % 7;
      cells.push(
        <div
          key={i}
          onClick={() => { setSelDay(day); setSheet('day'); }}
          className="flex min-h-0 cursor-pointer flex-col gap-px overflow-hidden border-b border-r"
          style={{ borderColor: 'var(--color-border)', padding: '1px 2px 2px', background: isWeekendCol(col) ? 'var(--color-weekend, transparent)' : 'transparent' }}
        >
          <span
            className="self-start"
            style={{
              fontSize: 'calc(10.5px * var(--text-scale))', fontWeight: 700, padding: isToday ? '1px 5px' : '0 2px',
              borderRadius: 999, marginBottom: 1,
              color: isToday ? 'var(--color-accent-contrast)' : inMonth ? 'var(--color-text)' : 'var(--color-muted)',
              opacity: inMonth ? 1 : 0.4, background: isToday ? 'var(--color-accent)' : 'transparent',
            }}
          >
            {day.getDate()}
          </span>
          {items.map((it) =>
            it.kind === 'task' ? (
              <div key={it.key} className="flex items-center gap-1" style={{ fontSize: 'calc(9.5px * var(--text-scale))', fontWeight: 700, overflow: 'hidden' }}>
                <i style={{ width: 5, height: 5, borderRadius: 999, background: it.color, flex: 'none' }} />
                <span style={clamp2}>{it.title}</span>
              </div>
            ) : (
              <div key={it.key} style={{ ...clamp2, fontSize: 'calc(9.5px * var(--text-scale))', fontWeight: 700, color: '#fff', background: it.color, borderRadius: 3, padding: '1px 3px', lineHeight: 1.2 }}>
                {it.kind === 'birthday' ? '🎂 ' : ''}{it.title}
              </div>
            ),
          )}
        </div>,
      );
    }
    return (
      <>
        <div className="grid grid-cols-7" style={FULLBLEED}>
          {WEEKDAY_INITIALS.map((d, i) => (
            <div key={i} className="pb-1 text-center font-bold uppercase" style={{ fontSize: 10, letterSpacing: '.04em', color: isWeekendCol(i) ? 'var(--color-accent)' : 'var(--color-muted)' }}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-7 overflow-hidden border-l border-t" style={{ ...FULLBLEED, gridAutoRows: '1fr', borderColor: 'var(--color-border)' }}>
          {cells}
        </div>
      </>
    );
  }

  // ─────────── WEEK ───────────
  function weekView() {
    const start = startOfWeekMon(selDay);
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      const items = itemsFor(day);
      const isToday = sameDay(day, today);
      rows.push(
        <div key={i} className="border-b border-border py-2.5" style={{ borderRadius: isWeekendCol(i) ? 12 : 0, background: isWeekendCol(i) ? 'var(--color-weekend, transparent)' : 'transparent', paddingLeft: isWeekendCol(i) ? 8 : 0, paddingRight: isWeekendCol(i) ? 8 : 0 }}>
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="font-head font-bold" style={{ fontSize: 19, color: isToday ? 'var(--color-accent)' : 'var(--color-text)' }}>{day.getDate()}</span>
            <span className="font-bold uppercase text-muted" style={{ fontSize: 11 }}>
              {day.toLocaleDateString([], { weekday: 'long' })}
            </span>
          </div>
          {items.length ? items.map(evtRow) : <div className="text-muted" style={{ fontSize: 12 }}>—</div>}
        </div>,
      );
    }
    return <div className="flex-1 overflow-y-auto pt-1">{rows}</div>;
  }

  // ─────────── AGENDA (dot month + day detail) ───────────
  function agendaView() {
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const day = addDays(gridStart, i);
      const inMonth = day.getMonth() === cursor.getMonth();
      const items = itemsFor(day);
      const isToday = sameDay(day, today);
      const isSel = sameDay(day, selDay);
      const col = i % 7;
      cells.push(
        <div
          key={i}
          onClick={() => setSelDay(day)}
          className="flex cursor-pointer flex-col items-center gap-1 rounded-lg py-1.5"
          style={{ background: isSel ? 'var(--color-accent-soft)' : isWeekendCol(col) ? 'var(--color-weekend, transparent)' : 'transparent' }}
        >
          <span className="grid place-items-center rounded-full" style={{ width: 26, height: 26, fontSize: 13, fontWeight: 600, color: isToday ? 'var(--color-accent-contrast)' : inMonth ? 'var(--color-text)' : 'var(--color-muted)', opacity: inMonth ? 1 : 0.4, background: isToday ? 'var(--color-accent)' : 'transparent' }}>
            {day.getDate()}
          </span>
          <span className="flex gap-0.5" style={{ height: 5 }}>
            {items.slice(0, 4).map((it, k) => (
              <i key={k} style={{ width: 5, height: 5, borderRadius: 999, background: it.color }} />
            ))}
          </span>
        </div>,
      );
    }
    const selItems = itemsFor(selDay);
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid grid-cols-7 px-1">
          {WEEKDAY_INITIALS.map((d, i) => (
            <div key={i} className="pb-1 text-center font-bold uppercase" style={{ fontSize: 10, color: isWeekendCol(i) ? 'var(--color-accent)' : 'var(--color-muted)' }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 px-1">{cells}</div>
        <div className="mt-d2 flex-1 overflow-y-auto border-t border-border pt-d3" style={FULLBLEED}>
          <div className="px-d4">
            <h4 className="mb-d2 font-head" style={{ fontSize: 15 }}>
              {selDay.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
            </h4>
            {selItems.length ? selItems.map(evtRow) : <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>Nothing on this day.</p>}
          </div>
        </div>
      </div>
    );
  }

  // ─────────── LIST (rolling upcoming days with items) ───────────
  function listView() {
    const sections = [];
    for (let i = 0; i < 46; i++) {
      const day = addDays(startToday, i);
      const items = itemsFor(day);
      if (!items.length) continue;
      const label = sameDay(day, today) ? 'Today' : sameDay(day, addDays(today, 1)) ? 'Tomorrow' : day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
      sections.push(
        <section key={i}>
          <h2 className="mb-d2 mt-d3 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '.09em' }}>{label}</h2>
          {items.map(evtRow)}
        </section>,
      );
    }
    return (
      <div className="flex-1 overflow-y-auto">
        {sections.length ? sections : <p className="mt-8 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>Nothing coming up.</p>}
      </div>
    );
  }

  const periodLabel =
    view === 'list'
      ? 'Upcoming'
      : view === 'week'
        ? `${startOfWeekMon(selDay).toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${addDays(startOfWeekMon(selDay), 6).toLocaleDateString([], { day: 'numeric', month: 'short' })}`
        : cursor.toLocaleDateString([], { month: 'long', year: 'numeric' });
  const showNav = view === 'month' || view === 'agenda';

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ marginTop: -14 }}>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-head" style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}>
          {periodLabel}
        </h1>
        {showNav && (
          <div className="flex gap-1.5">
            <button className="grid h-8 w-8 place-items-center rounded-full text-muted" style={{ background: 'var(--color-chip-bg)' }} onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>‹</button>
            <button className="grid h-8 w-8 place-items-center rounded-full text-muted" style={{ background: 'var(--color-chip-bg)' }} onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>›</button>
          </div>
        )}
      </div>

      {/* 4-way switcher */}
      <div className="mb-d2 flex rounded-lg p-0.5" style={{ background: 'var(--color-chip-bg)' }}>
        {VIEWS.map((o) => (
          <button
            key={o.v}
            onClick={() => changeView(o.v)}
            className="flex-1 rounded-md py-1.5 font-bold"
            style={{ fontSize: 'var(--fs-sm)', background: view === o.v ? 'var(--color-surface)' : 'transparent', color: view === o.v ? 'var(--color-text)' : 'var(--color-muted)', boxShadow: view === o.v ? '0 1px 2px rgba(0,0,0,.12)' : 'none' }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {people.length > 0 && (
        <div className="mb-d2 flex gap-2 overflow-x-auto pb-1">
          {people.map((p) => {
            const on = !hidden.has(p.id);
            return (
              <button key={p.id} onClick={() => toggleHidden(p.id)} className="flex flex-none items-center gap-1.5 rounded-full py-1 pl-1 pr-3 font-bold" style={{ fontSize: 12, background: 'var(--color-chip-bg)', border: `1.5px solid ${on ? p.avatarColor : 'transparent'}`, opacity: on ? 1 : 0.45 }}>
                <Avatar emoji={p.avatarEmoji} color={p.avatarColor} size={20} />
                {p.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      )}

      {view === 'month' ? monthView() : view === 'week' ? weekView() : view === 'agenda' ? agendaView() : listView()}

      {sheet && (
        <CalSheet
          mode={sheet}
          day={selDay}
          items={itemsFor(selDay)}
          people={people}
          lists={lists}
          onClose={() => setSheet(null)}
          onPick={(m) => setSheet(m)}
          onOpenTask={onOpenTask}
          onDone={() => {
            utils.calendar.range.invalidate();
            utils.birthdays.list.invalidate();
            utils.tasks.agenda.invalidate();
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}

const clamp2: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
};

// ─────────────────────────── add / day sheet ───────────────────────────
function CalSheet({
  mode, day, items, people, lists, onClose, onPick, onOpenTask, onDone,
}: {
  mode: SheetMode;
  day: Date;
  items: CalItem[];
  people: { id: string; name: string; avatarEmoji: string; avatarColor: string }[];
  lists: { id: string; name: string; emojiIcon: string }[];
  onClose: () => void;
  onPick: (m: SheetMode) => void;
  onOpenTask: (id: string) => void;
  onDone: () => void;
}) {
  const createEvent = trpc.events.create.useMutation({ onSuccess: onDone });
  const createBirthday = trpc.birthdays.create.useMutation({ onSuccess: onDone });

  const [title, setTitle] = useState('');
  const [listId, setListId] = useState(lists[0]?.id ?? '');
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState(() => toLocalInput(new Date(day.getTime() + 9 * 3600_000).toISOString()));
  const [end, setEnd] = useState(() => toLocalInput(new Date(day.getTime() + 10 * 3600_000).toISOString()));
  const [assignee, setAssignee] = useState<string | null>(null);
  const [bname, setBname] = useState('');
  const [bmonth, setBmonth] = useState(day.getMonth() + 1);
  const [bday, setBday] = useState(day.getDate());

  useEffect(() => setListId(lists[0]?.id ?? ''), [lists]);

  const field = 'w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none';
  const fieldStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' };
  const label = 'mb-1.5 mt-3 block font-semibold text-muted';
  const labelStyle = { fontSize: 'var(--fs-sm)' };

  return (
    <>
      <div className="fixed inset-0 z-30" style={{ background: 'rgba(0,0,0,.4)' }} onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md overflow-y-auto p-4" style={{ background: 'var(--color-bg)', borderRadius: '22px 22px 0 0', maxHeight: '82%', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: 'var(--color-check-border)' }} />

        {mode === 'day' && (
          <>
            <h3 className="mb-3 font-head" style={{ fontSize: 18 }}>{day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            {items.length ? items.map((it) => (
              <div key={it.key} className="mb-2 flex items-center gap-2 rounded-card bg-surface p-3 shadow-card" style={{ fontSize: 'var(--fs-base)' }} onClick={() => it.id && onOpenTask(it.id)}>
                <span className="self-stretch rounded-full" style={{ width: 4, background: it.color, minHeight: 24 }} />
                <span className="flex-1">{it.kind === 'birthday' ? '🎂 ' : ''}{it.title}</span>
                {it.time && <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>{it.time}</span>}
              </div>
            )) : <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>Nothing on this day.</p>}
            <button className="mt-3 w-full rounded-card py-3 font-bold text-accent-contrast" style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }} onClick={() => onPick('choose')}>＋ Add to this day</button>
          </>
        )}

        {mode === 'choose' && (
          <div className="flex flex-col gap-2">
            <h3 className="mb-1 font-head" style={{ fontSize: 18 }}>Add</h3>
            <button className="rounded-card bg-surface p-4 text-left shadow-card" style={{ fontSize: 'var(--fs-base)' }} onClick={() => onPick('event')}>📅 &nbsp;Event</button>
            <button className="rounded-card bg-surface p-4 text-left shadow-card" style={{ fontSize: 'var(--fs-base)' }} onClick={() => onPick('birthday')}>🎂 &nbsp;Birthday</button>
          </div>
        )}

        {mode === 'event' && (
          <>
            <h3 className="mb-2 font-head" style={{ fontSize: 18 }}>New event</h3>
            <input autoFocus className={field} style={fieldStyle} placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className={label} style={labelStyle}>List</label>
            <select className={field} style={fieldStyle} value={listId} onChange={(e) => setListId(e.target.value)}>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.emojiIcon} {l.name}</option>)}
            </select>
            <label className="mt-3 flex items-center gap-2 font-semibold" style={{ fontSize: 'var(--fs-sm)' }}>
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
            </label>
            <label className={label} style={labelStyle}>Start</label>
            <input type={allDay ? 'date' : 'datetime-local'} className={field} style={fieldStyle} value={allDay ? start.slice(0, 10) : start} onChange={(e) => setStart(allDay ? e.target.value + 'T00:00' : e.target.value)} />
            <label className={label} style={labelStyle}>End</label>
            <input type={allDay ? 'date' : 'datetime-local'} className={field} style={fieldStyle} value={allDay ? end.slice(0, 10) : end} onChange={(e) => setEnd(allDay ? e.target.value + 'T23:59' : e.target.value)} />
            {people.length > 1 && (
              <>
                <label className={label} style={labelStyle}>For</label>
                <div className="flex flex-wrap gap-2">
                  {people.map((p) => (
                    <button key={p.id} onClick={() => setAssignee((a) => (a === p.id ? null : p.id))} className="rounded-full" style={{ padding: 2, borderRadius: '50%', boxShadow: assignee === p.id ? '0 0 0 2px var(--color-accent)' : 'none' }}>
                      <Avatar emoji={p.avatarEmoji} color={p.avatarColor} size={30} />
                    </button>
                  ))}
                </div>
              </>
            )}
            <button disabled={!title.trim() || !listId || createEvent.isPending} className="mt-4 w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-50" style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
              onClick={() => { const s = fromLocalInput(start); const e = fromLocalInput(end); if (!s || !e) return; createEvent.mutate({ listId, title: title.trim(), startAt: s, endAt: e, allDay, assigneeId: assignee ?? undefined }); }}>
              {createEvent.isPending ? 'Adding…' : 'Add event'}
            </button>
          </>
        )}

        {mode === 'birthday' && (
          <>
            <h3 className="mb-2 font-head" style={{ fontSize: 18 }}>New birthday</h3>
            <input autoFocus className={field} style={fieldStyle} placeholder="Name" value={bname} onChange={(e) => setBname(e.target.value)} />
            <div className="mt-3 flex gap-2">
              <select className={field} style={fieldStyle} value={bmonth} onChange={(e) => setBmonth(Number(e.target.value))}>
                {MONTHS.map((mn, i) => <option key={i} value={i + 1}>{mn}</option>)}
              </select>
              <select className={field} style={fieldStyle} value={bday} onChange={(e) => setBday(Number(e.target.value))}>
                {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </select>
            </div>
            <button disabled={!bname.trim() || createBirthday.isPending} className="mt-4 w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-50" style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
              onClick={() => createBirthday.mutate({ name: bname.trim(), day: bday, month: bmonth })}>
              {createBirthday.isPending ? 'Adding…' : 'Add birthday'}
            </button>
          </>
        )}
      </div>
    </>
  );
}
