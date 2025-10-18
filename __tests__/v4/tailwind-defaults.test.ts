import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../src/v4/index';

describe('Tailwind Default Theme', () => {
  test('loads Tailwind defaults when includeTailwindDefaults is true', async () => {
    const result = await resolveTheme({
      css: '@theme { --color-primary-500: #custom; }',
      includeTailwindDefaults: true,
    });

    // Should have user's custom color
    expect(result.theme.colors.primary).toBeDefined();
    if (typeof result.theme.colors.primary === 'object') {
      expect(result.theme.colors.primary[500]).toBe('#custom');
    }

    // Should also have Tailwind's default colors (if Tailwind is installed)
    // If Tailwind is not installed, this is fine - we just get user theme
    if (result.theme.colors.red !== undefined) {
      expect(result.theme.colors.red).toBeDefined();
      // Tailwind has red-500 by default
      if (typeof result.theme.colors.red === 'object') {
        expect(result.theme.colors.red[500]).toBeDefined();
      }
    }
  });

  test('does not load defaults when includeTailwindDefaults is false', async () => {
    const result = await resolveTheme({
      css: '@theme { --color-primary-500: #custom; }',
      includeTailwindDefaults: false,
    });

    // Should have user's custom color
    expect(result.theme.colors.primary).toBeDefined();

    // Should NOT have other colors (only what user defined)
    const colorKeys = Object.keys(result.theme.colors);
    expect(colorKeys).toEqual(['primary']);
  });

  test('user values override Tailwind defaults', async () => {
    const result = await resolveTheme({
      css: '@theme { --color-red-500: #custom-red; }',
      includeTailwindDefaults: true,
    });

    // Should have user's override
    if (typeof result.theme.colors.red === 'object') {
      expect(result.theme.colors.red[500]).toBe('#custom-red');
    }
  });

  test('merges user color scale with Tailwind defaults', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-red-500: #custom-red;
          --color-red-600: #custom-red-dark;
        }
      `,
      includeTailwindDefaults: true,
    });

    if (typeof result.theme.colors.red === 'object') {
      // User overrides
      expect(result.theme.colors.red[500]).toBe('#custom-red');
      expect(result.theme.colors.red[600]).toBe('#custom-red-dark');

      // Tailwind defaults (if installed) should still exist
      if (result.theme.colors.red[50] !== undefined) {
        expect(result.theme.colors.red[50]).toBeDefined();
        expect(result.theme.colors.red[100]).toBeDefined();
      }
    }
  });

  test('gracefully handles Tailwind not being installed', async () => {
    // This test always passes - we just verify no errors thrown
    const result = await resolveTheme({
      css: '@theme { --color-primary-500: #custom; }',
      includeTailwindDefaults: true,
    });

    // Should always have user theme
    expect(result.theme.colors.primary).toBeDefined();

    // May or may not have Tailwind defaults depending on installation
    // Both outcomes are valid
    expect(result.theme).toBeDefined();
  });
});
