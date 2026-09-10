// Each colour's name is the only thing a screen reader can announce about it:
// the swatch is a button whose entire content is its background.
const COLORS = [
  { hex: '#EF4444', name: 'Red' },
  { hex: '#F43F5E', name: 'Rose' },
  { hex: '#F97316', name: 'Orange' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#EAB308', name: 'Yellow' },
  { hex: '#84CC16', name: 'Lime' },
  { hex: '#22C55E', name: 'Green' },
  { hex: '#10B981', name: 'Emerald' },
  { hex: '#14B8A6', name: 'Teal' },
  { hex: '#06B6D4', name: 'Cyan' },
  { hex: '#0EA5E9', name: 'Sky' },
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#6366F1', name: 'Indigo' },
  { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#A855F7', name: 'Purple' },
  { hex: '#D946EF', name: 'Fuchsia' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#78716C', name: 'Stone' },
] as const;

const PALETTE = COLORS.map((c) => c.hex);

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
      aria-label={c ? (COLORS.find((x) => x.hex === c)?.name ?? c) : 'No colour'}
      className="relative grid place-items-center rounded-full"
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
      {/* 30px is a small thing to hit accurately; the target reaches past it
          without moving the swatches apart. */}
      <span aria-hidden="true" className="absolute" style={{ inset: -6 }} />
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
