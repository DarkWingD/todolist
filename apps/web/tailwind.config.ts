import type { Config } from 'tailwindcss';

/**
 * Colors, radii, and fonts all resolve to the CSS variables defined in
 * styles/themes.css, so utilities like `bg-surface` or `text-accent`
 * automatically reflect the active theme + light/dark.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        'accent-contrast': 'var(--color-accent-contrast)',
        'accent-soft': 'var(--color-accent-soft)',
        border: 'var(--color-border)',
        track: 'var(--color-track)',
        'chip-bg': 'var(--color-chip-bg)',
        'emoji-bg': 'var(--color-emoji-bg)',
        danger: 'var(--color-danger)',
        'danger-soft': 'var(--color-danger-soft)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        check: 'var(--radius-check)',
        emoji: 'var(--radius-emoji)',
        fab: 'var(--radius-fab)',
      },
      fontFamily: {
        head: 'var(--font-head)',
        body: 'var(--font-body)',
      },
      fontSize: {
        xs: 'var(--fs-xs)',
        sm: 'var(--fs-sm)',
        base: 'var(--fs-base)',
        lg: 'var(--fs-lg)',
        title: 'var(--fs-title)',
        big: 'var(--fs-big)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      spacing: {
        d1: 'var(--space-1)',
        d2: 'var(--space-2)',
        d3: 'var(--space-3)',
        d4: 'var(--space-4)',
        d5: 'var(--space-5)',
      },
    },
  },
  plugins: [],
} satisfies Config;
