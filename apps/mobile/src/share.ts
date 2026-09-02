/**
 * Getting things off the device.
 *
 * Same shape as the data adapters, and for the same reason: the screens
 * shouldn't know which platform they're on. In a browser a file is a download
 * and text goes to the clipboard; on Android neither works — a WebView blocks
 * page-initiated downloads — so the native build swaps in Filesystem + Share and
 * hands the file to the OS share sheet, which is better anyway: it reaches
 * Drive, email or a message thread directly.
 *
 * Note the asymmetry with import: `<input type="file">` is NOT blocked on
 * Android. Capacitor's bridge implements the file chooser, so picking a backup
 * needs no plugin at all.
 */
export interface SharePort {
  /** Offer a file to wherever the platform sends files. */
  saveFile(name: string, mimeType: string, contents: string): Promise<void>;
  /** Offer text to wherever the platform sends text. */
  shareText(title: string, text: string): Promise<void>;
  /** What actually happened, so the UI can say something true. */
  describe: { file: string; text: string };
}

// `navigator.share` is typed as always present but is absent on most desktop
// browsers, so this has to be a runtime feature check.
const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

export const webShare: SharePort = {
  saveFile: async (name, mimeType, contents) => {
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  },
  shareText: async (title, text) => {
    // The Web Share API where it exists (most mobile browsers), clipboard
    // otherwise — a desktop browser has nowhere to share to.
    if (canShare) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (err) {
        // A cancelled share sheet is a normal outcome, not a failure.
        if ((err as Error).name === 'AbortError') return;
      }
    }
    await navigator.clipboard.writeText(text);
  },
  describe: {
    file: 'Downloaded.',
    text: canShare ? 'Shared.' : 'Copied to the clipboard.',
  },
};
