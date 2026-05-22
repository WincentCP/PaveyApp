/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Satoshi', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'Satoshi', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#7B8BFC',
          500: '#3B5BFF',
          600: '#2746F0',
          700: '#1E3AD6',
          800: '#1A30AD',
          900: '#172A8C',
        },
        ink: {
          900: '#0B1020',
          800: '#1A1F2E',
          700: '#2A3142',
          600: '#475067',
          500: '#697490',
          400: '#8E97AE',
          300: '#B7BECF',
          200: '#DDE2EC',
          100: '#EEF1F7',
          50: '#F6F8FC',
        },
      },
      boxShadow: {
        soft: '0 8px 24px -8px rgba(20, 30, 80, 0.12)',
        card: '0 12px 32px -12px rgba(20, 30, 80, 0.16)',
        glow: '0 12px 32px -8px rgba(59, 91, 255, 0.45)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(220px)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        pulseDot: 'pulseDot 2s ease-in-out infinite',
        bounceIn: 'bounceIn 420ms cubic-bezier(.34,1.56,.64,1)',
        floaty: 'floaty 3.5s ease-in-out infinite',
        scanLine: 'scanLine 1.6s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
