/**
 * Regression test for bug where nesting configuration was not applied to Tailwind defaults
 * Issue: src/v4/index.ts was not passing `nesting` parameter to loadTailwindDefaults()
 */

import path from 'node:path';

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4';

const FIXTURES_DIR = path.join(import.meta.dir, '../fixtures');
const DEFAULT_THEME_PATH = path.join(FIXTURES_DIR, 'default_theme.css');

describe('Nesting configuration applies to Tailwind defaults (regression)', () => {
  test('maxDepth: 0 flattens default colors with camelCase', async () => {
    const result = await resolveTheme({
      input: DEFAULT_THEME_PATH,
      resolveImports: false,
      includeDefaults: false, // Fixture already contains defaults
      nesting: {
        default: {
          maxDepth: 0,
          flattenMode: 'camelcase',
        },
      },
    });

    const colors = result.variants.default.colors;

    // With maxDepth: 0, blue-500 should become blue500 (flat)
    expect(colors).toHaveProperty('blue50');
    expect(colors).toHaveProperty('blue100');
    expect(colors).toHaveProperty('blue500');

    // Should NOT have nested structure
    expect(colors.blue).toBeUndefined();
  });

  test('maxDepth: 0 flattens default colors with literal', async () => {
    const result = await resolveTheme({
      input: DEFAULT_THEME_PATH,
      resolveImports: false,
      includeDefaults: false, // Fixture already contains defaults
      nesting: {
        default: {
          maxDepth: 0,
          flattenMode: 'literal',
        },
      },
    });

    const colors = result.variants.default.colors;

    // With maxDepth: 0 and flattenMode: 'literal', blue-500 should become 'blue-500'
    expect(colors).toHaveProperty('blue-50');
    expect(colors).toHaveProperty('blue-100');
    expect(colors).toHaveProperty('blue-500');

    // Should NOT have nested structure
    expect(colors.blue).toBeUndefined();
  });

  test('maxDepth: 1 limits default color nesting depth', async () => {
    const result = await resolveTheme({
      input: DEFAULT_THEME_PATH,
      resolveImports: false,
      includeDefaults: false, // Fixture already contains defaults
      nesting: {
        default: {
          maxDepth: 1,
          flattenMode: 'camelcase',
        },
      },
    });

    const colors = result.variants.default.colors;

    // With maxDepth: 1, we have 1 nesting level:
    // --color-blue-50 → colors.blue['50'] (blue is the 1st level, 50 is the final key)
    expect(colors.blue).toBeDefined();
    expect(typeof colors.blue).toBe('object');

    // The numeric keys should be present as properties
    const blue = colors.blue as Record<string, unknown>;
    expect(blue).toHaveProperty('50'); // --color-blue-50 → blue['50']
    expect(blue).toHaveProperty('500'); // --color-blue-500 → blue['500']
  });

  test('user variables and defaults use same nesting configuration', async () => {
    // This test uses inline CSS with user variables
    // The defaults from the fixture get merged with the user variables
    const result = await resolveTheme({
      css: `
        @import "${DEFAULT_THEME_PATH}";

        @theme {
          --color-custom-deep-blue: #0000ff;
        }
      `,
      resolveImports: true,
      includeDefaults: false, // Using fixture instead
      nesting: {
        default: {
          maxDepth: 0,
          flattenMode: 'camelcase',
        },
      },
    });

    const colors = result.variants.default.colors;

    // Both user colors and defaults should be flattened the same way
    expect(colors).toHaveProperty('customDeepBlue'); // User color: custom-deep-blue → customDeepBlue
    expect(colors).toHaveProperty('blue500'); // Default: blue-500 → blue500

    // Neither should have nested structure
    expect(colors.blue).toBeUndefined();
    expect(colors.custom).toBeUndefined();
  });
});
