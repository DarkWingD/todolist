import clsx from 'clsx';
import type { ReactNode } from 'react';
import { NavIcon } from './NavIcon';

export type TabId = 'today' | 'lists' | 'cal' | 'meals' | 'you';

// Mostly geometric glyphs, but Meals gets a real plate: a fourth square sat
// next to the calendar's grid said nothing about food. Emoji is in keeping —
// lists and avatars use them throughout.
// Marks live in NavIcon and inherit currentColor, so the active tab tints its
// icon and label together. Emoji stay where they're content — list icons and
// avatars — rather than chrome.
const TABS: { id: TabId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'lists', label: 'Lists' },
  { id: 'cal', label: 'Cal' },
  { id: 'meals', label: 'Meals' },
  { id: 'you', label: 'You' },
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
            <NavIcon tab={t.id} />
            {t.label}
          </button>
        ))}
      </nav>

      {overlay}
    </div>
  );
}
