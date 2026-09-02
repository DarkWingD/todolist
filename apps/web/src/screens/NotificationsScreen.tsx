import { useEffect, useState } from 'react';
import { BackButton } from '../components/BackButton';
import { Checkbox } from '@todolist/kitchen-ui';
import { PushSetupHelp } from '../components/PushSetupHelp';
import {
  getSubscription,
  pushBlocker,
  pushSupported,
  subscribePush,
  unsubscribePush,
} from '../lib/push';
import { trpc } from '../lib/trpc';

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data: vapidKey, isLoading: keyLoading } = trpc.push.publicKey.useQuery();
  const { data: prefs } = trpc.prefs.get.useQuery();
  const setNotifications = trpc.prefs.setNotifications.useMutation({
    onSuccess: () => utils.prefs.get.invalidate(),
  });
  const notifyEmail = prefs?.notifyEmail ?? true;
  const notifyPush = prefs?.notifyPush ?? true;
  const subscribe = trpc.push.subscribe.useMutation();
  const unsubscribe = trpc.push.unsubscribe.useMutation();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const supported = pushSupported();
  const blocker = pushBlocker();

  useEffect(() => {
    getSubscription().then((s) => setEnabled(!!s));
  }, []);

  async function enable() {
    if (!vapidKey) return;
    setBusy(true);
    setError('');
    try {
      const sub = await subscribePush(vapidKey);
      if (!sub) {
        setError('Permission was declined.');
      } else {
        await subscribe.mutateAsync(sub);
        setEnabled(true);
      }
    } catch {
      setError('Could not enable notifications on this device.');
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    try {
      const endpoint = await unsubscribePush();
      if (endpoint) await unsubscribe.mutateAsync({ endpoint });
    } catch {
      /* ignore */
    }
    setEnabled(false);
    setBusy(false);
  }

  const card = 'rounded-card bg-surface p-d3 shadow-card';

  return (
    <>
      <BackButton label="You" onClick={onBack} />
      <h1
        className="mb-d3 font-head"
        style={{
          fontSize: 'var(--fs-big)',
          fontWeight: 'var(--title-weight)',
          letterSpacing: 'var(--title-tracking)',
        }}
      >
        Notifications &amp; reminders
      </h1>

      <div
        className={`${card} mb-d2 flex items-start gap-3`}
        style={{ fontSize: 'var(--fs-base)' }}
      >
        <Checkbox
          checked={notifyEmail}
          onChange={(v) => setNotifications.mutate({ notifyEmail: v, notifyPush })}
          label="Email reminders"
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">✉️ Email reminders</div>
          <p className="mt-1 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Reminders are emailed to you when they’re due.
          </p>
        </div>
      </div>

      <div className={`${card} flex items-start gap-3`} style={{ fontSize: 'var(--fs-base)' }}>
        <Checkbox
          checked={notifyPush}
          onChange={(v) => setNotifications.mutate({ notifyEmail, notifyPush: v })}
          label="Push notifications"
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">📱 Push notifications</div>
          <p className="mt-1 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Reminders pop up on devices where you’ve enabled notifications below.
          </p>
        </div>
      </div>

      <h2
        className="mb-d2 mt-d4 font-bold uppercase text-muted"
        style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
      >
        Push on this device
      </h2>

      {blocker !== 'none' && blocker !== 'unsupported' ? (
        <PushSetupHelp blocker={blocker} />
      ) : !supported ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          This browser doesn’t support push notifications.
        </p>
      ) : keyLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Loading…
        </p>
      ) : !vapidKey ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Push isn’t configured on the server yet.
        </p>
      ) : (
        <>
          <button
            disabled={busy || enabled === null}
            onClick={enabled ? disable : enable}
            className="w-full rounded-card py-3 font-bold disabled:opacity-60"
            style={
              enabled
                ? {
                    background: 'var(--color-chip-bg)',
                    color: 'var(--color-text)',
                    fontSize: 'var(--fs-base)',
                  }
                : {
                    background: 'var(--color-accent)',
                    color: 'var(--color-accent-contrast)',
                    fontSize: 'var(--fs-base)',
                  }
            }
          >
            {busy
              ? 'Working…'
              : enabled
                ? 'Turn off on this device'
                : '🔔 Enable notifications on this device'}
          </button>
          {error && (
            <p className="mt-2 text-danger" style={{ fontSize: 'var(--fs-sm)' }}>
              {error}
            </p>
          )}
          <p className="mt-3 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            On iPhone/iPad, add ToDoList to your Home Screen first — iOS only allows notifications
            for installed apps.
          </p>
        </>
      )}
    </>
  );
}
