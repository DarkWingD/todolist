// `navigator.share` is typed as always present but is missing on most desktop
// browsers, so this has to be a runtime check rather than a type assertion.
const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

/**
 * Send text wherever the browser can send it.
 *
 * On a phone that's the OS share sheet — the point being to text the list to
 * whoever is actually at the shops. A desktop browser has nowhere to share to,
 * so it falls back to the clipboard, which is still useful and never fails
 * silently.
 *
 * Returns what actually happened so the caller can say something true.
 */
export async function shareOrCopy(title: string, text: string): Promise<string> {
  if (canShare) {
    try {
      await navigator.share({ title, text });
      return 'Shared.';
    } catch {
      // A dismissed share sheet is a normal outcome, not a failure — fall
      // through to the clipboard rather than reporting an error.
    }
  }
  await navigator.clipboard.writeText(text);
  return 'Copied to the clipboard.';
}
