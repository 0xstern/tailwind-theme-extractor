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

  test('creates nested structure for multi-dash color names', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-brand-primary-500: #3b82f6;
        }
      `,
      resolveImports: false,
    });

    // With "every dash = nesting" rule, this creates: colors.brand.primary[500]
    expect(result.variants.default.colors.brand).toBeDefined();
    const brand = result.variants.default.colors.brand as Record<
      string,
      Record<number, string>
    >;
    expect(brand.primary).toBeDefined();
    if (brand.primary !== undefined) {
      expect(brand.primary[500]).toBe('#3b82f6');
    }
  });

  test('handles deeply nested color structures with numeric keys', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-button-500-hover: #60a5fa;
          --color-button-500-active: #3b82f6;
        }
      `,
      resolveImports: false,
    });

    // With "every dash = nesting" rule, this creates: colors.button[500].hover
    expect(result.variants.default.colors.button).toBeDefined();
    const button = result.variants.default.colors.button;

    if (button !== undefined && typeof button !== 'string') {
      const buttonScale = button as unknown as Record<
        string,
        Record<string, string>
      >;
      expect(buttonScale['500']).toBeDefined();
      if (buttonScale['500'] !== undefined) {
        expect(buttonScale['500'].hover).toBe('#60a5fa');
        expect(buttonScale['500'].active).toBe('#3b82f6');
      }
    }
  });
});
