import { useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { EmojiPicker } from '../components/EmojiPicker';
import { ColorPicker } from '../components/ColorPicker';
import { signOut } from '../lib/auth';
import { useErrorReporter } from '../lib/errors';
import { trpc } from '../lib/trpc';
import type { SessionUser } from '../types';

const THEME_LABEL: Record<string, string> = {
  tento: 'Tento',
  nudge: 'Nudge',
  momentum: 'Momentum',
};

// Centre-crop to a small square so the stored data URL stays ~20KB.
async function fileToSquareDataUrl(file: File, px = 256): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, px, px);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export function YouScreen({
  me,
  themeName,
  onOpenAppearance,
  onOpenAccount,
  onOpenPrivacy,
  onOpenManageLists,
  onOpenNotifications,
}: {
  me: SessionUser;
  themeName: string;
  onOpenAppearance: () => void;
  onOpenAccount: () => void;
  onOpenPrivacy: () => void;
  onOpenManageLists: () => void;
  onOpenNotifications: () => void;
}) {
  const { report } = useErrorReporter();
  const fileInput = useRef<HTMLInputElement>(null);
  // Reload after changing the photo so the Better Auth session picks up the new image.
  const setPhoto = trpc.account.setPhoto.useMutation({ onSuccess: () => location.reload() });
  const setProfile = trpc.account.setProfile.useMutation({ onSuccess: () => location.reload() });
  const [draftName, setDraftName] = useState(me.name);
  const [editAvatar, setEditAvatar] = useState(false);

  const row = (
    icon: string,
    label: string,
    opts: { onClick?: () => void; value?: string } = {},
  ) => (
    <button
      onClick={opts.onClick}
      className="flex w-full items-center gap-3 border-b border-border px-3.5 py-3 text-left last:border-0"
    >
      <span className="w-6 text-center" style={{ fontSize: 16 }}>
        {icon}
      </span>
      <span className="flex-1 font-medium" style={{ fontSize: 'var(--fs-base)' }}>
        {label}
      </span>
      {opts.value && (
        <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          {opts.value}
        </span>
      )}
      <span className="text-muted" style={{ fontSize: 18 }}>
        ›
      </span>
    </button>
  );

  return (
    <>
      <h1
        className="mb-d3 font-head"
        style={{
          fontSize: 'var(--fs-big)',
          fontWeight: 'var(--title-weight)',
          letterSpacing: 'var(--title-tracking)',
        }}
      >
        You
      </h1>

      <div className="mb-d4 flex items-center gap-3">
        <button
          aria-label="Change profile photo"
          className="relative"
          onClick={() => fileInput.current?.click()}
          disabled={setPhoto.isPending}
        >
          <Avatar emoji={me.avatarEmoji} color={me.avatarColor} image={me.image} size={54} />
          <span
            className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full"
            style={{
              width: 20,
              height: 20,
              fontSize: 11,
              background: 'var(--color-accent)',
              boxShadow: '0 0 0 2px var(--color-bg)',
            }}
          >
            📷
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              setPhoto.mutate({ image: await fileToSquareDataUrl(file) });
            } catch {
              // The app has an error toast; a native alert doesn't belong here.
              report("Couldn't read that image.", 'Try a different photo.');
            }
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="font-head font-bold" style={{ fontSize: 'var(--fs-lg)' }}>
            {me.name}
          </div>
          <div className="break-all text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {me.email}
          </div>
          <div className="mt-0.5 flex gap-3">
            <button
              className="font-semibold text-muted"
              style={{ fontSize: 'var(--fs-xs)' }}
              onClick={() => setEditAvatar((v) => !v)}
            >
              {editAvatar ? 'Done' : 'Edit name, emoji & colour'}
            </button>
            {me.image && (
              <button
                className="font-semibold text-muted"
                style={{ fontSize: 'var(--fs-xs)' }}
                onClick={() => setPhoto.mutate({ image: null })}
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Folded away by default: most people set this once. Without it an adult
          had no way to change their own emoji or colour anywhere in the app. */}
      {editAvatar && (
        <div className="mb-d3 rounded-card bg-surface p-d3 shadow-card">
          <div className="mb-1 font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Your name
          </div>
          <div className="mb-3 flex gap-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              aria-label="Your name"
              placeholder="What should the family call you?"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none"
              style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
            />
            <button
              type="button"
              disabled={!draftName.trim() || draftName.trim() === me.name || setProfile.isPending}
              onClick={() => setProfile.mutate({ name: draftName.trim() })}
              className="flex-none rounded-full px-4 font-bold text-accent disabled:opacity-40"
              style={{ background: 'var(--color-accent-soft)', fontSize: 'var(--fs-sm)' }}
            >
              Save
            </button>
          </div>
          <div className="mb-1 font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Your emoji
          </div>
          <EmojiPicker value={me.avatarEmoji} onChange={(emojiIcon) => setProfile.mutate({ emojiIcon })} />
          <div className="mb-1 mt-3 font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Your colour
          </div>
          <ColorPicker
            value={me.avatarColor}
            onChange={(color) => color && setProfile.mutate({ color })}
          />
        </div>
      )}

      <div className="mb-d3 overflow-hidden rounded-card bg-surface shadow-card">
        {row('🎨', 'Appearance', { onClick: onOpenAppearance, value: THEME_LABEL[themeName] })}
        {row('🔔', 'Notifications & reminders', { onClick: onOpenNotifications })}
        {row('🗂️', 'Lists & tags', { onClick: onOpenManageLists })}
      </div>

      <div className="mb-d3 overflow-hidden rounded-card bg-surface shadow-card">
        {row('⚙️', 'Account', { onClick: onOpenAccount })}
        {row('🔒', 'Privacy & security', { onClick: onOpenPrivacy })}
      </div>

      <div className="overflow-hidden rounded-card bg-surface shadow-card">
        {row('↪', 'Sign out', {
          onClick: async () => {
            await signOut();
            location.reload();
          },
        })}
      </div>
    </>
  );
}
