import { Avatar } from '../components/Avatar';
import { signOut } from '../lib/auth';
import type { SessionUser } from '../types';

const THEME_LABEL: Record<string, string> = { tento: 'Tento', nudge: 'Nudge', momentum: 'Momentum' };

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
  const row = (icon: string, label: string, opts: { onClick?: () => void; value?: string } = {}) => (
    <button
      onClick={opts.onClick}
      className="flex w-full items-center gap-3 border-b border-border px-3.5 py-3 text-left last:border-0"
    >
      <span className="w-6 text-center" style={{ fontSize: 16 }}>{icon}</span>
      <span className="flex-1 font-medium" style={{ fontSize: 'var(--fs-base)' }}>{label}</span>
      {opts.value && <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>{opts.value}</span>}
      <span className="text-muted" style={{ fontSize: 18 }}>›</span>
    </button>
  );

  return (
    <>
      <h1
        className="mb-d3 font-head"
        style={{ fontSize: 'var(--fs-big)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}
      >
        You
      </h1>

      <div className="mb-d4 flex items-center gap-3">
        <Avatar emoji={me.avatarEmoji} color={me.avatarColor} size={54} />
        <div>
          <div className="font-head font-bold" style={{ fontSize: 'var(--fs-lg)' }}>{me.name}</div>
          <div className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>{me.email}</div>
        </div>
      </div>

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
