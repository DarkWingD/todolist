import { useEffect, useRef } from 'react';
import { Avatar } from '../components/Avatar';
import { BackButton } from '../components/BackButton';
import { actorLabel, describeActivity, relativeTime, type ActivityItem } from '../lib/activityText';
import { trpc } from '../lib/trpc';

function dayLabel(iso: string | Date): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
}

export function ActivityRow({
  item: it,
  people,
  fresh,
}: {
  item: ActivityItem;
  people: { id: string; name: string }[];
  fresh?: boolean;
}) {
  const { icon, text } = describeActivity(it, people);
  return (
    <div className="flex items-start gap-d3 border-b border-border px-3.5 py-3 last:border-0">
      <span className="relative flex-none">
        <Avatar
          emoji={it.actorEmoji ?? '🙂'}
          color={it.actorColor ?? '#888'}
          image={it.actorImage}
          size={32}
        />
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full"
          style={{
            fontSize: 9,
            background: 'var(--color-surface)',
            boxShadow: '0 0 0 1.5px var(--color-border)',
          }}
        >
          {icon}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block" style={{ fontSize: 'var(--fs-base)' }}>
          <b style={{ color: fresh ? 'var(--color-accent)' : undefined }}>{actorLabel(it)}</b>{' '}
          {text}
        </span>
        <span className="mt-0.5 block text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
          {relativeTime(it.createdAt)}
          {it.listName ? ` · ${it.listEmoji ?? ''} ${it.listName}` : ''}
        </span>
      </span>
    </div>
  );
}

/**
 * Everything the family has done lately, newest first, with a line under the
 * things you hadn't seen yet. Opening it is what counts as having looked.
 */
export function ActivityScreen({ onBack }: { onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.activity.recent.useQuery({ limit: 120 });
  const { data: household } = trpc.household.get.useQuery();
  const markSeen = trpc.activity.markSeen.useMutation({
    onSuccess: () => utils.activity.recent.invalidate(),
  });
  // Mark seen once the first load has landed, so the "new" line is drawn from
  // the seenAt that was true when you arrived, then moves on.
  const marked = useRef(false);
  const seenAtOnArrival = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (data && !marked.current) {
      marked.current = true;
      seenAtOnArrival.current = data.seenAt ? new Date(data.seenAt).toISOString() : null;
      markSeen.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const people = household?.people ?? [];
  const seen = seenAtOnArrival.current;
  const isFresh = (it: ActivityItem) =>
    !it.mine && (seen === null || (seen !== undefined && new Date(it.createdAt) > new Date(seen)));

  const groups: { label: string; items: ActivityItem[] }[] = [];
  for (const it of data?.items ?? []) {
    const label = dayLabel(it.createdAt);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(it);
    else groups.push({ label, items: [it] });
  }

  return (
    <>
      <BackButton label="Today" onClick={onBack} />
      <h1
        className="mb-d3 font-head"
        style={{
          fontSize: 'var(--fs-big)',
          fontWeight: 'var(--title-weight)',
          letterSpacing: 'var(--title-tracking)',
        }}
      >
        What's been happening
      </h1>

      {isLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Loading…
        </p>
      ) : groups.length === 0 ? (
        <div className="mt-8 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          <div className="mb-2 text-4xl">🌱</div>
          Nothing yet. As the family ticks things off, plans dinners and adds events, it shows up
          here.
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="mb-d4">
            <h2
              className="mb-d2 font-bold uppercase text-muted"
              style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
            >
              {g.label}
            </h2>
            <div className="overflow-hidden rounded-card bg-surface shadow-card">
              {g.items.map((it) => (
                <ActivityRow key={it.id} item={it} people={people} fresh={isFresh(it)} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
