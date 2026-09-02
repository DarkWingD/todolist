import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // Let server routes (auth verify, tRPC, etc.) bypass the SPA nav fallback —
        // otherwise the service worker serves index.html for /api/auth/... and
        // magic-link sign-in silently never runs.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Add web-push handlers to the generated SW without a full custom SW.
        importScripts: ['/push-handler.js'],
      },
      manifest: {
        name: 'ToDoList',
        short_name: 'ToDoList',
        description: 'A calm, collaborative to-do app and weekly meal planner.',
        theme_color: '#FF6B5E',
        background_color: '#FFF9F5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_URL ?? 'http://localhost:8787', changeOrigin: true },
    },
  },
});
