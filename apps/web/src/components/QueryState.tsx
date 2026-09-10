import type { ReactNode } from 'react';

/**
 * Loading, failed, empty, or the content — in that order.
 *
 * Screens were writing `isLoading ? 'Loading…' : content`, which gets a failed
 * query wrong twice over. A query that errors is no longer loading and has no
 * data, so it either fell into the loading branch and span forever, or into the
 * empty branch and told you there was nothing there — "Nothing yet. As the
 * family ticks things off…" on a feed that simply hadn't loaded.
 *
 * The error toast still fires underneath; this is about the screen not
 * asserting something false while it does.
 */
export function QueryState({
  isLoading,
  isError,
  onRetry,
  isEmpty,
  empty,
  loading = 'Loading…',
  children,
}: {
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  isEmpty?: boolean;
  /** Shown when the query succeeded and there is genuinely nothing. */
  empty?: ReactNode;
  loading?: ReactNode;
  children: ReactNode;
}) {
  if (isError) {
    return (
      <div className="rounded-card bg-surface p-d3" style={{ fontSize: 'var(--fs-base)' }}>
        <p className="text-muted">That didn’t load.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 font-semibold text-accent"
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            Try again
          </button>
        )}
      </div>
    );
  }
  if (isLoading) {
    return (
      <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
        {loading}
      </p>
    );
  }
  if (isEmpty && empty) {
    return (
      <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
        {empty}
      </p>
    );
  }
  return <>{children}</>;
}
