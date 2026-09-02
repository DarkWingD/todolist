import clsx from 'clsx';
import { motion, type PanInfo } from 'framer-motion';
import { useState } from 'react';
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
  onToggle: (id: string, completed: boolean) => void;
  onOpen: (id: string) => void;
  onIndent?: (id: string) => void;
  onOutdent?: (id: string) => void;
  onCompleteStart?: (id: string) => void;
}) {
  const [completing, setCompleting] = useState(false);
  const going = completing || Boolean(leaving);
  const showChecked = completed || going;

  function startComplete() {
    if (completed) {
      onToggle(id, false); // un-complete immediately, no animation
    } else {
      onCompleteStart?.(id);
      setCompleting(true);
    }
  }

  function onDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD && canIndent) onIndent?.(id);
    else if (info.offset.x < -SWIPE_THRESHOLD && canOutdent) onOutdent?.(id);
  }

  return (
    <motion.div
      className="relative mb-d2"
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
        className="relative flex cursor-pointer items-start gap-d3 rounded-card bg-surface shadow-card"
        style={{ padding: 'var(--space-3)' }}
        onClick={() => onOpen(id)}
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
      </motion.div>
    </motion.div>
  );
}
