import clsx from 'clsx';
import { findTimers, ingredientLines, scaleLine } from '@todolist/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCloseOnBack } from '../lib/backstack';
import { methodSteps } from './ui';

/**
 * Cooking from the recipe: one step at a time in big type, the ingredients a
 * tap away, and timers started from the step that mentions them ("simmer for 20
 * minutes" has a 20-minute button). The screen is kept awake while it is open,
 * because a phone that locks itself with flour on your hands is the reason
 * people stop using a recipe app at the stove.
 */

export interface CookRecipe {
  name: string;
  ingredients: string | null;
  method?: string | null;
  servings?: number | null;
}

interface Timer {
  id: number;
  label: string;
  endsAt: number;
  total: number;
  done: boolean;
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
}

/** A short beep through the speaker, for a timer that runs out. */
function beep() {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.35);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.35);
      o.stop(ctx.currentTime + i * 0.35 + 0.3);
    }
  } catch {
    /* no audio: the flashing timer still says it */
  }
}

export function CookMode({
  recipe,
  factor = 1,
  onClose,
}: {
  recipe: CookRecipe;
  /** Scale the ingredients by this, when cooking for more or fewer than the recipe. */
  factor?: number;
  onClose: () => void;
}) {
  const steps = useMemo(() => methodSteps(recipe.method), [recipe.method]);
  const ingredients = useMemo(
    () => ingredientLines(recipe.ingredients).map((l) => scaleLine(l, factor)),
    [recipe.ingredients, factor],
  );
  const [tab, setTab] = useState<'steps' | 'ingredients'>(steps.length ? 'steps' : 'ingredients');
  const [i, setI] = useState(0);
  const [got, setGot] = useState<Set<number>>(new Set());
  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(Date.now());
  const seq = useRef(0);

  const close = useCallback(() => onClose(), [onClose]);
  useCloseOnBack(true, close);

  // Keep the screen on while cooking, and take the lock back after the tab was hidden.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    const take = () => {
      if (document.visibilityState === 'visible' && nav.wakeLock)
        nav.wakeLock
          .request('screen')
          .then((l) => (lock = l))
          .catch(() => {});
    };
    take();
    document.addEventListener('visibilitychange', take);
    return () => {
      document.removeEventListener('visibilitychange', take);
      lock?.release().catch(() => {});
    };
  }, []);

  // The clock for the timers, and the moment each runs out.
  useEffect(() => {
    if (!timers.some((t) => !t.done)) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      setTimers((all) =>
        all.map((x) => {
          if (x.done || x.endsAt > t) return x;
          beep();
          navigator.vibrate?.([300, 150, 300, 150, 300]);
          return { ...x, done: true };
        }),
      );
    }, 500);
    return () => window.clearInterval(id);
  }, [timers]);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(steps.length - 1, n + 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
      if (e.key === 'Escape') close();
    },
    [steps.length, close],
  );
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const step = steps[i] ?? '';
  const stepTimers = findTimers(step);
  const startTimer = (label: string, seconds: number) => {
    const id = ++seq.current;
    setTimers((all) => [
      ...all,
      { id, label, endsAt: Date.now() + seconds * 1000, total: seconds, done: false },
    ]);
    setNow(Date.now());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Cooking ${recipe.name}`}
      className="fixed inset-0 flex flex-col bg-bg"
      style={{ zIndex: 60, color: 'var(--color-text)' }}
    >
      <header className="flex items-center gap-d2 border-b border-border px-d4 py-d3">
        <span
          className="min-w-0 flex-1 truncate font-head font-bold"
          style={{ fontSize: 'var(--fs-lg)' }}
        >
          🍳 {recipe.name}
        </span>
        <button
          type="button"
          onClick={close}
          className="flex-none rounded-full px-4 py-2 font-bold"
          style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-sm)' }}
        >
          Done
        </button>
      </header>

      <div className="flex gap-d2 px-d4 pt-d3">
        {(['steps', 'ingredients'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className="rounded-full px-4 py-2 font-bold"
            style={{
              fontSize: 'var(--fs-sm)',
              background: tab === t ? 'var(--color-accent-soft)' : 'var(--color-chip-bg)',
              color: tab === t ? 'var(--color-accent)' : 'var(--color-muted)',
            }}
          >
            {t === 'steps'
              ? `Steps${steps.length ? ` (${steps.length})` : ''}`
              : `Ingredients (${ingredients.length})`}
          </button>
        ))}
      </div>

      {timers.length > 0 && (
        <div className="flex flex-wrap gap-d2 px-d4 pt-d3" aria-live="polite">
          {timers.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTimers((all) => all.filter((x) => x.id !== t.id))}
              title="Tap to dismiss"
              className={clsx('rounded-full px-3 py-1 font-bold', t.done && 'animate-pulse')}
              style={{
                fontSize: 'var(--fs-base)',
                fontVariantNumeric: 'tabular-nums',
                background: t.done ? 'var(--color-danger)' : 'var(--color-accent-soft)',
                color: t.done ? '#fff' : 'var(--color-accent)',
              }}
            >
              ⏱ {t.done ? `${t.label} — done!` : fmt(t.endsAt - now)} ✕
            </button>
          ))}
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-d4 py-d4">
        {tab === 'steps' ? (
          steps.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 'var(--fs-lg)' }}>
              This recipe has no steps yet. Add the method in the recipe book and they will show
              here, one at a time.
            </p>
          ) : (
            <>
              <span
                className="font-bold uppercase text-muted"
                style={{ fontSize: 'var(--fs-sm)', letterSpacing: '0.06em' }}
              >
                Step {i + 1} of {steps.length}
              </span>
              <p
                className="mt-d3 font-semibold"
                style={{ fontSize: 'clamp(22px, 5.5vw, 40px)', lineHeight: 1.35 }}
              >
                {step}
              </p>
              {stepTimers.length > 0 && (
                <div className="mt-d4 flex flex-wrap gap-d2">
                  {stepTimers.map((t, k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => startTimer(t.label, t.seconds)}
                      className="rounded-full px-4 py-2 font-bold"
                      style={{
                        background: 'var(--color-accent)',
                        color: 'var(--color-accent-contrast)',
                        fontSize: 'var(--fs-base)',
                      }}
                    >
                      ⏱ Start {t.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )
        ) : (
          <ul className="flex flex-col gap-d2">
            {ingredients.map((line, k) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() =>
                    setGot((s) => {
                      const n = new Set(s);
                      if (n.has(k)) n.delete(k);
                      else n.add(k);
                      return n;
                    })
                  }
                  className="flex w-full items-center gap-d3 rounded-card bg-surface p-d3 text-left shadow-card"
                  style={{ fontSize: 'var(--fs-lg)', opacity: got.has(k) ? 0.45 : 1 }}
                >
                  <span aria-hidden="true">{got.has(k) ? '✅' : '⬜'}</span>
                  <span className={clsx(got.has(k) && 'line-through')}>{line}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {tab === 'steps' && steps.length > 0 && (
        <footer
          className="flex gap-d3 border-t border-border px-d4 py-d3"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            disabled={i === 0}
            onClick={() => setI((n) => n - 1)}
            className="flex-1 rounded-full py-4 font-bold disabled:opacity-40"
            style={{ background: 'var(--color-chip-bg)', fontSize: 'var(--fs-lg)' }}
          >
            ‹ Back
          </button>
          <button
            type="button"
            onClick={() => (i < steps.length - 1 ? setI((n) => n + 1) : close())}
            className="flex-[2] rounded-full py-4 font-bold"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-contrast)',
              fontSize: 'var(--fs-lg)',
            }}
          >
            {i < steps.length - 1 ? 'Next ›' : 'Finished 🎉'}
          </button>
        </footer>
      )}
    </div>
  );
}
