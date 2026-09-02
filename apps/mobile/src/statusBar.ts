import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Match the native status bar to the active theme.
 *
 * It sits outside the WebView, so `data-mode` means nothing to it. Left alone,
 * a dark theme gets dark icons on a dark bar and the top of the screen goes
 * unreadable.
 *
 * `Style.Light` means *light content* — light icons for a dark background —
 * which reads backwards until you know it.
 */
export async function syncStatusBar(mode: 'light' | 'dark'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: mode === 'dark' ? Style.Light : Style.Dark });
    // Read the theme's own background rather than hardcoding, so the bar
    // follows Tento/Nudge/Momentum as well as light/dark.
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
    if (bg.startsWith('#')) await StatusBar.setBackgroundColor({ color: bg });
  } catch {
    // Not every Android version allows setting the bar colour; the app is
    // perfectly usable without it.
  }
}
