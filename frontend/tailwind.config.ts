import type { Config } from 'tailwindcss';

const config: Config = {
  // Enable class-based dark mode (controlled by next-themes)
  darkMode: ['class'],

  // Content paths
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
    './src/modules/**/*.{ts,tsx}',
    './src/core/**/*.{ts,tsx}',
  ],

  theme: {
    extend: {
      // Map CSS custom properties to Tailwind color tokens
      colors: {
        // Brand colors — overridden at runtime by Theme Studio
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--color-primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          foreground: 'var(--color-secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          foreground: 'var(--color-accent-foreground)',
        },

        // Surface colors
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          2: 'var(--color-surface-2)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },

        // Text colors
        foreground: 'var(--color-text-primary)',
        muted: {
          DEFAULT: 'var(--color-surface-2)',
          foreground: 'var(--color-text-muted)',
        },

        // Semantic colors
        success: {
          DEFAULT: 'var(--color-success)',
          bg: 'var(--color-success-bg)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg: 'var(--color-warning-bg)',
        },
        destructive: {
          DEFAULT: 'var(--color-error)',
          foreground: '#FFFFFF',
          bg: 'var(--color-error-bg)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          bg: 'var(--color-info-bg)',
        },

        // shadcn/ui compatibility tokens
        card: {
          DEFAULT: 'var(--color-surface)',
          foreground: 'var(--color-text-primary)',
        },
        popover: {
          DEFAULT: 'var(--color-background)',
          foreground: 'var(--color-text-primary)',
        },
        input: 'var(--color-border)',
        ring: 'var(--color-primary)',
      },

      // Font families — driven by CSS vars for Theme Studio override
      fontFamily: {
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },

      // Extended font sizes for ERP data density
      fontSize: {
        data: ['13px', { lineHeight: '1.375' }],
        'data-sm': ['12px', { lineHeight: '1.375' }],
      },

      // Border radius from design tokens
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        DEFAULT: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },

      // Box shadows from design tokens
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        drawer: 'var(--shadow-drawer)',
      },

      // Layout dimensions
      width: {
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-collapsed-width)',
      },
      height: {
        topbar: 'var(--topbar-height)',
        contextbar: 'var(--contextbar-height)',
      },

      // Smooth transitions
      transitionDuration: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
        slower: 'var(--duration-slower)',
      },

      // Animations
      keyframes: {
        'slide-in-from-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-out-to-right': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'slide-in': 'slide-in-from-right 300ms var(--ease-out)',
        'slide-out': 'slide-out-to-right 300ms var(--ease-in)',
        'fade-in': 'fade-in 150ms var(--ease-out)',
        'fade-out': 'fade-out 150ms var(--ease-in)',
        'scale-in': 'scale-in 200ms var(--ease-out)',
        skeleton: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },

  plugins: [],
};

export default config;
