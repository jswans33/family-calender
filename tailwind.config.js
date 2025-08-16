/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        calendar: {
          today: '#fef3c7',
          'today-border': '#f59e0b',
          'out-month': '#f3f4f6',
          'event-bg': '#dbeafe',
          'event-text': '#1e40af',
          overflow: '#ef4444',
        },
      },
      gridTemplateColumns: {
        7: 'repeat(7, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
};
