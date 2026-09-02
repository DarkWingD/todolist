import clsx from 'clsx';
import { motion, useDragControls, type PanInfo } from 'framer-motion';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface MealEntry {
  date: string;
  mealId: string;
  name: string;
  recipeUrl: string | null;
  notes: string | null;
  isFavourite: boolean;
  cookSpan: number;
  isLeftover: boolean;
  cookDate: string;
  night: number;
}

export interface MealOption {
  id: string;
  name: string;
  recipeUrl: string | null;
  notes: string | null;
  isFavourite: boolean;
}

const COOK_SPAN_MAX = 7;

/** Just the host, so a long recipe URL reads as a source rather than a string. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

interface Props {
  weekday: string;
  dayNum: number;
  isToday: boolean;
  isWeekend: boolean;
  entry: MealEntry | null;
  meals: MealOption[];
  expanded: boolean;
  busy: boolean;
  onToggleOpen: () => void;
  onPick: (v: { mealId?: string; name?: string; cookSpan: number }) => void;
  onClear: () => void;
  onPushNextWeek: () => void;
  onEditMeal: (v: { id: string; recipeUrl?: string | null; notes?: string | null }) => void;
  onToggleFavourite: (id: string, next: boolean) => void;
  /** How far the card was dragged vertically; the screen maps that to a day. */
  onDragEndY: (offsetY: number) => void;
}

export function MealDayCard({
  weekday,
  dayNum,
  isToday,
  isWeekend,
  entry,
  meals,
  expanded,
  busy,
  onToggleOpen,
  onPick,
  onClear,
  onPushNextWeek,
  onEditMeal,
  onToggleFavourite,
  onDragEndY,
}: Props) {
  const dragControls = useDragControls();
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [recipe, setRecipe] = useState('');
  const [notes, setNotes] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-seed the editor whenever it opens or the underlying meal changes.
  useEffect(() => {
    if (!expanded) return;
    setDraft(entry?.name ?? '');
    setRecipe(entry?.recipeUrl ?? '');
    setNotes(entry?.notes ?? '');
    setHighlight(0);
    if (!entry) inputRef.current?.focus();
  }, [expanded, entry]);

  const q = draft.trim().toLowerCase();
  const matches =
    q.length === 0
      ? meals.slice(0, 8)
      : meals.filter((m) => m.name.toLowerCase().includes(q) && m.name.toLowerCase() !== q).slice(0, 8);
  const showList = expanded && (!entry || draft !== entry.name) && matches.length > 0;

  // Only a planned, collapsed day can be dragged to another day.
  const draggableNow = Boolean(entry) && !expanded;
  const cookSpan = entry?.cookSpan ?? 1;
  const railUp = Boolean(entry?.isLeftover);
  const railDown = Boolean(entry && entry.night < entry.cookSpan);

  function commit(name: string, mealId?: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    onPick(mealId ? { mealId, cookSpan } : { name: trimmed, cookSpan });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && showList) {
      e.preventDefault();
      setHighlight((h) => (h + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && showList) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = showList ? matches[highlight] : undefined;
      if (hit) commit(hit.name, hit.id);
      else commit(draft);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onToggleOpen();
    }
  }

  return (
    <div className="relative">
      {/* The rail that joins a cook to the nights it feeds. It overhangs the
          card so the segments meet across the gap between them. */}
      {(railUp || railDown) && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            left: 33,
            top: railUp ? -10 : 34,
            bottom: railDown ? -10 : 'auto',
            height: railDown ? 'auto' : 12,
            width: 2,
            borderRadius: 2,
            background: 'var(--color-accent)',
            opacity: 0.4,
          }}
        />
      )}

      <motion.div
        // Dragging is started only by the grip, so a normal touch anywhere on
        // the card still scrolls the page.
        drag={draggableNow ? 'y' : false}
        dragListener={false}
        dragControls={dragControls}
        dragSnapToOrigin
        dragElastic={0.4}
        onDragStart={() => setDragging(true)}
        onDragEnd={(_e: unknown, info: PanInfo) => {
          setDragging(false);
          onDragEndY(info.offset.y);
        }}
        className={clsx(
          'flex gap-d3 rounded-card p-d3',
          expanded ? 'flex-col shadow-lg' : 'items-start shadow-card',
        )}
        style={{
          position: 'relative',
          zIndex: dragging ? 5 : undefined,
          boxShadow: dragging ? '0 12px 26px rgba(0,0,0,.24)' : undefined,
          background:
            entry?.isLeftover && !expanded
              ? 'color-mix(in srgb, var(--color-surface) 62%, transparent)'
              : isWeekend
                ? 'color-mix(in srgb, var(--color-weekend), var(--color-surface))'
                : 'var(--color-surface)',
          outline: expanded ? '1px solid var(--color-accent)' : undefined,
        }}
      >
        <div className={clsx('flex w-full gap-d3', expanded ? 'items-center' : 'items-start')}>
          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={expanded}
            aria-label={`${weekday} ${dayNum}${entry ? `, ${entry.name}` : ', nothing planned'}`}
            className="flex flex-none flex-col items-center rounded-emoji"
            style={{
              width: 44,
              padding: '6px 0',
              background: isToday ? 'var(--color-accent)' : 'var(--color-chip-bg)',
              color: isToday ? 'var(--color-accent-contrast)' : 'var(--color-text)',
            }}
          >
            <span
              className="font-bold uppercase"
              style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.07em', opacity: 0.75 }}
            >
              {weekday}
            </span>
            <span className="font-bold" style={{ fontSize: 'var(--fs-lg)', lineHeight: 1.1 }}>
              {dayNum}
            </span>
          </button>

          {expanded ? (
            <span className="flex-1 font-bold" style={{ fontSize: 'var(--fs-base)' }}>
              {entry ? 'Editing' : 'Plan this day'}
            </span>
          ) : (
            <button
              type="button"
              onClick={onToggleOpen}
              className="min-w-0 flex-1 pt-0.5 text-left"
            >
              {entry ? (
                <>
                  <span
                    className={clsx('block', entry.isLeftover ? 'text-muted font-semibold' : 'font-bold')}
                    style={{ fontSize: 'var(--fs-base)' }}
                  >
                    {entry.name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-d2">
                    {entry.isLeftover ? (
                      <span
                        className="rounded-full px-2 py-0.5 font-semibold text-muted"
                        style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-xs)' }}
                      >
                        Leftovers · night {entry.night}
                      </span>
                    ) : (
                      entry.cookSpan > 1 && (
                        <span
                          className="rounded-full px-2 py-0.5 font-semibold"
                          style={{
                            background: 'var(--color-accent-soft)',
                            color: 'var(--color-accent)',
                            fontSize: 'var(--fs-xs)',
                          }}
                        >
                          Feeds {entry.cookSpan} nights
                        </span>
                      )
                    )}
                    {entry.recipeUrl && (
                      <span
                        className="rounded-full px-2 py-0.5 font-semibold text-muted"
                        style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-xs)' }}
                      >
                        🔗 {hostOf(entry.recipeUrl)}
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <span className="italic text-muted" style={{ fontSize: 'var(--fs-base)' }}>
                  Nothing planned
                </span>
              )}
            </button>
          )}

          {!expanded && entry?.isFavourite && (
            <span className="flex-none text-accent" style={{ fontSize: 14 }}>
              ★
            </span>
          )}

          {draggableNow && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Drag to another day"
              onPointerDown={(e) => dragControls.start(e)}
              className="flex-none cursor-grab select-none px-1 text-muted"
              // touch-action:none is what lets a touch drag here beat the
              // page's own vertical scroll.
              style={{ touchAction: 'none', fontSize: 16, lineHeight: 1 }}
            >
              ⠿
            </span>
          )}
        </div>

        {expanded && (
          <div className="flex w-full flex-col gap-d3">
            <label className="flex flex-col gap-1">
              <span
                className="font-bold uppercase text-muted"
                style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.04em' }}
              >
                Meal
              </span>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onKeyDown}
                onBlur={() => {
                  // Let a click on the list win the race before committing.
                  window.setTimeout(() => {
                    if (draft.trim() && draft.trim() !== entry?.name) commit(draft);
                  }, 150);
                }}
                placeholder="What's for dinner?"
                autoComplete="off"
                spellCheck={false}
                className="rounded-check border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
              />
            </label>

            {showList && (
              <div className="-mt-2 overflow-hidden rounded-check border border-border">
                {matches.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(m.name, m.id);
                    }}
                    className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-b-0"
                    style={{
                      fontSize: 'var(--fs-sm)',
                      background: i === highlight ? 'var(--color-accent-soft)' : 'var(--color-surface)',
                      color: i === highlight ? 'var(--color-accent)' : 'var(--color-text)',
                      fontWeight: i === highlight ? 700 : 400,
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    {m.isFavourite && <span style={{ fontSize: 12 }}>★</span>}
                    {m.recipeUrl && <span style={{ fontSize: 12 }}>🔗</span>}
                  </button>
                ))}
              </div>
            )}

            {entry && (
              <>
                <label className="flex flex-col gap-1">
                  <span
                    className="font-bold uppercase text-muted"
                    style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.04em' }}
                  >
                    Recipe link
                  </span>
                  <input
                    value={recipe}
                    onChange={(e) => setRecipe(e.target.value)}
                    onBlur={() => {
                      const next = recipe.trim();
                      if (next !== (entry.recipeUrl ?? ''))
                        onEditMeal({ id: entry.mealId, recipeUrl: next || null });
                    }}
                    placeholder="https://…"
                    inputMode="url"
                    autoComplete="off"
                    className="rounded-check border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                    style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
                  />
                </label>

                <div className="flex flex-col gap-1">
                  <span
                    className="font-bold uppercase text-muted"
                    style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.04em' }}
                  >
                    Feeds
                  </span>
                  <div className="flex items-center gap-d2">
                    <button
                      type="button"
                      aria-label="Fewer nights"
                      disabled={busy || cookSpan <= 1}
                      onClick={() => onPick({ mealId: entry.mealId, cookSpan: cookSpan - 1 })}
                      className="grid h-8 w-8 place-items-center rounded-full border border-border disabled:opacity-40"
                      style={{ background: 'var(--color-bg)' }}
                    >
                      −
                    </button>
                    <span
                      className="text-center font-bold"
                      style={{ fontSize: 'var(--fs-base)', minWidth: 16, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {cookSpan}
                    </span>
                    <button
                      type="button"
                      aria-label="More nights"
                      disabled={busy || cookSpan >= COOK_SPAN_MAX}
                      onClick={() => onPick({ mealId: entry.mealId, cookSpan: cookSpan + 1 })}
                      className="grid h-8 w-8 place-items-center rounded-full border border-border disabled:opacity-40"
                      style={{ background: 'var(--color-bg)' }}
                    >
                      +
                    </button>
                    <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                      {cookSpan === 1 ? 'night' : 'nights'}
                    </span>
                  </div>
                </div>

                <label className="flex flex-col gap-1">
                  <span
                    className="font-bold uppercase text-muted"
                    style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.04em' }}
                  >
                    Notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => {
                      const next = notes.trim();
                      if (next !== (entry.notes ?? ''))
                        onEditMeal({ id: entry.mealId, notes: next || null });
                    }}
                    rows={2}
                    placeholder="Anything worth remembering next time"
                    className="resize-none rounded-check border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                    style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
                  />
                </label>

                <p className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                  The recipe and notes belong to {entry.name} everywhere it appears.
                </p>

                <div className="flex flex-wrap gap-d2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onPushNextWeek}
                    className="flex-1 rounded-full px-3 py-2 font-bold text-accent-contrast disabled:opacity-50"
                    style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
                  >
                    Push to next week →
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleFavourite(entry.mealId, !entry.isFavourite)}
                    aria-pressed={entry.isFavourite}
                    className="rounded-full border border-border px-3 py-2 font-bold disabled:opacity-50"
                    style={{
                      fontSize: 'var(--fs-sm)',
                      color: entry.isFavourite ? 'var(--color-accent)' : 'var(--color-text)',
                    }}
                  >
                    {entry.isFavourite ? '★' : '☆'} Favourite
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onClear}
                    className="rounded-full border border-border px-3 py-2 font-bold disabled:opacity-50"
                    style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-danger)' }}
                  >
                    Clear
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
