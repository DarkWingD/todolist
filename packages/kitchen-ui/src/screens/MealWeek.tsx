import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { MealDayCard, type MealEntry } from '../components/MealDayCard';
import { addDays, sameDay, startOfWeekMon, WEEKDAY_SHORT } from '../lib/caldate';
import type { MealPlannerAdapter } from '../adapter';

/** Local calendar day as "YYYY-MM-DD" — never via toISOString, which shifts by UTC. */
export function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const fmtDay = (d: Date) => d.toLocaleDateString([], { day: 'numeric', month: 'short' });

/**
 * The week board. Knows nothing about where its data comes from — the host app
 * hands it an adapter, and the same component renders against a Postgres server
 * or a JSON file on a phone.
 *
 * `onSent` lets the host react to a shopping-list push (the web app refreshes
 * its Lists screen); the phone has nothing else to tell.
 */
export function MealWeek({
  adapter,
  onSent,
}: {
  adapter: MealPlannerAdapter;
  onSent?: () => void;
}) {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeekMon(new Date()));
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const from = toKey(days[0]!);
  const to = toKey(days[6]!);
  const today = new Date();

  // Everyone lands on a plan with no setup: the first they belong to, or a new
  // one. Someone who accepted an invite gets the shared plan, not a second.
  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ['mealPlan'],
    queryFn: () => adapter.ensurePlan(),
  });
  const planId = plan?.id;
  const enabled = Boolean(planId);

  const { data: entries = [], isLoading: weekLoading } = useQuery({
    queryKey: ['mealWeek', planId, from, to],
    queryFn: () => adapter.getWeek(planId!, from, to),
    enabled,
  });
  const { data: meals = [] } = useQuery({
    queryKey: ['meals', planId],
    queryFn: () => adapter.getMeals(planId!),
    enabled,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['mealWeek'] });
    qc.invalidateQueries({ queryKey: ['meals'] });
  };
  const setDay = useMutation({ mutationFn: adapter.setDay.bind(adapter), onSuccess: invalidate });
  const clearDay = useMutation({
    mutationFn: (v: { planId: string; date: string }) => adapter.clearDay(v.planId, v.date),
    onSuccess: invalidate,
  });
  const moveDay = useMutation({
    mutationFn: (v: { planId: string; from: string; to: string }) =>
      adapter.moveDay(v.planId, v.from, v.to),
    onSuccess: invalidate,
  });
  const editMeal = useMutation({
    mutationFn: adapter.updateMeal.bind(adapter),
    onSuccess: invalidate,
  });
  const favourite = useMutation({
    mutationFn: (v: { id: string; isFavourite: boolean }) =>
      adapter.toggleFavourite(v.id, v.isFavourite),
    onSuccess: invalidate,
  });
  const invite = useMutation({
    mutationFn: (v: { planId: string; email: string }) => adapter.invite!(v.planId, v.email),
    onSuccess: () => {
      setInviteEmail('');
      setSharing(false);
    },
  });
  const toShopping = useMutation({
    mutationFn: (v: { planId: string; from: string; to: string }) =>
      adapter.sendToShoppingList(v.planId, v.from, v.to),
    onSuccess: () => onSent?.(),
  });
  const busy =
    setDay.isPending ||
    clearDay.isPending ||
    moveDay.isPending ||
    editMeal.isPending ||
    favourite.isPending;

  const byDate = useMemo(() => {
    const m = new Map<string, MealEntry>();
    for (const e of entries) m.set(e.date, e);
    return m;
  }, [entries]);

  const showingThisWeek = sameDay(weekStart, startOfWeekMon(today));

  // Cards vary in height, so a drop lands on whichever day's box centre is
  // nearest — which stays correct however tall the neighbours happen to be.
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  function onDropFrom(index: number, offsetY: number) {
    if (!planId) return;
    const source = slotRefs.current[index];
    if (!source) return;
    const sourceBox = source.getBoundingClientRect();
    const droppedAt = sourceBox.top + sourceBox.height / 2 + offsetY;
    let best = index;
    let bestGap = Number.POSITIVE_INFINITY;
    slotRefs.current.forEach((el, i) => {
      if (!el) return;
      const box = el.getBoundingClientRect();
      const gap = Math.abs(box.top + box.height / 2 - droppedAt);
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    });
    if (best === index) return;
    const entry = byDate.get(toKey(days[index]!));
    const anchor = entry?.isLeftover ? entry.cookDate : toKey(days[index]!);
    moveDay.mutate({ planId, from: anchor, to: toKey(days[best]!) });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-d3 flex flex-col gap-d3">
        <div className="flex items-baseline gap-d2">
          <h1
            className="font-head flex-1"
            style={{
              fontSize: 'var(--fs-big)',
              fontWeight: 'var(--title-weight)',
              letterSpacing: 'var(--title-tracking)',
            }}
          >
            Meals
          </h1>
          {/* No adapter.invite means no server to share through — the phone. */}
          {planId && adapter.invite && (
            <button
              type="button"
              onClick={() => setSharing((s) => !s)}
              aria-expanded={sharing}
              className="flex-none rounded-full px-3 py-1 font-semibold text-muted"
              style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-xs)' }}
            >
              {plan && plan.memberCount > 1 ? `Shared with ${plan.memberCount}` : 'Share'}
            </button>
          )}
        </div>

        {sharing && planId && adapter.invite && (
          <div className="flex flex-col gap-d2 rounded-card bg-surface p-d3 shadow-card">
            <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Invite someone to plan meals with you. They'll get a link by email.
            </span>
            <div className="flex gap-d2">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="their@email.com"
                type="email"
                autoComplete="email"
                aria-label="Email address to invite"
                className="min-w-0 flex-1 rounded-check border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
              />
              <button
                type="button"
                disabled={!inviteEmail.trim() || invite.isPending}
                onClick={() => invite.mutate({ planId, email: inviteEmail.trim() })}
                className="flex-none rounded-full px-4 py-2 font-bold text-accent-contrast disabled:opacity-50"
                style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
              >
                {invite.isPending ? 'Sending…' : 'Invite'}
              </button>
            </div>
            {invite.error && (
              <span style={{ color: 'var(--color-danger)', fontSize: 'var(--fs-sm)' }}>
                {(invite.error as Error).message}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-d2">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted"
            style={{ background: 'var(--color-chip-bg)' }}
          >
            ‹
          </button>
          <span className="flex-1 text-center font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
            {fmtDay(days[0]!)} – {fmtDay(days[6]!)} {days[6]!.getFullYear()}
          </span>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted"
            style={{ background: 'var(--color-chip-bg)' }}
          >
            ›
          </button>
          {!showingThisWeek && (
            <button
              type="button"
              onClick={() => setWeekStart(startOfWeekMon(new Date()))}
              className="flex-none rounded-full px-3 py-1 font-bold"
              style={{
                background: 'var(--color-accent-soft)',
                color: 'var(--color-accent)',
                fontSize: 'var(--fs-xs)',
              }}
            >
              Today
            </button>
          )}
        </div>
      </header>

      {planLoading || (weekLoading && entries.length === 0) ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Loading…
        </p>
      ) : (
        <div className="flex flex-col gap-d2 md:grid md:grid-cols-7 md:items-start">
          {days.map((d, i) => {
            const key = toKey(d);
            const entry = byDate.get(key) ?? null;
            const expanded = openDate === key;
            // The cook owns the chain, so edits from a leftover night are
            // applied to the day the meal was actually cooked.
            const anchor = entry?.isLeftover ? entry.cookDate : key;
            return (
              <div
                key={key}
                ref={(el) => {
                  slotRefs.current[i] = el;
                }}
                className={clsx(expanded && 'md:col-span-7')}
              >
                <MealDayCard
                  weekday={WEEKDAY_SHORT[i]!}
                  dayNum={d.getDate()}
                  isToday={sameDay(d, today)}
                  isWeekend={i >= 5}
                  entry={entry}
                  meals={meals}
                  expanded={expanded}
                  busy={busy}
                  onToggleOpen={() => setOpenDate(expanded ? null : key)}
                  onPick={(v) => {
                    if (!planId) return;
                    // Naming a meal on a leftover night starts a new cook there;
                    // adjusting the span belongs to the original cook's day.
                    const target = v.name ? key : anchor;
                    setDay.mutate({ planId, date: target, ...v });
                  }}
                  onClear={() => {
                    if (!planId || !entry) return;
                    if (entry.isLeftover) {
                      // Stop the leftovers here rather than deleting a row that
                      // this day never had.
                      setDay.mutate({
                        planId,
                        date: entry.cookDate,
                        mealId: entry.mealId,
                        cookSpan: entry.night - 1,
                      });
                    } else {
                      clearDay.mutate({ planId, date: key });
                    }
                    setOpenDate(null);
                  }}
                  onPushNextWeek={() => {
                    if (!planId || !entry) return;
                    moveDay.mutate({
                      planId,
                      from: anchor,
                      to: toKey(addDays(new Date(`${anchor}T00:00:00`), 7)),
                    });
                    setOpenDate(null);
                  }}
                  onEditMeal={(v) => editMeal.mutate(v)}
                  onToggleFavourite={(id, next) => favourite.mutate({ id, isFavourite: next })}
                  onDragEndY={(offsetY) => onDropFrom(i, offsetY)}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-d4 flex gap-d2 pb-2">
        <button
          type="button"
          disabled={!planId || toShopping.isPending || entries.length === 0}
          onClick={() => planId && toShopping.mutate({ planId, from, to })}
          className="flex-1 rounded-full py-3 font-bold text-accent-contrast disabled:opacity-50"
          style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
        >
          {toShopping.isPending ? 'Adding…' : '🛒 Send week to shopping list'}
        </button>
      </div>
      {toShopping.error && (
        <p
          className="pb-2 text-center"
          style={{ color: 'var(--color-danger)', fontSize: 'var(--fs-sm)' }}
        >
          {(toShopping.error as Error).message}
        </p>
      )}
      {toShopping.data && !toShopping.error && (
        <p
          className="pb-2 text-center"
          style={{
            fontSize: 'var(--fs-sm)',
            color: toShopping.data.added > 0 ? 'var(--color-accent)' : 'var(--color-muted)',
          }}
        >
          {toShopping.data.added > 0
            ? `Added ${toShopping.data.added} ${
                toShopping.data.added === 1 ? 'item' : 'items'
              } to Shopping.`
            : 'Everything from this week is already on the list.'}
        </p>
      )}
    </div>
  );
}
