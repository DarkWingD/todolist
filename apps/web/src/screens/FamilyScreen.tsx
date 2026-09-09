import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { ColorPicker, pickUnusedColor } from '../components/ColorPicker';
import { EmojiPicker } from '../components/EmojiPicker';
import { trpc } from '../lib/trpc';
import type { SessionUser } from '../types';

type Person = {
  id: string;
  kind: 'adult' | 'child';
  name: string;
  avatarEmoji: string;
  avatarColor: string;
  image: string | null;
  userId: string | null;
  childListId: string | null;
  email: string | null;
};

const field = 'w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none';
const fieldStyle = { fontSize: 'var(--fs-base)', color: 'var(--color-text)' };
const sectionH = 'mb-d2 mt-d4 font-bold uppercase text-muted';
const sectionStyle = { fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' };

/**
 * The family: who is in it, and the door for letting someone else in.
 *
 * Adults are accounts; kids are people without one. Both can be given tasks
 * and events. Settings for *you* live behind the gear, since they are about
 * this account rather than the household.
 */
export function FamilyScreen({
  me,
  onOpenYou,
  onOpenChild,
  onOpenActivity,
  addSignal,
}: {
  me: SessionUser;
  onOpenYou: () => void;
  onOpenChild: (listId: string) => void;
  onOpenActivity: () => void;
  addSignal?: number;
}) {
  const utils = trpc.useUtils();
  const { data: hh, isLoading } = trpc.household.get.useQuery();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState<Person | null>(null);

  const refresh = () => {
    utils.household.get.invalidate();
    utils.calendar.people.invalidate();
    utils.children.mine.invalidate();
    utils.lists.mine.invalidate();
  };
  const rename = trpc.household.rename.useMutation({
    onSuccess: () => {
      refresh();
      setRenaming(false);
    },
  });
  const invite = trpc.household.invite.useMutation({
    onSuccess: () => {
      refresh();
      setInviting(false);
      setEmail('');
    },
  });

  // The floating + on this tab adds a child.
  const lastAdd = useRef(addSignal);
  useEffect(() => {
    if (addSignal !== lastAdd.current) {
      lastAdd.current = addSignal;
      setAdding(true);
    }
  }, [addSignal]);

  const people: Person[] = hh?.people ?? [];
  const adults = people.filter((p) => p.kind === 'adult');
  const kids = people.filter((p) => p.kind === 'child');

  const personRow = (p: Person) => {
    const isMe = p.userId === me.id;
    const sub =
      p.kind === 'child' ? 'Child · tap for their week' : isMe ? 'You' : (p.email ?? 'Adult');
    return (
      <div
        key={p.id}
        className="flex items-center gap-d3 border-b border-border px-3.5 py-3 last:border-0"
      >
        <button
          type="button"
          disabled={p.kind !== 'child' || !p.childListId}
          onClick={() => p.childListId && onOpenChild(p.childListId)}
          className="flex min-w-0 flex-1 items-center gap-d3 text-left"
        >
          <Avatar emoji={p.avatarEmoji} color={p.avatarColor} image={p.image} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
              {p.name}
            </span>
            <span className="block truncate text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
              {sub}
            </span>
          </span>
        </button>
        {p.kind === 'child' && (
          <button
            type="button"
            aria-label={`Edit ${p.name}`}
            className="grid h-9 w-9 flex-none place-items-center rounded-full text-muted"
            style={{ background: 'var(--color-chip-bg)', fontSize: 18 }}
            onClick={() => setEditing(p)}
          >
            ⋯
          </button>
        )}
        {p.kind === 'adult' && p.childListId === null && !isMe && (
          <span className="text-muted" style={{ fontSize: 18 }}>
            {' '}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <header className="mb-d3 flex items-center gap-d3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setRenaming(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) rename.mutate({ name: name.trim() });
                if (e.key === 'Escape') setRenaming(false);
              }}
              aria-label="Family name"
              className="w-full bg-transparent font-head outline-none"
              style={{
                fontSize: 'var(--fs-big)',
                fontWeight: 'var(--title-weight)',
                letterSpacing: 'var(--title-tracking)',
                color: 'var(--color-text)',
              }}
            />
          ) : (
            <button
              type="button"
              className="text-left"
              title="Rename"
              onClick={() => {
                setName(hh?.name ?? 'Family');
                setRenaming(true);
              }}
            >
              <h1
                className="font-head"
                style={{
                  fontSize: 'var(--fs-big)',
                  fontWeight: 'var(--title-weight)',
                  letterSpacing: 'var(--title-tracking)',
                }}
              >
                {hh?.name ?? 'Family'}
              </h1>
            </button>
          )}
          <p className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {people.length === 1
              ? 'Just you so far'
              : `${adults.length} ${adults.length === 1 ? 'adult' : 'adults'}${
                  kids.length ? ` · ${kids.length} ${kids.length === 1 ? 'kid' : 'kids'}` : ''
                }`}
          </p>
        </div>
        <button
          type="button"
          aria-label="Your settings"
          onClick={onOpenYou}
          className="grid h-10 w-10 flex-none place-items-center rounded-full"
          style={{ background: 'var(--color-chip-bg)' }}
        >
          <Avatar emoji={me.avatarEmoji} color={me.avatarColor} image={me.image} size={30} />
        </button>
      </header>

      {isLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Loading…
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={onOpenActivity}
            className="mb-d3 flex w-full items-center gap-d3 rounded-card bg-surface px-3.5 py-3 text-left shadow-card"
          >
            <span
              className="grid h-10 w-10 place-items-center rounded-full"
              style={{ background: 'var(--color-accent-soft)', fontSize: 18 }}
            >
              ✎
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold" style={{ fontSize: 'var(--fs-base)' }}>
                What's been happening
              </span>
              <span className="block text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                Everything the family has ticked off, planned and added
              </span>
            </span>
            <span className="text-muted" style={{ fontSize: 18 }}>
              ›
            </span>
          </button>
          <h2 className={sectionH} style={{ ...sectionStyle, marginTop: 0 }}>
            Grown-ups
          </h2>
          <div className="overflow-hidden rounded-card bg-surface shadow-card">
            {adults.map(personRow)}
            {(hh?.pendingInvites ?? []).map((i) => (
              <div
                key={i.id}
                className="flex items-center gap-d3 border-b border-border px-3.5 py-3 last:border-0"
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full text-muted"
                  style={{ background: 'var(--color-chip-bg)', fontSize: 18 }}
                >
                  ✉
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate font-semibold"
                    style={{ fontSize: 'var(--fs-base)' }}
                  >
                    {i.email}
                  </span>
                  <span className="block text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                    Invited · waiting for them to accept
                  </span>
                </span>
              </div>
            ))}
            {inviting ? (
              <div className="flex gap-2 px-3.5 py-3">
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && email.trim()) invite.mutate({ email: email.trim() });
                    if (e.key === 'Escape') setInviting(false);
                  }}
                  placeholder="their email"
                  aria-label="Email to invite"
                  className={field}
                  style={{ ...fieldStyle, fontSize: 'var(--fs-sm)' }}
                />
                <button
                  type="button"
                  disabled={!email.trim() || invite.isPending}
                  className="rounded-lg px-3 font-bold text-accent-contrast disabled:opacity-50"
                  style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
                  onClick={() => invite.mutate({ email: email.trim() })}
                >
                  {invite.isPending ? 'Sending…' : 'Send'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setInviting(true)}
                className="flex w-full items-center gap-d3 px-3.5 py-3 text-left font-bold text-accent"
                style={{ fontSize: 'var(--fs-base)' }}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full"
                  style={{ background: 'var(--color-accent-soft)', fontSize: 20 }}
                >
                  ＋
                </span>
                Invite a grown-up
              </button>
            )}
          </div>
          <p className="mt-2 text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
            Grown-ups see every list, the calendar, the meal plan and the kids' weeks, unless a list
            is marked private.
          </p>

          <h2 className={sectionH} style={sectionStyle}>
            Kids
          </h2>
          <div className="overflow-hidden rounded-card bg-surface shadow-card">
            {kids.map(personRow)}
            {adding ? (
              <div className="px-3.5 py-3">
                <AddChildForm
                  usedColors={people.map((p) => p.avatarColor)}
                  onDone={() => {
                    refresh();
                    setAdding(false);
                  }}
                  onCancel={() => setAdding(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-d3 px-3.5 py-3 text-left font-bold text-accent"
                style={{ fontSize: 'var(--fs-base)' }}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full"
                  style={{ background: 'var(--color-accent-soft)', fontSize: 20 }}
                >
                  ＋
                </span>
                Add a child
              </button>
            )}
          </div>
          <p className="mt-2 text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
            Kids don't sign in. They can still be given tasks and events, and each has a page for
            their school week, term dates and the details you otherwise hunt for in an email.
          </p>
        </>
      )}

      {editing && (
        <EditChildSheet
          person={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            refresh();
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function AddChildForm({
  usedColors,
  onDone,
  onCancel,
}: {
  usedColors: (string | null | undefined)[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🧒');
  const [color, setColor] = useState<string | null>(() => pickUnusedColor(usedColors));
  const add = trpc.household.addChild.useMutation({ onSuccess: onDone });
  const submit = () => {
    if (!name.trim() || add.isPending) return;
    add.mutate({ name: name.trim(), emojiIcon: emoji, color: color ?? undefined });
  };
  return (
    <>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Their name"
        aria-label="Child's name"
        className={`${field} mb-3`}
        style={fieldStyle}
      />
      <EmojiPicker value={emoji} onChange={setEmoji} />
      <div className="mb-1 mt-3 font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
        Their colour
      </div>
      <ColorPicker value={color} onChange={setColor} />
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
          disabled={!name.trim() || add.isPending}
          className="rounded-lg px-4 py-2 font-bold text-accent-contrast disabled:opacity-50"
          style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}
          onClick={submit}
        >
          {add.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
    </>
  );
}

function EditChildSheet({
  person: p,
  onClose,
  onDone,
}: {
  person: Person;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(p.name);
  const [emoji, setEmoji] = useState(p.avatarEmoji);
  const [color, setColor] = useState<string | null>(p.avatarColor);
  const [confirmDel, setConfirmDel] = useState(false);
  const update = trpc.household.updatePerson.useMutation({ onSuccess: onDone });
  const remove = trpc.household.removePerson.useMutation({ onSuccess: onDone });
  return (
    <>
      <div
        className="fixed inset-0 z-30"
        style={{ background: 'rgba(0,0,0,.4)' }}
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md overflow-y-auto p-4"
        style={{
          background: 'var(--color-bg)',
          borderRadius: '22px 22px 0 0',
          maxHeight: '85%',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        }}
      >
        <div
          className="mx-auto mb-3 h-1.5 w-10 rounded-full"
          style={{ background: 'var(--color-check-border)' }}
        />
        <h3 className="mb-3 font-head" style={{ fontSize: 18 }}>
          {p.name}
        </h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Name"
          className={`${field} bg-surface`}
          style={fieldStyle}
        />
        <div className="mt-3">
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </div>
        <div className="mb-1 mt-3 font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          Their colour
        </div>
        <ColorPicker value={color} onChange={setColor} />
        <button
          type="button"
          disabled={!name.trim() || update.isPending}
          onClick={() => update.mutate({ id: p.id, name: name.trim(), emojiIcon: emoji, color })}
          className="mt-4 w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-50"
          style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
        {confirmDel ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Remove {p.name}? Their week and details are put away too.
            </span>
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: p.id })}
              className="rounded-full px-3 py-1.5 font-bold"
              style={{
                fontSize: 'var(--fs-sm)',
                background: 'var(--color-danger)',
                color: '#fff',
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            className="mt-3 w-full py-2 font-semibold text-danger"
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            Remove from family
          </button>
        )}
      </div>
    </>
  );
}
