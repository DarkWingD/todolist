import clsx from 'clsx';
import type { ReactNode } from 'react';

type ChipVariant = 'default' | 'due' | 'over' | 'tag';

interface ChipProps {
  children: ReactNode;
  variant?: ChipVariant;
}

export function Chip({ children, variant = 'default' }: ChipProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        variant === 'due' && 'text-accent',
        variant === 'over' && 'text-danger',
        (variant === 'default' || variant === 'tag') && 'text-muted',
      )}
      style={{
        fontSize: 'var(--fs-xs)',
        padding: '3px 8px',
        background:
          variant === 'due'
            ? 'var(--color-accent-soft)'
            : variant === 'over'
              ? 'var(--color-danger-soft)'
              : 'var(--color-chip-bg)',
      }}
    >
      {variant === 'tag' && (
        <span
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)' }}
        />
      )}
      {children}
    </span>
  );
}
