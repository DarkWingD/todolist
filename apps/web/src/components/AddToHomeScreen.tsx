import type { ReactNode } from 'react';

/**
 * Shown to iPhone and iPad instead of "your browser doesn't support this".
 *
 * Safari has done web push since iOS 16.4, but only for a site that has been
 * added to the Home Screen — in an ordinary tab the APIs simply aren't there.
 * So this is an instruction, not an apology.
 *
 * Two variants, because the first step differs: only Safari can install a site,
 * so Chrome, Firefox and in-app browsers have to switch before any of the rest
 * applies. Giving everyone the Safari steps with "unless you're not in Safari"
 * appended puts the one thing blocking them in the place people skip.
 */
function Strong({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-text">{children}</span>;
}

export function AddToHomeScreen({ needsSafari = false }: { needsSafari?: boolean }) {
  return (
    <div className="flex flex-col gap-d2 rounded-card bg-surface p-d3">
      <span className="font-bold" style={{ fontSize: 'var(--fs-base)' }}>
        {needsSafari ? 'Open this in Safari first' : 'Add to your Home Screen first'}
      </span>
      <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
        {needsSafari
          ? 'iPhones and iPads only allow notifications from apps on the Home Screen, and Safari is the only browser that can put one there.'
          : 'iPhones and iPads only allow notifications from apps on the Home Screen, not from a browser tab.'}
      </span>
      <ol
        className="ml-4 list-decimal text-muted"
        style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.55 }}
      >
        {needsSafari && (
          <li>
            Open <Strong>todolist.dansownsite.com</Strong> in Safari.
          </li>
        )}
        <li>
          Tap <Strong>Share</Strong> — the square with an arrow coming out of it.
        </li>
        <li>
          Choose <Strong>Add to Home Screen</Strong>, then <Strong>Add</Strong>.
        </li>
        <li>Open ToDoList from the new icon, and turn notifications on there.</li>
      </ol>
    </div>
  );
}
