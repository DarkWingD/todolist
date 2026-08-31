import { useState, type FormEvent } from 'react';
import { signIn } from '../lib/auth';

export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError('');
    const { error } = await signIn.magicLink({ email, callbackURL: '/' });
    if (error) {
      setError(error.message ?? 'Something went wrong.');
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col items-center justify-center gap-6 px-8">
      <div className="text-center">
        <div
          className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-emoji text-3xl"
          style={{ background: 'var(--color-accent-soft)' }}
        >
          ✓
        </div>
        <h1
          className="font-head"
          style={{ fontSize: 'var(--fs-big)', fontWeight: 'var(--title-weight)', letterSpacing: 'var(--title-tracking)' }}
        >
          ToDoList
        </h1>
        <p className="mt-1 text-muted" style={{ fontSize: 'var(--fs-base)' }}>
          Sign in with a magic link — no password.
        </p>
      </div>

      {status === 'sent' ? (
        <div className="w-full rounded-card bg-surface p-5 text-center shadow-card">
          <div className="mb-1 text-2xl">📬</div>
          <p style={{ fontSize: 'var(--fs-base)' }}>
            Check <strong>{email}</strong> for your sign-in link.
          </p>
          <button
            className="mt-3 font-semibold text-accent"
            style={{ fontSize: 'var(--fs-sm)' }}
            onClick={() => setStatus('idle')}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-card border border-border bg-surface px-4 py-3 outline-none"
            style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)' }}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-card py-3 font-bold text-accent-contrast disabled:opacity-60"
            style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
          {status === 'error' && (
            <p className="text-center text-danger" style={{ fontSize: 'var(--fs-sm)' }}>
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
