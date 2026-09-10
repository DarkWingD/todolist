import { useEffect } from 'react';

/**
 * A stack of things Back should close before it navigates.
 *
 * On a phone, Back is the gesture people reach for to dismiss whatever is in
 * front of them — and in an installed PWA there is no browser chrome to fall
 * back on, so a Back that isn't handled leaves the app entirely. Sheets and
 * other overlays register here while they are open; the shell asks this first
 * and only moves through its own history if nothing wanted the press.
 *
 * Registration is last-in-first-out, so nested overlays close from the top.
 */

let stack: { id: number; close: () => void }[] = [];
let seq = 0;

/** Close the topmost overlay, if there is one. True if the press was used. */
export function closeTopOverlay(): boolean {
  const top = stack.pop();
  if (!top) return false;
  top.close();
  return true;
}

export function overlayDepth(): number {
  return stack.length;
}

/** Register `close` as the Back action while `open`. */
export function useCloseOnBack(open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    const id = ++seq;
    stack.push({ id, close });
    return () => {
      stack = stack.filter((h) => h.id !== id);
    };
  }, [open, close]);
}
