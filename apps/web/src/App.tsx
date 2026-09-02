import { useEffect, useState } from 'react';
import { AppShell, type TabId } from './components/AppShell';
import { QuickAddSheet } from './components/QuickAddSheet';
import { useSession } from './lib/auth';
import { trpc } from './lib/trpc';
import { AccountScreen } from './screens/AccountScreen';
import { AppearanceScreen } from './screens/AppearanceScreen';
import { CalScreen } from './screens/CalScreen';
import { InviteAcceptScreen } from './screens/InviteAcceptScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { ListDetailScreen } from './screens/ListDetailScreen';
import { ListsScreen } from './screens/ListsScreen';
import { ManageListsScreen } from './screens/ManageListsScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SignInScreen } from './screens/SignInScreen';
import { TaskDetailScreen } from './screens/TaskDetailScreen';
import { TodayScreen } from './screens/TodayScreen';
import { YouScreen } from './screens/YouScreen';
import { useTheme } from './theme/ThemeProvider';
import type { SessionUser } from './types';

interface MinList {
  id: string;
  name: string;
  emojiIcon: string;
  type?: 'tasks' | 'checklist';
  systemKey?: string | null;
}

function Splash() {
  return (
    <div className="grid h-[100dvh] place-items-center bg-bg text-muted" style={{ fontSize: 'var(--fs-base)' }}>
      <div className="animate-pulse text-3xl">✓</div>
    </div>
  );
}

function toSessionUser(u: Record<string, unknown>): SessionUser {
  return {
    id: String(u.id),
    email: String(u.email ?? ''),
    name:
      typeof u.name === 'string' && u.name.trim()
        ? u.name.trim()
        : String(u.email ?? 'you').split('@')[0] || 'you',
    avatarEmoji: (u.avatarEmoji as string) ?? '🙂',
    avatarColor: (u.avatarColor as string) ?? '#8B5CF6',
    image: typeof u.image === 'string' ? u.image : null,
  };
}

export function App() {
  const { data: session, isPending } = useSession();
  const inviteToken = window.location.pathname.match(/^\/invite\/(.+)$/)?.[1];

  if (isPending) return <Splash />;
  if (!session) return <SignInScreen />;
  if (inviteToken) return <InviteAcceptScreen token={inviteToken} />;
  return <AuthedApp me={toSessionUser(session.user as Record<string, unknown>)} />;
}

type View =
  | 'main'
  | 'listDetail'
  | 'appearance'
  | 'taskDetail'
  | 'account'
  | 'privacy'
  | 'manageLists'
  | 'notifications';

function AuthedApp({ me }: { me: SessionUser }) {
  const { theme, setPrefs } = useTheme();
  const { data: serverPrefs } = trpc.prefs.get.useQuery();
  const { data: lists = [] } = trpc.lists.mine.useQuery();

  const [tab, setTab] = useState<TabId>('today');
  const [view, setView] = useState<View>('main');
  const [selectedList, setSelectedList] = useState<MinList | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskReturn, setTaskReturn] = useState<{ view: 'main' | 'listDetail'; tab: TabId }>({
    view: 'main',
    tab: 'today',
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createListSignal, setCreateListSignal] = useState(0);
  const [calCreateSignal, setCalCreateSignal] = useState(0);
  const [focusAddSignal, setFocusAddSignal] = useState(0);

  // The floating + adds whatever the current screen is about: a list on Lists,
  // an event/birthday on Cal, a reminder in the Reminders list, otherwise a task.
  function onAdd() {
    if (view === 'main' && tab === 'lists') setCreateListSignal((n) => n + 1);
    else if (view === 'main' && tab === 'cal') setCalCreateSignal((n) => n + 1);
    else if (view === 'listDetail' && selectedList?.systemKey === 'reminders')
      setFocusAddSignal((n) => n + 1);
    else setSheetOpen(true);
  }

  useEffect(() => {
    if (serverPrefs) {
      setPrefs({
        theme: serverPrefs.theme,
        appearance: serverPrefs.appearance,
        density: serverPrefs.density,
        textScale: serverPrefs.textScale,
      });
    }
  }, [serverPrefs, setPrefs]);

  function navigate(t: TabId) {
    setTab(t);
    setView('main');
    setSelectedList(null);
  }
  function openList(l: MinList) {
    setSelectedList(l);
    setView('listDetail');
  }
  function openTask(id: string) {
    setSelectedTaskId(id);
    setTaskReturn(view === 'listDetail' ? { view: 'listDetail', tab: 'lists' } : { view: 'main', tab });
    setView('taskDetail');
  }
  function closeTask() {
    if (taskReturn.view === 'listDetail' && selectedList) setView('listDetail');
    else {
      setView('main');
      setTab(taskReturn.tab);
    }
  }

  const activeTab: TabId =
    view === 'appearance' ||
    view === 'account' ||
    view === 'privacy' ||
    view === 'manageLists' ||
    view === 'notifications'
      ? 'you'
      : view === 'listDetail'
        ? 'lists'
        : view === 'taskDetail'
          ? taskReturn.view === 'listDetail'
            ? 'lists'
            : taskReturn.tab
          : tab;
  const showFab =
    (view === 'main' && (tab === 'today' || tab === 'lists' || tab === 'cal')) || view === 'listDetail';

  let content;
  if (view === 'taskDetail' && selectedTaskId) {
    content = <TaskDetailScreen taskId={selectedTaskId} onBack={closeTask} />;
  } else if (view === 'listDetail' && selectedList) {
    content = (
      <ListDetailScreen
        list={selectedList}
        onBack={() => navigate('lists')}
        onOpenTask={openTask}
        focusAddSignal={focusAddSignal}
      />
    );
  } else if (view === 'appearance') {
    content = <AppearanceScreen onBack={() => setView('main')} />;
  } else if (view === 'account') {
    content = <AccountScreen me={me} onBack={() => setView('main')} />;
  } else if (view === 'privacy') {
    content = <PrivacyScreen onBack={() => setView('main')} />;
  } else if (view === 'manageLists') {
    content = <ManageListsScreen onBack={() => setView('main')} onOpenList={openList} />;
  } else if (view === 'notifications') {
    content = <NotificationsScreen onBack={() => setView('main')} />;
  } else if (tab === 'today') {
    content = <TodayScreen me={me} onOpenTask={openTask} />;
  } else if (tab === 'lists') {
    content = <ListsScreen onOpenList={openList} createSignal={createListSignal} />;
  } else if (tab === 'cal') {
    content = <CalScreen onOpenTask={openTask} createSignal={calCreateSignal} />;
  } else if (tab === 'search') {
    content = <SearchScreen onOpenList={openList} />;
  } else {
    content = (
      <YouScreen
        me={me}
        themeName={theme}
        onOpenAppearance={() => setView('appearance')}
        onOpenAccount={() => setView('account')}
        onOpenPrivacy={() => setView('privacy')}
        onOpenManageLists={() => setView('manageLists')}
        onOpenNotifications={() => setView('notifications')}
      />
    );
  }

  return (
    <AppShell
      active={activeTab}
      onNavigate={navigate}
      showFab={showFab}
      onAdd={onAdd}
      overlay={
        <QuickAddSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          lists={lists}
          defaultListId={selectedList?.id}
        />
      }
    >
      {content}
    </AppShell>
  );
}
