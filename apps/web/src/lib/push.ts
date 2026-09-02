export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export interface SerializedSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function serialize(sub: PushSubscription): SerializedSub {
  const json = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' };
}

export async function getSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Requests permission and subscribes; returns the serialized subscription or null. */
export async function subscribePush(vapidPublicKey: string): Promise<SerializedSub | null> {
  if (!pushSupported()) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
  return serialize(sub);
}

/** Unsubscribes locally and returns the endpoint (to tell the server), or null. */
export async function unsubscribePush(): Promise<string | null> {
  const sub = await getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

/**
 * iPadOS 13+ reports itself as a Mac, so the user-agent alone is not enough —
 * a touch-capable "Mac" is an iPad.
 */
function isApplePhoneOrTablet(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  // Safari's own flag; the media query is what every other browser answers to.
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
}

/**
 * Whether this is Safari, given we already know it's an iPhone or iPad.
 *
 * Every iOS browser renders with WebKit, but only Safari can add a site to the
 * Home Screen — so Chrome and Firefox users need a different first step, not
 * the same instructions with a footnote they'll skip.
 *
 * Detected by exclusion rather than by looking for "Safari", because every one
 * of these carries the Safari token too. The second test catches in-app
 * browsers (Facebook, Instagram, Gmail), which drop the token entirely and
 * can't install anything either.
 */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|YaBrowser|Coast|mercury/i.test(ua)) return false;
  return /Safari\//.test(ua);
}

/**
 * An Android in-app browser — the WebView you land in when you open a link
 * from Facebook, Instagram, WhatsApp or a mail app.
 *
 * It supports no service workers at all, so push is genuinely absent, but the
 * fix is one menu tap: open the page in Chrome. `wv` is the WebView's own
 * marker; the app tokens catch the ones that omit it.
 */
function isAndroidInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  if (!/Android/.test(ua)) return false;
  return /; wv\)|FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|MicroMessenger|GSA\//i.test(ua);
}

export type PushBlocker =
  'none' | 'ios-needs-install' | 'ios-needs-safari' | 'android-needs-chrome' | 'unsupported';

/**
 * Why push can't be offered, when it can't.
 *
 * The point of the extra cases is that "this browser doesn't support
 * notifications" is usually true and useless. iOS *does* support web push, but
 * only once the site is on the Home Screen; an Android in-app browser doesn't,
 * but Chrome one tap away does. Only what's left is a real dead end.
 */
export function pushBlocker(): PushBlocker {
  if (pushSupported()) return 'none';
  if (isApplePhoneOrTablet() && !isInstalled()) {
    return isIosSafari() ? 'ios-needs-install' : 'ios-needs-safari';
  }
  if (isAndroidInAppBrowser()) return 'android-needs-chrome';
  return 'unsupported';
}
