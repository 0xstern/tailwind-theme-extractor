/**
 * Benchmarks for theme override system performance
 * Tests override parsing, application, and variable injection hot paths
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import type {
  CSSVariable,
  OverrideOptions,
  Theme,
  ThemeVariant,
} from '../../src/v4/types';

import { bench, group, run } from 'mitata';

import {
  applyThemeOverrides,
  injectVariableOverrides,
  resolveVariantName,
} from '../../src/v4/parser/theme-overrides';

/**
 * Creates a complete Theme object with all required properties
 * Mimics what the parser would produce in production
 *
 * @param overrides - Partial theme properties to override defaults
 * @returns Complete Theme object
 */
function createMockTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    colors: {},
    spacing: {},
    fonts: {},
    fontSize: {},
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
    ...overrides,
  };
}

// Realistic test data matching production parser output
const mockBaseTheme: Theme = createMockTheme({
  colors: {
    primary: { 500: '#3b82f6', 600: '#2563eb' },
    background: '#ffffff',
    foreground: '#000000',
  },
  fonts: {
    sans: 'system-ui, sans-serif',
    mono: 'monospace',
  },
  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
  },
  spacing: {
    base: '0.25rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
  },
});

const mockVariants: Record<string, ThemeVariant> = {
  dark: {
    theme: createMockTheme({
      colors: {
        background: '#1a1a1a',
        foreground: '#ffffff',
      },
    }),
    selector: '[data-theme="dark"]',
  },
  themeInter: {
    theme: createMockTheme({
      fonts: {
        sans: 'var(--font-inter)',
      },
    }),
    selector: '.theme-inter .theme-container',
  },
  themeNotoSans: {
    theme: createMockTheme({
      fonts: {
        sans: 'var(--font-noto-sans)',
      },
    }),
    selector: '.theme-noto-sans .theme-container',
  },
  themeFigtree: {
    theme: createMockTheme({
      fonts: {
        sans: 'var(--font-figtree)',
      },
    }),
    selector: '.theme-figtree .theme-container',
  },
};

const mockVariables: Array<CSSVariable> = [
  { name: '--color-primary-500', value: '#3b82f6', source: 'theme' },
  { name: '--color-background', value: '#ffffff', source: 'theme' },
  { name: '--radius-lg', value: '0.75rem', source: 'theme' },
  { name: '--font-sans', value: 'system-ui, sans-serif', source: 'theme' },
];

// Benchmark resolveVariantName
group('resolveVariantName', () => {
  bench('wildcard selector (*)', () => {
    resolveVariantName('*', mockVariants);
  });

  bench('default selector', () => {
    resolveVariantName('default', mockVariants);
  });

  bench('direct variant match', () => {
    resolveVariantName('dark', mockVariants);
  });

  bench('CSS selector exact match', () => {
    resolveVariantName('[data-theme="dark"]', mockVariants);
  });

  bench('CSS selector substring match', () => {
    resolveVariantName('.theme-inter', mockVariants);
  });

  bench('camelCase variant name', () => {
    resolveVariantName('themeInter', mockVariants);
  });

  bench('batch: 100 variant resolutions', () => {
    const selectors = [
      '*',
      'default',
      'dark',
      'themeInter',
      '[data-theme="dark"]',
    ];
    for (let i = 0; i < 100; i++) {
      resolveVariantName(selectors[i % selectors.length]!, mockVariants);
    }
  });
});

// Benchmark parseOverrideConfig (via applyThemeOverrides)
group('override parsing and application', () => {
  bench('flat notation - single property', () => {
    const overrides: OverrideOptions = {
      default: {
        'radius.lg': '0.5rem',
      },
    };
    applyThemeOverrides(
      structuredClone(mockBaseTheme),
      structuredClone(mockVariants),
      overrides,
      false,
    );
  });

  bench('flat notation - multiple properties', () => {
    const overrides: OverrideOptions = {
      default: {
        'colors.primary.500': '#ff0000',
        'colors.background': '#f5f5f5',
        'radius.lg': '0.5rem',
        'fonts.sans': 'Inter, sans-serif',
      },
    };
    applyThemeOverrides(
      structuredClone(mockBaseTheme),
      structuredClone(mockVariants),
      overrides,
      false,
    );
  });

  bench('nested notation - single property', () => {
    const overrides: OverrideOptions = {
      default: {
        radius: {
          lg: '0.5rem',
        },
      },
    };
    applyThemeOverrides(
      structuredClone(mockBaseTheme),
      structuredClone(mockVariants),
      overrides,
      false,
    );
  });

  bench('nested notation - deep nesting', () => {
    const overrides: OverrideOptions = {
      default: {
        colors: {
          primary: {
            500: '#ff0000',
            600: '#ee0000',
          },
        },
        radius: {
          lg: '0.5rem',
        },
      },
    };
    applyThemeOverrides(
      structuredClone(mockBaseTheme),
      structuredClone(mockVariants),
      overrides,
      false,
    );
  });

  bench('mixed notation (separate keys)', () => {
    const overrides: OverrideOptions = {
      default: {
        'colors.primary.500': '#ff0000',
        'colors.primary.600': '#ee0000',
        'radius.lg': '0.5rem',
        'radius.md': '0.25rem',
        'fonts.sans': 'Inter, sans-serif',
      },
    };
    applyThemeOverrides(
      structuredClone(mockBaseTheme),
      structuredClone(mockVariants),
      overrides,
      false,
    );
  });

  bench('variant-specific overrides', () => {
    const overrides: OverrideOptions = {
      dark: {
        'colors.background': '#000000',
        'colors.foreground': '#ffffff',
      },
    };
    applyThemeOverrides(
      structuredClone(mockBaseTheme),
      structuredClone(mockVariants),
      overrides,
      false,
    );
  });

  bench('multiple variants with wildcard', () => {
    const overrides: OverrideOptions = {
      default: {
        'radius.lg': '0.5rem',
      },
      dark: {
        'colors.background': '#000000',
      },
      '*': {
        'fonts.mono': 'JetBrains Mono, monospace',
      },
    };
    applyThemeOverrides(
      structuredClone(mockBaseTheme),
      structuredClone(mockVariants),
      overrides,
      false,
    );
  });
});

// Benchmark injectVariableOverrides
group('variable injection', () => {
  bench('inject single variable', () => {
    const variables: Array<CSSVariable> = structuredClone(mockVariables);
    const overrides: OverrideOptions = {
      default: {
        'colors.primary': '#ff0000',
      },
    };
    injectVariableOverrides(variables, overrides, false);
  });

  bench('inject multiple variables', () => {
    const variables: Array<CSSVariable> = structuredClone(mockVariables);
    const overrides: OverrideOptions = {
      default: {
        'colors.primary.500': '#ff0000',
        'colors.background': '#f5f5f5',
        'radius.lg': '0.5rem',
        'fonts.sans': 'Inter, sans-serif',
      },
    };
    injectVariableOverrides(variables, overrides, false);
  });

  bench('inject with wildcard', () => {
    const variables: Array<CSSVariable> = structuredClone(mockVariables);
    const overrides: OverrideOptions = {
      '*': {
        'fonts.sans': 'Inter, sans-serif',
        'fonts.mono': 'JetBrains Mono, monospace',
      },
    };
    injectVariableOverrides(variables, overrides, false);
  });

  bench('inject with base selector', () => {
    const variables: Array<CSSVariable> = structuredClone(mockVariables);
    const overrides: OverrideOptions = {
      base: {
        'colors.primary': '#ff0000',
        'radius.lg': '0.5rem',
      },
    };
    injectVariableOverrides(variables, overrides, false);
  });
});

// Realistic workload simulation
group('realistic workload', () => {
  bench('Next.js font theme overrides (4 variants)', () => {
    const overrides: OverrideOptions = {
      themeInter: {
        'fonts.sans': 'Inter, sans-serif',
      },
      themeNotoSans: {
        'fonts.sans': 'Noto Sans, sans-serif',
      },
      themeFigtree: {
        'fonts.sans': 'Figtree, sans-serif',
      },
      default: {
        'fonts.sans': 'system-ui, sans-serif',
      },
    };
    applyThemeOverrides(
      structuredClone(mockBaseTheme),
      structuredClone(mockVariants),
      overrides,
      false,
    );
  });

  bench('shadcn theme customization (10+ overrides)', () => {
    const overrides: OverrideOptions = {
      default: {
        'colors.primary.500': '#3b82f6',
        'colors.background': '#ffffff',
        'colors.foreground': '#0a0a0a',
        'radius.sm': '0.25rem',
        'radius.md': '0.5rem',
        'radius.lg': '0.75rem',
        'fonts.sans': 'Inter, sans-serif',
        'fonts.mono': 'JetBrains Mono, monospace',
      },
      dark: {
        'colors.background': '#0a0a0a',
        'colors.foreground': '#fafafa',
      },
    };
    applyThemeOverrides(
      structuredClone(mockBaseTheme),
      structuredClone(mockVariants),
      overrides,
      false,
    );
  });

  bench('complex multi-variant override (20+ operations)', () => {
    const overrides: OverrideOptions = {
      default: {
        'colors.primary.500': '#3b82f6',
        'colors.primary.600': '#2563eb',
        'radius.lg': '0.5rem',
        'spacing.lg': '1.5rem',
      },
      dark: {
        'colors.background': '#000000',
        'colors.foreground': '#ffffff',
      },
      themeInter: {
        'fonts.sans': 'Inter, sans-serif',
      },
      themeNotoSans: {
        'fonts.sans': 'Noto Sans, sans-serif',
      },
      '*': {
        'fonts.mono': 'JetBrains Mono, monospace',
      },
    };
    applyThemeOverrides(
      structuredClone(mockBaseTheme),
      structuredClone(mockVariants),
      overrides,
      false,
    );
  });

  bench('full pipeline: injection + application', () => {
    const variables: Array<CSSVariable> = structuredClone(mockVariables);
    const overrides: OverrideOptions = {
      default: {
        'colors.primary': '#ff0000',
        'fonts.sans': 'Inter, sans-serif',
      },
      dark: {
        'colors.background': '#000000',
      },
    };

    // Pre-resolution injection
    injectVariableOverrides(variables, overrides, false);

    // Post-resolution application
    applyThemeOverrides(
      structuredClone(mockBaseTheme),
      structuredClone(mockVariants),
      overrides,
      false,
    );
  });
});

await run();
