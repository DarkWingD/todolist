/**
 * Where the document is kept between launches.
 *
 * A port, like everything else that touches a platform: the browser keeps it in
 * localStorage, and the native build will write a real file with
 * `@capacitor/filesystem`. Both store the same single JSON document, which is
 * also exactly what Export hands you — a backup and the live data cannot drift
 * apart, because they are the same bytes.
 *
 * Writes are async and may fail (private mode, cleared site data, a WebView with
 * storage switched off). Losing a write must never take the app down with it —
 * you carry on shopping, you just lose the session.
 */
export interface StoragePort {
  load(): Promise<string | null>;
  save(text: string): Promise<void>;
}

const KEY = 'kitchenboard.store';

export const webStorage: StoragePort = {
  load: async () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  save: async (text) => {
    try {
      localStorage.setItem(KEY, text);
    } catch {
      // Quota, private mode, blocked storage. Nothing useful to do here — the
      // in-memory copy is still correct for this session.
    }
  },
};
