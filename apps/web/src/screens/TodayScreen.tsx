import { Avatar } from '../components/Avatar';
import { TaskRow } from '../components/TaskRow';
import { groupAgenda } from '../lib/agenda';
import { toTaskRow } from '../lib/mapTask';
import { trpc } from '../lib/trpc';
import type { SessionUser } from '../types';

// How many days ahead the agenda shows.
const HORIZON_DAYS = 14;

export function TodayScreen({ me, onOpenTask }: { me: SessionUser; onOpenTask: (id: string) => void }) {
  const utils = trpc.useUtils();
  // Local horizon: start of (today + N days), so day boundaries are in the user's timezone.
  const until = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + HORIZON_DAYS);
    return d.toISOString();
  })();

  const { data: tasks = [], isLoading } = trpc.tasks.agenda.useQuery({ until });
  const toggle = trpc.tasks.toggle.useMutation({ onSuccess: () => utils.tasks.agenda.invalidate() });

  const sections = groupAgenda(tasks);

  const today = new Date().toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      <header className="mb-d4 flex items-center justify-between">
        <div>
          <h1
            className="font-head"
            style={{ fontSize: 'var(--fs-big)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}
          >
            Today
          </h1>
          <div className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {today}
          </div>
        </div>
        <Avatar emoji={me.avatarEmoji} color={me.avatarColor} size={36} />
      </header>

      {isLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Loading…
        </p>
      ) : sections.length === 0 ? (
        <div className="mt-8 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          <div className="mb-2 text-4xl">🌤️</div>
          Nothing scheduled. Add a due date to a task and it’ll show up here.
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.key}>
            {/* The screen title already says "Today", so today's group needs no header. */}
            {section.key !== 'today' && (
              <h2
                className="mb-d2 mt-d3 font-bold uppercase"
                style={{
                  fontSize: 'var(--fs-xs)',
                  letterSpacing: '0.09em',
                  color: section.overdue ? 'var(--color-danger)' : 'var(--color-muted)',
                }}
              >
                {section.label}
              </h2>
            )}
            {section.tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={toTaskRow(t, { withLeadEmoji: true })}
                onToggle={(id, completed) => toggle.mutate({ id, completed })}
                onOpen={onOpenTask}
              />
            ))}
          </section>
        ))
      )}
    </>
  );
}
