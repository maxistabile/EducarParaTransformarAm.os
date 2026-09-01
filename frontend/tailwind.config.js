/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        purple: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#5B35C5',
          800: '#4c1d95',
          900: '#3730a3',
          950: '#312e81',
        },
        purpleLight: '#EEE9FF',
        purpleDark: '#3D2092',
        purpleMid: '#7B55E8',
        white: '#FFFFFF',
        bg: '#F5F4FB',
        text: '#1A1A2E',
        textMuted: '#6B6B8A',
        border: '#E8E6F5',
        green: '#27AE60',
        orange: '#E67E22',
        red: '#E74C3C',
        blue: '#2980B9',
        pink: '#E91E8C',
      },
      fontFamily: {
        sans: ['Nunito', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 16px rgba(91,53,197,0.06)',
        'card-hover': '0 6px 24px rgba(91,53,197,0.12)',
      },
      borderRadius: {
        'card': '16px',
        'input': '10px',
        'btn': '10px',
      },
    },
  },
  plugins: [],
}