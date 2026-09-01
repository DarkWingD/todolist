import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { addDays, sameDay, startOfDay, startOfWeekMon, WEEKDAY_INITIALS, WEEKDAY_SHORT } from '../lib/caldate';
import { fromLocalInput, toLocalInput } from '../lib/datetime';
import { trpc } from '../lib/trpc';

const NEUTRAL = '#9aa3b8';
const BIRTHDAY_COLOR = '#EC4899';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type SheetMode = null | 'day' | 'choose' | 'event' | 'birthday';

export function CalScreen({
  onOpenTask,
  createSignal,
}: {
  onOpenTask: (id: string) => void;
  createSignal?: number;
}) {
  const utils = trpc.useUtils();
  const [view, setView] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return startOfDay(d);
  });
  const [selDay, setSelDay] = useState<Date>(() => startOfDay(new Date()));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<SheetMode>(null);

  const gridStart = startOfWeekMon(cursor);
  const gridEnd = addDays(gridStart, 42);

  const { data: people = [] } = trpc.calendar.people.useQuery();
  const { data: birthdays = [] } = trpc.birthdays.list.useQuery();
  const { data: lists = [] } = trpc.lists.mine.useQuery();
  const { data: range } = trpc.calendar.range.useQuery({
    from: gridStart.toISOString(),
    to: gridEnd.toISOString(),
  });

  // Only open the add sheet when the + is actually tapped (signal changes),
  // not on mount when navigating back to the tab.
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
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const events = range?.events ?? [];
  const tasks = range?.tasks ?? [];

  // Items on a given day (respecting people filter).
  function itemsFor(day: Date) {
    const out: {
      key: string;
      kind: 'event' | 'task' | 'birthday';
      title: string;
      color: string;
      isStart?: boolean;
      isEnd?: boolean;
      time?: string;
      emoji?: string;
      id?: string;
    }[] = [];
    for (const ev of events) {
      const s = startOfDay(new Date(ev.startAt as unknown as string));
      const e = startOfDay(new Date(ev.endAt as unknown as string));
      if (day >= s && day <= e && !isHidden(ev.assigneeId)) {
        out.push({
          key: 'e' + ev.id + day.getDate(),
          kind: 'event',
          title: ev.title,
          color: colorFor(ev.assigneeId),
          isStart: sameDay(day, s),
          isEnd: sameDay(day, e),
          time: ev.allDay
            ? undefined
            : new Date(ev.startAt as unknown as string).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              }),
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
        out.push({
          key: 't' + t.id,
          kind: 'task',
          title: t.title,
          color: colorFor(t.assigneeId),
          id: t.id,
        });
      }
    }
    return out;
  }

  const today = startOfDay(new Date());

  // ─────────── render helpers ───────────
  function pill(it: ReturnType<typeof itemsFor>[number]) {
    if (it.kind === 'task') {
      return (
        <div
          key={it.key}
          className="flex items-center gap-1 overflow-hidden"
          style={{ fontSize: 9, fontWeight: 700 }}
          onClick={(e) => {
            e.stopPropagation();
            if (it.id) onOpenTask(it.id);
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: it.color, flex: 'none' }} />
          <span className="truncate" style={{ color: 'var(--color-text)' }}>{it.title}</span>
        </div>
      );
    }
    if (it.kind === 'birthday') {
      return (
        <div key={it.key} className="truncate rounded" style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: it.color, padding: '1px 4px' }}>
          🎂 {it.title}
        </div>
      );
    }
    // event bar (respect multi-day rounding)
    const radius = it.isStart && it.isEnd ? 4 : it.isStart ? '4px 0 0 4px' : it.isEnd ? '0 4px 4px 0' : 0;
    return (
      <div key={it.key} className="truncate" style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: it.color, padding: '1px 4px', borderRadius: radius }}>
        {it.isStart ? it.title : ' '}
      </div>
    );
  }

  function monthGrid() {
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const day = addDays(gridStart, i);
      const inMonth = day.getMonth() === cursor.getMonth();
      const items = itemsFor(day);
      const shown = items.slice(0, 3);
      const extra = items.length - shown.length;
      const isToday = sameDay(day, today);
      const isSel = sameDay(day, selDay);
      cells.push(
        <div
          key={i}
          onClick={() => {
            setSelDay(day);
            setSheet('day');
          }}
          className="flex min-h-0 cursor-pointer flex-col gap-[2px] overflow-hidden rounded-lg px-[3px] pt-[3px]"
          style={{ background: isSel ? 'var(--color-chip-bg)' : 'transparent' }}
        >
          <div
            className="mx-auto grid h-5 w-5 place-items-center rounded-full"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: isToday ? 'var(--color-accent-contrast)' : inMonth ? 'var(--color-text)' : 'var(--color-muted)',
              opacity: inMonth ? 1 : 0.5,
              background: isToday ? 'var(--color-accent)' : 'transparent',
            }}
          >
            {day.getDate()}
          </div>
          {shown.map(pill)}
          {extra > 0 && (
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-muted)', paddingLeft: 2 }}>+{extra}</div>
          )}
        </div>,
      );
    }
    return (
      <>
        <div className="grid grid-cols-7 px-2">
          {WEEKDAY_INITIALS.map((d, i) => (
            <div key={i} className="pb-1 text-center font-bold uppercase text-muted" style={{ fontSize: 10, letterSpacing: '0.05em' }}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-7 gap-[2px] overflow-hidden px-2 pb-1" style={{ gridAutoRows: '1fr' }}>
          {cells}
        </div>
      </>
    );
  }

  function weekView() {
    const start = startOfWeekMon(selDay);
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      const items = itemsFor(day);
      const isToday = sameDay(day, today);
      rows.push(
        <div key={i} className="flex gap-3 border-b border-border py-2.5">
          <div className="w-11 flex-none text-center">
            <div className="font-bold uppercase text-muted" style={{ fontSize: 10 }}>{WEEKDAY_SHORT[i]}</div>
            <div className="font-head font-bold" style={{ fontSize: 20, color: isToday ? 'var(--color-accent)' : 'var(--color-text)' }}>
              {day.getDate()}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
            {items.length === 0 ? (
              <div className="text-muted" style={{ fontSize: 12 }}>—</div>
            ) : (
              items.map((it) => (
                <div
                  key={it.key}
                  className="flex items-center gap-2 rounded-lg bg-surface shadow-card"
                  style={{ padding: '7px 9px', fontSize: 13 }}
                  onClick={() => it.kind === 'task' && it.id && onOpenTask(it.id)}
                >
                  <span className="self-stretch rounded-full" style={{ width: 4, background: it.color }} />
                  <span className="truncate">{it.kind === 'birthday' ? '🎂 ' : ''}{it.title}</span>
                  {it.time && <span className="ml-auto text-muted" style={{ fontSize: 11 }}>{it.time}</span>}
                </div>
              ))
            )}
          </div>
        </div>,
      );
    }
    return <div className="flex-1 overflow-y-auto px-3.5 py-1">{rows}</div>;
  }

  const monthLabel = cursor.toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* header */}
      <div className="mb-1 flex items-center justify-between">
        <h1 className="font-head" style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}>
          {monthLabel}
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg p-0.5" style={{ background: 'var(--color-chip-bg)' }}>
            {(['month', 'week'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="rounded-md px-2.5 py-1 font-bold capitalize"
                style={{
                  fontSize: 12,
                  background: view === v ? 'var(--color-surface)' : 'transparent',
                  color: view === v ? 'var(--color-text)' : 'var(--color-muted)',
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-full text-muted" style={{ background: 'var(--color-chip-bg)' }} onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>‹</button>
          <button className="grid h-8 w-8 place-items-center rounded-full text-muted" style={{ background: 'var(--color-chip-bg)' }} onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>›</button>
        </div>
      </div>

      {/* people chips */}
      {people.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {people.map((p) => {
            const on = !hidden.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleHidden(p.id)}
                className="flex flex-none items-center gap-1.5 rounded-full py-1 pl-1 pr-3 font-bold"
                style={{
                  fontSize: 12,
                  background: 'var(--color-chip-bg)',
                  border: `1.5px solid ${on ? p.avatarColor : 'transparent'}`,
                  opacity: on ? 1 : 0.45,
                }}
              >
                <Avatar emoji={p.avatarEmoji} color={p.avatarColor} size={20} />
                {p.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      )}

      {view === 'month' ? monthGrid() : weekView()}

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

// ─────────────────────────── bottom sheet ───────────────────────────
function CalSheet({
  mode,
  day,
  items,
  people,
  lists,
  onClose,
  onPick,
  onOpenTask,
  onDone,
}: {
  mode: SheetMode;
  day: Date;
  items: { key: string; kind: string; title: string; color: string; time?: string; id?: string }[];
  people: { id: string; name: string; avatarEmoji: string; avatarColor: string }[];
  lists: { id: string; name: string; emojiIcon: string }[];
  onClose: () => void;
  onPick: (m: SheetMode) => void;
  onOpenTask: (id: string) => void;
  onDone: () => void;
}) {
  const createEvent = trpc.events.create.useMutation({ onSuccess: onDone });
  const createBirthday = trpc.birthdays.create.useMutation({ onSuccess: onDone });

  // event form state
  const [title, setTitle] = useState('');
  const [listId, setListId] = useState(lists[0]?.id ?? '');
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState(() => toLocalInput(new Date(day.getTime() + 9 * 3600_000).toISOString()));
  const [end, setEnd] = useState(() => toLocalInput(new Date(day.getTime() + 10 * 3600_000).toISOString()));
  const [assignee, setAssignee] = useState<string | null>(null);
  // birthday form
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
      <div className="absolute inset-0 z-10" style={{ background: 'rgba(0,0,0,.4)' }} onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 z-20 overflow-y-auto p-4"
        style={{ background: 'var(--color-bg)', borderRadius: '22px 22px 0 0', maxHeight: '80%', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: 'var(--color-check-border)' }} />

        {mode === 'day' && (
          <>
            <h3 className="mb-3 font-head" style={{ fontSize: 18 }}>
              {day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {items.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>Nothing on this day.</p>
            ) : (
              items.map((it) => (
                <div key={it.key} className="mb-2 flex items-center gap-2 rounded-card bg-surface p-3 shadow-card" style={{ fontSize: 'var(--fs-base)' }} onClick={() => it.id && onOpenTask(it.id)}>
                  <span className="self-stretch rounded-full" style={{ width: 4, background: it.color }} />
                  <span>{it.kind === 'birthday' ? '🎂 ' : ''}{it.title}</span>
                  {it.time && <span className="ml-auto text-muted" style={{ fontSize: 'var(--fs-sm)' }}>{it.time}</span>}
                </div>
              ))
            )}
            <button className="mt-3 w-full rounded-card py-3 font-bold text-accent-contrast" style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }} onClick={() => onPick('choose')}>
              ＋ Add to this day
            </button>
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
            <button
              disabled={!title.trim() || !listId || createEvent.isPending}
              className="mt-4 w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-50"
              style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
              onClick={() => {
                const s = fromLocalInput(start);
                const e = fromLocalInput(end);
                if (!s || !e) return;
                createEvent.mutate({ listId, title: title.trim(), startAt: s, endAt: e, allDay, assigneeId: assignee ?? undefined });
              }}
            >
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
            <button
              disabled={!bname.trim() || createBirthday.isPending}
              className="mt-4 w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-50"
              style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
              onClick={() => createBirthday.mutate({ name: bname.trim(), day: bday, month: bmonth })}
            >
              {createBirthday.isPending ? 'Adding…' : 'Add birthday'}
            </button>
          </>
        )}
      </div>
    </>
  );
}
