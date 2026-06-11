/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#E8EDF4',
          100: '#C5D0E3',
          200: '#9BAFC9',
          300: '#708DAF',
          400: '#4F739B',
          500: '#2E5987',
          600: '#274C75',
          700: '#1E3C5E',
          800: '#162D48',
          900: '#0F2137',
          950: '#091524',
        },
        gold: {
          50: '#FBF6E9',
          100: '#F5E9C5',
          200: '#EDDA9D',
          300: '#E5CA74',
          400: '#DFBE55',
          500: '#C9A84C',
          600: '#B08E3F',
          700: '#8E6F30',
          800: '#6D5424',
          900: '#533F1B',
        },
        surface: {
          DEFAULT: '#F8F7F4',
          50: '#FFFFFF',
          100: '#FDFCFA',
          200: '#F8F7F4',
          300: '#EEECE6',
          400: '#E3E0D8',
        },
        success: {
          DEFAULT: '#2D9E6B',
          light: '#D4F5E3',
          dark: '#1B7A4E',
        },
        danger: {
          DEFAULT: '#E05252',
          light: '#FDE8E8',
          dark: '#B83E3E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 33, 55, 0.08), 0 4px 12px rgba(15, 33, 55, 0.04)',
        'card-hover': '0 4px 16px rgba(15, 33, 55, 0.12), 0 8px 24px rgba(15, 33, 55, 0.06)',
        nav: '0 -1px 12px rgba(15, 33, 55, 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'count-up': 'countUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.4)', opacity: '0.7' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
