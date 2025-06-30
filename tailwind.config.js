import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    // Breakpoints customizados seguindo as especificações
    screens: {
      'mobile': {'max': '767px'},        // Mobile: até 767px
      'tablet': {'min': '768px', 'max': '1279px'},  // Tablet: 768px até 1279px
      'desktop': {'min': '1280px', 'max': '1535px'}, // Desktop: 1280px até 1535px
      'wide': {'min': '1536px'},         // Wide: acima de 1536px
      
      // Breakpoints padrão do Tailwind (mobile-first)
      'sm': '768px',   // Tablet
      'md': '1024px',  // Desktop pequeno
      'lg': '1280px',  // Desktop
      'xl': '1536px',  // Wide
    },
    
    // Tamanhos de fonte responsivos
    fontSize: {
      // Mobile (até 767px)
      'xs': ['0.75rem', { lineHeight: '1rem' }],        // 12px
      'sm': ['0.875rem', { lineHeight: '1.25rem' }],    // 14px
      'base': ['1rem', { lineHeight: '1.5rem' }],       // 16px
      'lg': ['1.125rem', { lineHeight: '1.75rem' }],    // 18px
      'xl': ['1.25rem', { lineHeight: '1.75rem' }],     // 20px
      '2xl': ['1.5rem', { lineHeight: '2rem' }],        // 24px
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],   // 30px
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],     // 36px
      
      // Tamanhos responsivos por breakpoint
      // Mobile
      'mobile-xs': ['0.75rem', { lineHeight: '1rem' }],
      'mobile-sm': ['0.875rem', { lineHeight: '1.25rem' }],
      'mobile-base': ['1rem', { lineHeight: '1.5rem' }],
      'mobile-lg': ['1.125rem', { lineHeight: '1.75rem' }],
      'mobile-xl': ['1.25rem', { lineHeight: '1.75rem' }],
      'mobile-2xl': ['1.375rem', { lineHeight: '1.875rem' }],
      
      // Tablet
      'tablet-xs': ['0.875rem', { lineHeight: '1.25rem' }],
      'tablet-sm': ['1rem', { lineHeight: '1.5rem' }],
      'tablet-base': ['1.125rem', { lineHeight: '1.75rem' }],
      'tablet-lg': ['1.25rem', { lineHeight: '1.875rem' }],
      'tablet-xl': ['1.5rem', { lineHeight: '2rem' }],
      'tablet-2xl': ['1.75rem', { lineHeight: '2.25rem' }],
      
      // Desktop
      'desktop-xs': ['1rem', { lineHeight: '1.5rem' }],
      'desktop-sm': ['1.125rem', { lineHeight: '1.75rem' }],
      'desktop-base': ['1.25rem', { lineHeight: '1.875rem' }],
      'desktop-lg': ['1.5rem', { lineHeight: '2rem' }],
      'desktop-xl': ['1.75rem', { lineHeight: '2.25rem' }],
      'desktop-2xl': ['2rem', { lineHeight: '2.5rem' }],
      
      // Wide
      'wide-xs': ['1.125rem', { lineHeight: '1.75rem' }],
      'wide-sm': ['1.25rem', { lineHeight: '1.875rem' }],
      'wide-base': ['1.375rem', { lineHeight: '2rem' }],
      'wide-lg': ['1.625rem', { lineHeight: '2.25rem' }],
      'wide-xl': ['1.875rem', { lineHeight: '2.5rem' }],
      'wide-2xl': ['2.25rem', { lineHeight: '2.75rem' }],
    },
    
    fontFamily: {
      sans: ["Montserrat", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "sans-serif"],
    },
    extend: {
      // Container responsivo otimizado para cada breakpoint
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',         // Mobile: 16px padding
          'sm': '1.5rem',         // Tablet: 24px padding
          'md': '2rem',           // Desktop pequeno: 32px padding
          'lg': '2.5rem',         // Desktop: 40px padding
          'xl': '3rem',           // Wide: 48px padding
        },
        screens: {
          'sm': '768px',          // Tablet: max-width 768px
          'md': '1024px',         // Desktop pequeno: max-width 1024px
          'lg': '1280px',         // Desktop: max-width 1280px
          'xl': '1536px',         // Wide: max-width 1536px
        },
      },
      
      // Espaçamentos responsivos
      spacing: {
        // Mobile
        'mobile-xs': '0.25rem',   // 4px
        'mobile-sm': '0.5rem',    // 8px
        'mobile-md': '1rem',      // 16px
        'mobile-lg': '1.5rem',    // 24px
        'mobile-xl': '2rem',      // 32px
        
        // Tablet
        'tablet-xs': '0.5rem',    // 8px
        'tablet-sm': '0.75rem',   // 12px
        'tablet-md': '1.25rem',   // 20px
        'tablet-lg': '2rem',      // 32px
        'tablet-xl': '2.5rem',    // 40px
        
        // Desktop
        'desktop-xs': '0.75rem',  // 12px
        'desktop-sm': '1rem',     // 16px
        'desktop-md': '1.5rem',   // 24px
        'desktop-lg': '2.5rem',   // 40px
        'desktop-xl': '3rem',     // 48px
        
        // Wide
        'wide-xs': '1rem',        // 16px
        'wide-sm': '1.25rem',     // 20px
        'wide-md': '2rem',        // 32px
        'wide-lg': '3rem',        // 48px
        'wide-xl': '4rem',        // 64px
      },
      
      // Grid responsivo
      gridTemplateColumns: {
        // Mobile: 1-2 colunas
        'mobile-1': 'repeat(1, minmax(0, 1fr))',
        'mobile-2': 'repeat(2, minmax(0, 1fr))',
        
        // Tablet: 2-4 colunas
        'tablet-2': 'repeat(2, minmax(0, 1fr))',
        'tablet-3': 'repeat(3, minmax(0, 1fr))',
        'tablet-4': 'repeat(4, minmax(0, 1fr))',
        
        // Desktop: 3-6 colunas
        'desktop-3': 'repeat(3, minmax(0, 1fr))',
        'desktop-4': 'repeat(4, minmax(0, 1fr))',
        'desktop-5': 'repeat(5, minmax(0, 1fr))',
        'desktop-6': 'repeat(6, minmax(0, 1fr))',
        
        // Wide: 4-8 colunas
        'wide-4': 'repeat(4, minmax(0, 1fr))',
        'wide-6': 'repeat(6, minmax(0, 1fr))',
        'wide-8': 'repeat(8, minmax(0, 1fr))',
        'wide-12': 'repeat(12, minmax(0, 1fr))',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};