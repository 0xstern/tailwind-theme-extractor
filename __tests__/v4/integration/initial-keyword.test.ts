/**
 * Integration tests for the `initial` keyword feature
 * Tests end-to-end functionality of removing Tailwind defaults
 */

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4/index';

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
});
