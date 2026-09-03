import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MealWeek, ShoppingList } from '@todolist/kitchen-ui';
import { useEffect, useState } from 'react';
import { Settings } from './screens/Settings';
import { shareShoppingList } from './shareList';
import { Welcome } from './screens/Welcome';
import { flush, initStore, mealAdapter, shoppingAdapter } from './store/memory';
import { hasSeenWelcome, markWelcomeSeen, usePrefs } from './theme';

type Tab = 'meals' | 'shopping' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'meals', label: 'Meals' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'settings', label: 'Settings' },
];

/** Fork and knife, and a basket — drawn so they tint with the active accent. */
function Icon({ tab }: { tab: Tab }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tab === 'meals' && (
        <>
          <path d="M7 3.5v7a2.5 2.5 0 0 0 5 0v-7" />
          <path d="M9.5 3.5v17" />
          <path d="M17 3.5c1.5 1.5 1.8 4 1.4 6.2-.2 1-.9 1.6-1.9 1.6H16v9.2" />
        </>
      )}
      {tab === 'shopping' && (
        <>
          <path d="M3.5 8.5h17l-1.6 9a2 2 0 0 1-2 1.6H7.1a2 2 0 0 1-2-1.6z" />
          <path d="M8.5 8.5 11 3.5M15.5 8.5 13 3.5" />
        </>
      )}
      {tab === 'settings' && (
        <>
          <circle cx="12" cy="12" r="3.25" />
          <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 8.9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 8.88 4.6 1.6 1.6 0 0 0 9.88 3.13V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
        </>
      )}
    </svg>
  );
}

export function App() {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 0 } } }));
  const [tab, setTab] = useState<Tab>('meals');
  const { prefs, setPrefs } = usePrefs();
  const [ready, setReady] = useState(false);
  const [welcomed, setWelcomed] = useState(hasSeenWelcome);

  // Nothing renders until the document is loaded, so the screens never briefly
  // show the seed and then swap it for real data.
  useEffect(() => {
    void initStore().then(() => setReady(true));
  }, []);

  // A debounced write would be lost if the app is backgrounded or closed mid-
  // timer, which on a phone is most of the time.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  if (!ready) {
    return <div className="grid h-[100dvh] place-items-center bg-bg" aria-busy="true" />;
  }

  if (!welcomed) {
    return (
      <Welcome
        onDone={() => {
          markWelcomeSeen();
          setWelcomed(true);
        }}
      />
    );
  }

  return (
    <QueryClientProvider client={qc}>
      <div className="relative mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden bg-bg">
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-d4 pt-3">
          {tab === 'meals' && <MealWeek adapter={mealAdapter} />}
          {tab === 'shopping' && (
            <ShoppingList
              adapter={shoppingAdapter}
              onShare={(items) => void shareShoppingList(items)}
            />
          )}
          {tab === 'settings' && <Settings prefs={prefs} setPrefs={setPrefs} />}
        </main>

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
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={
                tab === t.id
                  ? 'flex flex-col items-center gap-[3px] font-bold text-accent'
                  : 'flex flex-col items-center gap-[3px] text-muted'
              }
              style={{ fontSize: 11.5 }}
            >
              <Icon tab={t.id} />
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </QueryClientProvider>
  );
}
