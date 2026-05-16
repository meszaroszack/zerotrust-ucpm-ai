/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0B5FFF',
          secondary: '#0F172A',
          accent: '#14B8A6',
          gold: '#D4A72C',
          success: '#15803D',
          warning: '#B45309',
          error: '#B91C1C',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#0F172A',
        },
        bg: {
          light: '#F8FAFC',
          dark: '#020617',
        }
      },
      fontFamily: {
        heading: ['"Inter Tight"', 'Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0,0,0,0.12), inset 0 1px 0 0 rgba(255,255,255,0.06)',
        'card': '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
        'elevated': '0 10px 40px rgba(0,0,0,0.15)',
      }
    }
  },
  plugins: []
};
