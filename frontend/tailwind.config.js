/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#111111',
          light: '#1a1a1a',
          lighter: '#222222',
        },
        accent: {
          DEFAULT: '#31929A',
          hover: '#3BA9B0',
          muted: '#1F5C61',
        },
        muted: '#888888',
        border: '#27272a',
        'text-primary': '#ebebeb',
        danger: '#f85149',
        success: '#3fb950',
        warning: '#f0a030',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
