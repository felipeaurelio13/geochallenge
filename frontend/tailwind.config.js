/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--color-bg-app)',
          shell: 'var(--color-bg-shell)',
          surface: 'var(--color-surface)',
          muted: 'var(--color-surface-muted)',
          border: 'var(--color-border)',
          text: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          subtle: 'var(--color-text-muted)',
        },
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
          DEFAULT: 'var(--color-primary-500)',
        },
        success: {
          500: 'var(--color-success-500)',
          600: 'var(--color-success-600)',
        },
        warning: {
          500: 'var(--color-warning-500)',
        },
        error: {
          500: 'var(--color-error-500)',
          600: 'var(--color-error-600)',
        },
      },
      spacing: {
        0.5: 'var(--space-0_5)',
        1.5: 'var(--space-1_5)',
        2.5: 'var(--space-2_5)',
        3.5: 'var(--space-3_5)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        'glow-primary': 'var(--shadow-glow-primary)',
      },
      screens: {
        xs: '30rem',
        sm: '40rem',
        md: '48rem',
        lg: '64rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
    },
  },
  plugins: [],
};
