/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        space: {
          900: '#050818',
          800: '#0a0e27',
          700: '#1a1147',
          600: '#2d1b69',
          500: '#3d2a8a',
        },
        neon: {
          pink: '#ff2e88',
          cyan: '#00f5ff',
          gold: '#ffd700',
          violet: '#9d4edd',
          red: '#ff3860',
          green: '#39ff14',
        },
        stardust: '#e0e0ff',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        tech: ['Rajdhani', 'sans-serif'],
        body: ['"Noto Sans SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'shake': 'shake 0.4s ease-in-out',
        'flip-in': 'flip-in 0.4s ease-out',
        'rise': 'rise 0.5s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255,46,136,0.5)' },
          '50%': { boxShadow: '0 0 40px rgba(0,245,255,0.7)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-8px)' },
          '75%': { transform: 'translateX(8px)' },
        },
        'flip-in': {
          '0%': { transform: 'rotateY(90deg)', opacity: '0' },
          '100%': { transform: 'rotateY(0)', opacity: '1' },
        },
        rise: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
