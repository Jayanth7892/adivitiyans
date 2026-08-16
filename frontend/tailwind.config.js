/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        borderLine: 'var(--color-borderLine)',
        brand: {
          primary: 'var(--color-brand-primary)',
          soft: 'var(--color-brand-soft)',
          accent: '#F97316', // warm orange-red logo accent
        },
        success: {
          DEFAULT: '#16A34A',
          soft: 'var(--color-success-soft)',
        },
        alert: {
          DEFAULT: '#DC2626',
          soft: 'var(--color-alert-soft)',
        },
        textPrimary: 'var(--color-textPrimary)',
        textSecondary: 'var(--color-textSecondary)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}
