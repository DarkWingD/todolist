import clsx from 'clsx';
import { motion, type PanInfo } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Checkbox } from './Checkbox';

const SWIPE_THRESHOLD = 90;

/**
 * A single line on a shopping list.
 *
 * Deliberately not the app's `TaskRow`: a shopping item has no due date,
 * priority, assignee or recurrence, and a phone with no accounts has nobody to
 * assign to. Same card styling, none of the machinery.
 *
 * Swipe reshapes the outline rather than completing or deleting — ticking is
 * the checkbox's job and deleting lives in the edit sheet. A row that can do
 * neither doesn't move at all, so the gesture never lies.
 */
export function ShoppingRow({
  id,
  title,
  completed,
  canIndent,
  canOutdent,
  leaving,
  animateOut = true,
  flash,
  onToggle,
  onOpen,
  onIndent,
  onOutdent,
  onCompleteStart,
}: {
  id: string;
  title: string;
  completed: boolean;
  canIndent?: boolean;
  canOutdent?: boolean;
  /** Animate out because the heading above is being ticked. */
  leaving?: boolean;
  /**
   * Whether ticking this row makes it leave. True for a top-level row, which
   * moves to Bought; false for an ingredient, which stays under its meal struck
   * through so you can watch the meal fill up.
   */
  animateOut?: boolean;
  /** Just added: scroll it into view and wash it once, so it isn't lost. */
  flash?: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onOpen: (id: string) => void;
  onIndent?: (id: string) => void;
  onOutdent?: (id: string) => void;
  onCompleteStart?: (id: string) => void;
}) {
  const [completing, setCompleting] = useState(false);
  // A row only fades when it is actually going somewhere. An ingredient ticked
  // on its own stays put, so it must not be left at opacity 0 — it keeps the
  // same React instance in the same parent, and `completing` would never clear.
  const going = (completing && animateOut) || Boolean(leaving);
  const showChecked = completed || completing || Boolean(leaving);

  // Once the store confirms the tick, the transient animation state is spent.
  useEffect(() => {
    if (completed) setCompleting(false);
  }, [completed]);

  // A new item keeps its place in the outline, which on a long list means it
  // lands off-screen. Bring it into view rather than reordering around it.
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 'nearest' moves as little as possible — enough to reveal the row, without
    // yanking the whole list around mid-flow.
    if (flash) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [flash]);

  function startComplete() {
    if (completed) {
      onToggle(id, false); // un-complete immediately, no animation
      return;
    }
    onCompleteStart?.(id);
    // Strike through at once either way. A row that fades writes when the
    // animation ends; one that stays put has no animation to wait for, and
    // waiting would mean the tick was never written at all.
    setCompleting(true);
    if (!animateOut) onToggle(id, true);
  }

  function onDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD && canIndent) onIndent?.(id);
    else if (info.offset.x < -SWIPE_THRESHOLD && canOutdent) onOutdent?.(id);
  }

  return (
    <motion.div
      ref={rowRef}
      // Tighter than a task row's gap: shorter rows made the old spacing read
      // as gappy. Still on the density scale rather than a fixed pixel value.
      className="relative mb-d1"
      style={{ overflow: 'hidden' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: going ? 0 : 1, y: 0 }}
      transition={going ? { opacity: { delay: 0.3, duration: 0.3 } } : { duration: 0.2 }}
      onAnimationComplete={() => {
        // Only the row actually ticked writes; one carried out by its heading is
        // already handled by the cascade.
        if (completing) onToggle(id, true);
      }}
    >
      <div
        className="absolute inset-0 flex items-center justify-between rounded-card px-4 font-semibold"
        style={{ fontSize: 'var(--fs-sm)' }}
      >
        <span className="text-accent">{canIndent ? '→ Under above' : ''}</span>
        <span className="text-accent">{canOutdent ? 'Own heading ←' : ''}</span>
      </div>

      <motion.div
        drag="x"
        dragSnapToOrigin
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: canOutdent ? 0.7 : 0, right: canIndent ? 0.7 : 0 }}
        onDragEnd={onDragEnd}
        className="relative flex cursor-pointer items-center gap-d3 rounded-card bg-surface shadow-card"
        // Tighter vertically than a task row — a shopping list is scanned in
        // bulk, and the whole row is the tap target so it needn't be tall.
        style={{ padding: 'var(--space-2) var(--space-3)' }}
        // Ticking is what you do constantly in a shop, so it gets the whole row
        // rather than a 22px box; editing is rare and gets its own button.
        onClick={startComplete}
      >
        <div onClick={(e) => e.stopPropagation()} onPointerDownCapture={(e) => e.stopPropagation()}>
          <Checkbox
            checked={showChecked}
            onChange={startComplete}
            label={`Mark "${title}" ${completed ? 'not bought' : 'bought'}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={clsx('font-medium', completed && 'text-muted')}
            style={{ fontSize: 'var(--fs-base)', letterSpacing: '-0.005em' }}
          >
            <span className="relative inline-block">
              {title}
              {showChecked && (
                <motion.span
                  className="pointer-events-none absolute left-0"
                  style={{ top: '50%', height: 2, background: 'currentColor', borderRadius: 2 }}
                  initial={{ width: completed && !completing ? '100%' : '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.25 }}
                />
              )}
            </span>
          </div>
        </div>

        {/* A bare pencil rather than a circled ⋯: the button's own box was
            setting the row height, and editing is rare enough not to earn it. */}
        <button
          type="button"
          aria-label={`Edit "${title}"`}
          className="grid h-8 w-8 flex-none place-items-center text-muted"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(id);
          }}
          onPointerDownCapture={(e) => e.stopPropagation()}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4.5 19.5h3.2L19 8.2a2.1 2.1 0 0 0-3-3L4.5 16.3v3.2z" />
            <path d="M14.8 6.4l2.8 2.8" />
          </svg>
        </button>

        {/* A wash that fades out, rather than a colour interpolation — the
            theme's values are CSS variables and can't be tweened. */}
        {flash && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-card"
            style={{ background: 'var(--color-accent-soft)' }}
            initial={{ opacity: 0.95 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
