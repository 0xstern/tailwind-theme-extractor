import { describe, expect, test } from 'bun:test';

import { extractTheme } from '../../src/v4/index';

// Test constants
const EXPECTED_DEPRECATION_WARNING_COUNT_FOUR = 4;
const EXPECTED_DEPRECATION_WARNING_COUNT_TWO = 2;

describe('Singular Variables (Deprecated Format)', () => {
  test('handles --spacing (singular) as spacing.base', async () => {
    const result = await extractTheme({
      css: '@theme { --spacing: 0.25rem; }',
      includeTailwindDefaults: false,
    });

    expect(result.theme.spacing.base).toBe('0.25rem');
  });

  test('handles --blur (singular) as blur.default', async () => {
    const result = await extractTheme({
      css: '@theme { --blur: 8px; }',
      includeTailwindDefaults: false,
    });

    expect(result.theme.blur.default).toBe('8px');
  });

  test('handles --shadow (singular) as shadows.default', async () => {
    const result = await extractTheme({
      css: '@theme { --shadow: 0 1px 3px rgba(0,0,0,0.1); }',
      includeTailwindDefaults: false,
    });

    expect(result.theme.shadows.default).toBe('0 1px 3px rgba(0,0,0,0.1)');
  });

  test('handles --radius (singular) as radius.default', async () => {
    const result = await extractTheme({
      css: '@theme { --radius: 0.25rem; }',
      includeTailwindDefaults: false,
    });

    expect(result.theme.radius.default).toBe('0.25rem');
  });

  test('handles multiple singular variables together', async () => {
    const result = await extractTheme({
      css: `
        @theme {
          --spacing: 0.25rem;
          --blur: 8px;
          --shadow: 0 1px 3px rgba(0,0,0,0.1);
          --radius: 0.25rem;
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.theme.spacing.base).toBe('0.25rem');
    expect(result.theme.blur.default).toBe('8px');
    expect(result.theme.shadows.default).toBe('0 1px 3px rgba(0,0,0,0.1)');
    expect(result.theme.radius.default).toBe('0.25rem');
  });

  test('singular variables work alongside suffixed versions', async () => {
    const result = await extractTheme({
      css: `
        @theme {
          --blur: 8px;
          --blur-sm: 4px;
          --blur-lg: 16px;
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.theme.blur.default).toBe('8px');
    expect(result.theme.blur.sm).toBe('4px');
    expect(result.theme.blur.lg).toBe('16px');
  });

  test('unknown singular variables use "default" key', async () => {
    const result = await extractTheme({
      css: '@theme { --custom: some-value; }',
      includeTailwindDefaults: false,
    });

    // Should extract with 'default' key for unknown namespaces
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0]?.name).toBe('--custom');
    expect(result.variables[0]?.value).toBe('some-value');
  });

  test('singular variables work with variants', async () => {
    const result = await extractTheme({
      css: `
        @theme {
          --blur: 4px;
        }

        [data-theme='dark'] {
          --blur: 8px;
        }
      `,
      includeTailwindDefaults: false,
    });

    // Base theme
    expect(result.theme.blur.default).toBe('4px');

    // Dark variant
    expect(result.variants.dark).toBeDefined();
    expect(result.variants.dark?.theme.blur.default).toBe('8px');
  });

  test('preserves singular variable values exactly as defined', async () => {
    const result = await extractTheme({
      css: `
        @theme {
          --spacing: calc(0.25rem * 2);
          --blur: var(--custom-blur);
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.theme.spacing.base).toBe('calc(0.25rem * 2)');
    expect(result.theme.blur.default).toBe('var(--custom-blur)');
  });

  test('generates deprecation warnings for known singular variables', async () => {
    const result = await extractTheme({
      css: `
        @theme {
          --spacing: 0.25rem;
          --blur: 8px;
          --shadow: 0 1px 3px rgba(0,0,0,0.1);
          --radius: 0.25rem;
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.deprecationWarnings).toHaveLength(
      EXPECTED_DEPRECATION_WARNING_COUNT_FOUR,
    );

    expect(result.deprecationWarnings[0]).toEqual({
      variable: '--spacing',
      message: "Singular variable '--spacing' is deprecated in Tailwind v4",
      replacement: '--spacing-base',
    });

    expect(result.deprecationWarnings[1]).toEqual({
      variable: '--blur',
      message: "Singular variable '--blur' is deprecated in Tailwind v4",
      replacement: '--blur-sm or --blur-md',
    });

    expect(result.deprecationWarnings[2]).toEqual({
      variable: '--shadow',
      message: "Singular variable '--shadow' is deprecated in Tailwind v4",
      replacement: '--shadow-sm or --shadow-md',
    });

    expect(result.deprecationWarnings[3]).toEqual({
      variable: '--radius',
      message: "Singular variable '--radius' is deprecated in Tailwind v4",
      replacement: '--radius-sm or --radius-md',
    });
  });

  test('does not generate warnings for suffixed variables', async () => {
    const result = await extractTheme({
      css: `
        @theme {
          --blur-sm: 4px;
          --blur-lg: 16px;
          --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.deprecationWarnings).toHaveLength(0);
  });

  test('deprecation warnings work with variants', async () => {
    const result = await extractTheme({
      css: `
        @theme {
          --blur: 4px;
        }

        [data-theme='dark'] {
          --blur: 8px;
        }
      `,
      includeTailwindDefaults: false,
    });

    // Should have 2 warnings (base + variant)
    expect(result.deprecationWarnings).toHaveLength(
      EXPECTED_DEPRECATION_WARNING_COUNT_TWO,
    );
    expect(result.deprecationWarnings[0]?.variable).toBe('--blur');
    expect(result.deprecationWarnings[1]?.variable).toBe('--blur');
  });
});
