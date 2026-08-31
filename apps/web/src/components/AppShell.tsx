import clsx from 'clsx';
import type { ReactNode } from 'react';

export type TabId = 'today' | 'lists' | 'search' | 'you';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'today', icon: '◎', label: 'Today' },
  { id: 'lists', icon: '☰', label: 'Lists' },
  { id: 'search', icon: '⌕', label: 'Search' },
  { id: 'you', icon: '◔', label: 'You' },
];

interface AppShellProps {
  active: TabId;
  onNavigate: (tab: TabId) => void;
  onAdd?: () => void;
  showFab?: boolean;
  children: ReactNode;
}

export function AppShell({ active, onNavigate, onAdd, showFab, children }: AppShellProps) {
  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-bg">
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-d4 pt-8">{children}</main>

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
            style={{ fontSize: 10 }}
          >
            <span style={{ fontSize: 19, lineHeight: 1 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
