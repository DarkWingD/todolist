import webpush from 'web-push';
import { env } from './env.js';

let configured = false;

export function pushEnabled(): boolean {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

function ensureConfigured() {
  if (!configured && pushEnabled()) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
    configured = true;
  }
}

export interface Sub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Returns 'gone' if the subscription is expired/invalid so the caller can prune it. */
export async function sendPush(sub: Sub, payload: unknown): Promise<'ok' | 'gone' | 'error'> {
  if (!pushEnabled()) return 'error';
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return 'ok';
  } catch (err) {
    const code = (err as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) return 'gone';
    console.error('Push send failed:', code, (err as { body?: string }).body);
    return 'error';
  }
}
