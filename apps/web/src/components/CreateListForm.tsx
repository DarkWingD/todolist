import { useState } from 'react';
import { ColorPicker, pickUnusedColor } from './ColorPicker';
import { EmojiPicker } from './EmojiPicker';
import { trpc } from '../lib/trpc';
import type { ListType } from '../types';

interface Created {
  id: string;
  name: string;
  emojiIcon: string;
  type: ListType;
}

const TYPE_OPTIONS: { v: ListType; label: string; emoji: string }[] = [
  { v: 'tasks', label: '✓ Tasks', emoji: '📝' },
  { v: 'checklist', label: '🛒 Shopping', emoji: '🛒' },
  { v: 'note', label: '📄 Note', emoji: '📄' },
];
const DEFAULT_EMOJIS = new Set(TYPE_OPTIONS.map((o) => o.emoji));

/**
 * The new-list form, shared by the phone's Lists tab and the desktop index.
 * Picks the least-used calendar colour to start; the picker still lets you
 * override it.
 */
export function CreateListForm({
  usedColors,
  onCreated,
  onCancel,
}: {
  usedColors: (string | null | undefined)[];
  onCreated: (list: Created) => void;
  onCancel: () => void;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📝');
  const [color, setColor] = useState<string | null>(() => pickUnusedColor(usedColors));
  const [type, setType] = useState<ListType>('tasks');
  const [isPrivate, setIsPrivate] = useState(false);
  const { data: household } = trpc.household.get.useQuery();
  const others = (household?.people ?? []).filter((p) => p.kind === 'adult').length - 1;

  const done = (l: Created) => {
    utils.lists.mine.invalidate();
    onCreated(l);
  };
  const create = trpc.lists.create.useMutation({
    onSuccess: (l) => done({ id: l.id, name: l.name, emojiIcon: l.emojiIcon, type: l.type }),
  });

  const pending = create.isPending;
  function submit() {
    if (!name.trim() || pending) return;
    create.mutate({
      name: name.trim(),
      emojiIcon: emoji,
      color: color ?? undefined,
      type,
      private: isPrivate,
    });
  }

  return (
    <div className="rounded-card bg-surface p-4 shadow-card">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="List name"
        aria-label="List name"
        className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none"
        style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
      />
      <div className="mb-3 flex rounded-lg p-0.5" style={{ background: 'var(--color-chip-bg)' }}>
        {TYPE_OPTIONS.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => {
              setType(o.v);
              // Swap the icon along with the type, but only while it is still
              // one of ours — a hand-picked emoji stays.
              if (DEFAULT_EMOJIS.has(emoji)) setEmoji(o.emoji);
            }}
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
      {type === 'note' && (
        <p className="mb-3 text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          A page you just type on. Shared with whoever you invite, like any list.
        </p>
      )}
      <EmojiPicker value={emoji} onChange={setEmoji} />
      <div className="mb-1 mt-3 font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
        Calendar colour
      </div>
      <ColorPicker value={color} onChange={setColor} />
      {others > 0 && (
        <label
          className="mt-3 flex items-center gap-2 text-muted"
          style={{ fontSize: 'var(--fs-sm)' }}
        >
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          Just me — don't share this one with the family
        </label>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          className="text-muted"
          style={{ fontSize: 'var(--fs-sm)' }}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim() || pending}
          className="rounded-lg px-4 py-2 font-bold text-accent-contrast disabled:opacity-50"
          style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
          onClick={submit}
        >
          Create
        </button>
      </div>
    </div>
  );
}
