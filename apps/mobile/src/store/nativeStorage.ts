import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { StoragePort } from './persistence';

/**
 * The document as a real file on the device.
 *
 * `Directory.Data` is app-private storage: it isn't visible in the gallery or to
 * other apps, and Android removes it when the app is uninstalled. That is the
 * right trade for a local-first app — nothing leaks, and the file is only ever
 * ours — but it does mean uninstalling loses everything, which is exactly why
 * Export exists.
 */
const FILE = 'kitchen-board.json';

export const nativeStorage: StoragePort = {
  load: async () => {
    try {
      const { data } = await Filesystem.readFile({
        path: FILE,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      return typeof data === 'string' ? data : null;
    } catch {
      // First launch, or the file was removed. Not an error worth surfacing.
      return null;
    }
  },
  save: async (text) => {
    try {
      await Filesystem.writeFile({
        path: FILE,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        data: text,
      });
    } catch (err) {
      // A failed write shouldn't take the app down — the in-memory copy is
      // still correct for this session.
      console.error('Could not save:', err);
    }
  },
};
