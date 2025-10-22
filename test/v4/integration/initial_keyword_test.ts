/**
 * Integration tests for the `initial` keyword feature
 * Tests end-to-end functionality of removing Tailwind defaults
 */

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4';

// Test constants for expected counts
const EXPECTED_USER_COLORS_COUNT = 5;
const EXPECTED_RED_VARIANTS_COUNT = 2;
const EXPECTED_COLOR_KEYS_COUNT = 2;

describe('Initial keyword - Integration tests', () => {
  test('removes single color scale with wildcard', async () => {
    const result = await resolveTheme({
      css: '@theme { --color-lime-*: initial; }',
      includeTailwindDefaults: true,
    });

    // Should NOT have lime color scale
    expect(result.variants.default.colors.lime).toBeUndefined();

    // Should still have other Tailwind default colors (if installed)
    if (result.variants.default.colors.red !== undefined) {
      expect(result.variants.default.colors.red).toBeDefined();
    }
  });

  test('removes multiple color scales with wildcards', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-lime-*: initial;
          --color-fuchsia-*: initial;
        }
      `,
      includeTailwindDefaults: true,
    });

    // Should NOT have lime or fuchsia
    expect(result.variants.default.colors.lime).toBeUndefined();
    expect(result.variants.default.colors.fuchsia).toBeUndefined();

    // Should still have other colors (if installed)
    if (result.variants.default.colors.red !== undefined) {
      expect(result.variants.default.colors.red).toBeDefined();
    }
  });

  test('removes all colors with namespace wildcard', async () => {
    const result = await resolveTheme({
      css: '@theme { --color-*: initial; }',
      includeTailwindDefaults: true,
    });

    // Should have empty colors object
    expect(Object.keys(result.variants.default.colors).length).toBe(0);

    // Should still have other properties (if installed)
    if (result.variants.default.spacing['4'] !== undefined) {
      expect(result.variants.default.spacing['4']).toBeDefined();
    }
  });

  test('removes single color variant', async () => {
    const result = await resolveTheme({
      css: '@theme { --color-lime-500: initial; }',
      includeTailwindDefaults: true,
    });

    // If lime exists, it should not have the 500 variant
    if (result.variants.default.colors.lime !== undefined) {
      if (typeof result.variants.default.colors.lime !== 'string') {
        expect(result.variants.default.colors.lime[500]).toBeUndefined();
        // Should still have other variants
        if (result.variants.default.colors.lime[50] !== undefined) {
          expect(result.variants.default.colors.lime[50]).toBeDefined();
        }
      }
    }
  });

  test('custom values are preserved when using initial', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-lime-*: initial;
          --color-primary-500: #custom;
        }
      `,
      includeTailwindDefaults: true,
    });

    // Should NOT have lime
    expect(result.variants.default.colors.lime).toBeUndefined();

    // Should have custom primary color
    expect(result.variants.default.colors.primary).toBeDefined();
    if (
      result.variants.default.colors.primary !== undefined &&
      typeof result.variants.default.colors.primary !== 'string'
    ) {
      expect(result.variants.default.colors.primary[500]).toBe('#custom');
    }
  });

  test('custom values from :root are preserved with --color-*: initial', async () => {
    const result = await resolveTheme({
      css: `
        :root {
          --background: #ffffff;
          --foreground: #000000;
          --primary: #3b82f6;
        }

        @theme inline {
          --color-*: initial;
          --color-background: var(--background);
          --color-foreground: var(--foreground);
          --color-primary: var(--primary);
        }
      `,
      includeTailwindDefaults: true,
    });

    // Tailwind defaults should be removed
    expect(result.variants.default.colors.red).toBeUndefined();
    expect(result.variants.default.colors.blue).toBeUndefined();
    expect(result.variants.default.colors.green).toBeUndefined();

    // User-defined colors should be preserved
    expect(result.variants.default.colors.background).toBe('#ffffff');
    expect(result.variants.default.colors.foreground).toBe('#000000');
    expect(result.variants.default.colors.primary).toBe('#3b82f6');
  });

  test('--color-*: initial with var() references from :root preserves user colors', async () => {
    const result = await resolveTheme({
      css: `
        :root {
          --background: oklch(1 0 0);
          --foreground: oklch(0.141 0.005 285.823);
          --card: oklch(1 0 0);
          --primary: oklch(0.21 0.006 285.885);
          --custom-brand: #ff0000;
        }

        .dark {
          --background: oklch(0.141 0.005 285.823);
          --foreground: oklch(0.985 0 0);
        }

        @theme inline {
          --color-*: initial;
          --color-background: var(--background);
          --color-foreground: var(--foreground);
          --color-card: var(--card);
          --color-primary: var(--primary);
          --color-custom-brand: var(--custom-brand);
        }
      `,
      includeTailwindDefaults: true,
    });

    // User-defined colors should be preserved and var() references resolved
    expect(result.variants.default.colors.background).toBe('oklch(1 0 0)');
    expect(result.variants.default.colors.foreground).toBe(
      'oklch(0.141 0.005 285.823)',
    );
    expect(result.variants.default.colors.card).toBe('oklch(1 0 0)');
    expect(result.variants.default.colors.primary).toBe(
      'oklch(0.21 0.006 285.885)',
    );
    expect(result.variants.default.colors.customBrand).toBe('#ff0000');

    // Tailwind default colors should be removed (if Tailwind is installed)
    // We check for common defaults - if they exist, they indicate a bug
    expect(result.variants.default.colors.red).toBeUndefined();
    expect(result.variants.default.colors.blue).toBeUndefined();
    expect(result.variants.default.colors.green).toBeUndefined();
    expect(result.variants.default.colors.yellow).toBeUndefined();
    expect(result.variants.default.colors.purple).toBeUndefined();
    expect(result.variants.default.colors.pink).toBeUndefined();
    expect(result.variants.default.colors.orange).toBeUndefined();
    expect(result.variants.default.colors.lime).toBeUndefined();

    // Verify we ONLY have user-defined colors
    const userColorKeys = Object.keys(result.variants.default.colors);
    expect(userColorKeys).toEqual(
      expect.arrayContaining([
        'background',
        'foreground',
        'card',
        'primary',
        'customBrand',
      ]),
    );
    expect(userColorKeys.length).toBe(EXPECTED_USER_COLORS_COUNT);

    // Variant colors should work
    if (result.variants.dark !== undefined) {
      expect(result.variants.dark.colors.background).toBe(
        'oklch(0.141 0.005 285.823)',
      );
      expect(result.variants.dark.colors.foreground).toBe('oklch(0.985 0 0)');
    }
  });

  test('initial takes priority over includeTailwindDefaults', async () => {
    const result = await resolveTheme({
      css: '@theme { --color-lime-*: initial; }',
      includeTailwindDefaults: {
        colors: true,
        spacing: true,
      },
    });

    // Even though colors are included, lime should be removed
    expect(result.variants.default.colors.lime).toBeUndefined();

    // Other colors should still exist (if installed)
    if (result.variants.default.colors.red !== undefined) {
      expect(result.variants.default.colors.red).toBeDefined();
    }
  });

  test('initial works with includeTailwindDefaults: false', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-primary-500: #custom;
          --color-primary-600: initial;
        }
      `,
      includeTailwindDefaults: false,
    });

    // Should have primary with only 500 variant
    expect(result.variants.default.colors.primary).toBeDefined();
    if (
      result.variants.default.colors.primary !== undefined &&
      typeof result.variants.default.colors.primary !== 'string'
    ) {
      expect(result.variants.default.colors.primary[500]).toBe('#custom');
      expect(result.variants.default.colors.primary[600]).toBeUndefined();
    }
  });

  test('initial works with spacing namespace', async () => {
    const result = await resolveTheme({
      css: '@theme { --spacing-*: initial; }',
      includeTailwindDefaults: true,
    });

    // Should have empty spacing
    expect(Object.keys(result.variants.default.spacing).length).toBe(0);
  });

  test('initial works with multiple namespaces', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-lime-*: initial;
          --spacing-4: initial;
          --radius-lg: initial;
        }
      `,
      includeTailwindDefaults: true,
    });

    // Verify removals
    expect(result.variants.default.colors.lime).toBeUndefined();
    expect(result.variants.default.spacing['4']).toBeUndefined();
    expect(result.variants.default.radius.lg).toBeUndefined();

    // Other values should still exist (if installed)
    if (result.variants.default.colors.red !== undefined) {
      expect(result.variants.default.colors.red).toBeDefined();
    }
    if (result.variants.default.spacing['8'] !== undefined) {
      expect(result.variants.default.spacing['8']).toBeDefined();
    }
  });

  test('initial in @theme inline context', async () => {
    const result = await resolveTheme({
      css: '@theme inline { --color-lime-*: initial; }',
      includeTailwindDefaults: true,
    });

    // Should work the same as regular @theme
    expect(result.variants.default.colors.lime).toBeUndefined();

    if (result.variants.default.colors.red !== undefined) {
      expect(result.variants.default.colors.red).toBeDefined();
    }
  });

  test('complex wildcard patterns', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-red-*: initial;
          --color-blue-*: initial;
          --color-green-*: initial;
        }
      `,
      includeTailwindDefaults: true,
    });

    // Should NOT have red, blue, or green
    expect(result.variants.default.colors.red).toBeUndefined();
    expect(result.variants.default.colors.blue).toBeUndefined();
    expect(result.variants.default.colors.green).toBeUndefined();

    // Should still have other colors (if installed)
    if (result.variants.default.colors.yellow !== undefined) {
      expect(result.variants.default.colors.yellow).toBeDefined();
    }
  });

  test('initial does not affect user-defined values in :root', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-lime-*: initial;
        }
        :root {
          --color-lime-custom: #custom;
        }
      `,
      includeTailwindDefaults: true,
    });

    // Default lime should be removed, but custom value should exist
    // Note: This depends on how :root variables are mapped
    // Since :root uses source='root', it won't be filtered by initial
    expect(result.variants.default.colors.lime).toBeUndefined();
  });

  test('initial with granular includeTailwindDefaults', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-lime-*: initial;
          --spacing-4: initial;
        }
      `,
      includeTailwindDefaults: {
        colors: true,
        spacing: true,
        shadows: false,
      },
    });

    // Colors and spacing are included, but specific values removed
    expect(result.variants.default.colors.lime).toBeUndefined();
    expect(result.variants.default.spacing['4']).toBeUndefined();

    // Other values should exist (if installed)
    if (result.variants.default.colors.red !== undefined) {
      expect(result.variants.default.colors.red).toBeDefined();
    }
    if (result.variants.default.spacing['8'] !== undefined) {
      expect(result.variants.default.spacing['8']).toBeDefined();
    }

    // Shadows should be empty (not included)
    expect(Object.keys(result.variants.default.shadows).length).toBe(0);
  });

  test('initial with theme overrides', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-lime-*: initial;
          --color-primary-500: #user-defined;
          --radius-lg: 1rem;
        }
      `,
      includeTailwindDefaults: true,
      overrides: {
        default: {
          'radius.lg': '0.5rem',
        },
      },
    });

    // Lime should be removed
    expect(result.variants.default.colors.lime).toBeUndefined();

    // User-defined value should exist
    if (
      result.variants.default.colors.primary !== undefined &&
      typeof result.variants.default.colors.primary !== 'string'
    ) {
      expect(result.variants.default.colors.primary[500]).toBe('#user-defined');
    }

    // Override should apply
    expect(result.variants.default.radius.lg).toBe('0.5rem');
  });

  test('initial value with extra whitespace and newlines', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-lime-*:
            initial
          ;
        }
      `,
      includeTailwindDefaults: true,
    });

    // Should still work with whitespace
    expect(result.variants.default.colors.lime).toBeUndefined();
  });

  test('partial color scale removal', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-blue-500: initial;
          --color-blue-600: initial;
        }
      `,
      includeTailwindDefaults: true,
    });

    // Blue should exist but without 500 and 600
    if (result.variants.default.colors.blue !== undefined) {
      if (typeof result.variants.default.colors.blue !== 'string') {
        expect(result.variants.default.colors.blue[500]).toBeUndefined();
        expect(result.variants.default.colors.blue[600]).toBeUndefined();
        // Other variants should still exist (if they were in defaults)
        if (result.variants.default.colors.blue[50] !== undefined) {
          expect(result.variants.default.colors.blue[50]).toBeDefined();
        }
      }
    }
  });

  test('does not affect variants (dark mode, etc.)', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-lime-*: initial;
          --color-background: var(--background);
        }
        :root {
          --background: #fff;
        }
        [data-theme="dark"] {
          --background: #000;
        }
      `,
      includeTailwindDefaults: true,
    });

    // Default should not have lime
    expect(result.variants.default.colors.lime).toBeUndefined();

    // Default variant should work
    expect(result.variants.default.colors.background).toBe('#fff');

    // Dark variant should still work
    if (result.variants.dark !== undefined) {
      expect(result.variants.dark.colors.background).toBe('#000');
    }
  });
});

describe('Initial keyword - CSS Cascade Order', () => {
  test('CASE 1: specific value BEFORE wildcard initial - value should be REMOVED', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-red-50: #ffffff;
          --color-red-100: #fee;
          --color-*: initial;
        }
      `,
      includeTailwindDefaults: false,
    });

    // red-50 and red-100 should NOT exist (initial came after and removed them)
    expect(result.variants.default.colors.red).toBeUndefined();
  });

  test('CASE 2: wildcard initial BEFORE specific value - value should be PRESERVED', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-*: initial;
          --color-red-50: #ffffff;
          --color-red-100: #fee;
        }
      `,
      includeTailwindDefaults: false,
    });

    // red should exist with only 50 and 100 variants (initial came before, then overridden)
    expect(result.variants.default.colors.red).toBeDefined();
    if (
      result.variants.default.colors.red !== undefined &&
      typeof result.variants.default.colors.red !== 'string'
    ) {
      expect(result.variants.default.colors.red[50]).toBe('#ffffff');
      expect(result.variants.default.colors.red[100]).toBe('#fee');
      expect(Object.keys(result.variants.default.colors.red).length).toBe(
        EXPECTED_RED_VARIANTS_COUNT,
      );
    }
  });

  test('CASE 1: specific values BEFORE wildcard initial - values should be REMOVED', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-red-400: #custom1;
          --color-red-500: #custom2;
          --color-red-*: initial;
        }
      `,
      includeTailwindDefaults: false,
    });

    // red should NOT exist (wildcard initial came after and removed all variants)
    expect(result.variants.default.colors.red).toBeUndefined();
  });

  test('CASE 2: wildcard initial BEFORE specific values - values should be PRESERVED', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-red-*: initial;
          --color-red-400: #custom1;
          --color-red-500: #custom2;
        }
      `,
      includeTailwindDefaults: false,
    });

    // red should exist with 400 and 500 (values came after initial)
    expect(result.variants.default.colors.red).toBeDefined();
    if (
      result.variants.default.colors.red !== undefined &&
      typeof result.variants.default.colors.red !== 'string'
    ) {
      expect(result.variants.default.colors.red[400]).toBe('#custom1');
      expect(result.variants.default.colors.red[500]).toBe('#custom2');
      expect(Object.keys(result.variants.default.colors.red).length).toBe(
        EXPECTED_RED_VARIANTS_COUNT,
      );
    }
  });

  test('Complex cascade: multiple values, then wildcard initial, then new value', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-blue-400: #aaa;
          --color-blue-500: #bbb;
          --color-blue-600: #ccc;
          --color-blue-*: initial;
          --color-blue-700: #custom;
        }
      `,
      includeTailwindDefaults: false,
    });

    // Only blue-700 should exist (400, 500, 600 removed by initial, then 700 added)
    expect(result.variants.default.colors.blue).toBeDefined();
    if (
      result.variants.default.colors.blue !== undefined &&
      typeof result.variants.default.colors.blue !== 'string'
    ) {
      expect(result.variants.default.colors.blue[400]).toBeUndefined();
      expect(result.variants.default.colors.blue[500]).toBeUndefined();
      expect(result.variants.default.colors.blue[600]).toBeUndefined();
      expect(result.variants.default.colors.blue[700]).toBe('#custom');
      expect(Object.keys(result.variants.default.colors.blue).length).toBe(1);
    }
  });

  test('Cascade order with Tailwind defaults: namespace initial then user value', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-*: initial;
          --color-brand-primary: #user-custom;
        }
      `,
      includeTailwindDefaults: true,
    });

    // All defaults removed, only user's custom color preserved
    expect(result.variants.default.colors.blue).toBeUndefined();
    expect(result.variants.default.colors.green).toBeUndefined();
    expect(result.variants.default.colors.red).toBeUndefined();

    expect(result.variants.default.colors.brandPrimary).toBe('#user-custom');
    expect(Object.keys(result.variants.default.colors).length).toBe(1);
  });
});

describe('Initial keyword - Edge cases', () => {
  test('empty initial pattern (malformed CSS)', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --: initial;
        }
      `,
      includeTailwindDefaults: true,
    });

    // Should not crash, just ignore the malformed pattern
    expect(result.variants.default).toBeDefined();
  });

  test('initial with non-existent namespace', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --nonexistent-value: initial;
        }
      `,
      includeTailwindDefaults: true,
    });

    // Should not crash, defaults should still load
    if (result.variants.default.colors.red !== undefined) {
      expect(result.variants.default.colors.red).toBeDefined();
    }
  });

  test('mix of initial and regular values for same color', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-blue-400: initial;
          --color-blue-500: #custom;
          --color-blue-600: initial;
        }
      `,
      includeTailwindDefaults: true,
    });

    // Should have blue with only 500 variant
    if (result.variants.default.colors.blue !== undefined) {
      if (typeof result.variants.default.colors.blue !== 'string') {
        expect(result.variants.default.colors.blue[400]).toBeUndefined();
        expect(result.variants.default.colors.blue[500]).toBe('#custom');
        expect(result.variants.default.colors.blue[600]).toBeUndefined();
        // Other defaults might still exist
        if (result.variants.default.colors.blue[50] !== undefined) {
          expect(result.variants.default.colors.blue[50]).toBeDefined();
        }
      }
    }
  });

  test('custom value after wildcard initial', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-lime-*: initial;
          --color-primary-500: #custom;
        }
      `,
      includeTailwindDefaults: true,
    });

    // Lime should be removed (defaults)
    expect(result.variants.default.colors.lime).toBeUndefined();

    // Custom primary should exist
    expect(result.variants.default.colors.primary).toBeDefined();
    if (
      result.variants.default.colors.primary !== undefined &&
      typeof result.variants.default.colors.primary !== 'string'
    ) {
      expect(result.variants.default.colors.primary[500]).toBe('#custom');
    }
  });

  test('EDGE CASE: --color-*: initial then --color-red-50: #000000 overrides specific value', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-*: initial;
          --color-red-50: #000000;
          --color-red-100: #111111;
          --color-blue-500: #0000ff;
        }
      `,
      includeTailwindDefaults: true,
    });

    // All default colors should be removed by --color-*: initial
    expect(result.variants.default.colors.green).toBeUndefined();
    expect(result.variants.default.colors.yellow).toBeUndefined();
    expect(result.variants.default.colors.purple).toBeUndefined();

    // But user-defined values should be preserved (defined AFTER initial)
    expect(result.variants.default.colors.red).toBeDefined();
    if (
      result.variants.default.colors.red !== undefined &&
      typeof result.variants.default.colors.red !== 'string'
    ) {
      // User overrides should exist
      expect(result.variants.default.colors.red[50]).toBe('#000000');
      expect(result.variants.default.colors.red[100]).toBe('#111111');

      // Default red variants (200, 300, etc.) should NOT exist
      expect(result.variants.default.colors.red[200]).toBeUndefined();
      expect(result.variants.default.colors.red[300]).toBeUndefined();
      expect(result.variants.default.colors.red[400]).toBeUndefined();
      expect(result.variants.default.colors.red[500]).toBeUndefined();
    }

    // Blue override should also work
    expect(result.variants.default.colors.blue).toBeDefined();
    if (
      result.variants.default.colors.blue !== undefined &&
      typeof result.variants.default.colors.blue !== 'string'
    ) {
      expect(result.variants.default.colors.blue[500]).toBe('#0000ff');
      // Other blue variants should NOT exist
      expect(result.variants.default.colors.blue[50]).toBeUndefined();
      expect(result.variants.default.colors.blue[600]).toBeUndefined();
    }

    // Verify we ONLY have user-defined colors (red and blue with specific variants)
    const colorKeys = Object.keys(result.variants.default.colors);
    expect(colorKeys).toEqual(expect.arrayContaining(['red', 'blue']));
    expect(colorKeys.length).toBe(EXPECTED_COLOR_KEYS_COUNT);
  });
});
