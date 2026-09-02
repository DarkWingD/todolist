import { useState } from 'react';
import { AddToHomeScreen } from '../components/AddToHomeScreen';
import { pushBlocker, subscribePush } from '../lib/push';
import { trpc } from '../lib/trpc';

/**
 * Shown once, after a first sign-in.
 *
 * Two jobs: say plainly where things live and who can see them, and get
 * notifications turned on while there's a reason to explain them. Asking for
 * permission cold, mid-task, is how people end up denying it permanently —
 * browsers only let you ask once.
 */
function Point({ icon, title, children }: { icon: string; title: string; children: string }) {
  return (
    <div className="flex gap-d3">
      <span className="flex-none" style={{ fontSize: 22, lineHeight: 1.2 }} aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="block font-bold" style={{ fontSize: 'var(--fs-base)' }}>
          {title}
        </span>
        <span className="block text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          {children}
        </span>
      </span>
    </div>
  );
}

export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const { data: vapidKey } = trpc.push.publicKey.useQuery();
  const subscribe = trpc.push.subscribe.useMutation();
  const [state, setState] = useState<'idle' | 'asking' | 'on' | 'denied'>('idle');

  // Three outcomes, not two. Push unconfigured on the server, or a browser that
  // genuinely can't: say nothing, since there is nothing to do about it. But an
  // iPhone or iPad in a Safari tab *can* do this once the app is on the Home
  // Screen, so that case gets instructions rather than silence.
  const blocker = pushBlocker();
  const configured = Boolean(vapidKey);
  const canAsk = blocker === 'none' && configured;
  const needsInstall =
    configured && (blocker === 'ios-needs-install' || blocker === 'ios-needs-safari');

  async function enable() {
    if (!vapidKey) return;
    setState('asking');
    try {
      const sub = await subscribePush(vapidKey);
      if (!sub) {
        setState('denied');
        return;
      }
      await subscribe.mutateAsync(sub);
      setState('on');
    } catch {
      setState('denied');
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-between px-d4 py-d5">
      <div className="flex flex-1 flex-col justify-center gap-d5">
        <div>
          <h1
            className="font-head"
            style={{
              fontSize: 'var(--fs-big)',
              fontWeight: 'var(--title-weight)',
              letterSpacing: 'var(--title-tracking)',
            }}
          >
            Welcome to ToDoList
          </h1>
          <p className="mt-1 text-muted" style={{ fontSize: 'var(--fs-base)' }}>
            Lists, reminders and the week's meals, shared with whoever you invite.
          </p>
        </div>

        <div className="flex flex-col gap-d4">
          <Point icon="🏡" title="Self-hosted, not a product">
            This runs on a machine at home, not a company's servers. Nothing is sold, mined or
            handed to anyone.
          </Point>
          <Point icon="👥" title="Shared only where you say">
            A list or meal plan is private until you invite someone to it. People you invite see
            that one thing, not everything.
          </Point>
          <Point icon="🍽" title="Meals feed the shopping list">
            Plan the week's dinners, add ingredients once, and send the whole week to your shopping
            list grouped by meal.
          </Point>
        </div>

        {canAsk && (
          <div className="flex flex-col gap-d2 rounded-card bg-surface p-d3 shadow-card">
            <span className="font-bold" style={{ fontSize: 'var(--fs-base)' }}>
              Reminders that actually reach you
            </span>
            <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Without notifications, a reminder only appears next time you open the app. You can
              change this later under You → Notifications.
            </span>
            {state === 'on' ? (
              <span className="font-semibold text-accent" style={{ fontSize: 'var(--fs-sm)' }}>
                ✓ Notifications are on.
              </span>
            ) : (
              <>
                <button
                  type="button"
                  disabled={state === 'asking'}
                  onClick={() => void enable()}
                  className="rounded-full py-2.5 font-bold text-accent-contrast disabled:opacity-50"
                  style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
                >
                  {state === 'asking' ? 'Waiting for permission…' : 'Enable notifications'}
                </button>
                {state === 'denied' && (
                  <span className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    Not enabled. Browsers only ask once, so if you dismissed it you'll need to allow
                    notifications for this site in your browser settings.
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {needsInstall && <AddToHomeScreen needsSafari={blocker === 'ios-needs-safari'} />}
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-d4 w-full rounded-full border border-border py-3 font-bold"
        style={{ fontSize: 'var(--fs-base)' }}
      >
        {state === 'on' ? 'Get started' : 'Skip for now'}
      </button>
    </div>
  );
}
