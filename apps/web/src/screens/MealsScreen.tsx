import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MealDayCard, type MealEntry } from '../components/MealDayCard';
import { addDays, sameDay, startOfWeekMon, WEEKDAY_SHORT } from '../lib/caldate';
import { trpc } from '../lib/trpc';

/** Local calendar day as "YYYY-MM-DD" — never via toISOString, which shifts by UTC. */
function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const fmtDay = (d: Date) => d.toLocaleDateString([], { day: 'numeric', month: 'short' });

export function MealsScreen() {
  const utils = trpc.useUtils();
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

  // Everyone lands on a plan with no setup: the first one they belong to, or a
  // new one. Someone who accepted an invite gets the shared plan, not a second.
  const { data: plans, isLoading: plansLoading } = trpc.mealPlan.mine.useQuery();
  const ensure = trpc.mealPlan.ensure.useMutation({
    onSuccess: () => utils.mealPlan.mine.invalidate(),
  });
  const ensured = useRef(false);
  useEffect(() => {
    if (!plansLoading && plans && plans.length === 0 && !ensured.current) {
      ensured.current = true;
      ensure.mutate();
    }
  }, [plansLoading, plans, ensure]);

  const planId = plans?.[0]?.id;
  const enabled = Boolean(planId);

  const { data: entries = [], isLoading: weekLoading } = trpc.mealPlan.range.useQuery(
    { planId: planId!, from, to },
    { enabled },
  );
  const { data: meals = [] } = trpc.mealPlan.meals.useQuery({ planId: planId! }, { enabled });

  const invalidate = () => {
    utils.mealPlan.range.invalidate();
    utils.mealPlan.meals.invalidate();
  };
  const setDay = trpc.mealPlan.setDay.useMutation({ onSuccess: invalidate });
  const clearDay = trpc.mealPlan.clearDay.useMutation({ onSuccess: invalidate });
  const moveDay = trpc.mealPlan.moveDay.useMutation({ onSuccess: invalidate });
  const editMeal = trpc.mealPlan.updateMeal.useMutation({ onSuccess: invalidate });
  const favourite = trpc.mealPlan.toggleFavourite.useMutation({ onSuccess: invalidate });
  const invite = trpc.mealPlan.invite.useMutation({
    onSuccess: () => {
      setInviteEmail('');
      setSharing(false);
    },
  });
  const toShopping = trpc.mealPlan.sendToShoppingList.useMutation({
    onSuccess: () => {
      utils.lists.mine.invalidate();
      utils.lists.shopping.invalidate();
      utils.tasks.agenda.invalidate();
    },
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
          {planId && (
            <button
              type="button"
              onClick={() => setSharing((s) => !s)}
              aria-expanded={sharing}
              className="flex-none rounded-full px-3 py-1 font-semibold text-muted"
              style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-xs)' }}
            >
              {plans && plans[0]!.memberCount > 1
                ? `Shared with ${plans[0]!.memberCount}`
                : 'Share'}
            </button>
          )}
        </div>

        {sharing && planId && (
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
                {invite.error.message}
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

      {plansLoading || (weekLoading && entries.length === 0) ? (
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
          {toShopping.error.message}
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
