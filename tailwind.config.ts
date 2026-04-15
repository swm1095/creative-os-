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
        blue: { DEFAULT: '#2B4EFF', light: '#e8ecff', mid: '#c0caff' },
        green: { DEFAULT: '#00a86b', light: '#e6f7f1' },
        amber: { DEFAULT: '#d97706', light: '#fef3c7' },
        red: { DEFAULT: '#dc2626', light: '#fef2f2' },
        gray: {
          50: '#f8f8f8',
          100: '#f2f2f2',
          300: '#c8c8c8',
          500: '#6b6b6b',
          700: '#3a3a3a',
        },
        border: '#e8e8e8',
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
}

export default config
