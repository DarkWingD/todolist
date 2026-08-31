import type { Appearance, Density, Theme } from '@todolist/shared';
import { BackButton } from '../components/BackButton';
import { trpc } from '../lib/trpc';
import { useTheme, type ThemePrefs } from '../theme/ThemeProvider';

const THEME_SW: Record<Theme, string[]> = {
  tento: ['#FBFAF8', '#5A5FCC', '#1C1B1A'],
  nudge: ['#FFF9F5', '#FF6B5E', '#FFB020'],
  momentum: ['#151519', '#A78BFA', '#7C3AED'],
};
const THEME_NAME: Record<Theme, string> = { tento: 'Tento', nudge: 'Nudge', momentum: 'Momentum' };

export function AppearanceScreen({ onBack }: { onBack: () => void }) {
  const { theme, appearance, density, textScale, setPrefs } = useTheme();
  const update = trpc.prefs.update.useMutation();

  function apply(patch: Partial<ThemePrefs>) {
    const next = { theme, appearance, density, textScale, ...patch };
    setPrefs(patch);
    update.mutate(next);
  }

  const seg = <T extends string>(
    current: T,
    options: { value: T; label: string }[],
    onPick: (v: T) => void,
  ) => (
    <div className="flex rounded-lg p-0.5" style={{ background: 'var(--color-chip-bg)' }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onPick(o.value)}
          className="flex-1 rounded-md py-1.5 font-semibold"
          style={{
            fontSize: 'var(--fs-sm)',
            background: current === o.value ? 'var(--color-surface)' : 'transparent',
            color: current === o.value ? 'var(--color-text)' : 'var(--color-muted)',
            boxShadow: current === o.value ? '0 1px 2px rgba(0,0,0,.12)' : 'none',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <BackButton label="You" onClick={onBack} />
      <h1
        className="mb-d3 font-head"
        style={{ fontSize: 'var(--fs-big)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}
      >
        Appearance
      </h1>

      <h2 className="mb-d2 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}>
        Theme
      </h2>
      <div className="mb-d4 flex gap-2">
        {(Object.keys(THEME_SW) as Theme[]).map((t) => (
          <button
            key={t}
            onClick={() => apply({ theme: t })}
            className="flex-1 rounded-xl p-2.5 text-center"
            style={{
              boxShadow: theme === t ? 'inset 0 0 0 2px var(--color-accent)' : 'inset 0 0 0 1.5px var(--color-border)',
            }}
          >
            <span className="mb-1.5 flex justify-center gap-1">
              {THEME_SW[t].map((c, i) => (
                <i key={i} className="h-3 w-3 rounded" style={{ background: c }} />
              ))}
            </span>
            <span className="font-bold" style={{ fontSize: 'var(--fs-xs)' }}>{THEME_NAME[t]}</span>
          </button>
        ))}
      </div>

      <h2 className="mb-d2 font-bold uppercase text-muted" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}>
        Display
      </h2>
      <div className="rounded-card bg-surface p-d3 shadow-card">
        <div className="mb-d3">
          <div className="mb-2 font-semibold" style={{ fontSize: 'var(--fs-sm)' }}>Appearance</div>
          {seg<Appearance>(appearance,
            [{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }],
            (v) => apply({ appearance: v }))}
        </div>
        <div className="mb-d3">
          <div className="mb-2 font-semibold" style={{ fontSize: 'var(--fs-sm)' }}>Density</div>
          {seg<Density>(density,
            [{ value: 'comfortable', label: 'Comfortable' }, { value: 'cozy', label: 'Cozy' }, { value: 'compact', label: 'Compact' }],
            (v) => apply({ density: v }))}
        </div>
        <div>
          <div className="mb-2 font-semibold" style={{ fontSize: 'var(--fs-sm)' }}>Text size</div>
          <div className="flex items-center gap-3">
            <span className="text-muted" style={{ fontSize: 12 }}>A</span>
            <input
              type="range"
              min={0.88}
              max={1.14}
              step={0.02}
              value={textScale}
              onChange={(e) => apply({ textScale: parseFloat(e.target.value) })}
              className="flex-1"
              style={{ accentColor: 'var(--color-accent)' }}
            />
            <span className="text-muted" style={{ fontSize: 18 }}>A</span>
          </div>
        </div>
      </div>
    </>
  );
}
