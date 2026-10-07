import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * The small pieces the recipe screens share, in the same look as the meal
 * card's editor: uppercase field labels, bordered inputs, a solid accent button
 * for the one thing a panel is for, and soft chips for everything else.
 */

export const inputClass =
  'w-full rounded-check border border-border bg-bg px-3 py-2 outline-none focus:border-accent';
export const inputStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' } as const;

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="font-bold uppercase text-muted"
      style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.04em' }}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={clsx(
        'rounded-full px-4 py-2 font-bold text-accent-contrast disabled:opacity-50',
        className,
      )}
      style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)', ...rest.style }}
    >
      {children}
    </button>
  );
}

export function ChipButton({
  active,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      aria-pressed={active}
      className={clsx(
        'flex-none rounded-full px-3 py-1 font-semibold disabled:opacity-50',
        !active && 'text-muted',
        className,
      )}
      style={{
        background: active ? 'var(--color-accent-soft)' : 'var(--color-chip-bg)',
        color: active ? 'var(--color-accent)' : undefined,
        fontSize: 'var(--fs-xs)',
        ...rest.style,
      }}
    >
      {children}
    </button>
  );
}

/** "20 min", "1 h 15 min". */
export function minutesText(m: number | null | undefined): string | null {
  if (!m) return null;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`;
}

/** The steps of a method, one per non-empty line. */
export function methodSteps(method: string | null | undefined): string[] {
  return (method ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
