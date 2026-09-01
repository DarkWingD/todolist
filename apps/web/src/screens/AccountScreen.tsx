import { useState } from 'react';
import { BackButton } from '../components/BackButton';
import { signOut } from '../lib/auth';
import { trpc } from '../lib/trpc';
import type { SessionUser } from '../types';

export function AccountScreen({ me, onBack }: { me: SessionUser; onBack: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportQ = trpc.account.exportMe.useQuery(undefined, { enabled: false });
  const del = trpc.account.deleteMe.useMutation({
    onSuccess: async () => {
      await signOut();
      location.reload();
    },
  });

  async function doExport() {
    setExporting(true);
    const res = await exportQ.refetch();
    setExporting(false);
    if (res.data) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'todolist-export.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <>
      <BackButton label="You" onClick={onBack} />
      <h1
        className="mb-d3 font-head"
        style={{ fontSize: 'var(--fs-big)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}
      >
        Account
      </h1>

      <div className="rounded-card bg-surface p-d3 shadow-card" style={{ fontSize: 'var(--fs-base)' }}>
        <div className="font-semibold">{me.name}</div>
        <div className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>{me.email}</div>
      </div>

      <h2 className="mb-d2 mt-d4 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}>
        Your data
      </h2>
      <button
        onClick={doExport}
        disabled={exporting}
        className="w-full rounded-card bg-surface p-d3 text-left font-semibold shadow-card disabled:opacity-60"
        style={{ fontSize: 'var(--fs-base)' }}
      >
        ⬇︎ &nbsp;{exporting ? 'Preparing…' : 'Export my data (JSON)'}
      </button>
      <p className="mt-2 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
        Downloads everything you’ve created — profile, lists, tasks, events and birthdays.
      </p>

      <h2 className="mb-d2 mt-d4 font-bold uppercase" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em', color: 'var(--color-danger)' }}>
        Danger zone
      </h2>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="w-full rounded-card p-d3 text-left font-semibold shadow-card"
          style={{ fontSize: 'var(--fs-base)', color: 'var(--color-danger)', background: 'var(--color-danger-soft)' }}
        >
          🗑 &nbsp;Delete my account
        </button>
      ) : (
        <div className="rounded-card p-d3" style={{ background: 'var(--color-danger-soft)' }}>
          <p className="mb-3 font-semibold" style={{ fontSize: 'var(--fs-base)', color: 'var(--color-danger)' }}>
            This permanently deletes your account and everything in lists you own. This can’t be undone.
          </p>
          <div className="flex gap-2">
            <button className="flex-1 rounded-lg py-2 font-semibold" style={{ fontSize: 'var(--fs-sm)', background: 'var(--color-surface)' }} onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button
              disabled={del.isPending}
              className="flex-1 rounded-lg py-2 font-bold text-white disabled:opacity-60"
              style={{ fontSize: 'var(--fs-sm)', background: 'var(--color-danger)' }}
              onClick={() => del.mutate()}
            >
              {del.isPending ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
