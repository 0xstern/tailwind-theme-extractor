/**
 * Color scale resolution integration tests
 * Tests the complete workflow of resolving color scales with numeric keys and camelCase naming
 */

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4';

describe('Color Scale Resolution', () => {
  test('resolves standard numeric color scales', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-blue-50: #eff6ff;
          --color-blue-500: #3b82f6;
          --color-blue-900: #1e3a8a;
        }
      `,
      resolveImports: false,
    });

    expect(
      (result.variants.default.colors.blue as Record<number, string>)[50],
    ).toBe('#eff6ff');
    expect(
      (result.variants.default.colors.blue as Record<number, string>)[500],
    ).toBe('#3b82f6');
    expect(
      (result.variants.default.colors.blue as Record<number, string>)[900],
    ).toBe('#1e3a8a');
  });

  test('converts multi-word color names to camelCase', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-brand-primary-500: #3b82f6;
        }
      `,
      resolveImports: false,
    });

    expect(
      (
        result.variants.default.colors.brandPrimary as Record<number, string>
      )[500],
    ).toBe('#3b82f6');
  });

  test('handles color variants with suffixes', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-button-500-hover: #60a5fa;
          --color-button-500-active: #3b82f6;
        }
      `,
      resolveImports: false,
    });

    expect(
      (result.variants.default.colors.button as Record<string, string>)[
        '500-hover'
      ],
    ).toBe('#60a5fa');
    expect(
      (result.variants.default.colors.button as Record<string, string>)[
        '500-active'
      ],
    ).toBe('#3b82f6');
  });
});
