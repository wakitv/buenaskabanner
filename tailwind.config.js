/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        buenas: {
          orange: '#FF6B1A',
          yellow: '#FFC629',
          red: '#E8302A',
          black: '#0E0E10',
          ink: '#1A1A1E',
          panel: '#232328',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
