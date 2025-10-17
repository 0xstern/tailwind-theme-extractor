/**
 * Comprehensive edge case tests using Bun test framework
 */

import type { ParseResult } from '../../src/v4/types';

import { beforeAll, describe, expect, test } from 'bun:test';

import { extractTheme } from '../../src/v4/index';

let result: ParseResult;

const EXPECTED_FILE_COUNT = 9;
const MIN_VARIANT_COUNT = 20;
const MIN_VARIABLE_COUNT = 200;
const LONG_VALUE_MIN_LENGTH = 100;

beforeAll(async () => {
  // Parse once before all tests
  result = await extractTheme({
    filePath: './__tests__/v4/fixtures/main.css',
    resolveImports: true,
  });
});

describe('Import Resolution', () => {
  test('processes all imported files', () => {
    const expectedFiles = [
      'main.css',
      'base-theme.css',
      'dark-mode.css',
      'custom-themes.css',
      'media-queries.css',
      'overrides.css',
      'imports-level1.css',
      'imports-level2.css',
      'imports-level3.css',
    ];

    for (const file of expectedFiles) {
      const found = result.files.some((f) => f.includes(file));
      expect(found).toBe(true);
    }
  });

  test('processes 9 total files', () => {
    expect(result.files.length).toBe(EXPECTED_FILE_COUNT);
  });

  test('handles 3-level deep nested imports', () => {
    // Variants from level-1, level-2, level-3 files
    expect(result.variants['level-1']).toBeDefined();
    expect(result.variants['level-2']).toBeDefined();
    expect(result.variants['level-3']).toBeDefined();
  });
});

describe('Color Extraction', () => {
  test('extracts standard color scales with numeric keys', () => {
    expect(result.theme.colors.red).toBeDefined();
    expect((result.theme.colors.red as Record<number, string>)[50]).toBe(
      'oklch(0.98 0.02 25)',
    );
    expect((result.theme.colors.red as Record<number, string>)[100]).toBe(
      'oklch(0.96 0.05 25)',
    );
    expect((result.theme.colors.red as Record<number, string>)[900]).toBe(
      'oklch(0.35 0.18 25)',
    );
  });

  test('converts multi-word color names to camelCase', () => {
    expect(result.theme.colors.tooltipOutline).toBeDefined();
    expect(
      (result.theme.colors.tooltipOutline as Record<number, string>)[50],
    ).toBe('oklch(0.98 0.02 280)');
    expect(
      (result.theme.colors.tooltipOutline as Record<number, string>)[500],
    ).toBe('oklch(0.65 0.2 280)');
  });

  test('handles color variants with suffixes as string keys', () => {
    expect(result.theme.colors.interactive).toBeDefined();
    expect(
      (result.theme.colors.interactive as Record<string, string>)['500-hover'],
    ).toBe('oklch(0.6 0.2 250)');
    expect(
      (result.theme.colors.interactive as Record<string, string>)['500-active'],
    ).toBe('oklch(0.55 0.18 250)');
    expect(
      (result.theme.colors.interactive as Record<string, string>)[
        '500-disabled'
      ],
    ).toBe('oklch(0.7 0.1 250)');
  });

  test('supports custom numeric variants', () => {
    expect((result.theme.colors.brand as Record<number, string>)[25]).toBe(
      'oklch(0.99 0.01 280)',
    );
    expect((result.theme.colors.brand as Record<number, string>)[1500]).toBe(
      'oklch(0.45 0.15 280)',
    );
    expect((result.theme.colors.brand as Record<number, string>)[2000]).toBe(
      'oklch(0.3 0.12 280)',
    );
  });

  test('extracts flat colors with camelCase names', () => {
    expect(result.theme.colors.errorPrimary).toBe('#ef4444');
    expect(result.theme.colors.successDefault).toBe('#10b981');
    expect(result.theme.colors.warningSubtle).toBe('#fbbf24');
  });

  test('handles very complex multi-word flat colors', () => {
    expect(result.theme.colors.tooltipContainerBackground).toBe('#1f2937');
    expect(result.theme.colors.buttonPrimaryOutline).toBe('#3b82f6');
  });
});

describe('Theme Variants', () => {
  test('extracts dark mode variant', () => {
    expect(result.variants.dark).toBeDefined();

    if (result.variants.dark === undefined) {
      throw new Error('Dark variant should be defined');
    }
    expect(result.variants.dark.selector).toContain('dark');
  });

  test('dark mode has overridden colors', () => {
    if (result.variants.dark === undefined) {
      throw new Error('Dark variant should be defined');
    }
    expect(result.variants.dark.theme.colors.white).toBe('#1f2937');
    expect(result.variants.dark.theme.colors.black).toBe('#f9fafb');
    expect(result.variants.dark.theme.colors.errorPrimary).toBe('#f87171');
  });

  test('extracts custom data-attribute themes', () => {
    expect(result.variants.ocean).toBeDefined();
    expect(result.variants.sunset).toBeDefined();
    expect(result.variants.forest).toBeDefined();

    if (result.variants.ocean === undefined) {
      throw new Error('Ocean variant should be defined');
    }
    if (result.variants.sunset === undefined) {
      throw new Error('Sunset variant should be defined');
    }
    if (result.variants.forest === undefined) {
      throw new Error('Forest variant should be defined');
    }

    expect(result.variants.ocean.theme.colors.brandMain).toBe('#0ea5e9');
    expect(result.variants.sunset.theme.colors.brandMain).toBe('#f97316');
    expect(result.variants.forest.theme.colors.brandMain).toBe('#10b981');
  });

  test('extracts class-based variants', () => {
    expect(result.variants.midnight).toBeDefined();

    if (result.variants.midnight === undefined) {
      throw new Error('Midnight variant should be defined');
    }
    expect(result.variants.midnight.selector).toBe('.midnight');
    expect(result.variants.midnight.theme.colors.background).toBe('#0f172a');
    expect(result.variants.midnight.theme.colors.brandMain).toBe('#818cf8');
  });

  test('extracts data-mode attribute variants', () => {
    expect(result.variants.blue).toBeDefined();

    if (result.variants.blue === undefined) {
      throw new Error('Blue variant should be defined');
    }
    expect(result.variants.blue.theme.colors.background).toBe('#dbeafe');
  });

  test('extracts media query variants', () => {
    // Light variant from @media (prefers-color-scheme: light)
    expect(result.variants.light).toBeDefined();
  });

  test('extracts at least 20 variants', () => {
    expect(Object.keys(result.variants).length).toBeGreaterThanOrEqual(
      MIN_VARIANT_COUNT,
    );
  });

  test('merges multiple definitions of same variant', () => {
    // dark-merge variant has two separate [data-theme='dark-merge'] blocks
    expect(result.variants['dark-merge']).toBeDefined();

    if (result.variants['dark-merge'] === undefined) {
      throw new Error('Dark-merge variant should be defined');
    }
    // Both color variables from different blocks should be merged
    const darkMerge = result.variants['dark-merge'].theme;
    expect(Object.keys(darkMerge.colors).length).toBeGreaterThan(0);
  });

  test('corporate theme overrides spacing', () => {
    expect(result.variants.corporate).toBeDefined();

    if (result.variants.corporate === undefined) {
      throw new Error('Corporate variant should be defined');
    }
    expect(result.variants.corporate.theme.spacing['4']).toBe('1.25rem');
    expect(result.variants.corporate.theme.spacing['6']).toBe('2rem');
  });
});

describe('Font Extraction', () => {
  test('extracts font families', () => {
    expect(result.theme.fonts.sans).toBe(
      'ui-sans-serif, system-ui, sans-serif',
    );
    expect(result.theme.fonts.serif).toBe('ui-serif, Georgia, serif');
    expect(result.theme.fonts.display).toBe("'Poppins', sans-serif");
    // --font-body-text becomes fonts['body-text'] (kebab case preserved in namespace)
    expect(result.theme.fonts['body-text']).toBe("'Inter', sans-serif");
  });

  test('extracts font sizes with line heights', () => {
    expect(result.theme.fontSize.xs).toBeDefined();

    if (result.theme.fontSize.xs === undefined) {
      throw new Error('Font size xs should be defined');
    }
    expect(result.theme.fontSize.xs.size).toBe('0.75rem');
    expect(result.theme.fontSize.xs.lineHeight).toBe('1rem');

    expect(result.theme.fontSize['2xl']).toBeDefined();

    if (result.theme.fontSize['2xl'] === undefined) {
      throw new Error('Font size 2xl should be defined');
    }
    expect(result.theme.fontSize['2xl'].size).toBe('1.5rem');
    expect(result.theme.fontSize['2xl'].lineHeight).toBe('2rem');
  });

  test('font weight namespace exists', () => {
    // Font weight namespace should exist
    expect(result.theme.fontWeight).toBeDefined();
  });
});

describe('Spacing & Layout', () => {
  test('extracts spacing scale', () => {
    expect(result.theme.spacing['0']).toBe('0');
    expect(result.theme.spacing['1']).toBe('0.25rem');
    expect(result.theme.spacing['96']).toBe('24rem');
  });

  test('extracts breakpoints', () => {
    expect(result.theme.breakpoints.sm).toBe('40rem');
    expect(result.theme.breakpoints.md).toBe('48rem');
    expect(result.theme.breakpoints['3xl']).toBe('120rem');
  });

  test('extracts container sizes', () => {
    expect(result.theme.containers.sm).toBe('40rem');
    expect(result.theme.containers.md).toBe('48rem');
  });

  test('extracts tracking (letter spacing)', () => {
    expect(result.theme.tracking.tighter).toBe('-0.05em');
    expect(result.theme.tracking.wide).toBe('0.025em');
  });

  test('extracts leading (line height)', () => {
    expect(result.theme.leading.none).toBe('1');
    expect(result.theme.leading.tight).toBe('1.25');
    expect(result.theme.leading.loose).toBe('2');
  });
});

describe('Border & Effects', () => {
  test('extracts border radius', () => {
    expect(result.theme.radius.sm).toBe('0.125rem');
    expect(result.theme.radius.full).toBe('9999px');
    // --radius-custom-button becomes radius['custom-button']
    expect(result.theme.radius['custom-button']).toBeDefined();
  });

  test('extracts box shadows', () => {
    expect(result.theme.shadows.sm).toBeDefined();
    expect(result.theme.shadows.md).toBeDefined();
    expect(result.theme.shadows['elevation-1']).toBeDefined();
  });

  test('shadow namespaces exist', () => {
    // All shadow types should have namespace objects even if empty
    expect(result.theme.insetShadows).toBeDefined();
    expect(result.theme.dropShadows).toBeDefined();
    expect(result.theme.textShadows).toBeDefined();
  });

  test('extracts blur values', () => {
    expect(result.theme.blur.none).toBe('0');
    expect(result.theme.blur.sm).toBe('4px');
    expect(result.theme.blur.lg).toBe('16px');
  });
});

describe('Animations & Transforms', () => {
  test('extracts perspective', () => {
    expect(result.theme.perspective.near).toBe('500px');
    expect(result.theme.perspective.normal).toBe('1000px');
  });

  test('extracts aspect ratios', () => {
    expect(result.theme.aspect.square).toBe('1/1');
    expect(result.theme.aspect.video).toBe('16/9');
  });

  test('extracts easing functions', () => {
    expect(result.theme.ease.linear).toBe('linear');
    // --ease-in-out becomes ease['in-out']
    expect(result.theme.ease['in-out']).toBeDefined();
    expect(result.theme.ease.fluid).toBe('cubic-bezier(0.3, 0, 0, 1)');
  });

  test('extracts animations', () => {
    // Animations may be overridden by media query variants (reduced-motion: none)
    expect(result.theme.animations.spin).toBeDefined();
    expect(result.theme.animations.ping).toBeDefined();
    expect(result.theme.animations.pulse).toBeDefined();
  });
});

describe('Edge Cases', () => {
  test('handles special characters in values', () => {
    // Special chars variant exists
    expect(result.variants['special-chars']).toBeDefined();
  });

  test('handles very long variable values', () => {
    expect(result.variants['long-values']).toBeDefined();

    if (result.variants['long-values'] === undefined) {
      throw new Error('Long-values variant should be defined');
    }
    expect(result.variants['long-values'].theme.shadows.complex).toBeDefined();

    const complexShadow = result.variants['long-values'].theme.shadows.complex;
    if (complexShadow === undefined) {
      throw new Error('Complex shadow should be defined');
    }
    expect(complexShadow.length).toBeGreaterThan(LONG_VALUE_MIN_LENGTH);
  });

  test('ignores non-variable declarations', () => {
    // mixed variant has regular CSS properties that should be ignored
    expect(result.variants.mixed).toBeDefined();

    if (result.variants.mixed === undefined) {
      throw new Error('Mixed variant should be defined');
    }
    expect(result.variants.mixed.theme.colors.mixedValid).toBe('#555555');
  });

  test('extracts all raw variables', () => {
    expect(result.variables.length).toBeGreaterThan(MIN_VARIABLE_COUNT);
  });

  test('all theme namespaces exist', () => {
    expect(result.theme.colors).toBeDefined();
    expect(result.theme.spacing).toBeDefined();
    expect(result.theme.fonts).toBeDefined();
    expect(result.theme.fontSize).toBeDefined();
    expect(result.theme.fontWeight).toBeDefined();
    expect(result.theme.tracking).toBeDefined();
    expect(result.theme.leading).toBeDefined();
    expect(result.theme.breakpoints).toBeDefined();
    expect(result.theme.containers).toBeDefined();
    expect(result.theme.radius).toBeDefined();
    expect(result.theme.shadows).toBeDefined();
    expect(result.theme.insetShadows).toBeDefined();
    expect(result.theme.dropShadows).toBeDefined();
    expect(result.theme.textShadows).toBeDefined();
    expect(result.theme.blur).toBeDefined();
    expect(result.theme.perspective).toBeDefined();
    expect(result.theme.aspect).toBeDefined();
    expect(result.theme.ease).toBeDefined();
    expect(result.theme.animations).toBeDefined();
  });
});
