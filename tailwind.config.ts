import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Themed via CSS variables (light default + dark override in globals.css)
        page: 'var(--c-page)',
        surface: 'var(--c-surface)',
        elevated: 'var(--c-elevated)',
        border: 'var(--c-border)',
        // Text scale
        'text-primary': 'var(--c-text-primary)',
        'text-secondary': 'var(--c-text-secondary)',
        'text-muted': 'var(--c-text-muted)',
        'text-dim': 'var(--c-text-dim)',
        'text-faint': 'var(--c-text-faint)',
        'text-subtle': 'var(--c-text-subtle)',
        // Unified Hype10 blue accent (blue + legacy fulton both point here)
        blue: { DEFAULT: 'var(--c-accent)', dark: 'var(--c-accent-hover)', light: 'var(--c-accent-light)', mid: 'var(--c-accent-mid)' },
        hype: { DEFAULT: 'var(--c-accent)', glow: 'var(--c-accent-glow)' },
        fulton: { DEFAULT: 'var(--c-accent)', dark: 'var(--c-accent-hover)', light: 'var(--c-accent-light)', gold: 'var(--c-gold)', 'gold-light': 'var(--c-gold-light)' },
        // Status
        green: { DEFAULT: 'var(--c-ok)', light: 'var(--c-ok-light)' },
        amber: { DEFAULT: 'var(--c-warn)', light: 'var(--c-warn-light)' },
        red: { DEFAULT: 'var(--c-bad)', light: 'var(--c-bad-light)' },
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.4' }],
        'xs': ['12px', { lineHeight: '1.5' }],
        'sm': ['13.5px', { lineHeight: '1.5' }],
        'base': ['14.5px', { lineHeight: '1.55' }],
        'lg': ['17px', { lineHeight: '1.4' }],
        'xl': ['20px', { lineHeight: '1.3' }],
        '2xl': ['24px', { lineHeight: '1.2' }],
        '3xl': ['30px', { lineHeight: '1.1' }],
      },
      spacing: {
        'sidebar': '220px',
      },
      borderRadius: {
        DEFAULT: '8px',
        'lg': '12px',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        toastIn: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease',
        toastIn: 'toastIn 0.3s ease',
      },
    },
  },
  plugins: [],
}

export default config
