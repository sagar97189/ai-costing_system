/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0A0A0F',
          surface: '#111118',
          elevated: '#1A1A24',
          indigo: '#6366F1',
          violet: '#8B5CF6',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          info: '#3B82F6',
        },
        ice: {
          950: '#06111f',
          900: '#0a1628',
          800: '#122238',
          200: '#dbe8f4',
        },
        powder: '#f5fbff',
        signal: '#98f5ff',
        sunset: '#f56f46',
        gear: '#d7ff63',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        anton: ['Anton', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        serif: ['"Instrument Serif"', 'serif'],
      },
      backgroundImage: {
        'dotted-tech': `
          radial-gradient(circle, rgba(245, 251, 255, 0.08) 1px, transparent 1.4px),
          radial-gradient(circle at top, rgba(124, 170, 255, 0.12), transparent 30%),
          linear-gradient(180deg, #07111f 0%, #091426 22%, #08101b 100%)
        `,
      },
      backgroundSize: {
        'dotted-tech': '14px 14px, 100% 100%, 100% 100%',
      }
    },
  },
  plugins: [],
}
