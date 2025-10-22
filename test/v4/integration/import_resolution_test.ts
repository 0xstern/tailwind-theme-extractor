/**
 * Import resolution integration tests
 * Tests CSS @import statement resolution and file handling
 */

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4';

describe('Import Resolution', () => {
  test('resolves @import statements', async () => {
    const result = await resolveTheme({
      input: './test/v4/fixtures/main.css',
      resolveImports: true,
    });

    // main.css imports 6 files + itself + nested imports from imports_level1
    expect(result.files.length).toBeGreaterThan(1);
    expect(result.files.some((f) => f.includes('main.css'))).toBe(true);
    expect(result.files.some((f) => f.includes('base_theme.css'))).toBe(true);
    expect(result.files.some((f) => f.includes('dark_mode.css'))).toBe(true);
  });

  test('skips import resolution when disabled', async () => {
    const result = await resolveTheme({
      input: './test/v4/fixtures/main.css',
      resolveImports: false,
    });

    // Should only include the main file, not its imports
    expect(result.files.length).toBe(1);
    expect(result.files[0]).toMatch(/main\.css$/);
  });
});
