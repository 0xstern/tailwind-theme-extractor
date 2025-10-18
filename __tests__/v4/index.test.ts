/**
 * Basic functionality tests
 */

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../src/v4/index';

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

    expect(result.theme.colors.primary).toBe('#3b82f6');
    expect(result.theme.spacing['4']).toBe('1rem');
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

    expect(result.theme.colors.secondary).toBe('#8b5cf6');
    expect(result.theme.fonts.sans).toBe("'Inter', sans-serif");
  });

  test('throws error when neither input nor css provided', async () => {
    expect(resolveTheme({})).rejects.toThrow(
      'Either input or css must be provided',
    );
  });

  test('resolves from file path', async () => {
    const result = await resolveTheme({
      input: './examples/v4/basic-theme.css',
    });

    expect(result.theme.colors).toBeDefined();
    expect(result.files.length).toBeGreaterThan(0);
  });
});

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

    expect((result.theme.colors.blue as Record<number, string>)[50]).toBe(
      '#eff6ff',
    );
    expect((result.theme.colors.blue as Record<number, string>)[500]).toBe(
      '#3b82f6',
    );
    expect((result.theme.colors.blue as Record<number, string>)[900]).toBe(
      '#1e3a8a',
    );
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
      (result.theme.colors.brandPrimary as Record<number, string>)[500],
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
      (result.theme.colors.button as Record<string, string>)['500-hover'],
    ).toBe('#60a5fa');
    expect(
      (result.theme.colors.button as Record<string, string>)['500-active'],
    ).toBe('#3b82f6');
  });
});

describe('Variant Resolution', () => {
  test('resolves data-theme dark mode variant', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-background: #ffffff;
        }

        [data-theme='dark'] {
          --color-background: #1f2937;
        }
      `,
      resolveImports: false,
    });

    expect(result.theme.colors.background).toBe('#ffffff');
    expect(result.variants.dark).toBeDefined();

    if (result.variants.dark === undefined) {
      throw new Error('Dark variant should be defined');
    }
    expect(result.variants.dark.theme.colors.background).toBe('#1f2937');
  });

  test('resolves class-based variants', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-primary: #3b82f6;
        }

        .midnight {
          --color-primary: #818cf8;
        }
      `,
      resolveImports: false,
    });

    expect(result.variants.midnight).toBeDefined();

    if (result.variants.midnight === undefined) {
      throw new Error('Midnight variant should be defined');
    }
    expect(result.variants.midnight.selector).toBe('.midnight');
    expect(result.variants.midnight.theme.colors.primary).toBe('#818cf8');
  });

  test('resolves media query variants', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-primary: #3b82f6;
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --color-primary: #60a5fa;
          }
        }
      `,
      resolveImports: false,
    });

    expect(result.variants.dark).toBeDefined();

    if (result.variants.dark === undefined) {
      throw new Error('Dark variant should be defined');
    }
    expect(result.variants.dark.selector).toContain(
      'prefers-color-scheme: dark',
    );
  });

  test('merges multiple variant definitions', async () => {
    const result = await resolveTheme({
      css: `
        [data-theme='custom'] {
          --color-primary: #3b82f6;
        }

        [data-theme='custom'] {
          --color-secondary: #8b5cf6;
        }
      `,
      resolveImports: false,
    });

    expect(result.variants.custom).toBeDefined();

    if (result.variants.custom === undefined) {
      throw new Error('Custom variant should be defined');
    }
    expect(result.variants.custom.theme.colors.primary).toBe('#3b82f6');
    expect(result.variants.custom.theme.colors.secondary).toBe('#8b5cf6');
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

    expect(result.theme.fontSize.sm).toBeDefined();

    if (result.theme.fontSize.sm === undefined) {
      throw new Error('Font size sm should be defined');
    }
    expect(result.theme.fontSize.sm.size).toBe('0.875rem');
    expect(result.theme.fontSize.sm.lineHeight).toBe('1.25rem');
  });
});

describe('Import Resolution', () => {
  test('resolves @import statements', async () => {
    const result = await resolveTheme({
      input: './examples/v4/main-theme.css',
      resolveImports: true,
    });

    expect(result.files.length).toBeGreaterThan(1);
    expect(result.files.some((f) => f.includes('main-theme.css'))).toBe(true);
    expect(result.files.some((f) => f.includes('base-colors.css'))).toBe(true);
  });

  test('skips import resolution when disabled', async () => {
    const result = await resolveTheme({
      input: './examples/v4/main-theme.css',
      resolveImports: false,
    });

    expect(result.files.length).toBe(1);
  });
});
