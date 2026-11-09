import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { httpBatchLink } from '@trpc/client';
import { useState, type ReactNode } from 'react';
import { describeError, ErrorProvider, useErrorReporter } from './errors';
import { trpc } from './trpc';

// Bump this when a query's cached shape changes in a way old data can't satisfy (a field
// renamed or removed) — it busts anything persisted under the old shape instead of a page
// crashing on it. Not tied to the app version: most releases don't touch cached shapes.
const PERSIST_BUSTER = 'sorted-cache-v1';
// How long a persisted entry is still worth painting on a cold open before it's not even
// worth showing as a stale placeholder. Independent of staleTime (which only governs
// background refetch) — this governs the much coarser "is this worth keeping at all".
const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * The query client is created inside the error provider so that every mutation
 * and query failure reports itself centrally. Screens previously had to
 * remember to render `mutation.error`, and most did not — which is how a
 * rejected save came to look exactly like a successful one.
 */
function QueryLayer({ children }: { children: ReactNode }) {
  const { report } = useErrorReporter();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // gcTime needs to outlive PERSIST_MAX_AGE below, or the persisted entry gets
          // garbage-collected from memory (and so never re-persisted) before it's stale enough
          // to matter — the cache would quietly stop surviving a relaunch.
          queries: { staleTime: 5_000, gcTime: PERSIST_MAX_AGE, retry: 1 },
        },
        // A failed write is the dangerous one: the user believes it saved.
        mutationCache: new MutationCache({
          onError: (err) => {
            const { message, detail } = describeError(err);
            report(message, detail);
          },
        }),
        // A failed read usually leaves a visible loading or empty state, so it
        // is only worth reporting when there is no cached data to fall back on.
        queryCache: new QueryCache({
          onError: (err, query) => {
            if (query.state.data !== undefined) return;
            const { detail } = describeError(err);
            report("Couldn't load that.", detail);
          },
        }),
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          // Send the session cookie with every request.
          fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include' }),
        }),
      ],
    }),
  );
  // localStorage, not IndexedDB: the whole cache is small (a household's tasks/calendar/
  // doses, not media) and sync storage means the very first paint can read it, before any
  // await — an async persister still shows a blank frame on cold open.
  const [persister] = useState(() => createSyncStoragePersister({ storage: window.localStorage }));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: PERSIST_MAX_AGE, buster: PERSIST_BUSTER }}
      >
        {children}
      </PersistQueryClientProvider>
    </trpc.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorProvider>
      <QueryLayer>{children}</QueryLayer>
    </ErrorProvider>
  );
}
