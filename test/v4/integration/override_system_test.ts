/**
 * Integration tests for the theme override system
 * Tests the complete pipeline from CSS parsing through override application
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4';

const TEST_CSS = `
@theme {
  --color-primary-500: #3b82f6;
  --color-background: #ffffff;
  --radius-lg: 1rem;
  --font-sans: system-ui, sans-serif;
}

[data-theme="dark"] {
  --color-background: #1a1a1a;
}
`;

/**
 * Helper to create a temporary CSS file for testing
 *
 * @param css - CSS content to write to the file
 * @returns Object containing the temporary directory and CSS file path
 */
async function createTempCssFile(
  css: string,
): Promise<{ tempDir: string; cssPath: string }> {
  const tempDir = join(tmpdir(), `override-test-${Date.now()}`);
  const cssPath = join(tempDir, 'theme.css');

  await mkdir(tempDir, { recursive: true });
  await writeFile(cssPath, css, 'utf-8');

  return { tempDir, cssPath };
}

describe('Theme Override System - Integration', () => {
  test('applies flat notation override to default theme', async () => {
    const { tempDir, cssPath } = await createTempCssFile(TEST_CSS);

    try {
      const result = await resolveTheme({
        input: cssPath,
        includeTailwindDefaults: false,
        overrides: {
          default: {
            'radius.lg': '0.5rem',
          },
        },
      });

      expect(result.variants.default!.radius.lg).toBe('0.5rem');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('applies nested notation override to default theme', async () => {
    const { tempDir, cssPath } = await createTempCssFile(TEST_CSS);

    try {
      const result = await resolveTheme({
        input: cssPath,
        includeTailwindDefaults: false,
        overrides: {
          default: {
            radius: {
              lg: '0',
            },
          },
        },
      });

      expect(result.variants.default!.radius.lg).toBe('0');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('applies override to specific variant', async () => {
    const { tempDir, cssPath } = await createTempCssFile(TEST_CSS);

    try {
      const result = await resolveTheme({
        input: cssPath,
        includeTailwindDefaults: false,
        overrides: {
          dark: {
            'colors.background': '#000000',
          },
        },
      });

      // Verify dark variant override applied
      expect(result.variants.dark?.colors.background).toBe('#000000');

      // Verify default theme NOT affected
      expect(result.variants.default!.colors.background).toBe('#ffffff');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('applies wildcard override to all variants', async () => {
    const { tempDir, cssPath } = await createTempCssFile(TEST_CSS);

    try {
      const result = await resolveTheme({
        input: cssPath,
        includeTailwindDefaults: false,
        overrides: {
          '*': {
            'fonts.sans': 'Inter, sans-serif',
          },
        },
      });

      // Verify applied to default
      expect(result.variants.default!.fonts.sans).toBe('Inter, sans-serif');

      // Verify applied to dark variant
      expect(result.variants.dark?.fonts.sans).toBe('Inter, sans-serif');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('applies multiple overrides to multiple variants', async () => {
    const { tempDir, cssPath } = await createTempCssFile(TEST_CSS);

    try {
      const result = await resolveTheme({
        input: cssPath,
        includeTailwindDefaults: false,
        overrides: {
          default: {
            'radius.lg': '0.5rem',
            'fonts.sans': 'Roboto, sans-serif',
          },
          dark: {
            'colors.background': '#0a0a0a',
          },
        },
      });

      // Verify default overrides
      expect(result.variants.default!.radius.lg).toBe('0.5rem');
      expect(result.variants.default!.fonts.sans).toBe('Roboto, sans-serif');

      // Verify dark override
      expect(result.variants.dark?.colors.background).toBe('#0a0a0a');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('injects synthetic variables for pre-resolution', async () => {
    const cssWithVarRef = `
@theme {
  --color-primary: var(--custom-primary);
  --radius-lg: 1rem;
}
`;

    const { tempDir, cssPath } = await createTempCssFile(cssWithVarRef);

    try {
      const result = await resolveTheme({
        input: cssPath,
        includeTailwindDefaults: false,
        overrides: {
          default: {
            'colors.primary': '#ff0000',
          },
        },
      });

      // The injected variable should resolve the var() reference
      expect(result.variants.default!.colors.primary).toBe('#ff0000');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('respects resolveVars flag for post-resolution only', async () => {
    const { tempDir, cssPath } = await createTempCssFile(TEST_CSS);

    try {
      const result = await resolveTheme({
        input: cssPath,
        includeTailwindDefaults: false,
        overrides: {
          default: {
            'radius.lg': {
              value: '0.25rem',
              resolveVars: false,
            },
          },
        },
      });

      // Post-resolution override should still apply
      expect(result.variants.default!.radius.lg).toBe('0.25rem');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('handles CSS selector matching for variants', async () => {
    const { tempDir, cssPath } = await createTempCssFile(TEST_CSS);

    try {
      const result = await resolveTheme({
        input: cssPath,
        includeTailwindDefaults: false,
        overrides: {
          '[data-theme="dark"]': {
            'colors.background': '#111111',
          },
        },
      });

      // Should match dark variant by selector
      expect(result.variants.dark?.colors.background).toBe('#111111');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('skips override for non-existent paths gracefully', async () => {
    const { tempDir, cssPath } = await createTempCssFile(TEST_CSS);

    try {
      const result = await resolveTheme({
        input: cssPath,
        includeTailwindDefaults: false,
        overrides: {
          default: {
            'nonexistent.property': 'value',
            'radius.lg': '0.5rem', // This should still work
          },
        },
      });

      // Valid override should apply
      expect(result.variants.default!.radius.lg).toBe('0.5rem');

      // Non-existent property should not break anything
      expect(() => result.variants.default!).not.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('handles deep nested path overrides', async () => {
    const cssWithScale = `
@theme {
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-500: #6b7280;
  --color-gray-900: #111827;
}
`;

    const { tempDir, cssPath } = await createTempCssFile(cssWithScale);

    try {
      const result = await resolveTheme({
        input: cssPath,
        includeTailwindDefaults: false,
        overrides: {
          default: {
            'colors.gray.500': '#custom-gray',
          },
        },
      });

      const FIVE_HUNDRED = 500;

      // Verify deep nested override
      const gray = result.variants.default!.colors.gray;
      if (gray !== undefined && typeof gray !== 'string') {
        expect(gray[FIVE_HUNDRED]).toBe('#custom-gray');

        // Verify other values unchanged
        const FIFTY = 50;
        expect(gray[FIFTY]).toBe('#f9fafb');
      } else {
        throw new Error('Expected gray to be a color scale');
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('combines overrides with Tailwind defaults', async () => {
    const { tempDir, cssPath } = await createTempCssFile(TEST_CSS);

    try {
      const result = await resolveTheme({
        input: cssPath,
        includeTailwindDefaults: true, // Include Tailwind defaults
        overrides: {
          default: {
            'radius.lg': '0',
          },
        },
      });

      // Our override should apply
      expect(result.variants.default!.radius.lg).toBe('0');

      // Tailwind defaults should still be present
      expect(result.variants.default!.colors).toBeDefined();
      expect(
        Object.keys(result.variants.default!.colors).length,
      ).toBeGreaterThan(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
