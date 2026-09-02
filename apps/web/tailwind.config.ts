import type { Config } from 'tailwindcss';
import { kitchenPreset } from '@todolist/kitchen-ui/tailwind-preset';

/**
 * Tokens come from the shared kitchenPreset so both apps map Tailwind names
 * onto the same CSS variables. A drifted copy would purge silently.
 */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // The shared package lives outside this app, and Tailwind will not scan it
    // otherwise — every gap-d3 and rounded-card would purge with no error.
    '../../packages/kitchen-ui/src/**/*.{ts,tsx}',
  ],
  presets: [kitchenPreset],
  plugins: [],
} satisfies Config;
