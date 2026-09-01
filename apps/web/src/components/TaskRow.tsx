import clsx from 'clsx';
import { motion, type PanInfo } from 'framer-motion';
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
}

const SWIPE_THRESHOLD = 90;

export function TaskRow({ task, onToggle, onOpen }: TaskRowProps) {
  const hasMeta = task.due || task.recurrence || task.tag || task.assignee;

  function onDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) onToggle(task.id, !task.completed);
  }

  return (
    <div className="relative mb-d2">
      {/* Revealed behind the card when swiping right. */}
      <div
        className="absolute inset-0 flex items-center rounded-card px-4 font-semibold text-accent"
        style={{ background: 'var(--color-accent-soft)', fontSize: 'var(--fs-sm)' }}
      >
        ✓ {task.completed ? 'Reopen' : 'Complete'}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        drag="x"
        dragSnapToOrigin
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.7 }}
        onDragEnd={onDragEnd}
        className="relative flex cursor-pointer items-start gap-d3 rounded-card bg-surface shadow-card"
        style={{ padding: 'var(--space-3)' }}
        onClick={() => onOpen?.(task.id)}
      >
        <div onClick={(e) => e.stopPropagation()} onPointerDownCapture={(e) => e.stopPropagation()}>
          <Checkbox
            checked={task.completed}
            onChange={(c) => onToggle(task.id, c)}
            label={`Mark "${task.title}" ${task.completed ? 'incomplete' : 'complete'}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={clsx('font-medium', task.completed && 'text-muted line-through')}
            style={{ fontSize: 'var(--fs-base)', letterSpacing: '-0.005em' }}
          >
            {task.leadEmoji && <span className="mr-1">{task.leadEmoji}</span>}
            {task.flagged && !task.completed && (
              <span className="mr-1" style={{ color: 'var(--color-danger)' }}>⚑</span>
            )}
            {task.title}
          </div>
          {hasMeta && (
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
    </div>
  );
}
