/**
 * Benchmarks for Tailwind defaults loading and theme merging
 * Tests mergeThemes and mergeColorScales performance
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import type { Theme } from '../../src/v4/types';

import { bench, group, run } from 'mitata';

import { mergeThemes } from '../../src/v4/core';

// Helper to create a realistic Tailwind default theme
function createDefaultTheme(): Theme {
  const colorStops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const colorScales = [
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'emerald',
    'teal',
    'cyan',
    'sky',
    'blue',
    'indigo',
    'violet',
    'purple',
    'fuchsia',
    'pink',
    'rose',
    'slate',
    'gray',
    'zinc',
    'neutral',
    'stone',
  ];

  const colors: Theme['colors'] = {};
  for (const scale of colorScales) {
    const scaleObj: Record<number, string> = {};
    for (const stop of colorStops) {
      scaleObj[stop] = `oklch(${50 + stop / 20} 0.1 ${stop})`;
    }
    colors[scale] = scaleObj;
  }

  const spacing: Theme['spacing'] = {};
  for (let i = 0; i <= 96; i++) {
    spacing[i] = `${i * 0.25}rem`;
  }

  const fontSize: Theme['fontSize'] = {
    xs: { size: '0.75rem', lineHeight: '1rem' },
    sm: { size: '0.875rem', lineHeight: '1.25rem' },
    base: { size: '1rem', lineHeight: '1.5rem' },
    lg: { size: '1.125rem', lineHeight: '1.75rem' },
    xl: { size: '1.25rem', lineHeight: '1.75rem' },
    '2xl': { size: '1.5rem', lineHeight: '2rem' },
    '3xl': { size: '1.875rem', lineHeight: '2.25rem' },
    '4xl': { size: '2.25rem', lineHeight: '2.5rem' },
    '5xl': { size: '3rem', lineHeight: '1' },
  };

  return {
    colors,
    spacing,
    fontSize,
    fonts: {
      sans: 'ui-sans-serif, system-ui, sans-serif',
      serif: 'ui-serif, Georgia, serif',
      mono: 'ui-monospace, monospace',
    },
    fontWeight: {
      thin: 100,
      extralight: 200,
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
    },
    tracking: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0em',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em',
    },
    leading: {
      none: 1,
      tight: 1.25,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
      loose: 2,
    },
    breakpoints: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    containers: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    radius: {
      none: '0',
      sm: '0.125rem',
      DEFAULT: '0.25rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      '2xl': '1rem',
      '3xl': '1.5rem',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      none: 'none',
    },
    insetShadows: {},
    dropShadows: {},
    textShadows: {},
    blur: {
      none: '0',
      sm: '4px',
      DEFAULT: '8px',
      md: '12px',
      lg: '16px',
      xl: '24px',
      '2xl': '40px',
      '3xl': '64px',
    },
    perspective: {},
    aspect: {
      auto: 'auto',
      square: '1 / 1',
      video: '16 / 9',
    },
    ease: {
      DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
    animations: {},
    defaults: {},
    keyframes: {},
  };
}

// Helper to create user theme overrides
function createUserTheme(overrideCount: number): Theme {
  const colors: Theme['colors'] = {};

  // Override some color scales
  if (overrideCount >= 1) {
    colors.primary = '#3b82f6';
  }
  if (overrideCount >= 2) {
    colors.secondary = '#10b981';
  }
  if (overrideCount >= 3) {
    colors.background = '#ffffff';
  }
  if (overrideCount >= 4) {
    colors.foreground = '#000000';
  }
  if (overrideCount >= 5) {
    // Override a full color scale
    colors.blue = {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    };
  }

  return {
    colors,
    spacing: {},
    fontSize: {},
    fonts: {},
    fontWeight: {},
    tracking: {},
    leading: {},
    breakpoints: {},
    containers: {},
    radius: {},
    shadows: {},
    insetShadows: {},
    dropShadows: {},
    textShadows: {},
    blur: {},
    perspective: {},
    aspect: {},
    ease: {},
    animations: {},
    defaults: {},
    keyframes: {},
  };
}

// Benchmark mergeThemes with different scales
group('mergeThemes - scale', () => {
  const defaultTheme = createDefaultTheme();

  bench('minimal override (1 color)', () => {
    const userTheme = createUserTheme(1);
    mergeThemes(defaultTheme, userTheme);
  });

  bench('small override (5 colors)', () => {
    const userTheme = createUserTheme(5);
    mergeThemes(defaultTheme, userTheme);
  });

  bench('typical shadcn setup (10+ overrides)', () => {
    const userTheme: Theme = {
      colors: {
        background: '#ffffff',
        foreground: '#000000',
        primary: '#3b82f6',
        secondary: '#10b981',
        accent: '#f59e0b',
        muted: '#6b7280',
        border: '#e5e7eb',
        input: '#f3f4f6',
        ring: '#3b82f6',
        destructive: '#ef4444',
      },
      spacing: { custom: '2.5rem' },
      radius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
      },
      fontSize: {},
      fonts: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };
    mergeThemes(defaultTheme, userTheme);
  });

  bench('empty user theme (no overrides)', () => {
    const userTheme = createUserTheme(0);
    mergeThemes(defaultTheme, userTheme);
  });
});

// Benchmark color scale merging specifically
group('mergeThemes - color scale merging', () => {
  const defaultTheme = createDefaultTheme();

  bench('flat color override', () => {
    const userTheme: Theme = {
      colors: {
        primary: '#3b82f6',
        secondary: '#10b981',
        accent: '#f59e0b',
      },
      spacing: {},
      fontSize: {},
      fonts: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };
    mergeThemes(defaultTheme, userTheme);
  });

  bench('color scale partial override', () => {
    const userTheme: Theme = {
      colors: {
        blue: {
          500: '#custom-blue',
          600: '#custom-blue-dark',
        },
      },
      spacing: {},
      fontSize: {},
      fonts: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };
    mergeThemes(defaultTheme, userTheme);
  });

  bench('color scale full override', () => {
    const userTheme = createUserTheme(5);
    mergeThemes(defaultTheme, userTheme);
  });
});

// Benchmark repeated merges (cache effectiveness)
group('mergeThemes - repeated merges', () => {
  const defaultTheme = createDefaultTheme();
  const userTheme = createUserTheme(5);

  bench('batch: 10 merges (same themes)', () => {
    for (let i = 0; i < 10; i++) {
      mergeThemes(defaultTheme, userTheme);
    }
  });

  bench('batch: 100 merges (same themes)', () => {
    for (let i = 0; i < 100; i++) {
      mergeThemes(defaultTheme, userTheme);
    }
  });
});

await run();
