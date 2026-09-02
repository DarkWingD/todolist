import { useState } from 'react';
import { BackButton } from '../components/BackButton';
import { Checkbox } from '../components/Checkbox';
import { ListSettingsSheet } from '../components/ListSettingsSheet';
import { trpc } from '../lib/trpc';
import type { ListSummary } from '../types';

export function ManageListsScreen({
  onBack,
  onOpenList,
}: {
  onBack: () => void;
  onOpenList: (list: ListSummary) => void;
}) {
  const utils = trpc.useUtils();
  const { data: lists = [] } = trpc.lists.mine.useQuery();
  const { data: systemLists = [] } = trpc.lists.system.useQuery();
  const [settingsFor, setSettingsFor] = useState<ListSummary | null>(null);
  const setHidden = trpc.lists.setHidden.useMutation({
    onSuccess: () => {
      utils.lists.system.invalidate();
      utils.lists.reminders.invalidate();
      utils.lists.shopping.invalidate();
    },
  });

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
        Lists &amp; tags
      </h1>

      <h2
        className="mb-d2 font-bold uppercase text-muted"
        style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
      >
        Lists
      </h2>
      {lists.map((l) => (
        <div
          key={l.id}
          className="mb-d2 flex items-center gap-d3 rounded-card bg-surface p-d3 shadow-card"
        >
          <button
            className="flex min-w-0 flex-1 items-center gap-d3 text-left"
            onClick={() => onOpenList(l)}
          >
            <span
              className="grid h-9 w-9 flex-none place-items-center rounded-emoji text-lg"
              style={{ background: 'var(--color-emoji-bg)' }}
            >
              {l.emojiIcon}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
                {l.name}
              </span>
              <span className="block text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                {l.type === 'checklist' ? 'Shopping' : 'Tasks'} · {l.remaining}{' '}
                {l.type === 'checklist' ? 'left' : 'to do'}
              </span>
            </span>
          </button>
          <button
            aria-label={`Settings for ${l.name}`}
            className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted"
            style={{ background: 'var(--color-chip-bg)', fontSize: 16 }}
            onClick={() => setSettingsFor(l)}
          >
            ⋯
          </button>
        </div>
      ))}
      {lists.length === 0 && (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          No lists yet.
        </p>
      )}

      <h2
        className="mb-d2 mt-d4 font-bold uppercase text-muted"
        style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
      >
        Built-in lists
      </h2>
      {systemLists.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          None yet — these appear as you use reminders, meals and birthdays.
        </p>
      ) : (
        systemLists.map((l) => (
          <div
            key={l.id}
            className="mb-d2 flex items-center gap-d3 rounded-card bg-surface p-d3 shadow-card"
          >
            <span
              className="grid h-9 w-9 flex-none place-items-center rounded-emoji text-lg"
              style={{ background: 'var(--color-emoji-bg)' }}
            >
              {l.emojiIcon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
                {l.name}
              </span>
              <span className="block text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                {l.hidden
                  ? 'Hidden from Lists'
                  : `${l.remaining} ${l.type === 'checklist' ? 'left' : 'to do'}`}
              </span>
            </span>
            <Checkbox
              checked={!l.hidden}
              onChange={(v) => setHidden.mutate({ listId: l.id, hidden: !v })}
              label={`${l.hidden ? 'Show' : 'Hide'} ${l.name} on the Lists screen`}
            />
          </div>
        ))
      )}
      <p className="mb-d2 mt-d2 text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
        Hiding only removes the card. Anything sent to a hidden list still arrives, and its
        reminders still reach Today.
      </p>

      <h2
        className="mb-d2 mt-d4 font-bold uppercase text-muted"
        style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
      >
        Tags
      </h2>
      <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
        Tags aren’t in use yet — coming soon.
      </p>

      {settingsFor && (
        <ListSettingsSheet
          list={settingsFor}
          onClose={() => setSettingsFor(null)}
          onDeleted={() => setSettingsFor(null)}
        />
      )}
    </>
  );
}
