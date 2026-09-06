import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * App-wide error reporting.
 *
 * Every mutation in the app used to fail silently unless its screen happened to
 * render `mutation.error` — and most did not, so a rejected save looked exactly
 * like a successful one. This catches failures centrally instead, so a screen
 * has to opt *out* of reporting rather than remember to opt in.
 *
 * Read failures are deliberately quieter than write failures: a query that
 * fails usually leaves a visible loading or empty state, whereas a mutation
 * that fails leaves the user believing something was saved when it was not.
 */

export interface AppError {
  id: number;
  message: string;
  detail?: string;
}

interface ErrorBus {
  report: (message: string, detail?: string) => void;
}

const Ctx = createContext<ErrorBus>({ report: () => {} });

export const useErrorReporter = () => useContext(Ctx);

/** Turns whatever was thrown into something a person can act on. */
export function describeError(err: unknown): { message: string; detail?: string } {
  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Something went wrong.';

  // tRPC surfaces its code on the error's shape; use it to say something more
  // useful than the server's own wording where we can.
  const code = (err as { data?: { code?: string } } | null)?.data?.code;
  if (code === 'UNAUTHORIZED') {
    return { message: 'You have been signed out.', detail: 'Reload the page and sign in again.' };
  }
  if (code === 'FORBIDDEN') {
    return { message: "You don't have access to that.", detail: raw };
  }
  if (code === 'BAD_REQUEST') {
    return { message: "That couldn't be saved.", detail: raw };
  }
  if (!navigator.onLine) {
    return {
      message: 'No connection.',
      detail: 'Your change was not saved. Try again once you are back online.',
    };
  }
  return { message: "That didn't save.", detail: raw };
}

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<AppError[]>([]);

  const report = useCallback((message: string, detail?: string) => {
    setErrors((list) => {
      // Batched mutations can fail together; one message is enough.
      if (list.some((e) => e.message === message && e.detail === detail)) return list;
      return [...list, { id: Date.now() + Math.random(), message, detail }];
    });
  }, []);

  // Anything unhandled anywhere in the app — including a promise nobody awaited
  // — is still a failure the user deserves to know about.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const { message, detail } = describeError(e.reason);
      report(message, detail);
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, [report]);

  return (
    <Ctx.Provider value={{ report }}>
      {children}
      {errors.length > 0 && (
        <div
          className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-d4"
          style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))' }}
          role="alert"
          aria-live="assertive"
        >
          {errors.map((e) => (
            <div
              key={e.id}
              className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-card p-d3 shadow-card"
              style={{ background: 'var(--color-danger-soft)' }}
            >
              <span style={{ fontSize: 15, lineHeight: 1.3 }}>⚠️</span>
              <span className="min-w-0 flex-1">
                <span
                  className="block font-semibold"
                  style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-danger)' }}
                >
                  {e.message}
                </span>
                {e.detail && (
                  <span
                    className="block break-words"
                    style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text)', opacity: 0.75 }}
                  >
                    {e.detail}
                  </span>
                )}
              </span>
              {/* Dismissed by hand, never on a timer: a failed save is worth
                  more of your attention than a toast that vanishes while you
                  are looking at something else. */}
              <button
                type="button"
                onClick={() => setErrors((list) => list.filter((x) => x.id !== e.id))}
                aria-label="Dismiss"
                className="flex-none"
                style={{ fontSize: 16, color: 'var(--color-danger)' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  );
}
