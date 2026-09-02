import { Capacitor } from '@capacitor/core';
import { nativeShare } from './nativeShare';
import { webShare, type SharePort } from './share';
import { nativeStorage } from './store/nativeStorage';
import { webStorage, type StoragePort } from './store/persistence';

/**
 * The one place that asks what platform this is.
 *
 * Everything else takes a port, so no screen contains `if (isNative)`. Note the
 * asymmetry: import needs nothing native, because `<input type="file">` opens
 * the real Android picker through Capacitor's bridge — only writing out is
 * blocked in a WebView.
 */
export const isNative = Capacitor.isNativePlatform();

export const storage: StoragePort = isNative ? nativeStorage : webStorage;
export const share: SharePort = isNative ? nativeShare : webShare;
