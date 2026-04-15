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
        // Dark mode base
        page: '#101822',
        surface: '#131d2e',
        elevated: '#1c2a3e',
        border: '#1c2a3c',
        // Text scale
        'text-primary': '#feffff',
        'text-secondary': '#d8dce8',
        'text-muted': '#b0b6cc',
        'text-dim': '#8890b0',
        'text-faint': '#6870a0',
        'text-subtle': '#2a3650',
        // Brand accents
        blue: { DEFAULT: '#2138ff', dark: '#1a2ecc', light: '#0c1640', mid: '#111d4a' },
        fulton: { DEFAULT: '#2d7a54', dark: '#1B4332', light: '#0d2518', gold: '#d9a033', 'gold-light': '#271c08' },
        // Status
        green: { DEFAULT: '#34d399', light: '#0b2819' },
        amber: { DEFAULT: '#fbbf24', light: '#281e08' },
        red: { DEFAULT: '#f87171', light: '#280d0d' },
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4' }],
        'xs': ['11px', { lineHeight: '1.5' }],
        'sm': ['12px', { lineHeight: '1.5' }],
        'base': ['13px', { lineHeight: '1.5' }],
        'lg': ['15px', { lineHeight: '1.4' }],
        'xl': ['18px', { lineHeight: '1.3' }],
        '2xl': ['22px', { lineHeight: '1.2' }],
        '3xl': ['28px', { lineHeight: '1.1' }],
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
