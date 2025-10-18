/**
 * Real-world integration tests using shadcn CSS fixtures
 * Tests variable resolution, self-referential handling, and Tailwind defaults
 */

import type { ParseResult } from '../../src/v4/types';

import { resolve } from 'node:path';

import { beforeAll, describe, expect, test } from 'bun:test';

import { extractTheme } from '../../src/v4/index';

// Test constants for expected counts
const EXPECTED_FILE_COUNT = 3;
const EXPECTED_MIN_VARIABLES = 100;
const EXPECTED_MIN_VARIANTS = 15;
const EXPECTED_MIN_COLOR_KEYS = 30;
const EXPECTED_MIN_FONT_STACK_LENGTH = 20;

let result: ParseResult;

beforeAll(async () => {
  // Parse shadcn-global.css which imports default-theme.css and shadcn-themes.css
  result = await extractTheme({
    input: resolve(__dirname, './fixtures/shadcn-global.css'),
    resolveImports: true,
    basePath: __dirname, // Use test directory as basePath to find node_modules
  });
});

describe('Import Resolution', () => {
  test('processes all shadcn CSS files', () => {
    const expectedFiles = [
      'shadcn-global.css',
      'default-theme.css',
      'shadcn-themes.css',
    ];

    for (const file of expectedFiles) {
      const found = result.files.some((f) => f.includes(file));
      expect(found).toBe(true);
    }
  });

  test('resolves 3 total files', () => {
    expect(result.files.length).toBe(EXPECTED_FILE_COUNT);
  });
});

describe('Variable Resolution from Tailwind Defaults', () => {
  test('resolves chart colors from Tailwind defaults', () => {
    // shadcn-global.css has: --chart-1: var(--color-blue-300)
    // This should resolve to the actual oklch value from Tailwind defaults
    expect(result.theme.colors.chart).toBeDefined();
    expect(
      (result.theme.colors.chart as Record<string, string>)['1'],
    ).toBeDefined();

    const chart1 = (result.theme.colors.chart as Record<string, string>)['1'];
    // Should be resolved to actual oklch value, not var()
    expect(chart1).not.toContain('var(');
    expect(chart1).toContain('oklch');
    expect(chart1).toBe('oklch(80.9% 0.105 251.813)'); // --color-blue-300 from Tailwind
  });

  test('resolves all chart colors to Tailwind defaults', () => {
    const chartColors = result.theme.colors.chart as Record<string, string>;

    expect(chartColors['1']).toBe('oklch(80.9% 0.105 251.813)'); // blue-300
    expect(chartColors['2']).toBe('oklch(62.3% 0.214 259.815)'); // blue-500
    expect(chartColors['3']).toBe('oklch(54.6% 0.245 262.881)'); // blue-600
    expect(chartColors['4']).toBe('oklch(48.8% 0.243 264.376)'); // blue-700
    expect(chartColors['5']).toBe('oklch(42.4% 0.199 265.638)'); // blue-800

    // All should be actual values, no var() references
    for (const value of Object.values(chartColors)) {
      expect(value).not.toContain('var(');
    }
  });

  test('includes all Tailwind default colors in base theme', () => {
    // All Tailwind default color scales should be present
    const defaultColors = [
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

    for (const colorName of defaultColors) {
      expect(result.theme.colors[colorName]).toBeDefined();
    }
  });

  test('Tailwind color scales are complete', () => {
    // Check that blue scale has all variants
    const blue = result.theme.colors.blue as Record<string, string>;
    const expectedVariants = [
      '50',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      '700',
      '800',
      '900',
      '950',
    ];

    for (const variant of expectedVariants) {
      expect(blue[variant]).toBeDefined();
      expect(blue[variant]).toContain('oklch');
    }
  });

  test('includes Tailwind default fonts', () => {
    expect(result.theme.fonts.sans).toBeDefined();
    expect(result.theme.fonts.serif).toBeDefined();
    expect(result.theme.fonts.mono).toBeDefined();

    // Should be actual font stacks, not empty
    expect(result.theme.fonts.sans).toContain('ui-sans-serif');
    expect(result.theme.fonts.serif).toContain('ui-serif');
    expect(result.theme.fonts.mono).toContain('ui-monospace');
  });
});

describe('Self-Referential Variable Handling', () => {
  test('skips self-referential font variables', () => {
    // shadcn-global.css has: --font-sans: var(--font-sans)
    // This should be skipped, allowing Tailwind defaults to be used
    expect(result.theme.fonts.sans).toBeDefined();
    expect(result.theme.fonts.sans).not.toBe('var(--font-sans)');
    expect(result.theme.fonts.sans).toContain('ui-sans-serif'); // From Tailwind defaults
  });

  test('skips self-referential mono font', () => {
    expect(result.theme.fonts.mono).toBeDefined();
    expect(result.theme.fonts.mono).not.toBe('var(--font-mono)');
    expect(result.theme.fonts.mono).toContain('ui-monospace'); // From Tailwind defaults
  });
});

describe('Two-Layer Variable Resolution (shadcn Pattern)', () => {
  test('resolves @theme variables that reference :root variables', () => {
    // @theme has: --color-background: var(--background)
    // :root has: --background: oklch(1 0 0)
    expect(result.theme.colors.background).toBeDefined();
    expect(result.theme.colors.background).toBe('oklch(1 0 0)');
    expect(result.theme.colors.background).not.toContain('var(');
  });

  test('resolves semantic color tokens', () => {
    // All shadcn semantic tokens should resolve
    // Note: kebab-case names are converted to camelCase
    const semanticTokens = {
      background: 'oklch(1 0 0)',
      foreground: 'oklch(0.145 0 0)',
      card: 'oklch(1 0 0)',
      cardForeground: 'oklch(0.145 0 0)',
      popover: 'oklch(1 0 0)',
      popoverForeground: 'oklch(0.145 0 0)',
      primary: 'oklch(0.205 0 0)',
      primaryForeground: 'oklch(0.985 0 0)',
      secondary: 'oklch(0.97 0 0)',
      secondaryForeground: 'oklch(0.205 0 0)',
      muted: 'oklch(0.97 0 0)',
      mutedForeground: 'oklch(0.556 0 0)',
      accent: 'oklch(0.97 0 0)',
      accentForeground: 'oklch(0.205 0 0)',
    };

    const colors = result.theme.colors;
    for (const [key, expectedValue] of Object.entries(semanticTokens)) {
      expect(colors[key]).toBe(expectedValue);
    }
  });

  test('resolves destructive color', () => {
    expect(result.theme.colors.destructive).toBe('oklch(0.577 0.245 27.325)');
  });

  test('resolves border and input colors', () => {
    expect(result.theme.colors.border).toBe('oklch(0.922 0 0)');
    expect(result.theme.colors.input).toBe('oklch(0.922 0 0)');
    expect(result.theme.colors.ring).toBe('oklch(0.708 0 0)');
  });

  test('resolves sidebar colors', () => {
    const colors = result.theme.colors;
    expect(colors.sidebar).toBe('oklch(0.985 0 0)');
    expect(colors.sidebarForeground).toBe('oklch(0.145 0 0)');
    expect(colors.sidebarPrimary).toBe('oklch(0.205 0 0)');
    expect(colors.sidebarPrimaryForeground).toBe('oklch(0.985 0 0)');
    expect(colors.sidebarAccent).toBe('oklch(0.97 0 0)');
    expect(colors.sidebarAccentForeground).toBe('oklch(0.205 0 0)');
    expect(colors.sidebarBorder).toBe('oklch(0.922 0 0)');
    expect(colors.sidebarRing).toBe('oklch(0.708 0 0)');
  });

  test('resolves nested var() references', () => {
    // :root has: --surface-foreground: var(--foreground)
    // --foreground: oklch(0.145 0 0)
    expect(result.theme.colors.surfaceForeground).toBe('oklch(0.145 0 0)');

    // :root has: --code: var(--surface)
    // --surface: oklch(0.98 0 0)
    expect(result.theme.colors.code).toBe('oklch(0.98 0 0)');

    // :root has: --code-foreground: var(--surface-foreground)
    // --surface-foreground: var(--foreground)
    // --foreground: oklch(0.145 0 0)
    expect(result.theme.colors.codeForeground).toBe('oklch(0.145 0 0)');
  });
});

describe('Radius and Calc() Expressions', () => {
  test('extracts base radius', () => {
    // :root has: --radius: 0.625rem
    expect(result.theme.radius.lg).toBe('0.625rem');
  });

  test('preserves calc() expressions for radius variants', () => {
    // @theme has: --radius-sm: calc(var(--radius) - 4px)
    expect(result.theme.radius.sm).toBe('calc(0.625rem - 4px)');
    expect(result.theme.radius.md).toBe('calc(0.625rem - 2px)');
    expect(result.theme.radius.xl).toBe('calc(0.625rem + 4px)');
  });
});

describe('Breakpoint Extensions', () => {
  test('includes custom breakpoints', () => {
    expect(result.theme.breakpoints['3xl']).toBe('1600px');
    expect(result.theme.breakpoints['4xl']).toBe('2000px');
  });

  test('includes default Tailwind breakpoints', () => {
    // From default-theme.css
    expect(result.theme.breakpoints.sm).toBe('40rem');
    expect(result.theme.breakpoints.md).toBe('48rem');
    expect(result.theme.breakpoints.lg).toBe('64rem');
    expect(result.theme.breakpoints.xl).toBe('80rem');
    expect(result.theme.breakpoints['2xl']).toBe('96rem');
  });
});

describe('Theme Variants from shadcn-themes.css', () => {
  test('extracts dark mode variant from .dark selector', () => {
    expect(result.variants.dark).toBeDefined();
    expect(result.variants.dark?.selector).toBe('.dark');
  });

  test('dark mode overrides semantic colors', () => {
    const dark = result.variants.dark?.theme;
    expect(dark).toBeDefined();

    if (dark === undefined) {
      throw new Error('Dark variant should be defined');
    }

    expect(dark.colors.background).toBe('oklch(0.145 0 0)');
    expect(dark.colors.foreground).toBe('oklch(0.985 0 0)');
    expect(dark.colors.card).toBe('oklch(0.205 0 0)');
    expect(dark.colors.cardForeground).toBe('oklch(0.985 0 0)');
  });

  test('dark mode has resolved chart colors', () => {
    const dark = result.variants.dark?.theme;
    if (dark === undefined) {
      throw new Error('Dark variant should be defined');
    }

    // Dark mode also has chart colors referencing Tailwind defaults
    const chartColors = dark.colors.chart as Record<string, string>;
    expect(chartColors['1']).toBe('oklch(80.9% 0.105 251.813)'); // blue-300
    expect(chartColors['2']).toBe('oklch(62.3% 0.214 259.815)'); // blue-500
  });

  test('dark mode handles alpha channel colors', () => {
    const dark = result.variants.dark?.theme;
    if (dark === undefined) {
      throw new Error('Dark variant should be defined');
    }

    // Dark mode has alpha channel: --border: oklch(1 0 0 / 10%)
    expect(dark.colors.border).toBe('oklch(1 0 0 / 10%)');
    expect(dark.colors.input).toBe('oklch(1 0 0 / 15%)');
  });

  test('extracts theme-default variant', () => {
    expect(result.variants['theme-default']).toBeDefined();
  });

  test('extracts theme-mono variant', () => {
    expect(result.variants['theme-mono']).toBeDefined();

    const mono = result.variants['theme-mono']?.theme;
    if (mono === undefined) {
      throw new Error('Theme-mono variant should be defined');
    }

    // Theme-mono overrides primary color
    expect(mono.colors.primary).toBeDefined();
    expect(mono.colors.primary).not.toContain('var(');
  });

  test('extracts color theme variants', () => {
    const colorThemes = [
      'theme-blue',
      'theme-green',
      'theme-amber',
      'theme-rose',
      'theme-purple',
      'theme-orange',
      'theme-teal',
      'theme-red',
      'theme-yellow',
      'theme-violet',
    ];

    for (const themeName of colorThemes) {
      expect(result.variants[themeName]).toBeDefined();
    }
  });

  test('theme-blue resolves primary colors from Tailwind defaults', () => {
    const blue = result.variants['theme-blue']?.theme;
    if (blue === undefined) {
      throw new Error('Theme-blue variant should be defined');
    }

    // --primary: var(--color-blue-700)
    expect(blue.colors.primary).toBeDefined();
    expect(blue.colors.primary).not.toContain('var(');
    expect(blue.colors.primary).toContain('oklch');
  });

  test('theme-green resolves lime colors from Tailwind defaults', () => {
    const green = result.variants['theme-green']?.theme;
    if (green === undefined) {
      throw new Error('Theme-green variant should be defined');
    }

    // --primary: var(--color-lime-600)
    expect(green.colors.primary).toBeDefined();
    expect(green.colors.primary).not.toContain('var(');
  });

  test('extracts radius variants', () => {
    const radiusVariants = [
      'theme-rounded-none',
      'theme-rounded-small',
      'theme-rounded-medium',
      'theme-rounded-large',
      'theme-rounded-full',
    ];

    for (const variant of radiusVariants) {
      expect(result.variants[variant]).toBeDefined();
    }
  });

  test('theme-rounded-none sets radius to 0', () => {
    const variant = result.variants['theme-rounded-none']?.theme;
    if (variant === undefined) {
      throw new Error('Theme-rounded-none variant should be defined');
    }

    expect(variant.radius.lg).toBe('0');
  });

  test('theme-rounded-full has large radius', () => {
    const variant = result.variants['theme-rounded-full']?.theme;
    if (variant === undefined) {
      throw new Error('Theme-rounded-full variant should be defined');
    }

    expect(variant.radius.lg).toBe('1.2rem');
  });

  test('extracts font variants', () => {
    const fontVariants = [
      'theme-inter',
      'theme-noto-sans',
      'theme-nunito-sans',
      'theme-figtree',
    ];

    for (const variant of fontVariants) {
      expect(result.variants[variant]).toBeDefined();
    }
  });
});

describe('Media Query Variants', () => {
  test('extracts theme-mono media query overrides', () => {
    // theme-mono has @media (min-width: 1024px) with font size overrides
    const mono = result.variants['theme-mono']?.theme;
    if (mono === undefined) {
      throw new Error('Theme-mono variant should be defined');
    }

    // Media query sets --text-lg: 1rem
    expect(mono.fontSize.lg).toBeDefined();
  });

  test('extracts theme-scaled media query overrides', () => {
    const scaled = result.variants['theme-scaled']?.theme;
    if (scaled === undefined) {
      throw new Error('Theme-scaled variant should be defined');
    }

    // Media query sets --spacing: 0.2rem
    expect(scaled.spacing.base).toBeDefined();
  });
});

describe('Nested Variant Handling', () => {
  test('theme-blue has nested @variant dark block', () => {
    // theme-blue has a nested @variant dark { } block
    // This creates a composite selector
    const blueVariants = Object.keys(result.variants).filter((name) =>
      name.includes('blue'),
    );

    expect(blueVariants.length).toBeGreaterThan(0);
  });

  test('theme-mono has nested @variant dark block', () => {
    const monoVariants = Object.keys(result.variants).filter((name) =>
      name.includes('mono'),
    );

    expect(monoVariants.length).toBeGreaterThan(0);
  });
});

describe('Variable Count and Coverage', () => {
  test('extracts substantial number of variables', () => {
    // Should have hundreds of variables from all three files
    expect(result.variables.length).toBeGreaterThan(EXPECTED_MIN_VARIABLES);
  });

  test('has multiple theme variants', () => {
    // Should have 20+ variants from shadcn-themes.css
    expect(Object.keys(result.variants).length).toBeGreaterThan(
      EXPECTED_MIN_VARIANTS,
    );
  });

  test('base theme has comprehensive color palette', () => {
    const colorKeys = Object.keys(result.theme.colors);

    // Should have Tailwind defaults + shadcn semantic tokens
    expect(colorKeys.length).toBeGreaterThan(EXPECTED_MIN_COLOR_KEYS);
  });
});

describe('Special Value Handling', () => {
  test('handles oklch with alpha channel', () => {
    const dark = result.variants.dark?.theme;
    if (dark === undefined) {
      throw new Error('Dark variant should be defined');
    }

    // oklch(1 0 0 / 10%)
    expect(dark.colors.border).toContain('oklch');
    expect(dark.colors.border).toContain('/');
    expect(dark.colors.border).toContain('%');
  });

  test('handles hex color values', () => {
    // default-theme.css has --color-black: #000; --color-white: #fff;
    expect(result.theme.colors.black).toBe('#000');
    expect(result.theme.colors.white).toBe('#fff');
  });

  test('handles multi-line font stacks', () => {
    // default-theme.css has multi-line font family definitions
    const sansFontStack = result.theme.fonts.sans;
    expect(sansFontStack).toBeDefined();

    if (sansFontStack === undefined) {
      throw new Error('Sans font stack should be defined');
    }

    expect(sansFontStack.length).toBeGreaterThan(
      EXPECTED_MIN_FONT_STACK_LENGTH,
    ); // Long font stack
  });
});

describe('Spacing and Layout from Defaults', () => {
  test('includes Tailwind default spacing', () => {
    // default-theme.css has --spacing: 0.25rem
    expect(result.theme.spacing.base).toBe('0.25rem');
  });

  test('includes container sizes from defaults', () => {
    const containers = result.theme.containers;
    expect(containers['3xs']).toBe('16rem');
    expect(containers['2xs']).toBe('18rem');
    expect(containers.xs).toBe('20rem');
    expect(containers.sm).toBe('24rem');
    expect(containers['7xl']).toBe('80rem');
  });
});

describe('Font Sizes with Line Heights from Defaults', () => {
  test('extracts font sizes with line heights', () => {
    // default-theme.css has --text-xs: 0.75rem; --text-xs--line-height: calc(1 / 0.75);
    expect(result.theme.fontSize.xs).toBeDefined();

    const xs = result.theme.fontSize.xs;
    if (xs === undefined || typeof xs === 'string') {
      throw new Error('Font size xs should be an object');
    }

    expect(xs.size).toBe('0.75rem');
    expect(xs.lineHeight).toBe('calc(1 / 0.75)');
  });

  test('extracts all default font sizes', () => {
    const sizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];

    for (const size of sizes) {
      expect(result.theme.fontSize[size]).toBeDefined();
    }
  });
});

describe('Shadows from Defaults', () => {
  test('includes default shadow values', () => {
    expect(result.theme.shadows['2xs']).toBeDefined();
    expect(result.theme.shadows.xs).toBeDefined();
    expect(result.theme.shadows.sm).toBeDefined();
    expect(result.theme.shadows.md).toBeDefined();
    expect(result.theme.shadows.lg).toBeDefined();
    expect(result.theme.shadows.xl).toBeDefined();
    expect(result.theme.shadows['2xl']).toBeDefined();
  });

  test('includes inset shadows', () => {
    expect(result.theme.insetShadows['2xs']).toBeDefined();
    expect(result.theme.insetShadows.xs).toBeDefined();
    expect(result.theme.insetShadows.sm).toBeDefined();
  });

  test('includes drop shadows', () => {
    expect(result.theme.dropShadows.xs).toBeDefined();
    expect(result.theme.dropShadows.sm).toBeDefined();
    expect(result.theme.dropShadows.md).toBeDefined();
  });

  test('includes text shadows', () => {
    expect(result.theme.textShadows['2xs']).toBeDefined();
    expect(result.theme.textShadows.xs).toBeDefined();
    expect(result.theme.textShadows.sm).toBeDefined();
  });
});

describe('Animations and Keyframes from Defaults', () => {
  test('includes default animations', () => {
    expect(result.theme.animations.spin).toBeDefined();
    expect(result.theme.animations.ping).toBeDefined();
    expect(result.theme.animations.pulse).toBeDefined();
    expect(result.theme.animations.bounce).toBeDefined();
  });

  test('includes keyframes', () => {
    expect(result.theme.keyframes.spin).toBeDefined();
    expect(result.theme.keyframes.ping).toBeDefined();
    expect(result.theme.keyframes.pulse).toBeDefined();
    expect(result.theme.keyframes.bounce).toBeDefined();
  });
});

describe('No Unresolved var() References', () => {
  test('base theme has no var() in colors', () => {
    const colors = result.theme.colors;

    // Helper to check all values recursively
    const checkNoVar = (obj: unknown): void => {
      if (typeof obj === 'string') {
        if (obj.startsWith('var(')) {
          throw new Error(`Found unresolved var() reference: ${obj}`);
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (const value of Object.values(obj)) {
          checkNoVar(value);
        }
      }
    };

    checkNoVar(colors);
  });

  test('base theme has no var() in fonts', () => {
    const fonts = result.theme.fonts;

    for (const value of Object.values(fonts)) {
      if (value.startsWith('var(')) {
        throw new Error(`Found unresolved var() in fonts: ${value}`);
      }
    }
  });

  test('variants have minimal var() references', () => {
    // Some variants might have unresolved var() for custom fonts
    // but chart colors should always be resolved
    for (const variant of Object.values(result.variants)) {
      if (variant.theme.colors.chart !== undefined) {
        const chartColors = variant.theme.colors.chart as Record<
          string,
          string
        >;
        for (const value of Object.values(chartColors)) {
          expect(value).not.toContain('var(');
        }
      }
    }
  });
});
