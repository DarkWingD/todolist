const PALETTE = [
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#22C55E', // green
  '#14B8A6', // teal
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#78716C', // stone
];

interface ColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
}

/** Swatch row for a list's colour (shown on the calendar). First option = no colour. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const swatch = (c: string | null) => (
    <button
      key={c ?? 'none'}
      type="button"
      onClick={() => onChange(c)}
      aria-pressed={value === c}
      className="grid place-items-center rounded-full"
      style={{
        width: 30,
        height: 30,
        background: c ?? 'var(--color-chip-bg)',
        boxShadow:
          value === c
            ? '0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent)'
            : c
              ? 'none'
              : 'inset 0 0 0 1.5px var(--color-check-border)',
        color: 'var(--color-muted)',
        fontSize: 14,
      }}
    >
      {c ? '' : '∅'}
    </button>
  );
  return <div className="flex flex-wrap gap-2">{[null, ...PALETTE].map(swatch)}</div>;
}
