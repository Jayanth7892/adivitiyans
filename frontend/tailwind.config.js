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
        background:  'var(--color-background)',
        surface:     'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        borderLine:  'var(--color-borderLine)',
        borderStrong:'var(--color-borderStrong)',

        brand: {
          primary: 'var(--color-brand-primary)',
          hover:   'var(--color-brand-hover)',
          soft:    'var(--color-brand-soft)',
          subtle:  'var(--color-brand-subtle)',
          accent:  '#F97316',
        },

        success: {
          DEFAULT: 'var(--color-success)',
          soft:    'var(--color-success-soft)',
        },
        alert: {
          DEFAULT: 'var(--color-alert)',
          soft:    'var(--color-alert-soft)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          soft:    'var(--color-warning-soft)',
        },

        textPrimary:   'var(--color-textPrimary)',
        textSecondary: 'var(--color-textSecondary)',
        textMuted:     'var(--color-textMuted)',
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },

      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },

      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },

      boxShadow: {
        xs:    'var(--shadow-xs)',
        sm:    'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md:    'var(--shadow-md)',
        lg:    'var(--shadow-lg)',
        xl:    'var(--shadow-xl)',
        brand: 'var(--shadow-brand)',
      },

      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
      },

      letterSpacing: {
        widest: '0.15em',
      },
    },
  },
  plugins: [],
}
