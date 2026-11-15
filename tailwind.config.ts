/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f7f7f7',
          100: '#eeeeee',
          200: '#dddddd',
          300: '#bebebe',
          400: '#828282',
          500: 'var(--action)',
          600: 'var(--action-hover)',
          700: 'var(--fg)',
        },
      },
    },
  },
  plugins: [],
};
