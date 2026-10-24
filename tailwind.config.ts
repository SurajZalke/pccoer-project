import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', '"Manrope"', 'sans-serif'],
      },
      colors: {
        lab: {
          bg1: '#050816',
          bg2: '#080b18',
          bg3: '#0d1224',
          cyan: '#22d3ee',
          blue: '#6366f1',
          violet: '#a855f7',
          emerald: '#34d399',
          amber: '#fbbf24',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        quiz: {
          primary: '#9b87f5',
          secondary: '#7E69AB',
          accent: '#F97316',
          light: '#E5DEFF',
          dark: '#1A1F2C'
        },
        glass: {
          DEFAULT: 'rgba(255,255,255,0.12)',
          dark: 'rgba(20,23,30,0.7)'
        },
        glow: {
          purple: '#b09cff',
          blue: '#7efaf8'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      boxShadow: {
        glass: "0 4px 32px 0 rgba(100,100,255,0.15), 0 2px 4px rgba(0,0,0,0.04)",
        'glow-purple': "0 0 16px 2px #b09cff77, 0 2px 4px rgba(0,0,0,0.05)",
        'text-shadow-lg': '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)'
      },
      keyframes: {
        'pulse-scale': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.07)' },
        },
        'glow-border': {
          '0%': { boxShadow: '0 0 4px #b09cff66, 0 0 12px #7efaf866' },
          '50%': { boxShadow: '0 0 20px 6px #b09cff99, 0 0 48px 8px #7efaf833' },
          '100%': { boxShadow: '0 0 4px #b09cff66, 0 0 12px #7efaf866' }
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        'bounce-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'fadeIn': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'ping-slow': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.1)', opacity: '0.8' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'float-particle': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0.6' },
          '25%': { transform: 'translateY(-10px) translateX(5px)', opacity: '1' },
          '50%': { transform: 'translateY(-20px) translateX(-5px)', opacity: '0.6' },
          '75%': { transform: 'translateY(-30px) translateX(5px)', opacity: '0.3' },
          '100%': { transform: 'translateY(-40px) translateX(0)', opacity: '0' },
        },
        gradientMove: {
          "0%,100%": { backgroundPosition: "0 50%" },
          "25%": { backgroundPosition: "100% 50%" },
          "50%": { backgroundPosition: "50% 100%" },
          "75%": { backgroundPosition: "50% 0" }
        },
        blob: {
          '0%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
          '33%': {
            transform: 'translate(30px, -50px) scale(1.1)',
          },
          '66%': {
            transform: 'translate(-20px, 20px) scale(0.9)',
          },
          '100%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
        },
        'bounce-in': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'pulse-scale': 'pulse-scale 2s ease-in-out infinite',
        'glow-border': 'glow-border 2.8s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'float-slow': 'float-slow 4s ease-in-out infinite',
        'bounce-slow': 'bounce-slow 3s ease-in-out infinite',
        'fadeIn': 'fadeIn 0.8s ease-in-out',
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
        'ping-slow': 'ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'float-particle': 'float-particle 4s linear infinite',
        "gradientMove": "gradientMove 12s ease-in-out infinite",
        blob: 'blob 7s infinite cubic-bezier(0.6, 0.2, 0.4, 0.8)',
        'bounce-in': 'bounce-in 0.5s ease-out forwards',
      }
    }
  },
  plugins: [require("tailwindcss-animate"), function ({ addUtilities }) {
    const newUtilities = {
      '.animation-delay-2000': {
        'animation-delay': '2s',
      },
      '.animation-delay-4000': {
        'animation-delay': '4s',
      },
      '.animation-delay-700': {
        'animation-delay': '0.7s',
      },
      '.animation-delay-800': {
        'animation-delay': '0.8s',
      },
      '.animation-delay-900': {
        'animation-delay': '0.9s',
      },
      '.animation-delay-1000': {
        'animation-delay': '1s',
      },
      '.animation-delay-1100': {
        'animation-delay': '1.1s',
      },
      '.animation-delay-1200': {
        'animation-delay': '1.2s',
      },
      '.animation-delay-1300': {
        'animation-delay': '1.3s',
      },
      '.animation-delay-1400': {
        'animation-delay': '1.4s',
      },
      '.animation-delay-1500': {
        'animation-delay': '1.5s',
      },
      '.animation-delay-1600': {
        'animation-delay': '1.6s',
      },
      '.animation-delay-1700': {
        'animation-delay': '1.7s',
      },
      '.animation-delay-1800': {
        'animation-delay': '1.8s',
      },
      '.animation-delay-1900': {
        'animation-delay': '1.9s',
      },
      '.animation-delay-2000-duplicate': {
        'animation-delay': '2s',
      },
      '.animation-delay-2100': {
        'animation-delay': '2.1s',
      },
    };
    addUtilities(newUtilities);
  }],
} satisfies Config;
