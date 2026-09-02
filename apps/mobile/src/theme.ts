import { useEffect, useState } from 'react';

/**
 * Theming for Kitchen Board.
 *
 * Deliberately its own thing rather than the web app's ThemeProvider: that one
 * syncs preferences with the server, and this app has none. Pure DOM, CSS
 * variables and localStorage, all of which work unchanged inside a WebView.
 */
export const THEMES = ['tento', 'nudge', 'momentum'] as const;
export const APPEARANCES = ['system', 'light', 'dark'] as const;
export const DENSITIES = ['comfortable', 'cozy', 'compact'] as const;

export type Theme = (typeof THEMES)[number];
export type Appearance = (typeof APPEARANCES)[number];
export type Density = (typeof DENSITIES)[number];

export interface Prefs {
  theme: Theme;
  appearance: Appearance;
  density: Density;
  textScale: number;
}

export const TEXT_SCALE = { min: 0.88, max: 1.14, step: 0.02 } as const;
const DENSITY_VALUE: Record<Density, number> = { comfortable: 1, cozy: 0.9, compact: 0.8 };
const DEFAULTS: Prefs = { theme: 'nudge', appearance: 'system', density: 'cozy', textScale: 0.96 };
const STORAGE_KEY = 'kitchenboard.prefs';

function load(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    // Private mode, cleared site data, a WebView with storage blocked — the
    // defaults are a perfectly good answer.
    return DEFAULTS;
  }
}

export function usePrefs() {
  const [prefs, setPrefsState] = useState<Prefs>(load);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const mode = prefs.appearance === 'system' ? (systemDark ? 'dark' : 'light') : prefs.appearance;

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = prefs.theme;
    el.dataset.mode = mode;
    el.style.setProperty('--density', String(DENSITY_VALUE[prefs.density]));
    el.style.setProperty('--text-scale', String(prefs.textScale));
    el.style.colorScheme = mode;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Not being able to remember the choice shouldn't stop it applying now.
    }
  }, [prefs, mode]);

  const setPrefs = (patch: Partial<Prefs>) => setPrefsState((p) => ({ ...p, ...patch }));
  return { prefs, mode, setPrefs };
}
