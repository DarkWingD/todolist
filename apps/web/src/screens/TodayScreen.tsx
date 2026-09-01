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
  const until = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + HORIZON_DAYS);
    return d.toISOString();
  })();

  const { data: tasks = [], isLoading } = trpc.tasks.agenda.useQuery({ until });
  const { data: flagged = [] } = trpc.tasks.highPriority.useQuery();
  const toggle = trpc.tasks.toggle.useMutation({
    onSuccess: () => {
      utils.tasks.agenda.invalidate();
      utils.tasks.highPriority.invalidate();
    },
  });

  const removeTask = trpc.tasks.remove.useMutation({
    onSuccess: () => {
      utils.tasks.agenda.invalidate();
      utils.tasks.highPriority.invalidate();
    },
  });
  const onToggle = (id: string, completed: boolean) => toggle.mutate({ id, completed });
  const onDelete = (id: string) => removeTask.mutate({ id });

  // Priority tasks get their own section; drop them from the dated agenda to avoid dupes.
  const flaggedIds = new Set(flagged.map((t) => t.id));
  const sections = groupAgenda(tasks.filter((t) => !flaggedIds.has(t.id)));
  const hasAnything = flagged.length > 0 || sections.length > 0;

  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  const sectionH = (color: string) => ({ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em', color });

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
          <div className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>{today}</div>
        </div>
        <Avatar emoji={me.avatarEmoji} color={me.avatarColor} image={me.image} size={36} />
      </header>

      {isLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>Loading…</p>
      ) : !hasAnything ? (
        <div className="mt-8 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          <div className="mb-2 text-4xl">🌤️</div>
          Nothing scheduled. Flag a task as priority or give it a due date and it’ll show up here.
        </div>
      ) : (
        <>
          {flagged.length > 0 && (
            <section>
              <h2 className="mb-d2 font-bold uppercase" style={sectionH('var(--color-danger)')}>
                ⚑ Priority
              </h2>
              {flagged.map((t) => (
                <TaskRow key={t.id} task={toTaskRow(t, { withLeadEmoji: true })} onToggle={onToggle} onOpen={onOpenTask} onDelete={onDelete} />
              ))}
            </section>
          )}

          {sections.map((section) => (
            <section key={section.key}>
              {section.key !== 'today' && (
                <h2
                  className="mb-d2 mt-d3 font-bold uppercase"
                  style={sectionH(section.overdue ? 'var(--color-danger)' : 'var(--color-muted)')}
                >
                  {section.label}
                </h2>
              )}
              {/* keep spacing above today's block when a Priority section precedes it */}
              {section.key === 'today' && flagged.length > 0 && <div className="mt-d3" />}
              {section.tasks.map((t) => (
                <TaskRow key={t.id} task={toTaskRow(t, { withLeadEmoji: true })} onToggle={onToggle} onOpen={onOpenTask} onDelete={onDelete} />
              ))}
            </section>
          ))}
        </>
      )}
    </>
  );
}
