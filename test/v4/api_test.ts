/**
 * Basic API functionality tests
 * Tests the core resolveTheme API with simple use cases
 */

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../src/v4';

describe('Basic Theme Resolution', () => {
  test('resolves theme from @theme block', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-primary: #3b82f6;
          --spacing-4: 1rem;
        }
      `,
      resolveImports: false,
    });

    expect(result.variants.default.colors.primary).toBe('#3b82f6');
    expect(result.variants.default.spacing['4']).toBe('1rem');
  });

  test('resolves theme from :root block', async () => {
    const result = await resolveTheme({
      css: `
        :root {
          --color-secondary: #8b5cf6;
          --font-sans: 'Inter', sans-serif;
        }
      `,
      resolveImports: false,
    });

    expect(result.variants.default.colors.secondary).toBe('#8b5cf6');
    expect(result.variants.default.fonts.sans).toBe("'Inter', sans-serif");
  });

  test('throws error when neither input nor css provided', async () => {
    expect(resolveTheme({})).rejects.toThrow(
      'Either input or css must be provided',
    );
  });

  test('resolves from file path', async () => {
    const result = await resolveTheme({
      input: './test/v4/fixtures/base_theme.css',
    });

    expect(result.variants.default.colors).toBeDefined();
    expect(result.variants.default.colors.white).toBe('#ffffff');
    expect(result.variants.default.spacing['1']).toBe('0.25rem');
    expect(result.files.length).toBe(1);
  });
});

describe('Font Size Resolution', () => {
  test('resolves font sizes with line heights', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --text-sm: 0.875rem;
          --text-sm--line-height: 1.25rem;
        }
      `,
      resolveImports: false,
    });

    expect(result.variants.default.fontSize.sm).toBeDefined();

    if (result.variants.default.fontSize.sm === undefined) {
      throw new Error('Font size sm should be defined');
    }
    expect(result.variants.default.fontSize.sm.size).toBe('0.875rem');
    expect(result.variants.default.fontSize.sm.lineHeight).toBe('1.25rem');
  });
});
