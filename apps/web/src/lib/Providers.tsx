import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, type ReactNode } from 'react';
import { describeError, ErrorProvider, useErrorReporter } from './errors';
import { trpc } from './trpc';

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
        defaultOptions: { queries: { staleTime: 5_000, retry: 1 } },
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

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
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
