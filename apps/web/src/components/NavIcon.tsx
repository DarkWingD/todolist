import type { TabId } from './AppShell';

/**
 * The five tab-bar marks, drawn rather than pulled from an icon set — at this
 * count a dependency would cost more than it saves.
 *
 * All on a 24px grid with `stroke="currentColor"`, so the active tab's
 * `text-accent` tints the icon and its label together. That is the thing emoji
 * could not do: they carry their own colour, so the active state had to be
 * faked with a pill behind them.
 */
const PATHS: Record<TabId, JSX.Element> = {
  // A sun, not a calendar — Today is "now", and the grid belongs to Cal.
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2.5 12h2M19.5 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </>
  ),
  lists: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </>
  ),
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" />
    </>
  ),
  // Fork and knife: unambiguous at 24px, and it reads as a meal rather than food.
  meals: (
    <>
      <path d="M7 3.5v7a2.5 2.5 0 0 0 5 0v-7" />
      <path d="M9.5 3.5v17" />
      <path d="M17 3.5c1.5 1.5 1.8 4 1.4 6.2-.2 1-.9 1.6-1.9 1.6H16v9.2" />
    </>
  ),
  you: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0" />
    </>
  ),
};

export function NavIcon({ tab }: { tab: TabId }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[tab]}
    </svg>
  );
}
