/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.js",
    "./components/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0f1419',
        surface: '#1a2332',
        surfaceHover: '#232f42',
        border: '#2a3548',
        text: '#e8ecf1',
        textMuted: '#8b96a8',
        accent: 'var(--accent, #ff6b1a)',
        accentHover: 'var(--accent-hover, #ff8433)',
        accentMuted: 'var(--accent-muted, #ff6b1a1a)',
        win: '#3ecf8e',
        loss: '#ef4a4a',
      },
      fontFamily: {
        display: ['Archivo Black', 'Arial Black', 'Helvetica Neue', 'sans-serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
