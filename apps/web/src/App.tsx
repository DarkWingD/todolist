import { useState } from 'react';
import { AppShell, type TabId } from './components/AppShell';
import { TodayScreen } from './screens/TodayScreen';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="grid flex-1 place-items-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
      {title} — coming next
    </div>
  );
}

export function App() {
  const [tab, setTab] = useState<TabId>('today');

  return (
    <AppShell active={tab} onNavigate={setTab} showFab={tab === 'today' || tab === 'lists'} onAdd={() => {}}>
      {tab === 'today' && <TodayScreen />}
      {tab === 'lists' && <Placeholder title="Lists" />}
      {tab === 'search' && <Placeholder title="Search" />}
      {tab === 'you' && <Placeholder title="You / Settings" />}
    </AppShell>
  );
}
