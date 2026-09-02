import type { Config } from 'tailwindcss';
import { kitchenPreset } from '@todolist/kitchen-ui/tailwind-preset';

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Without this the shared screens render unstyled — Tailwind won't scan
    // outside the app, and the purge is silent.
    '../../packages/kitchen-ui/src/**/*.{ts,tsx}',
  ],
  presets: [kitchenPreset],
  plugins: [],
} satisfies Config;
