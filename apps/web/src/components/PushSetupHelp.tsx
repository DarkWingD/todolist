import type { ReactNode } from 'react';
import type { PushBlocker } from '../lib/push';

/**
 * Shown when notifications can't be switched on *here*, but could be somewhere
 * one or two taps away.
 *
 * Each variant exists because "this browser doesn't support notifications" was
 * true and useless in that situation:
 *
 * - iOS Safari has done web push since 16.4, but only for a site added to the
 *   Home Screen — in a tab the APIs simply aren't there.
 * - Other iOS browsers can't install a site at all, so their first step is
 *   switching to Safari. They get their own variant rather than the Safari
 *   steps with a caveat appended, which lands where people skip.
 * - Android in-app browsers (opened from Facebook, WhatsApp, a mail app) have
 *   no service workers, but Chrome is in the overflow menu.
 */
function Strong({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-text">{children}</span>;
}

const COPY: Record<string, { title: string; blurb: string; steps: ReactNode[] }> = {
  'ios-needs-install': {
    title: 'Add to your Home Screen first',
    blurb:
      'iPhones and iPads only allow notifications from apps on the Home Screen, not from a browser tab.',
    steps: [
      <>
        Tap <Strong>Share</Strong> — the square with an arrow coming out of it.
      </>,
      <>
        Choose <Strong>Add to Home Screen</Strong>, then <Strong>Add</Strong>.
      </>,
      <>Open ToDoList from the new icon, and turn notifications on there.</>,
    ],
  },
  'ios-needs-safari': {
    title: 'Open this in Safari first',
    blurb:
      'iPhones and iPads only allow notifications from apps on the Home Screen, and Safari is the only browser that can put one there.',
    steps: [
      <>
        Open <Strong>todolist.dansownsite.com</Strong> in Safari.
      </>,
      <>
        Tap <Strong>Share</Strong> — the square with an arrow coming out of it.
      </>,
      <>
        Choose <Strong>Add to Home Screen</Strong>, then <Strong>Add</Strong>.
      </>,
      <>Open ToDoList from the new icon, and turn notifications on there.</>,
    ],
  },
  'android-needs-chrome': {
    title: 'Open this in Chrome first',
    blurb:
      "You're in an app's built-in browser, which can't do notifications. Chrome can, and it's one tap away.",
    steps: [
      <>
        Tap <Strong>⋮</Strong> in the corner, then <Strong>Open in Chrome</Strong> (some apps say{' '}
        <Strong>Open in browser</Strong>).
      </>,
      <>Sign in there, and turn notifications on.</>,
      <>
        Worth adding to your Home Screen too, from the same <Strong>⋮</Strong> menu.
      </>,
    ],
  },
};

export function PushSetupHelp({ blocker }: { blocker: PushBlocker }) {
  const copy = COPY[blocker];
  if (!copy) return null;
  return (
    <div className="flex flex-col gap-d2 rounded-card bg-surface p-d3">
      <span className="font-bold" style={{ fontSize: 'var(--fs-base)' }}>
        {copy.title}
      </span>
      <span className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
        {copy.blurb}
      </span>
      <ol
        className="ml-4 list-decimal text-muted"
        style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.55 }}
      >
        {copy.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
