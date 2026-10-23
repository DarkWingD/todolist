import { BackButton } from '../components/BackButton';
import { trpc } from '../lib/trpc';

/**
 * Personal settings that change what the app shows or does, not how it
 * looks — that's Appearance. Week start, the Meals/Kids tabs, and weather
 * location all live here instead.
 */
export function PreferencesScreen({ onBack }: { onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data: serverPrefs } = trpc.prefs.get.useQuery();
  const setMealsVisible = trpc.prefs.setMealsVisible.useMutation({
    onSuccess: () => utils.prefs.get.invalidate(),
  });
  const setWeekStart = trpc.prefs.setWeekStart.useMutation({
    onSuccess: () => utils.prefs.get.invalidate(),
  });
  const setKidsVisible = trpc.prefs.setKidsVisible.useMutation({
    onSuccess: () => utils.prefs.get.invalidate(),
  });
  const setLiveLocation = trpc.prefs.setLiveLocation.useMutation({
    onSuccess: () => utils.prefs.get.invalidate(),
  });
  const showMeals = serverPrefs?.showMeals ?? true;
  const showKids = serverPrefs?.showKids ?? true;
  const useLiveLocation = serverPrefs?.useLiveLocation ?? false;
  const weekStartsOn = (serverPrefs?.weekStartsOn ?? 1) as 0 | 1;

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
            boxShadow:
              current === o.value ? 'var(--shadow-card, 0 1px 2px rgba(0,0,0,.12))' : 'none',
            outline: current === o.value ? '1px solid var(--color-border)' : 'none',
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
        style={{
          fontSize: 'var(--fs-big)',
          fontWeight: 'var(--title-weight)',
          letterSpacing: 'var(--title-tracking)',
        }}
      >
        Preferences
      </h1>

      <div className="mb-d2 font-semibold" style={{ fontSize: 'var(--fs-sm)' }}>
        Week starts on
      </div>
      {seg<'sun' | 'mon'>(
        weekStartsOn === 0 ? 'sun' : 'mon',
        [
          { value: 'sun', label: 'Sunday' },
          { value: 'mon', label: 'Monday' },
        ],
        (v) => setWeekStart.mutate({ weekStartsOn: v === 'sun' ? 0 : 1 }),
      )}
      <p className="mt-1 text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
        Used by the meal week and the calendar.
      </p>

      <div className="mt-d4">
        <div className="mb-2 font-semibold" style={{ fontSize: 'var(--fs-sm)' }}>
          Sections
        </div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={showMeals}
            onChange={(e) => setMealsVisible.mutate({ showMeals: e.target.checked })}
            style={{ accentColor: 'var(--color-accent)', width: 18, height: 18 }}
          />
          <span style={{ fontSize: 'var(--fs-base)' }}>Show Meals</span>
        </label>
        <p className="ml-8 mt-1 text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
          Hides the tab. Your meal plan and its shopping list stay exactly as they are.
        </p>

        <label className="mt-d3 flex items-center gap-3">
          <input
            type="checkbox"
            checked={showKids}
            onChange={(e) => setKidsVisible.mutate({ showKids: e.target.checked })}
            style={{ accentColor: 'var(--color-accent)', width: 18, height: 18 }}
          />
          <span style={{ fontSize: 'var(--fs-base)' }}>Show kids on Today</span>
        </label>
        <p className="ml-8 mt-1 text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
          Hides the &ldquo;Where everyone is&rdquo; section. The children themselves stay in Lists.
        </p>
      </div>

      <div className="mt-d4">
        <div className="mb-2 font-semibold" style={{ fontSize: 'var(--fs-sm)' }}>
          Weather
        </div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={useLiveLocation}
            onChange={(e) => setLiveLocation.mutate({ useLiveLocation: e.target.checked })}
            style={{ accentColor: 'var(--color-accent)', width: 18, height: 18 }}
          />
          <span style={{ fontSize: 'var(--fs-base)' }}>Use my location</span>
        </label>
        <p className="ml-8 mt-1 text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
          Your phone's own position instead of home, for while you're away. Your browser will ask
          to allow it; say no and this just falls back to home.
        </p>
      </div>
    </>
  );
}
