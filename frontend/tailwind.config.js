/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F7F8FA',
        surface: '#FFFFFF',
        borderLine: '#EAECEF',
        brand: {
          primary: '#5B4FE9',
          soft: '#EEF0FE',
          accent: '#F97316', // warm orange-red logo accent
        },
        success: {
          DEFAULT: '#16A34A',
          soft: '#E7F8EE',
        },
        alert: {
          DEFAULT: '#DC2626',
          soft: '#FDECEC',
        },
        textPrimary: '#111827',
        textSecondary: '#6B7280',
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
