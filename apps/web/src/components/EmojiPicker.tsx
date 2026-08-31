const PRESETS = [
  '🏡', '💼', '🛒', '🧳', '🏃', '📚', '🎯', '🎉', '🌱', '💡',
  '🍽️', '💰', '❤️', '🐾', '✈️', '🎵', '🧹', '🛠️', '📝', '⭐',
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {PRESETS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          className="grid aspect-square place-items-center rounded-lg text-lg"
          style={{
            background: value === e ? 'var(--color-accent-soft)' : 'var(--color-chip-bg)',
            boxShadow: value === e ? 'inset 0 0 0 2px var(--color-accent)' : 'none',
          }}
          aria-pressed={value === e}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
