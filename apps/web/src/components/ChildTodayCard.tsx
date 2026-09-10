/**
 * Where this child is today, who to ring, and any medicine still in its window
 * — the one card you open their page to read.
 *
 * Everything here was already being entered somewhere and shown nowhere: the
 * class and room only appeared on Today's kid card, the term dates only ever
 * decided whether the line above said "Primary school" or "School holidays",
 * and the dose status sat under a heading far enough down that the button to
 * log the next one had scrolled past.
 */

interface Period {
  kind: 'term' | 'break' | 'closure';
  name: string;
  startDate: string;
  endDate: string;
}

interface DoseStatus {
  medicine: string;
  amount: string | null;
  givenAt: string | Date;
  nextFrom: string | Date | null;
  countToday: number;
}

const fmtDay = (d: Date) =>
  d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (v: string | Date) =>
  new Date(v).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** "Term 4 · ends Fri 12 Dec · 6 weeks to go", or the next term when between them. */
function termLine(periods: Period[]): string | null {
  const terms = periods.filter((p) => p.kind === 'term');
  if (terms.length === 0) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const current = terms.find((t) => t.startDate <= key && t.endDate >= key);
  if (current) {
    const end = new Date(`${current.endDate}T00:00:00`);
    const days = Math.round((end.getTime() - today.getTime()) / 86_400_000);
    const left =
      days <= 0
        ? 'last day'
        : days === 1
          ? '1 day to go'
          : days < 14
            ? `${days} days to go`
            : `${Math.round(days / 7)} weeks to go`;
    return `${current.name} · ends ${fmtDay(end)} · ${left}`;
  }

  const next = terms
    .filter((t) => t.startDate > key)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];
  if (next) return `${next.name} starts ${fmtDay(new Date(`${next.startDate}T00:00:00`))}`;
  return null;
}

export function ChildTodayCard({
  name,
  emojiIcon,
  color,
  today,
  profile,
  periods,
  doses,
  onLogDose,
}: {
  name: string;
  emojiIcon: string;
  color: string | null;
  today: {
    place: string | null;
    startTime: string | null;
    endTime: string | null;
    offReason: string | null;
  };
  profile: {
    className: string | null;
    room: string | null;
    teacher: string | null;
    officePhone: string | null;
  } | null;
  periods: Period[];
  doses: DoseStatus[];
  onLogDose: () => void;
}) {
  const where = today.offReason
    ? today.offReason
    : today.place
      ? `${today.place}${today.startTime ? ` · ${today.startTime}${today.endTime ? `–${today.endTime}` : ''}` : ''}`
      : 'Nothing on today';

  // Class, room and teacher read as one line, the way you would say them.
  const bits = [
    profile?.className,
    profile?.room ? `Room ${profile.room}` : null,
    profile?.teacher,
  ].filter((s): s is string => Boolean(s && s.trim()));
  const term = termLine(periods);

  return (
    <div className="mb-d3 overflow-hidden rounded-card bg-surface shadow-card">
      <div className="flex items-start gap-d3 p-d3">
        <span
          className="grid h-11 w-11 flex-none place-items-center rounded-emoji"
          style={{
            fontSize: 22,
            background: color
              ? `color-mix(in srgb, ${color} 22%, var(--color-surface))`
              : 'var(--color-emoji-bg)',
          }}
        >
          {emojiIcon}
        </span>
        <div className="min-w-0 flex-1">
          <h1
            className="font-head truncate"
            style={{
              fontSize: 'var(--fs-big)',
              fontWeight: 'var(--title-weight)',
              letterSpacing: 'var(--title-tracking)',
              lineHeight: 1.1,
            }}
          >
            {name}
          </h1>
          {/* The whole payoff of the weekly pattern and the term dates — so it
              is read at full size rather than as a grey line under the name. */}
          <div className="mt-0.5 font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
            {where}
          </div>
          {bits.length > 0 && (
            <div className="mt-0.5 truncate text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
              {bits.join(' · ')}
            </div>
          )}
        </div>
        {profile?.officePhone && (
          <a
            href={`tel:${profile.officePhone.replace(/\s+/g, '')}`}
            aria-label={`Call ${name.split(' ')[0]}'s school`}
            className="grid h-11 w-11 flex-none place-items-center rounded-full"
            style={{ background: 'var(--color-accent-soft)', fontSize: 15 }}
          >
            📞
          </a>
        )}
      </div>

      {/* One strip per medicine still inside its window. The fact you need at a
          glance is when the next one is allowed, so it sits here rather than in
          a section you have to scroll to. */}
      {doses.map((d) => {
        const next = d.nextFrom ? new Date(d.nextFrom) : null;
        const ok = !next || next <= new Date();
        return (
          <div
            key={d.medicine}
            className="flex items-center gap-2 border-t border-border px-d3 py-2"
            style={{ background: ok ? 'transparent' : 'var(--color-accent-soft)' }}
          >
            <span className="flex-none" style={{ fontSize: 15 }}>
              💊
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold" style={{ fontSize: 'var(--fs-sm)' }}>
                {d.medicine}
                {d.amount ? ` · ${d.amount}` : ''}
                <span className="font-normal text-muted"> · {fmtTime(d.givenAt)}</span>
              </span>
              <span
                className="block"
                style={{
                  fontSize: 'var(--fs-sm)',
                  fontWeight: ok ? 400 : 700,
                  color: ok ? 'var(--color-muted)' : 'var(--color-accent)',
                }}
              >
                {next
                  ? ok
                    ? 'Can be given now'
                    : `Next from ${fmtTime(next)}`
                  : 'No spacing entered'}
                {d.countToday > 1 ? ` · ${d.countToday} in 24 h` : ''}
              </span>
            </span>
            {ok && (
              <button
                type="button"
                onClick={onLogDose}
                className="flex-none rounded-full px-3.5 py-2 font-bold text-accent-contrast"
                style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
              >
                Log
              </button>
            )}
          </div>
        );
      })}

      {term && (
        <div className="flex items-center gap-2 border-t border-border px-d3 py-2 text-muted">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="flex-none"
          >
            <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
            <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" />
          </svg>
          <span style={{ fontSize: 'var(--fs-xs)' }}>{term}</span>
        </div>
      )}
    </div>
  );
}
