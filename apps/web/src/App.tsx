import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell, type TabId } from './components/AppShell';
import { BackButton } from './components/BackButton';
import { CreateListForm } from './components/CreateListForm';
import { ListsIndex } from './components/ListsIndex';
import { QuickAddSheet } from './components/QuickAddSheet';
import { useSession } from './lib/auth';
import { trpc } from './lib/trpc';
import { DESKTOP_QUERY, useMediaQuery } from './lib/useMediaQuery';
import { AccountScreen } from './screens/AccountScreen';
import { AppearanceScreen } from './screens/AppearanceScreen';
import { CalScreen } from './screens/CalScreen';
import { ChildScreen } from './screens/ChildScreen';
import { FamilyScreen } from './screens/FamilyScreen';
import { InviteAcceptScreen } from './screens/InviteAcceptScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { ListDetailScreen } from './screens/ListDetailScreen';
import { ListsScreen } from './screens/ListsScreen';
import { ManageListsScreen } from './screens/ManageListsScreen';
import { MealsScreen } from './screens/MealsScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { SignInScreen } from './screens/SignInScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { TaskDetailScreen } from './screens/TaskDetailScreen';
import { TodayScreen } from './screens/TodayScreen';
import { YouScreen } from './screens/YouScreen';
import { useTheme } from './theme/ThemeProvider';
import type { ListType, SessionUser } from './types';

interface MinList {
  id: string;
  name: string;
  emojiIcon: string;
  type?: ListType;
  systemKey?: string | null;
}

function Splash() {
  return (
    <div
      className="grid h-[100dvh] place-items-center bg-bg text-muted"
      style={{ fontSize: 'var(--fs-base)' }}
    >
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

// Per browser rather than per account: it exists to ask for notification
// permission, which is a property of this browser, not of you.
const WELCOME_KEY = 'todolist.seenWelcome';
// Which list the desktop workspace reopens. Per browser: it is where *this*
// screen was, not a fact about the account.
const LAST_LIST_KEY = 'todolist.lastListId';

function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    // Storage blocked — better to show it again than to hide it wrongly.
    return false;
  }
}
function readLastListId(): string | null {
  try {
    return localStorage.getItem(LAST_LIST_KEY);
  } catch {
    return null;
  }
}
function writeLastListId(id: string) {
  try {
    localStorage.setItem(LAST_LIST_KEY, id);
  } catch {
    // Then the workspace opens on the first list next time. No harm.
  }
}

function isTyping(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null;
  if (!t) return false;
  return (
    t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.tagName === 'SELECT' ||
    t.isContentEditable === true
  );
}

export function App() {
  const { data: session, isPending } = useSession();
  const inviteToken = window.location.pathname.match(/^\/invite\/(.+)$/)?.[1];
  const [welcomed, setWelcomed] = useState(hasSeenWelcome);

  if (isPending) return <Splash />;
  if (!session) return <SignInScreen />;
  // An invite link is someone being pulled into a specific list; the tour can
  // wait until they've accepted.
  if (inviteToken) return <InviteAcceptScreen token={inviteToken} />;
  if (!welcomed) {
    return (
      <WelcomeScreen
        onDone={() => {
          try {
            localStorage.setItem(WELCOME_KEY, '1');
          } catch {
            // It will simply appear again next time.
          }
          setWelcomed(true);
        }}
      />
    );
  }
  return <AuthedApp me={toSessionUser(session.user as Record<string, unknown>)} />;
}

type View =
  | 'main'
  | 'listDetail'
  | 'you'
  | 'appearance'
  | 'taskDetail'
  | 'account'
  | 'privacy'
  | 'manageLists'
  | 'notifications'
  | 'child';

// Screens about this account, all reached through You.
const YOU_VIEWS: ReadonlySet<View> = new Set<View>([
  'you',
  'appearance',
  'account',
  'privacy',
  'manageLists',
  'notifications',
]);

function AuthedApp({ me }: { me: SessionUser }) {
  const { theme, setPrefs } = useTheme();
  const { data: serverPrefs } = trpc.prefs.get.useQuery();
  const showMeals = serverPrefs?.showMeals ?? true;
  const showKids = serverPrefs?.showKids ?? true;
  const weekStartsOn = (serverPrefs?.weekStartsOn ?? 1) as 0 | 1;
  const { data: lists = [] } = trpc.lists.mine.useQuery();
  const { data: remindersList } = trpc.lists.reminders.useQuery();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

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
  const [childAddSignal, setChildAddSignal] = useState(0);
  const [familyAddSignal, setFamilyAddSignal] = useState(0);
  // Desktop only: the New list form takes the pane while this is set.
  const [creatingList, setCreatingList] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // A child opens from Family or Today and returns to whichever it came from.
  const activeTab: TabId = YOU_VIEWS.has(view)
    ? 'family'
    : view === 'listDetail'
      ? 'lists'
      : view === 'taskDetail'
        ? taskReturn.view === 'listDetail'
          ? 'lists'
          : taskReturn.tab
        : tab;

  // On a wide window, Lists is one screen: the index down the left and the open
  // list beside it. Everything under the Lists tab renders inside it.
  const workspace = isDesktop && activeTab === 'lists' && view !== 'child';
  const inspectorOpen = workspace && view === 'taskDetail' && selectedTaskId !== null;

  function navigate(t: TabId) {
    setTab(t);
    setView('main');
    // The workspace keeps its place; the phone's Lists tab is the index itself.
    if (!(isDesktop && t === 'lists')) setSelectedList(null);
    setCreatingList(false);
  }
  function openChild(id: string) {
    setSelectedList({ id, name: '', emojiIcon: '', type: 'child' });
    setView('child');
  }
  const openList = useCallback((l: MinList) => {
    setSelectedList(l);
    setView(l.type === 'child' ? 'child' : 'listDetail');
    setCreatingList(false);
    if (l.type !== 'child') writeLastListId(l.id);
  }, []);
  function openTask(id: string) {
    setSelectedTaskId(id);
    setTaskReturn(
      view === 'listDetail' ? { view: 'listDetail', tab: 'lists' } : { view: 'main', tab },
    );
    setView('taskDetail');
  }
  function closeTask() {
    if (taskReturn.view === 'listDetail' && selectedList) setView('listDetail');
    else {
      setView('main');
      setTab(taskReturn.tab);
    }
  }

  // The workspace never sits empty: it reopens the list this browser had open,
  // or failing that the first of your own lists, then Reminders.
  useEffect(() => {
    if (!workspace || selectedList || creatingList) return;
    const remembered = readLastListId();
    const own = lists.filter((l) => l.type !== 'child');
    const pick =
      own.find((l) => l.id === remembered) ??
      (remindersList && remindersList.id === remembered ? remindersList : undefined) ??
      own[0] ??
      remindersList;
    if (pick) openList(pick);
  }, [workspace, selectedList, creatingList, lists, remindersList, openList]);

  // Desktop shortcuts. "/" finds, "n" adds to the open list, Esc closes the
  // task panel. None fire while you are typing somewhere.
  useEffect(() => {
    if (!workspace) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (inspectorOpen) closeTask();
        else if (creatingList) setCreatingList(false);
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        onAdd();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // The + adds whatever the current screen is about: a list on Lists, an
  // event/birthday on Cal, a child on Family, a reminder in the Reminders list,
  // text in a note, otherwise a task. Meals has no +: you plan a dinner by
  // tapping the day you want it on. In the workspace it adds to the open list;
  // New list has its own button at the foot of the index.
  function onAdd() {
    if (workspace) {
      if (!selectedList) setCreatingList(true);
      else setFocusAddSignal((n) => n + 1);
      return;
    }
    if (view === 'child') setChildAddSignal((n) => n + 1);
    else if (view === 'main' && tab === 'lists') setCreateListSignal((n) => n + 1);
    else if (view === 'main' && tab === 'cal') setCalCreateSignal((n) => n + 1);
    else if (view === 'main' && tab === 'family') setFamilyAddSignal((n) => n + 1);
    else if (
      view === 'listDetail' &&
      (selectedList?.systemKey === 'reminders' || selectedList?.type === 'note')
    )
      setFocusAddSignal((n) => n + 1);
    else setSheetOpen(true);
  }

  const showFab =
    !workspace &&
    ((view === 'main' &&
      (tab === 'today' || tab === 'lists' || tab === 'cal' || tab === 'family')) ||
      view === 'listDetail' ||
      view === 'child');

  let content;
  if (workspace) {
    let pane;
    if (creatingList) {
      pane = (
        <div className="max-w-lg">
          <h2
            className="mb-d3 font-head"
            style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--title-weight)' }}
          >
            New list
          </h2>
          <CreateListForm
            usedColors={lists.map((l) => l.color)}
            onCreated={(l) => openList(l)}
            onCancel={() => setCreatingList(false)}
          />
        </div>
      );
    } else if (selectedList) {
      pane = (
        <ListDetailScreen
          key={selectedList.id}
          list={selectedList}
          meId={me.id}
          onBack={() => setSelectedList(null)}
          onOpenTask={openTask}
          focusAddSignal={focusAddSignal}
          embedded
        />
      );
    } else {
      pane = (
        <p className="mt-10 text-center text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Pick a list, or make one.
        </p>
      );
    }
    content = (
      <div className="flex h-full min-w-0 flex-1">
        <ListsIndex
          selectedId={selectedList?.id ?? null}
          onSelect={openList}
          onOpenTask={openTask}
          onNewList={() => setCreatingList(true)}
          searchRef={searchRef}
        />
        <section className="relative flex min-h-0 min-w-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto px-d5 pb-10 pt-4">
            <div className="w-full max-w-[760px]">{pane}</div>
          </div>
          {inspectorOpen && selectedTaskId && (
            <aside
              key={selectedTaskId}
              aria-label="Task details"
              className="slide-in-right absolute inset-y-0 right-0 z-20 w-[380px] overflow-y-auto border-l border-border bg-bg px-d4 pb-10 pt-4"
              style={{ boxShadow: '-18px 0 40px -24px rgba(0,0,0,.35)' }}
            >
              <TaskDetailScreen taskId={selectedTaskId} onBack={closeTask} embedded />
            </aside>
          )}
        </section>
      </div>
    );
  } else if (view === 'taskDetail' && selectedTaskId) {
    content = <TaskDetailScreen taskId={selectedTaskId} onBack={closeTask} />;
  } else if (view === 'child' && selectedList) {
    content = (
      <ChildScreen
        listId={selectedList.id}
        onBack={() => setView('main')}
        addSignal={childAddSignal}
      />
    );
  } else if (view === 'listDetail' && selectedList) {
    content = (
      <ListDetailScreen
        list={selectedList}
        meId={me.id}
        onBack={() => navigate('lists')}
        onOpenTask={openTask}
        focusAddSignal={focusAddSignal}
      />
    );
  } else if (view === 'you') {
    content = (
      <>
        <BackButton label="Family" onClick={() => setView('main')} />
        <YouScreen
          me={me}
          themeName={theme}
          onOpenAppearance={() => setView('appearance')}
          onOpenAccount={() => setView('account')}
          onOpenPrivacy={() => setView('privacy')}
          onOpenManageLists={() => setView('manageLists')}
          onOpenNotifications={() => setView('notifications')}
        />
      </>
    );
  } else if (view === 'appearance') {
    content = <AppearanceScreen onBack={() => setView('you')} />;
  } else if (view === 'account') {
    content = <AccountScreen me={me} onBack={() => setView('you')} />;
  } else if (view === 'privacy') {
    content = <PrivacyScreen onBack={() => setView('you')} />;
  } else if (view === 'manageLists') {
    content = <ManageListsScreen onBack={() => setView('you')} onOpenList={openList} />;
  } else if (view === 'notifications') {
    content = <NotificationsScreen onBack={() => setView('you')} />;
  } else if (tab === 'today') {
    content = (
      <TodayScreen
        me={me}
        onOpenTask={openTask}
        onOpenYou={() => setView('you')}
        showKids={showKids}
        onOpenChild={openChild}
      />
    );
  } else if (tab === 'lists') {
    content = <ListsScreen onOpenList={openList} createSignal={createListSignal} />;
  } else if (tab === 'cal') {
    content = (
      <CalScreen onOpenTask={openTask} createSignal={calCreateSignal} weekStartsOn={weekStartsOn} />
    );
  } else if (tab === 'meals') {
    content = <MealsScreen weekStartsOn={weekStartsOn} />;
  } else {
    content = (
      <FamilyScreen
        me={me}
        onOpenYou={() => setView('you')}
        onOpenChild={openChild}
        addSignal={familyAddSignal}
      />
    );
  }

  return (
    <AppShell
      active={activeTab}
      onNavigate={navigate}
      showFab={showFab}
      onAdd={onAdd}
      wide={view === 'main' && (tab === 'meals' || tab === 'cal' || tab === 'lists')}
      fill={workspace}
      showMeals={showMeals}
      overlay={
        <QuickAddSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          // A note holds text, not tasks, so it is not somewhere a task can go.
          lists={lists.filter((l) => l.type !== 'note')}
          defaultListId={selectedList?.type === 'note' ? undefined : selectedList?.id}
        />
      }
    >
      {content}
    </AppShell>
  );
}
