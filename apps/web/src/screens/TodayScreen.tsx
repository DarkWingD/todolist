import { Avatar } from '../components/Avatar';
import { TaskRow, type TaskRowData } from '../components/TaskRow';
import { formatDue, recurrenceLabel } from '../lib/format';
import { trpc } from '../lib/trpc';
import type { SessionUser } from '../types';

export function TodayScreen({ me, onOpenTask }: { me: SessionUser; onOpenTask: (id: string) => void }) {
  const utils = trpc.useUtils();
  // Local start-of-tomorrow, so "today" respects the user's timezone.
  const before = (() => {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.toISOString();
  })();
  const { data: tasks = [], isLoading } = trpc.tasks.dueToday.useQuery({ before });
  const toggle = trpc.tasks.toggle.useMutation({
    onSuccess: () => utils.tasks.dueToday.invalidate(),
  });

  const rows: TaskRowData[] = tasks.map((t) => {
    const due = formatDue(t.dueAt as unknown as string);
    return {
      id: t.id,
      title: t.title,
      completed: !!t.completedAt,
      leadEmoji: t.listEmoji,
      due: due?.label,
      dueVariant: due?.variant,
      recurrence: recurrenceLabel(t.recurrenceRule) ?? undefined,
      assignee: t.assigneeId
        ? { id: t.assigneeId, emoji: t.assigneeEmoji ?? '🙂', color: t.assigneeColor ?? '#888' }
        : undefined,
    };
  });
  const done = rows.filter((r) => r.completed).length;

  const today = new Date().toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      <header className="mb-d2 flex items-center justify-between">
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

      {rows.length > 0 && (
        <div className="mb-d3 mt-d3 flex items-center gap-2">
          <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-track">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.round((done / rows.length) * 100)}%` }}
            />
          </div>
          <span className="font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {done} of {rows.length}
          </span>
        </div>
      )}

      <h2
        className="mb-d2 mt-d3 font-bold uppercase text-muted"
        style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
      >
        Focus
      </h2>

      {isLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-8 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          <div className="mb-2 text-4xl">🌤️</div>
          Nothing due today. Enjoy the calm.
        </div>
      ) : (
        rows.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            onToggle={(id, completed) => toggle.mutate({ id, completed })}
            onOpen={onOpenTask}
          />
        ))
      )}
    </>
  );
}
