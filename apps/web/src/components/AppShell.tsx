import clsx from 'clsx';
import type { ReactNode } from 'react';

export type TabId = 'today' | 'lists' | 'cal' | 'meals' | 'you';

// Icons are text glyphs rather than an icon set. '▤' reads as stacked rows,
// which is what the meal week actually looks like, and stays clear of the
// calendar's grid square.
const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'today', icon: '◎', label: 'Today' },
  { id: 'lists', icon: '☰', label: 'Lists' },
  { id: 'cal', icon: '▦', label: 'Cal' },
  { id: 'meals', icon: '▤', label: 'Meals' },
  { id: 'you', icon: '◔', label: 'You' },
];

interface AppShellProps {
  active: TabId;
  onNavigate: (tab: TabId) => void;
  onAdd?: () => void;
  showFab?: boolean;
  children: ReactNode;
  /** Overlays (e.g. bottom sheets) rendered at the shell root, above the nav. */
  overlay?: ReactNode;
  /**
   * Let the screen use the full width on a large display instead of the phone
   * column. Only the meal week board wants this — everything else reads better
   * in one column, so it stays opt-in.
   */
  wide?: boolean;
}

export function AppShell({
  active,
  onNavigate,
  onAdd,
  showFab,
  children,
  overlay,
  wide,
}: AppShellProps) {
  return (
    <div
      className={clsx(
        'relative mx-auto flex h-[100dvh] flex-col overflow-hidden bg-bg',
        wide ? 'max-w-md md:max-w-5xl' : 'max-w-md',
      )}
    >
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-d4 pt-3">{children}</main>

      {showFab && onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add task"
          className="absolute grid place-items-center rounded-fab text-accent-contrast"
          style={{
            right: 18,
            bottom: 'calc(76px + env(safe-area-inset-bottom))',
            width: 56,
            height: 56,
            fontSize: 27,
            background: 'var(--color-accent)',
            boxShadow: '0 12px 26px -6px var(--color-accent-glow)',
          }}
        >
          +
        </button>
      )}

      <nav
        className="flex flex-none items-center justify-around border-t border-border"
        style={{
          height: 'calc(64px + env(safe-area-inset-bottom))',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
          background: 'var(--color-tabbar)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onNavigate(t.id)}
            aria-current={active === t.id ? 'page' : undefined}
            className={clsx(
              'flex flex-col items-center gap-[3px]',
              active === t.id ? 'font-bold text-accent' : 'text-muted',
            )}
            style={{ fontSize: 11.5 }}
          >
            <span style={{ fontSize: 24, lineHeight: 1 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {overlay}
    </div>
  );
}
