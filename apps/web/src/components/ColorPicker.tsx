const PALETTE = [
  '#EF4444', // red
  '#F43F5E', // rose
  '#F97316', // orange
  '#F59E0B', // amber
  '#EAB308', // yellow
  '#84CC16', // lime
  '#22C55E', // green
  '#10B981', // emerald
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#0EA5E9', // sky
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#A855F7', // purple
  '#D946EF', // fuchsia
  '#EC4899', // pink
  '#78716C', // stone
];

/**
 * The least-used palette colour across the given list colours — used to
 * auto-assign a colour to a new list. Always returns something, even when
 * every colour is taken.
 */
export function pickUnusedColor(used: (string | null | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const c of used) if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  let best: string = PALETTE[0] ?? '#3B82F6';
  let bestN = Infinity;
  for (const c of PALETTE) {
    const n = counts.get(c) ?? 0;
    if (n < bestN) {
      bestN = n;
      best = c;
    }
  }
  return best;
}

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

/**
 * Black or white, whichever can actually be read on `bg`.
 *
 * The palette runs from a near-black stone to a bright yellow; white text holds
 * up on one end and is around 1.7:1 on the other, which is illegible at the
 * size a calendar chip renders. Uses the WCAG relative-luminance formula, and
 * its 0.179 crossover — the point where white and black give equal contrast.
 */
export function readableOn(bg: string | null | undefined): string {
  const hex = (bg ?? '').replace('#', '');
  if (hex.length !== 6) return '#fff';
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.179 ? '#000' : '#fff';
}
