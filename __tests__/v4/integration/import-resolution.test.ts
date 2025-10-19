/**
 * Import resolution integration tests
 * Tests CSS @import statement resolution and file handling
 */

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4/index';

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
