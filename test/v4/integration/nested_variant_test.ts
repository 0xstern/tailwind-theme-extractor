/**
 * Tests for nested @variant support
 * Tests that @variant at-rules inside variant selectors create compound variants
 */

import type { TailwindResult } from '../../../src/v4/types';

import { beforeAll, describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4';

let result: TailwindResult;

beforeAll(async () => {
  result = await resolveTheme({
    input: './test/v4/fixtures/nested_variant_simple.css',
    resolveImports: false,
  });
});

describe('Nested @variant Extraction', () => {
  test('extracts base variant variables', () => {
    expect(result.variants.themeTest).toBeDefined();
    expect(result.variants.themeMulti).toBeDefined();
  });

  test('creates compound variant for nested @variant', () => {
    expect(result.variants.themeTestDark).toBeDefined();
    expect(result.variants.themeMultiDark).toBeDefined();
  });

  test('base variant has correct selector', () => {
    expect(result.selectors.themeTest).toBe('.theme-test');
    expect(result.selectors.themeMulti).toBe('.theme-multi');
  });

  test('compound variant has correct selector', () => {
    expect(result.selectors.themeTestDark).toBe('.theme-test.dark');
    expect(result.selectors.themeMultiDark).toBe('.theme-multi.dark');
  });
});

describe('Nested @variant Variable Resolution', () => {
  test('theme-test base variant has direct declaration values', () => {
    if (result.variants.themeTest === undefined) {
      throw new Error('theme-test variant should be defined');
    }

    // Base variant should only contain direct declarations (not nested @variant values)
    expect(result.variants.themeTest.colors.primary).toBe('red');
  });

  test('theme-test.dark compound variant has nested @variant values', () => {
    if (result.variants.themeTestDark === undefined) {
      throw new Error('theme-test.dark variant should be defined');
    }

    expect(result.variants.themeTestDark.colors.primary).toBe('darkred');
  });

  test('theme-multi base variant has direct declaration values', () => {
    if (result.variants.themeMulti === undefined) {
      throw new Error('theme-multi variant should be defined');
    }

    // Base variant should only contain direct declarations
    expect(result.variants.themeMulti.colors.bg).toBe('white');
    expect(result.variants.themeMulti.colors.fg).toBe('black');
  });

  test('theme-multi.dark compound variant has nested @variant values', () => {
    if (result.variants.themeMultiDark === undefined) {
      throw new Error('theme-multi.dark variant should be defined');
    }

    expect(result.variants.themeMultiDark.colors.bg).toBe('black');
    expect(result.variants.themeMultiDark.colors.fg).toBe('white');
  });
});

describe('Nested @variant with Multiple Levels', () => {
  test('handles deeply nested @variant blocks', async () => {
    const deepCSS = `
      .theme-deep {
        --color-primary: blue;

        @variant dark {
          --color-primary: darkblue;

          @variant hover {
            --color-primary: navy;
          }
        }
      }
    `;

    const deepResult = await resolveTheme({ css: deepCSS });

    // Base variant
    expect(deepResult.variants.themeDeep).toBeDefined();
    if (deepResult.variants.themeDeep === undefined) {
      throw new Error('theme-deep variant should be defined');
    }
    expect(deepResult.variants.themeDeep.colors.primary).toBe('blue');

    // First level nesting
    expect(deepResult.variants.themeDeepDark).toBeDefined();
    if (deepResult.variants.themeDeepDark === undefined) {
      throw new Error('theme-deep.dark variant should be defined');
    }
    expect(deepResult.variants.themeDeepDark.colors.primary).toBe('darkblue');

    // Second level nesting (compound variant name)
    expect(deepResult.variants.themeDeepDarkHover).toBeDefined();
    if (deepResult.variants.themeDeepDarkHover === undefined) {
      throw new Error('theme-deep.dark.hover variant should be defined');
    }
    expect(deepResult.variants.themeDeepDarkHover.colors.primary).toBe('navy');
  });
});

describe('Nested @variant Edge Cases', () => {
  test('handles @variant with whitespace in params', async () => {
    const whitespaceCSS = `
      .whitespace-test {
        --color-primary: blue;
        @variant   dark   {
          --color-primary: navy;
        }
      }
    `;

    const whitespaceResult = await resolveTheme({ css: whitespaceCSS });

    expect(whitespaceResult.variants.whitespaceTestDark).toBeDefined();

    if (whitespaceResult.variants.whitespaceTestDark === undefined) {
      throw new Error('whitespace-test.dark variant should be defined');
    }

    expect(whitespaceResult.variants.whitespaceTestDark.colors.primary).toBe(
      'navy',
    );
  });

  test('handles empty @variant params gracefully', async () => {
    const emptyCSS = `
      .empty-test {
        --color-primary: blue;
        @variant {
          --color-primary: navy;
        }
      }
    `;

    const emptyResult = await resolveTheme({ css: emptyCSS });

    // Should not create a compound variant with empty name
    expect(emptyResult.variants.emptyTest).toBeDefined();
  });

  test('handles multiple @variant blocks in same selector', async () => {
    const multiCSS = `
      .multi-test {
        --color-primary: red;
        --color-secondary: blue;

        @variant dark {
          --color-primary: darkred;
        }

        @variant dark {
          --color-secondary: darkblue;
        }
      }
    `;

    const multiResult = await resolveTheme({ css: multiCSS });

    expect(multiResult.variants.multiTestDark).toBeDefined();

    if (multiResult.variants.multiTestDark === undefined) {
      throw new Error('multi-test.dark variant should be defined');
    }

    // Both variables from separate @variant dark blocks should be merged
    expect(multiResult.variants.multiTestDark.colors.primary).toBe('darkred');
    expect(multiResult.variants.multiTestDark.colors.secondary).toBe(
      'darkblue',
    );
  });

  test('ignores @variant in :root', async () => {
    const rootCSS = `
      :root {
        --color-white: white;
        @variant dark {
          --color-black: black;
        }
      }
    `;

    const rootResult = await resolveTheme({ css: rootCSS });

    // :root is not a variant, so @variant inside it should be ignored
    expect(rootResult.variants['.dark']).toBeUndefined();
    expect(rootResult.variants.dark).toBeUndefined();
    expect(rootResult.variants['root.dark']).toBeUndefined();

    // Only default variant should exist
    expect(Object.keys(rootResult.variants)).toEqual(['default']);
  });

  test('ignores @variant in @theme blocks', async () => {
    const themeCSS = `
      @theme {
        --color-primary: red;
        @variant dark {
          --color-primary: darkred;
        }
      }
    `;

    const themeResult = await resolveTheme({ css: themeCSS });

    // @variant inside @theme should be ignored
    expect(Object.keys(themeResult.variants)).toEqual(['default']);
  });
});

describe('Nested @variant with Complex Selectors', () => {
  test('handles compound selectors with data attributes', async () => {
    const dataCSS = `
      [data-theme='ocean'] {
        --color-primary: blue;
        @variant dark {
          --color-primary: navy;
        }
      }
    `;

    const dataResult = await resolveTheme({ css: dataCSS });

    expect(dataResult.variants.ocean).toBeDefined();
    expect(dataResult.variants.oceanDark).toBeDefined();

    if (dataResult.variants.oceanDark === undefined) {
      throw new Error('ocean.dark variant should be defined');
    }

    expect(dataResult.variants.oceanDark.colors.primary).toBe('navy');
  });

  test('handles class selectors with @variant', async () => {
    const classCSS = `
      .midnight {
        --color-background: #0f172a;
        @variant hover {
          --color-background: #1e293b;
        }
      }
    `;

    const classResult = await resolveTheme({ css: classCSS });

    expect(classResult.variants.midnight).toBeDefined();
    expect(classResult.variants.midnightHover).toBeDefined();

    if (classResult.variants.midnightHover === undefined) {
      throw new Error('midnight.hover variant should be defined');
    }

    expect(classResult.variants.midnightHover.colors.background).toBe(
      '#1e293b',
    );
  });
});
