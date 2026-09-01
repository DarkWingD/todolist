import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { ColorPicker } from './ColorPicker';
import { EmojiPicker } from './EmojiPicker';

interface Props {
  list: { id: string; name: string; emojiIcon: string; color?: string | null; type?: 'tasks' | 'checklist' };
  onClose: () => void;
  onDeleted: () => void;
}

export function ListSettingsSheet({ list, onClose, onDeleted }: Props) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(list.name);
  const [emoji, setEmoji] = useState(list.emojiIcon);
  const [color, setColor] = useState<string | null>(list.color ?? null);
  const [type, setType] = useState<'tasks' | 'checklist'>(list.type ?? 'tasks');
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

  const field = 'w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none';
  const fieldStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' };

  return (
    <>
      <div className="fixed inset-0 z-30" style={{ background: 'rgba(0,0,0,.4)' }} onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md overflow-y-auto p-4"
        style={{ background: 'var(--color-bg)', borderRadius: '22px 22px 0 0', maxHeight: '85%', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: 'var(--color-check-border)' }} />
        <h3 className="mb-3 font-head" style={{ fontSize: 18 }}>List settings</h3>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="List name" className={field} style={fieldStyle} />

        <div className="mt-3 flex rounded-lg p-0.5" style={{ background: 'var(--color-chip-bg)' }}>
          {([{ v: 'tasks', label: '✓ Tasks' }, { v: 'checklist', label: '🛒 Shopping' }] as const).map((o) => (
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

        <div className="mt-3">
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </div>

        <div className="mb-1 mt-3 font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          Calendar colour
        </div>
        <ColorPicker value={color} onChange={setColor} />

        <button
          disabled={!name.trim() || update.isPending}
          onClick={() => update.mutate({ listId: list.id, name: name.trim(), emojiIcon: emoji, color, type })}
          className="mt-4 w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-50"
          style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>

        <div className="mt-4">
          {!confirmDel ? (
            <button
              onClick={() => setConfirmDel(true)}
              className="w-full rounded-card py-3 font-semibold"
              style={{ fontSize: 'var(--fs-base)', color: 'var(--color-danger)', background: 'var(--color-danger-soft)' }}
            >
              🗑 Delete list
            </button>
          ) : (
            <div className="rounded-card p-3" style={{ background: 'var(--color-danger-soft)' }}>
              <p className="mb-3 font-semibold" style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-danger)' }}>
                Delete “{list.name}” and everything in it? This can’t be undone.
              </p>
              <div className="flex gap-2">
                <button className="flex-1 rounded-lg py-2 font-semibold" style={{ fontSize: 'var(--fs-sm)', background: 'var(--color-surface)' }} onClick={() => setConfirmDel(false)}>
                  Cancel
                </button>
                <button
                  disabled={del.isPending}
                  className="flex-1 rounded-lg py-2 font-bold text-white disabled:opacity-60"
                  style={{ fontSize: 'var(--fs-sm)', background: 'var(--color-danger)' }}
                  onClick={() => del.mutate({ listId: list.id })}
                >
                  {del.isPending ? 'Deleting…' : 'Delete forever'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
