import { Sheet } from '@todolist/kitchen-ui';
import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { ColorPicker } from './ColorPicker';
import { EmojiPicker } from './EmojiPicker';

interface Props {
  list: {
    id: string;
    name: string;
    emojiIcon: string;
    color?: string | null;
    type?: 'tasks' | 'checklist' | 'child' | 'note';
    /** Set on built-in lists, which can be hidden but never deleted. */
    systemKey?: string | null;
    hidden?: boolean;
  };
  onClose: () => void;
  onDeleted: () => void;
}

export function ListSettingsSheet({ list, onClose, onDeleted }: Props) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(list.name);
  const [emoji, setEmoji] = useState(list.emojiIcon);
  const [color, setColor] = useState<string | null>(list.color ?? null);
  // A child list has no tasks/shopping choice to make, and offering one would
  // let a stray tap convert it into an ordinary list and strand its week,
  // terms and profile behind a screen you could no longer reach. A note is
  // locked for the same reason: its text has no home in a task list.
  const isChild = list.type === 'child' || list.type === 'note';
  const [type, setType] = useState<'tasks' | 'checklist'>(
    list.type === 'checklist' ? 'checklist' : 'tasks',
  );
  const [confirmDel, setConfirmDel] = useState(false);

  const update = trpc.lists.update.useMutation({
    onSuccess: () => {
      utils.lists.mine.invalidate();
      onClose();
    },
  });
  const del = trpc.lists.softDelete.useMutation({
    onSuccess: () => {
      utils.lists.mine.invalidate();
      utils.tasks.agenda.invalidate();
      onDeleted();
    },
  });
  const isSystem = Boolean(list.systemKey);
  const setHidden = trpc.lists.setHidden.useMutation({
    onSuccess: () => {
      utils.lists.system.invalidate();
      utils.lists.reminders.invalidate();
      utils.lists.shopping.invalidate();
      onClose();
    },
  });

  const field = 'w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none';
  const fieldStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' };

  return (
    <Sheet open onClose={onClose} title="List settings" maxHeight="85%">
      <h3 className="mb-3 font-head" style={{ fontSize: 'var(--fs-lg)' }}>
        List settings
      </h3>

      <input
        data-autofocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="List name"
        className={field}
        style={fieldStyle}
      />

      {!isChild && (
        <div className="mt-3 flex rounded-lg p-0.5" style={{ background: 'var(--color-chip-bg)' }}>
          {(
            [
              { v: 'tasks', label: '✓ Tasks' },
              { v: 'checklist', label: '🛒 Shopping' },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              onClick={() => setType(o.v)}
              className="flex-1 rounded-md py-1.5 font-semibold"
              style={{
                fontSize: 'var(--fs-sm)',
                background: type === o.v ? 'var(--color-surface)' : 'transparent',
                color: type === o.v ? 'var(--color-text)' : 'var(--color-muted)',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3">
        <EmojiPicker value={emoji} onChange={setEmoji} />
      </div>

      <div className="mb-1 mt-3 font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
        Calendar colour
      </div>
      <ColorPicker value={color} onChange={setColor} />

      <button
        disabled={!name.trim() || update.isPending}
        onClick={() =>
          update.mutate({
            listId: list.id,
            name: name.trim(),
            emojiIcon: emoji,
            color,
            ...(isChild ? {} : { type }),
          })
        }
        className="mt-4 w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-50"
        style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
      >
        {update.isPending ? 'Saving…' : 'Save'}
      </button>

      <div className="mt-4">
        {isSystem ? (
          // Built-in lists are part of the app, so the destructive action is
          // replaced by tucking it out of the way.
          <>
            <button
              disabled={setHidden.isPending}
              onClick={() => setHidden.mutate({ listId: list.id, hidden: !list.hidden })}
              className="w-full rounded-card py-3 font-semibold disabled:opacity-50"
              style={{ fontSize: 'var(--fs-base)', background: 'var(--color-chip-bg)' }}
            >
              {list.hidden ? 'Show this list' : 'Hide this list'}
            </button>
            <p className="mt-2 text-center text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
              Built-in lists can be hidden, but not deleted. Hiding one only removes the card —
              anything sent to it still arrives.
            </p>
          </>
        ) : !confirmDel ? (
          <button
            onClick={() => setConfirmDel(true)}
            className="w-full rounded-card py-3 font-semibold"
            style={{
              fontSize: 'var(--fs-base)',
              color: 'var(--color-danger)',
              background: 'var(--color-danger-soft)',
            }}
          >
            🗑 Delete list
          </button>
        ) : (
          <div className="rounded-card p-3" style={{ background: 'var(--color-danger-soft)' }}>
            <p
              className="mb-3 font-semibold"
              style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-danger)' }}
            >
              Delete “{list.name}” and everything in it? This can’t be undone.
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg py-2 font-semibold"
                style={{ fontSize: 'var(--fs-sm)', background: 'var(--color-surface)' }}
                onClick={() => setConfirmDel(false)}
              >
                Cancel
              </button>
              <button
                disabled={del.isPending}
                className="flex-1 rounded-lg py-2 font-bold disabled:opacity-60"
                style={{
                  fontSize: 'var(--fs-sm)',
                  background: 'var(--color-danger)',
                  color: 'var(--color-danger-contrast)',
                }}
                onClick={() => del.mutate({ listId: list.id })}
              >
                {del.isPending ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
