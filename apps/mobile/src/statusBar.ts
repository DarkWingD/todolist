import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Match the native status bar to the active theme.
 *
 * It sits outside the WebView, so `data-mode` means nothing to it. Left alone,
 * a dark theme gets dark icons on a dark bar and the top of the screen goes
 * unreadable.
 *
 * `Style` names the background it is meant for, not the content it produces:
 * `Style.Dark` is light text for a dark background, `Style.Light` is dark text
 * for a light one. So the mode maps straight through. Reading the names as
 * describing the text inverts it, which is how this shipped backwards once.
 */
export async function syncStatusBar(mode: 'light' | 'dark'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: mode === 'dark' ? Style.Dark : Style.Light });
    // Read the theme's own background rather than hardcoding, so the bar
    // follows Tento/Nudge/Momentum as well as light/dark.
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
    if (bg.startsWith('#')) await StatusBar.setBackgroundColor({ color: bg });
  } catch {
    // Not every Android version allows setting the bar colour; the app is
    // perfectly usable without it.
  }
}
