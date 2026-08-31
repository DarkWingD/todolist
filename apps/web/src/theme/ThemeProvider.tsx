import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_PREFS,
  type Appearance,
  type Density,
  type Theme,
} from '@todolist/shared';

export interface ThemePrefs {
  theme: Theme;
  appearance: Appearance;
  density: Density;
  textScale: number;
}

interface ThemeContextValue extends ThemePrefs {
  /** Resolved light/dark after applying `system`. */
  mode: 'light' | 'dark';
  setPrefs: (patch: Partial<ThemePrefs>) => void;
}

const STORAGE_KEY = 'todolist.prefs';
const ThemeContext = createContext<ThemeContextValue | null>(null);

const DENSITY_VALUE: Record<Density, number> = {
  comfortable: 1,
  cozy: 0.9,
  compact: 0.8,
};

function loadPrefs(): ThemePrefs {
  if (typeof localStorage === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<ThemePrefs>) };
  } catch {
    /* ignore malformed storage */
  }
  return DEFAULT_PREFS;
}

function systemPrefersDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<ThemePrefs>(loadPrefs);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // Track OS light/dark while in `system` mode.
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const mode: 'light' | 'dark' =
    prefs.appearance === 'system' ? (systemDark ? 'dark' : 'light') : prefs.appearance;

  // Apply tokens to <html> and persist.
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
      /* ignore */
    }
  }, [prefs, mode]);

  const setPrefs = useCallback((patch: Partial<ThemePrefs>) => {
    setPrefsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ ...prefs, mode, setPrefs }),
    [prefs, mode, setPrefs],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
