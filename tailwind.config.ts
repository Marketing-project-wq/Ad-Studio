import type { Config } from 'tailwindcss';

/**
 * Tailwind is wired to the 20FIT Design System v1.0 tokens (declared as CSS
 * variables in app/globals.css). Utilities reference those vars so both the
 * ported component CSS and any Tailwind utilities stay in sync across
 * light/dark mode.
 */
const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        red: 'var(--red)',
        blue: 'var(--blue)',
        amber: 'var(--amber)',
        green: 'var(--green)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        data: 'var(--font-data)',
        body: 'var(--font-body)',
      },
      borderRadius: {
        card: 'var(--radius)',
        sm: 'var(--radius-sm)',
      },
    },
  },
  plugins: [],
};

export default config;
