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
        // Phone: a centred column. Desktop: the shell fills the window so the
        // rail sits against its left edge, and the content centres inside
        // whatever is left rather than inheriting the phone's centring.
        'relative mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden bg-bg md:mx-0 md:max-w-none md:flex-row',
      )}
    >
      {/* Desktop rail. The same five destinations as the phone's tab bar, moved
          to the side: a bottom bar on a monitor puts navigation as far from the
          content as the screen allows, and wastes the width that made the
          desktop layout worth doing. */}
      <nav className="hidden md:flex md:w-52 md:flex-none md:flex-col md:gap-1 md:border-r md:border-border md:px-3 md:py-4">
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="mb-d3 flex items-center gap-2 rounded-full px-4 py-2.5 font-bold text-accent-contrast"
            style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
            Add
          </button>
        )}
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onNavigate(t.id)}
            aria-current={active === t.id ? 'page' : undefined}
            className={clsx(
              'flex items-center gap-3 rounded-card px-3 py-2.5 text-left',
              active === t.id ? 'font-bold text-accent' : 'text-muted hover:text-text',
            )}
            style={active === t.id ? { background: 'var(--color-accent-soft)' } : undefined}
          >
            <NavIcon tab={t.id} />
            <span style={{ fontSize: 'var(--fs-sm)' }}>{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-d4 pt-3 md:min-w-0 md:px-d5">
        {/* Wide screens get room, but a list of tasks still reads badly at 1000px,
            so only the board opts out of a comfortable measure. */}
        <div
          className={clsx(
            'flex min-h-0 w-full flex-1 flex-col md:mx-auto',
            wide ? 'md:max-w-6xl' : 'md:max-w-3xl',
          )}
        >
          {children}
        </div>
      </main>

      {showFab && onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add task"
          className="absolute grid place-items-center rounded-fab text-accent-contrast md:hidden"
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
        className="flex flex-none items-center justify-around border-t border-border md:hidden"
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
