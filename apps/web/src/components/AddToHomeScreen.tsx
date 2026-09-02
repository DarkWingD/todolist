/**
 * Shown to iPhone and iPad instead of "your browser doesn't support this".
 *
 * Safari has done web push since iOS 16.4, but only for a site that has been
 * added to the Home Screen — in an ordinary tab the APIs simply aren't there.
 * So this is an instruction, not an apology: the three taps that fix it.
 */
export function AddToHomeScreen({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-d2 rounded-card bg-surface p-d3">
      <span className="font-bold" style={{ fontSize: 'var(--fs-base)' }}>
        Add to your Home Screen first
      </span>
      <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
        iPhones and iPads only allow notifications from apps on the Home Screen, not from a Safari
        tab.
      </span>
      <ol
        className="ml-4 list-decimal text-muted"
        style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.6 }}
      >
        <li>
          Tap <span className="font-semibold text-text">Share</span> at the bottom of Safari — the
          square with an arrow out of it.
        </li>
        <li>
          Choose <span className="font-semibold text-text">Add to Home Screen</span>, then{' '}
          <span className="font-semibold text-text">Add</span>.
        </li>
        <li>Open ToDoList from the new icon and turn notifications on there.</li>
      </ol>
      {!compact && (
        <span className="text-muted" style={{ fontSize: 'var(--fs-xs)' }}>
          It has to be Safari — Chrome and Firefox on iOS can’t add apps to the Home Screen.
        </span>
      )}
    </div>
  );
}
