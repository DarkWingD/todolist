import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dansownsite.kitchenboard',
  appName: 'Kitchen Board',
  webDir: 'dist',
  android: {
    // The WebView is served from https://localhost rather than a custom scheme,
    // which keeps localStorage and the Web Crypto APIs on a secure origin.
    allowMixedContent: false,
  },
  plugins: {
    // Native surfaces don't follow data-mode, so the bar is set explicitly at
    // startup instead of inheriting the theme.
    StatusBar: { overlaysWebView: false },
  },
};

export default config;
