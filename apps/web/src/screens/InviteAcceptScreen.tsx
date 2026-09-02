import { trpc } from '../lib/trpc';

export function InviteAcceptScreen({ token }: { token: string }) {
  const { data: info, isLoading, error } = trpc.invites.info.useQuery({ token });
  const accept = trpc.invites.accept.useMutation({
    onSuccess: () => {
      window.location.href = '/';
    },
  });

  const goHome = () => (window.location.href = '/');

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col items-center justify-center gap-5 px-8 text-center">
      {isLoading ? (
        <p className="text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Loading invite…
        </p>
      ) : error || !info ? (
        <>
          <div className="text-4xl">🔗</div>
          <p style={{ fontSize: 'var(--fs-base)' }}>This invite link isn’t valid.</p>
          <button className="font-semibold text-accent" onClick={goHome}>
            Go to ToDoList
          </button>
        </>
      ) : info.expired || info.status !== 'pending' ? (
        <>
          <div className="text-4xl">⌛</div>
          <p style={{ fontSize: 'var(--fs-base)' }}>
            This invite has {info.status !== 'pending' ? 'already been used' : 'expired'}.
          </p>
          <button className="font-semibold text-accent" onClick={goHome}>
            Go to ToDoList
          </button>
        </>
      ) : (
        <>
          <div
            className="grid h-20 w-20 place-items-center rounded-emoji text-4xl"
            style={{ background: 'var(--color-emoji-bg)' }}
          >
            {info.emoji}
          </div>
          <div>
            <h1
              className="font-head"
              style={{
                fontSize: 'var(--fs-big)',
                fontWeight: 'var(--title-weight)',
                letterSpacing: 'var(--title-tracking)',
              }}
            >
              {info.name}
            </h1>
            <p className="mt-1 text-muted" style={{ fontSize: 'var(--fs-base)' }}>
              {info.inviterName || 'Someone'} invited you to{' '}
              {info.kind === 'mealPlan' ? 'share this meal plan.' : 'collaborate on this list.'}
            </p>
          </div>
          <button
            disabled={accept.isPending}
            onClick={() => accept.mutate({ token })}
            className="w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-60"
            style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
          >
            {accept.isPending ? 'Joining…' : 'Accept & join'}
          </button>
          <button className="text-muted" style={{ fontSize: 'var(--fs-sm)' }} onClick={goHome}>
            Not now
          </button>
        </>
      )}
    </div>
  );
}
