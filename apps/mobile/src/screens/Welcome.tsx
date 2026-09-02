/**
 * Shown once, on first launch.
 *
 * Its job is to answer "where does my data go?" before anyone types anything —
 * a local-first app is unusual enough that saying so plainly is worth a screen.
 * It doubles as the honest version of what the Play Store listing claims.
 */
function Point({ icon, title, children }: { icon: string; title: string; children: string }) {
  return (
    <div className="flex gap-d3">
      <span className="flex-none" style={{ fontSize: 22, lineHeight: 1.2 }} aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="block font-bold" style={{ fontSize: 'var(--fs-base)' }}>
          {title}
        </span>
        <span className="block text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          {children}
        </span>
      </span>
    </div>
  );
}

export function Welcome({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col justify-between px-d4 py-d5">
      <div className="flex flex-1 flex-col justify-center gap-d5">
        <div>
          <h1
            className="font-head"
            style={{
              fontSize: 'var(--fs-big)',
              fontWeight: 'var(--title-weight)',
              letterSpacing: 'var(--title-tracking)',
            }}
          >
            Kitchen Board
          </h1>
          <p className="mt-1 text-muted" style={{ fontSize: 'var(--fs-base)' }}>
            Plan the week's dinners, then shop for them.
          </p>
        </div>

        <div className="flex flex-col gap-d4">
          <Point icon="🔒" title="Everything stays on this phone">
            No account, no sign-in, no server. Your meals and lists are never sent anywhere, and
            nothing is collected.
          </Point>
          <Point icon="✈️" title="Works with no signal">
            Nothing here needs the internet, which is handy in a supermarket.
          </Point>
          <Point icon="📤" title="Export to back up or move phones">
            Settings → Export saves a file you can keep or send. Import brings it back. That file is
            the only way your data leaves the device.
          </Point>
          <Point icon="🗑" title="Uninstalling deletes it">
            Because it's only ever on this phone, removing the app removes the data with it. Export
            first if you want to keep it.
          </Point>
        </div>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="w-full rounded-full py-3 font-bold text-accent-contrast"
        style={{ background: 'var(--color-accent)', fontSize: 'var(--fs-base)' }}
      >
        Get started
      </button>
    </div>
  );
}
