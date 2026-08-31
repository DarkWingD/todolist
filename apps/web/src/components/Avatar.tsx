interface AvatarProps {
  emoji: string;
  color: string;
  /** pixel diameter */
  size?: number;
  className?: string;
}

/**
 * A user's identity chip: emoji on a soft tint of their chosen color.
 * Readable across every theme + light/dark because the tint mixes with --color-surface.
 */
export function Avatar({ emoji, color, size = 24, className }: AvatarProps) {
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.56,
        display: 'inline-grid',
        placeItems: 'center',
        flex: 'none',
        lineHeight: 1,
        borderRadius: '50%',
        background: `color-mix(in srgb, ${color} 22%, var(--color-surface))`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${color} 48%, transparent)`,
      }}
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
}

interface AvatarStackProps {
  users: { id: string; emoji: string; color: string }[];
  size?: number;
  max?: number;
}

export function AvatarStack({ users, size = 26, max = 4 }: AvatarStackProps) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((u, i) => (
        <span
          key={u.id}
          style={{
            marginLeft: i === 0 ? 0 : -7,
            borderRadius: '50%',
            boxShadow: '0 0 0 2px var(--color-surface)',
          }}
        >
          <Avatar emoji={u.emoji} color={u.color} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="grid place-items-center rounded-full bg-chip-bg text-muted"
          style={{ width: size, height: size, fontSize: size * 0.4, marginLeft: -7, fontWeight: 700 }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
