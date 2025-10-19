/**
 * Variant resolution integration tests
 * Tests theme variant detection and resolution across different selector types
 */

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4/index';

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

    expect(result.variants.default.colors.background).toBe('#ffffff');
    expect(result.variants.dark).toBeDefined();

    if (result.variants.dark === undefined) {
      throw new Error('Dark variant should be defined');
    }
    expect(result.variants.dark.colors.background).toBe('#1f2937');
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
    expect(result.selectors.midnight).toBe('.midnight');
    expect(result.variants.midnight.colors.primary).toBe('#818cf8');
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
    expect(result.selectors.dark).toContain('prefers-color-scheme: dark');
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
    expect(result.variants.custom.colors.primary).toBe('#3b82f6');
    expect(result.variants.custom.colors.secondary).toBe('#8b5cf6');
  });
});
