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
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4', // Tertiary Cyan Accent
          600: '#0891b2', // Primary Medical Teal (from Dactor Android App)
          700: '#0e7490',
          800: '#155e75',
          900: '#0c4a6e', // Secondary Deep Medical Navy (from Dactor Android App)
          950: '#082f49',
        },
        dactor: {
          primary: '#0891b2',
          navy: '#0c4a6e',
          cyan: '#06b6d4',
          bg: '#f8fafc',
          green: '#059669',
          greenBg: '#ecfdf5',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
