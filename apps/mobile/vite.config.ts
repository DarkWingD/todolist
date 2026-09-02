import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Relative, so the built assets resolve under Capacitor's scheme rather than
  // from the root of a web server. No VitePWA here: a service worker inside a
  // WebView is redundant at best and delays first paint at worst.
  base: './',
  server: { port: 5174 },
});
