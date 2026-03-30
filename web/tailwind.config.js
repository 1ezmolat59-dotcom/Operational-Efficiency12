/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        coral: {
          50: '#fff5f5',
          100: '#fed7d7',
          500: '#fc5c65',
          600: '#e53e3e',
        },
        teal: {
          brand: '#0d9488',
        }
      }
    },
  },
  plugins: [],
}
