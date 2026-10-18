/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        danger: '#dc2626',
        warning: '#f59e0b',
        success: '#10b981',
        info: '#3b82f6',
        dark: '#0f172a',
        darker: '#020617',
        light: '#f8fafc',
      }
    },
  },
  plugins: [],
}
