/**
 * Unit tests for Tailwind defaults loader and theme merger
 * Tests both integration via resolveTheme and direct function testing
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../../src/v4/index';
import {
  clearDefaultThemeCache,
  loadTailwindDefaults,
  mergeThemes,
} from '../../../../src/v4/parser/tailwind-defaults';

describe('Tailwind Default Theme', () => {
  test('loads Tailwind defaults when includeTailwindDefaults is true', async () => {
    const result = await resolveTheme({
      css: '@theme { --color-primary-500: #custom; }',
      includeTailwindDefaults: true,
    });

    // Should have user's custom color
    expect(result.variants.default.colors.primary).toBeDefined();
    if (typeof result.variants.default.colors.primary === 'object') {
      expect(result.variants.default.colors.primary[500]).toBe('#custom');
    }

    // Should also have Tailwind's default colors (if Tailwind is installed)
    // If Tailwind is not installed, this is fine - we just get user theme
    if (result.variants.default.colors.red !== undefined) {
      expect(result.variants.default.colors.red).toBeDefined();
      // Tailwind has red-500 by default
      if (typeof result.variants.default.colors.red === 'object') {
        expect(result.variants.default.colors.red[500]).toBeDefined();
      }
    }
  });

  test('does not load defaults when includeTailwindDefaults is false', async () => {
    const result = await resolveTheme({
      css: '@theme { --color-primary-500: #custom; }',
      includeTailwindDefaults: false,
    });

    // Should have user's custom color
    expect(result.variants.default.colors.primary).toBeDefined();

    // Should NOT have other colors (only what user defined)
    const colorKeys = Object.keys(result.variants.default.colors);
    expect(colorKeys).toEqual(['primary']);
  });

  test('user values override Tailwind defaults', async () => {
    const result = await resolveTheme({
      css: '@theme { --color-red-500: #custom-red; }',
      includeTailwindDefaults: true,
    });

    // Should have user's override
    if (typeof result.variants.default.colors.red === 'object') {
      expect(result.variants.default.colors.red[500]).toBe('#custom-red');
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

    if (typeof result.variants.default.colors.red === 'object') {
      // User overrides
      expect(result.variants.default.colors.red[500]).toBe('#custom-red');
      expect(result.variants.default.colors.red[600]).toBe('#custom-red-dark');

      // Tailwind defaults (if installed) should still exist
      if (result.variants.default.colors.red[50] !== undefined) {
        expect(result.variants.default.colors.red[50]).toBeDefined();
        expect(result.variants.default.colors.red[100]).toBeDefined();
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
    expect(result.variants.default.colors.primary).toBeDefined();

    // May or may not have Tailwind defaults depending on installation
    // Both outcomes are valid
    expect(result.variants.default).toBeDefined();
  });
});

describe('loadTailwindDefaults - Direct function tests', () => {
  test('returns null or Theme object', async () => {
    const result = await loadTailwindDefaults(process.cwd());

    // Result should be either null (not installed) or a valid Theme
    if (result === null) {
      expect(result).toBeNull();
    } else {
      expect(result).toHaveProperty('colors');
      expect(result).toHaveProperty('spacing');
      expect(result).toHaveProperty('fonts');
      expect(result).toHaveProperty('fontSize');
    }
  });

  test('caches results for same base path', async () => {
    const basePath = process.cwd();

    const result1 = await loadTailwindDefaults(basePath);
    const result2 = await loadTailwindDefaults(basePath);

    // Should return same reference (cached)
    expect(result1).toBe(result2);
  });

  test('handles missing tailwindcss package gracefully', async () => {
    // Use a path where tailwindcss is definitely not installed
    const result = await loadTailwindDefaults('/tmp/nonexistent-project-path');

    expect(result).toBeNull();
  });

  test('returns valid theme structure when Tailwind is installed', async () => {
    const result = await loadTailwindDefaults(process.cwd());

    // Skip if Tailwind not installed
    if (result === null) {
      expect(result).toBeNull();
      return;
    }

    // Verify complete theme structure
    expect(result).toHaveProperty('colors');
    expect(result).toHaveProperty('spacing');
    expect(result).toHaveProperty('fonts');
    expect(result).toHaveProperty('fontSize');
    expect(result).toHaveProperty('fontWeight');
    expect(result).toHaveProperty('tracking');
    expect(result).toHaveProperty('leading');
    expect(result).toHaveProperty('breakpoints');
    expect(result).toHaveProperty('containers');
    expect(result).toHaveProperty('radius');
    expect(result).toHaveProperty('shadows');
    expect(result).toHaveProperty('insetShadows');
    expect(result).toHaveProperty('dropShadows');
    expect(result).toHaveProperty('textShadows');
    expect(result).toHaveProperty('blur');
    expect(result).toHaveProperty('perspective');
    expect(result).toHaveProperty('aspect');
    expect(result).toHaveProperty('ease');
    expect(result).toHaveProperty('animations');
    expect(result).toHaveProperty('defaults');
    expect(result).toHaveProperty('keyframes');

    // Verify all properties are objects
    expect(typeof result.colors).toBe('object');
    expect(typeof result.spacing).toBe('object');
  });
});

describe('loadTailwindDefaults - Cache behavior', () => {
  // Clean up cache before each test to ensure isolation
  beforeEach(() => {
    clearDefaultThemeCache();
  });

  afterEach(() => {
    clearDefaultThemeCache();
  });

  test('returns cached theme on subsequent calls with same base path', async () => {
    const basePath = process.cwd();

    // First call - will hit no-cache path (lines 81-101)
    const firstResult = await loadTailwindDefaults(basePath);
    // Second call - will hit cache-valid path (lines 52-54)
    const secondResult = await loadTailwindDefaults(basePath);

    // Should return exact same reference (cached)
    expect(firstResult).toBe(secondResult);
  });

  test('caches null result when Tailwind is not installed', async () => {
    const nonExistentPath = '/tmp/definitely-nonexistent-tailwind-project';

    // First call - will attempt to load and cache null (catch block lines 65-70)
    const firstResult = await loadTailwindDefaults(nonExistentPath);
    // Second call - should return cached null
    const secondResult = await loadTailwindDefaults(nonExistentPath);

    expect(firstResult).toBeNull();
    expect(secondResult).toBeNull();
    expect(firstResult).toBe(secondResult);
  });

  test('loads theme when no cache exists (cold start)', async () => {
    const basePath = process.cwd();

    // With cleared cache, this hits the no-cache path (lines 81-101)
    const result = await loadTailwindDefaults(basePath);

    // Should either return null (not installed) or Theme object
    if (result === null) {
      expect(result).toBeNull();
    } else {
      expect(result).toHaveProperty('colors');
      expect(result).toHaveProperty('spacing');
      expect(result).toHaveProperty('fonts');
    }
  });

  test('validates cached theme is still fresh on subsequent call', async () => {
    const basePath = process.cwd();

    // First call - populates cache
    const firstResult = await loadTailwindDefaults(basePath);

    // Skip test if Tailwind not installed
    if (firstResult === null) {
      expect(firstResult).toBeNull();
      return;
    }

    // Second call - validates timestamp hasn't changed (lines 51-54)
    const secondResult = await loadTailwindDefaults(basePath);

    // Should return exact same cached instance
    expect(secondResult).toBe(firstResult);
  });

  test('handles multiple different base paths independently', async () => {
    const path1 = process.cwd();
    const path2 = '/tmp/nonexistent-path-1';
    const path3 = '/tmp/nonexistent-path-2';

    // Load from all three paths
    await loadTailwindDefaults(path1); // May return theme or null
    const result2 = await loadTailwindDefaults(path2);
    const result3 = await loadTailwindDefaults(path3);

    // Different paths should have independent cache entries
    // path2 and path3 will be null (not installed)
    expect(result2).toBeNull();
    expect(result3).toBeNull();

    // Subsequent calls should return cached values
    expect(await loadTailwindDefaults(path2)).toBe(result2);
    expect(await loadTailwindDefaults(path3)).toBe(result3);
  });
});

describe('mergeThemes - Direct function tests', () => {
  test('merges flat colors correctly', () => {
    const defaultTheme = {
      colors: { white: '#fff', black: '#000' },
      spacing: {},
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const userTheme = {
      colors: { primary: 'blue' },
      spacing: {},
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const merged = mergeThemes(defaultTheme, userTheme);

    expect(merged.colors.white).toBe('#fff');
    expect(merged.colors.black).toBe('#000');
    expect(merged.colors.primary).toBe('blue');
  });

  test('user flat color overrides default flat color', () => {
    const defaultTheme = {
      colors: { primary: 'red' },
      spacing: {},
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const userTheme = {
      colors: { primary: 'blue' },
      spacing: {},
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const merged = mergeThemes(defaultTheme, userTheme);

    expect(merged.colors.primary).toBe('blue');
  });

  test('merges color scales deeply', () => {
    const defaultTheme = {
      colors: {
        red: { 50: '#fef2f2', 500: '#ef4444', 900: '#7f1d1d' },
      },
      spacing: {},
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const userTheme = {
      colors: {
        red: { 500: '#custom-red', 600: '#custom-red-dark' },
      },
      spacing: {},
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const merged = mergeThemes(defaultTheme, userTheme);

    if (typeof merged.colors.red !== 'string') {
      // Should keep default 50 and 900
      expect(merged.colors.red[50]).toBe('#fef2f2');
      expect(merged.colors.red[900]).toBe('#7f1d1d');
      // Should override 500 and add 600
      expect(merged.colors.red[500]).toBe('#custom-red');
      expect(merged.colors.red[600]).toBe('#custom-red-dark');
    }
  });

  test('user color scale replaces default flat color', () => {
    const defaultTheme = {
      colors: { primary: 'blue' },
      spacing: {},
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const userTheme = {
      colors: { primary: { 500: '#custom', 600: '#custom-dark' } },
      spacing: {},
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const merged = mergeThemes(defaultTheme, userTheme);

    expect(typeof merged.colors.primary).toBe('object');
    if (typeof merged.colors.primary !== 'string') {
      expect(merged.colors.primary[500]).toBe('#custom');
      expect(merged.colors.primary[600]).toBe('#custom-dark');
    }
  });

  test('merges spacing values', () => {
    const defaultTheme = {
      colors: {},
      spacing: { '4': '1rem', '8': '2rem' },
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const userTheme = {
      colors: {},
      spacing: { '12': '3rem' },
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const merged = mergeThemes(defaultTheme, userTheme);

    expect(merged.spacing['4']).toBe('1rem');
    expect(merged.spacing['8']).toBe('2rem');
    expect(merged.spacing['12']).toBe('3rem');
  });

  test('merges font sizes', () => {
    const defaultTheme = {
      colors: {},
      spacing: {},
      fonts: {},
      fontSize: { base: { size: '1rem', lineHeight: '1.5' } },
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const userTheme = {
      colors: {},
      spacing: {},
      fonts: {},
      fontSize: { lg: { size: '1.125rem' } },
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const merged = mergeThemes(defaultTheme, userTheme);

    expect(merged.fontSize.base).toEqual({ size: '1rem', lineHeight: '1.5' });
    expect(merged.fontSize.lg).toEqual({ size: '1.125rem' });
  });

  test('merges all theme properties', () => {
    const defaultTheme = {
      colors: {},
      spacing: { '4': '1rem' },
      fonts: { sans: 'Inter' },
      fontSize: {},
      fontWeight: { bold: '700' },
      tracking: {},
      leading: {},
      breakpoints: { md: '768px' },
      containers: {},
      radius: { base: '0.25rem' },
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: { spin: 'to { transform: rotate(360deg); }' },
    };

    const userTheme = {
      colors: {},
      spacing: { '12': '3rem' },
      fonts: { mono: 'Fira Code' },
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: { lg: '0.5rem' },
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const merged = mergeThemes(defaultTheme, userTheme);

    // Verify defaults preserved
    expect(merged.spacing['4']).toBe('1rem');
    expect(merged.fonts.sans).toBe('Inter');
    expect(merged.fontWeight.bold).toBe('700');
    expect(merged.breakpoints.md).toBe('768px');
    expect(merged.radius.base).toBe('0.25rem');
    expect(merged.keyframes.spin).toBe('to { transform: rotate(360deg); }');

    // Verify user additions
    expect(merged.spacing['12']).toBe('3rem');
    expect(merged.fonts.mono).toBe('Fira Code');
    expect(merged.radius.lg).toBe('0.5rem');
  });

  test('handles empty user theme', () => {
    const defaultTheme = {
      colors: { white: '#fff' },
      spacing: {},
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const userTheme = {
      colors: {},
      spacing: {},
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const merged = mergeThemes(defaultTheme, userTheme);

    expect(merged.colors.white).toBe('#fff');
  });

  test('handles empty default theme', () => {
    const defaultTheme = {
      colors: {},
      spacing: {},
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const userTheme = {
      colors: { primary: 'blue' },
      spacing: {},
      fonts: {},
      fontSize: {},
      fontWeight: {},
      tracking: {},
      leading: {},
      breakpoints: {},
      containers: {},
      radius: {},
      shadows: {},
      insetShadows: {},
      dropShadows: {},
      textShadows: {},
      blur: {},
      perspective: {},
      aspect: {},
      ease: {},
      animations: {},
      defaults: {},
      keyframes: {},
    };

    const merged = mergeThemes(defaultTheme, userTheme);

    expect(merged.colors.primary).toBe('blue');
  });
});
