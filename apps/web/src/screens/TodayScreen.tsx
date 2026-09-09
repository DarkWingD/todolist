import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { TaskRow } from '../components/TaskRow';
import { groupAgenda } from '../lib/agenda';
import { actorLabel, describeActivity, relativeTime } from '../lib/activityText';
import { toTaskRow } from '../lib/mapTask';
import { trpc } from '../lib/trpc';
import type { SessionUser } from '../types';

// How many days ahead the agenda shows.
const HORIZON_DAYS = 14;
// How many of the family's recent doings sit on Today before "See all".
const NEW_PREVIEW = 4;

/** Local calendar day as "YYYY-MM-DD" — never via toISOString, which shifts by UTC. */
function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * The fridge door. What the family has been up to, what's on today (events,
 * birthdays, dinner), where the kids are, then the tasks that are due.
 */
export function TodayScreen({
  me,
  onOpenTask,
  onOpenYou,
  onOpenChild,
  onOpenActivity,
  onOpenCal,
  onOpenMeals,
  showKids = true,
  showMeals = true,
}: {
  me: SessionUser;
  onOpenTask: (id: string) => void;
  onOpenYou: () => void;
  onOpenChild?: (id: string) => void;
  onOpenActivity: () => void;
  onOpenCal: () => void;
  onOpenMeals: () => void;
  showKids?: boolean;
  showMeals?: boolean;
}) {
  const utils = trpc.useUtils();
  const dayStart = startOfToday();
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const until = (() => {
    const d = new Date(dayStart);
    d.setDate(d.getDate() + HORIZON_DAYS);
    return d.toISOString();
  })();

  const { data: tasks = [], isLoading } = trpc.tasks.agenda.useQuery({ until });
  const { data: flagged = [] } = trpc.tasks.highPriority.useQuery();
  // Where each child is today, already crossed with term dates server-side.
  const { data: children = [] } = trpc.children.mine.useQuery(undefined, { enabled: showKids });
  const { data: feed } = trpc.activity.recent.useQuery({ limit: 30 });
  const { data: household } = trpc.household.get.useQuery();
  const { data: range } = trpc.calendar.range.useQuery({
    from: dayStart.toISOString(),
    to: dayEnd.toISOString(),
  });
  const { data: birthdays = [] } = trpc.birthdays.list.useQuery();
  const { data: plans = [] } = trpc.mealPlan.mine.useQuery(undefined, { enabled: showMeals });
  const planId = plans[0]?.id;
  const { data: dinnerRows = [] } = trpc.mealPlan.range.useQuery(
    { planId: planId ?? '', from: todayKey(), to: todayKey() },
    { enabled: showMeals && Boolean(planId) },
  );
  const dinner = dinnerRows[0];

  const toggle = trpc.tasks.toggle.useMutation({
    onSuccess: () => {
      utils.tasks.agenda.invalidate();
      utils.tasks.highPriority.invalidate();
      utils.activity.recent.invalidate();
    },
  });
  const removeTask = trpc.tasks.remove.useMutation({
    onSuccess: () => {
      utils.tasks.agenda.invalidate();
      utils.tasks.highPriority.invalidate();
      utils.activity.recent.invalidate();
    },
  });
  const onToggle = (id: string, completed: boolean) => toggle.mutate({ id, completed });
  const onDelete = (id: string) => removeTask.mutate({ id });

  // ── what's new: other people's doings since you last looked ──
  const seenAt = feed?.seenAt ? new Date(feed.seenAt) : null;
  const fresh = (feed?.items ?? []).filter(
    (it) => !it.mine && (!seenAt || new Date(it.createdAt) > seenAt),
  );
  const people = household?.people ?? [];

  // ── today's plan ──
  const events = (range?.events ?? [])
    .filter((ev) => {
      const s = new Date(ev.startAt as unknown as string);
      const e = new Date(ev.endAt as unknown as string);
      return s < dayEnd && e >= dayStart;
    })
    .sort(
      (a, b) =>
        new Date(a.startAt as unknown as string).getTime() -
        new Date(b.startAt as unknown as string).getTime(),
    );
  const todaysBirthdays = birthdays.filter(
    (b) => b.month === dayStart.getMonth() + 1 && b.day === dayStart.getDate(),
  );
  const hasPlan = events.length > 0 || todaysBirthdays.length > 0 || Boolean(dinner);

  // Priority tasks get their own section; drop them from the dated agenda to avoid dupes.
  const flaggedIds = new Set(flagged.map((t) => t.id));
  const sections = groupAgenda(tasks.filter((t) => !flaggedIds.has(t.id)));
  const hasAnything = flagged.length > 0 || sections.length > 0;
  // The screen itself is "Today", so that section usually needs no header — but
  // when an Overdue section renders above it, the header is what keeps today's
  // items from visually merging into the overdue list.
  const hasOverdue = sections.some((s) => s.overdue);

  const today = new Date().toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const sectionH = (color: string) => ({
    fontSize: 'var(--fs-xs)',
    letterSpacing: '0.09em',
    color,
  });
  const fmtTime = (iso: unknown) =>
    new Date(iso as string).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <>
      <header className="mb-d4 flex items-center justify-between">
        <div>
          <h1
            className="font-head"
            style={{
              fontSize: 'var(--fs-big)',
              fontWeight: 'var(--title-weight)',
              letterSpacing: 'var(--title-tracking)',
            }}
          >
            Today
          </h1>
          <div className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {today}
          </div>
        </div>
        <button aria-label="Profile & settings" onClick={onOpenYou}>
          <Avatar emoji={me.avatarEmoji} color={me.avatarColor} image={me.image} size={36} />
        </button>
      </header>

      {fresh.length > 0 && (
        <div className="mb-d4">
          <div className="mb-d2 flex items-baseline justify-between">
            <h2 className="font-bold uppercase" style={sectionH('var(--color-accent)')}>
              What's new
            </h2>
            <button
              type="button"
              onClick={onOpenActivity}
              className="font-semibold text-accent"
              style={{ fontSize: 'var(--fs-xs)' }}
            >
              See all ›
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenActivity}
            className="w-full overflow-hidden rounded-card bg-surface text-left shadow-card"
          >
            {fresh.slice(0, NEW_PREVIEW).map((it) => {
              const { text } = describeActivity(it, people);
              return (
                <div
                  key={it.id}
                  className="flex items-center gap-d3 border-b border-border px-3.5 py-2.5 last:border-0"
                >
                  <Avatar
                    emoji={it.actorEmoji ?? '🙂'}
                    color={it.actorColor ?? '#888'}
                    image={it.actorImage}
                    size={26}
                  />
                  <span className="min-w-0 flex-1 truncate" style={{ fontSize: 'var(--fs-sm)' }}>
                    <b>{actorLabel(it)}</b> {text}
                  </span>
                  <span className="flex-none text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    {relativeTime(it.createdAt)}
                  </span>
                </div>
              );
            })}
            {fresh.length > NEW_PREVIEW && (
              <div className="px-3.5 py-2 text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                and {fresh.length - NEW_PREVIEW} more
              </div>
            )}
          </button>
        </div>
      )}

      {hasPlan && (
        <div className="mb-d4">
          <h2 className="mb-d2 font-bold uppercase" style={sectionH('var(--color-muted)')}>
            On today
          </h2>
          <div className="overflow-hidden rounded-card bg-surface shadow-card">
            {todaysBirthdays.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={onOpenCal}
                className="flex w-full items-center gap-d3 border-b border-border px-3.5 py-2.5 text-left last:border-0"
              >
                <span style={{ fontSize: 18 }}>🎂</span>
                <span
                  className="min-w-0 flex-1 font-semibold"
                  style={{ fontSize: 'var(--fs-base)' }}
                >
                  {b.name}
                  {b.year ? ` turns ${dayStart.getFullYear() - b.year}` : "'s birthday"}
                </span>
              </button>
            ))}
            {events.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={onOpenCal}
                className="flex w-full items-center gap-d3 border-b border-border px-3.5 py-2.5 text-left last:border-0"
              >
                <span
                  className="self-stretch rounded-full"
                  style={{
                    width: 4,
                    background: ev.listColor ?? 'var(--color-muted)',
                    minHeight: 24,
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
                    {ev.title}
                  </span>
                  <span className="block text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                    {ev.allDay ? 'All day' : `${fmtTime(ev.startAt)} – ${fmtTime(ev.endAt)}`}
                    {ev.assigneeName ? ` · ${ev.assigneeName.split(' ')[0]}` : ''}
                  </span>
                </span>
                {ev.assigneeEmoji && (
                  <Avatar emoji={ev.assigneeEmoji} color={ev.assigneeColor ?? '#888'} size={26} />
                )}
              </button>
            ))}
            {dinner && (
              <button
                type="button"
                onClick={onOpenMeals}
                className="flex w-full items-center gap-d3 border-b border-border px-3.5 py-2.5 text-left last:border-0"
              >
                <span style={{ fontSize: 18 }}>🍽️</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
                    Dinner: {dinner.name}
                  </span>
                  <span className="block text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                    {dinner.isLeftover ? `Leftovers, night ${dinner.night}` : 'Cooking tonight'}
                    {dinner.recipeUrl ? ' · recipe saved' : ''}
                  </span>
                </span>
                {dinner.recipeUrl && (
                  <a
                    href={dinner.recipeUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full px-3 py-1.5 font-bold text-accent"
                    style={{ background: 'var(--color-accent-soft)', fontSize: 'var(--fs-xs)' }}
                  >
                    Recipe
                  </a>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {showKids && children.length > 0 && (
        <div className="mb-d4">
          <h2 className="mb-d2 font-bold uppercase" style={sectionH('var(--color-muted)')}>
            Where everyone is
          </h2>
          <div className="flex flex-col gap-d2 md:grid md:grid-cols-2">
            {children.map((c) => (
              <KidCard key={c.id} child={c} onOpen={() => onOpenChild?.(c.id)} />
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Loading…
        </p>
      ) : !hasAnything ? (
        <div className="mt-8 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          <div className="mb-2 text-4xl">🌤️</div>
          Nothing due. Flag a task as priority or give it a due date and it'll show up here.
        </div>
      ) : (
        <>
          {flagged.length > 0 && (
            <section>
              <h2 className="mb-d2 font-bold uppercase" style={sectionH('var(--color-danger)')}>
                ⚑ Priority
              </h2>
              {flagged.map((t) => (
                <TaskRow
                  key={t.id}
                  task={toTaskRow(t, { withLeadEmoji: true })}
                  onToggle={onToggle}
                  onOpen={onOpenTask}
                  onDelete={onDelete}
                />
              ))}
            </section>
          )}

          {sections.map((section) => (
            <section key={section.key}>
              {(section.key !== 'today' || hasOverdue) && (
                <h2
                  className="mb-d2 mt-d3 font-bold uppercase"
                  style={sectionH(section.overdue ? 'var(--color-danger)' : 'var(--color-muted)')}
                >
                  {section.label}
                </h2>
              )}
              {/* keep spacing above today's headerless block when a Priority section precedes it */}
              {section.key === 'today' && !hasOverdue && flagged.length > 0 && (
                <div className="mt-d3" />
              )}
              {section.tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={toTaskRow(t, { withLeadEmoji: true })}
                  onToggle={onToggle}
                  onOpen={onOpenTask}
                  onDelete={onDelete}
                />
              ))}
            </section>
          ))}
        </>
      )}
    </>
  );
}

interface KidToday {
  id: string;
  name: string;
  emojiIcon: string;
  color: string | null;
  place: string | null;
  startTime: string | null;
  endTime: string | null;
  offReason: string | null;
  profile: {
    className: string | null;
    room: string | null;
    teacher: string | null;
    officePhone: string | null;
    medicalNotes: string | null;
  } | null;
}

/**
 * A child on Today: where they are, and the details you'd otherwise dig out
 * of an email. The school's number is one tap; medical notes unfold in place.
 */
function KidCard({ child: c, onOpen }: { child: KidToday; onOpen: () => void }) {
  const [showMedical, setShowMedical] = useState(false);
  const p = c.profile;
  const bits = [p?.className, p?.room ? `Room ${p.room}` : null, p?.teacher].filter(
    (s): s is string => Boolean(s && s.trim()),
  );
  return (
    <div className="rounded-card bg-surface shadow-card">
      <div className="flex items-center gap-d3 p-d3">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-d3 text-left"
        >
          <span
            className="grid h-9 w-9 flex-none place-items-center rounded-emoji"
            style={{
              fontSize: 18,
              background: c.color
                ? `color-mix(in srgb, ${c.color} 22%, var(--color-surface))`
                : 'var(--color-emoji-bg)',
            }}
          >
            {c.emojiIcon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
              {c.name}
            </span>
            <span className="block text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
              {c.offReason
                ? c.offReason
                : c.place
                  ? `${c.place}${c.startTime ? ` · ${c.startTime}${c.endTime ? `–${c.endTime}` : ''}` : ''}`
                  : 'Nothing on today'}
            </span>
            {bits.length > 0 && (
              <span
                className="mt-0.5 block truncate text-muted"
                style={{ fontSize: 'var(--fs-xs)' }}
              >
                {bits.join(' · ')}
              </span>
            )}
          </span>
        </button>
        {p?.medicalNotes && (
          <button
            type="button"
            aria-label={`${c.name}'s medical notes`}
            aria-expanded={showMedical}
            onClick={() => setShowMedical((v) => !v)}
            className="grid h-9 w-9 flex-none place-items-center rounded-full"
            style={{
              background: showMedical ? 'var(--color-danger-soft)' : 'var(--color-chip-bg)',
              color: showMedical ? 'var(--color-danger)' : 'var(--color-muted)',
              fontSize: 15,
            }}
          >
            ✚
          </button>
        )}
        {p?.officePhone && (
          <a
            href={`tel:${p.officePhone.replace(/\s+/g, '')}`}
            aria-label={`Call ${c.name}'s school`}
            className="grid h-9 w-9 flex-none place-items-center rounded-full"
            style={{ background: 'var(--color-accent-soft)', fontSize: 15 }}
          >
            📞
          </a>
        )}
      </div>
      {showMedical && p?.medicalNotes && (
        <div
          className="border-t border-border px-d3 py-2.5"
          style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'pre-wrap' }}
        >
          {p.medicalNotes}
        </div>
      )}
    </div>
  );
}
