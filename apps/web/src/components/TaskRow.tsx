import clsx from 'clsx';
import { motion, type PanInfo } from 'framer-motion';
import { useState } from 'react';
import { Avatar } from './Avatar';
import { Checkbox } from './Checkbox';
import { Chip } from './Chip';

export interface TaskRowData {
  id: string;
  title: string;
  completed: boolean;
  flagged?: boolean;
  leadEmoji?: string;
  due?: string;
  dueVariant?: 'due' | 'over';
  recurrence?: string;
  tag?: string;
  assignee?: { id: string; emoji: string; color: string };
}

interface TaskRowProps {
  task: TaskRowData;
  onToggle: (id: string, completed: boolean) => void;
  onOpen?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const SWIPE_THRESHOLD = 90;

export function TaskRow({ task, onToggle, onOpen, onDelete }: TaskRowProps) {
  const [completing, setCompleting] = useState(false);
  const hasMeta = task.due || task.recurrence || task.tag || task.assignee;
  const showChecked = task.completed || completing;

  function startComplete() {
    if (task.completed) {
      onToggle(task.id, false); // un-complete immediately, no animation
    } else {
      setCompleting(true); // animate, then the outer onAnimationComplete fires onToggle
    }
  }

  function onDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) startComplete();
    else if (onDelete && info.offset.x < -SWIPE_THRESHOLD) onDelete(task.id);
  }

  return (
    <motion.div
      className="relative mb-d2"
      style={{ overflow: 'hidden' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: completing ? 0 : 1, y: 0 }}
      transition={completing ? { opacity: { delay: 0.3, duration: 0.3 } } : { duration: 0.2 }}
      onAnimationComplete={() => {
        if (completing) onToggle(task.id, true);
      }}
    >
      {/* Revealed behind the card while swiping. */}
      <div className="absolute inset-0 flex items-center justify-between rounded-card px-4 font-semibold" style={{ fontSize: 'var(--fs-sm)' }}>
        <span className="text-accent">✓ {task.completed ? 'Reopen' : 'Complete'}</span>
        {onDelete && <span className="text-danger">Delete 🗑</span>}
      </div>

      <motion.div
        drag="x"
        dragSnapToOrigin
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={onDelete ? 0.7 : { left: 0, right: 0.7 }}
        onDragEnd={onDragEnd}
        className="relative flex cursor-pointer items-start gap-d3 rounded-card bg-surface shadow-card"
        style={{ padding: 'var(--space-3)' }}
        onClick={() => onOpen?.(task.id)}
      >
        <div onClick={(e) => e.stopPropagation()} onPointerDownCapture={(e) => e.stopPropagation()}>
          <Checkbox
            checked={showChecked}
            onChange={() => startComplete()}
            label={`Mark "${task.title}" ${task.completed ? 'incomplete' : 'complete'}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={clsx('font-medium', task.completed && 'text-muted')}
            style={{ fontSize: 'var(--fs-base)', letterSpacing: '-0.005em' }}
          >
            <span className="relative inline-block">
              {task.leadEmoji && <span className="mr-1">{task.leadEmoji}</span>}
              {task.flagged && !showChecked && <span className="mr-1" style={{ color: 'var(--color-danger)' }}>⚑</span>}
              {task.title}
              {(showChecked || task.completed) && (
                <motion.span
                  className="pointer-events-none absolute left-0"
                  style={{ top: '50%', height: 2, background: 'currentColor', borderRadius: 2 }}
                  initial={{ width: task.completed && !completing ? '100%' : '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.25 }}
                />
              )}
            </span>
          </div>
          {hasMeta && !completing && (
            <div className="mt-d2 flex flex-wrap items-center gap-2">
              {task.due && (
                <Chip variant={task.dueVariant ?? 'due'}>
                  {task.dueVariant !== 'over' && '◷ '}
                  {task.due}
                </Chip>
              )}
              {task.recurrence && <Chip>🔁 {task.recurrence}</Chip>}
              {task.tag && <Chip variant="tag">{task.tag}</Chip>}
              {task.assignee && (
                <span className="ml-auto">
                  <Avatar emoji={task.assignee.emoji} color={task.assignee.color} size={22} />
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
