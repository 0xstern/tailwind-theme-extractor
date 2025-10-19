/**
 * Comprehensive edge case tests using Bun test framework
 */

import type { TailwindResult } from '../../src/v4/types';

import { beforeAll, describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../src/v4/index';

let result: TailwindResult;

const EXPECTED_FILE_COUNT = 9;
const MIN_VARIANT_COUNT = 20;
const MIN_VARIABLE_COUNT = 200;
const LONG_VALUE_MIN_LENGTH = 100;

beforeAll(async () => {
  // Parse once before all tests
  result = await resolveTheme({
    input: './__tests__/v4/fixtures/main.css',
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
    expect(result.variants.level1).toBeDefined();
    expect(result.variants.level2).toBeDefined();
    expect(result.variants.level3).toBeDefined();
  });
});

describe('Color Resolution', () => {
  test('resolves standard color scales with numeric keys', () => {
    expect(result.variants.default.colors.red).toBeDefined();
    expect(
      (result.variants.default.colors.red as Record<number, string>)[50],
    ).toBe('oklch(0.98 0.02 25)');
    expect(
      (result.variants.default.colors.red as Record<number, string>)[100],
    ).toBe('oklch(0.96 0.05 25)');
    expect(
      (result.variants.default.colors.red as Record<number, string>)[900],
    ).toBe('oklch(0.35 0.18 25)');
  });

  test('converts multi-word color names to camelCase', () => {
    expect(result.variants.default.colors.tooltipOutline).toBeDefined();
    expect(
      (
        result.variants.default.colors.tooltipOutline as Record<number, string>
      )[50],
    ).toBe('oklch(0.98 0.02 280)');
    expect(
      (
        result.variants.default.colors.tooltipOutline as Record<number, string>
      )[500],
    ).toBe('oklch(0.65 0.2 280)');
  });

  test('handles color variants with suffixes as string keys', () => {
    expect(result.variants.default.colors.interactive).toBeDefined();
    expect(
      (result.variants.default.colors.interactive as Record<string, string>)[
        '500-hover'
      ],
    ).toBe('oklch(0.6 0.2 250)');
    expect(
      (result.variants.default.colors.interactive as Record<string, string>)[
        '500-active'
      ],
    ).toBe('oklch(0.55 0.18 250)');
    expect(
      (result.variants.default.colors.interactive as Record<string, string>)[
        '500-disabled'
      ],
    ).toBe('oklch(0.7 0.1 250)');
  });

  test('supports custom numeric variants', () => {
    expect(
      (result.variants.default.colors.brand as Record<number, string>)[25],
    ).toBe('oklch(0.99 0.01 280)');
    expect(
      (result.variants.default.colors.brand as Record<number, string>)[1500],
    ).toBe('oklch(0.45 0.15 280)');
    expect(
      (result.variants.default.colors.brand as Record<number, string>)[2000],
    ).toBe('oklch(0.3 0.12 280)');
  });

  test('resolves flat colors with camelCase names', () => {
    expect(result.variants.default.colors.errorPrimary).toBe('#ef4444');
    expect(result.variants.default.colors.successDefault).toBe('#10b981');
    expect(result.variants.default.colors.warningSubtle).toBe('#fbbf24');
  });

  test('handles very complex multi-word flat colors', () => {
    expect(result.variants.default.colors.tooltipContainerBackground).toBe(
      '#1f2937',
    );
    expect(result.variants.default.colors.buttonPrimaryOutline).toBe('#3b82f6');
  });
});

describe('Theme Variants', () => {
  test('resolves dark mode variant', () => {
    expect(result.variants.dark).toBeDefined();

    if (result.variants.dark === undefined) {
      throw new Error('Dark variant should be defined');
    }
    expect(result.selectors.dark).toContain('dark');
  });

  test('dark mode has overridden colors', () => {
    if (result.variants.dark === undefined) {
      throw new Error('Dark variant should be defined');
    }
    expect(result.variants.dark.colors.white).toBe('#1f2937');
    expect(result.variants.dark.colors.black).toBe('#f9fafb');
    expect(result.variants.dark.colors.errorPrimary).toBe('#f87171');
  });

  test('resolves custom data-attribute themes', () => {
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

    expect(result.variants.ocean.colors.brandMain).toBe('#0ea5e9');
    expect(result.variants.sunset.colors.brandMain).toBe('#f97316');
    expect(result.variants.forest.colors.brandMain).toBe('#10b981');
  });

  test('resolves class-based variants', () => {
    expect(result.variants.midnight).toBeDefined();

    if (result.variants.midnight === undefined) {
      throw new Error('Midnight variant should be defined');
    }
    expect(result.selectors.midnight).toBe('.midnight');
    expect(result.variants.midnight.colors.background).toBe('#0f172a');
    expect(result.variants.midnight.colors.brandMain).toBe('#818cf8');
  });

  test('resolves data-mode attribute variants', () => {
    expect(result.variants.blue).toBeDefined();

    if (result.variants.blue === undefined) {
      throw new Error('Blue variant should be defined');
    }
    expect(result.variants.blue.colors.background).toBe('#dbeafe');
  });

  test('resolves media query variants', () => {
    // Light variant from @media (prefers-color-scheme: light)
    expect(result.variants.light).toBeDefined();
  });

  test('resolves at least 20 variants', () => {
    expect(Object.keys(result.variants).length).toBeGreaterThanOrEqual(
      MIN_VARIANT_COUNT,
    );
  });

  test('merges multiple definitions of same variant', () => {
    // dark-merge variant has two separate [data-theme='dark-merge'] blocks
    expect(result.variants.darkMerge).toBeDefined();

    if (result.variants.darkMerge === undefined) {
      throw new Error('Dark-merge variant should be defined');
    }
    // Both color variables from different blocks should be merged
    const darkMerge = result.variants.darkMerge;
    expect(Object.keys(darkMerge.colors).length).toBeGreaterThan(0);
  });

  test('corporate theme overrides spacing', () => {
    expect(result.variants.corporate).toBeDefined();

    if (result.variants.corporate === undefined) {
      throw new Error('Corporate variant should be defined');
    }
    expect(result.variants.corporate.spacing['4']).toBe('1.25rem');
    expect(result.variants.corporate.spacing['6']).toBe('2rem');
  });
});

describe('Font Resolution', () => {
  test('resolves font families', () => {
    expect(result.variants.default.fonts.sans).toBe(
      'ui-sans-serif, system-ui, sans-serif',
    );
    expect(result.variants.default.fonts.serif).toBe(
      'ui-serif, Georgia, serif',
    );
    expect(result.variants.default.fonts.display).toBe("'Poppins', sans-serif");
    // --font-body-text becomes fonts['body-text'] (kebab case preserved in namespace)
    expect(result.variants.default.fonts['body-text']).toBe(
      "'Inter', sans-serif",
    );
  });

  test('resolves font sizes with line heights', () => {
    expect(result.variants.default.fontSize.xs).toBeDefined();

    if (result.variants.default.fontSize.xs === undefined) {
      throw new Error('Font size xs should be defined');
    }
    expect(result.variants.default.fontSize.xs.size).toBe('0.75rem');
    expect(result.variants.default.fontSize.xs.lineHeight).toBe('1rem');

    expect(result.variants.default.fontSize['2xl']).toBeDefined();

    if (result.variants.default.fontSize['2xl'] === undefined) {
      throw new Error('Font size 2xl should be defined');
    }
    expect(result.variants.default.fontSize['2xl'].size).toBe('1.5rem');
    expect(result.variants.default.fontSize['2xl'].lineHeight).toBe('2rem');
  });

  test('font weight namespace exists', () => {
    // Font weight namespace should exist
    expect(result.variants.default.fontWeight).toBeDefined();
  });
});

describe('Spacing & Layout', () => {
  test('resolves spacing scale', () => {
    expect(result.variants.default.spacing['0']).toBe('0');
    expect(result.variants.default.spacing['1']).toBe('0.25rem');
    expect(result.variants.default.spacing['96']).toBe('24rem');
  });

  test('resolves breakpoints', () => {
    expect(result.variants.default.breakpoints.sm).toBe('40rem');
    expect(result.variants.default.breakpoints.md).toBe('48rem');
    expect(result.variants.default.breakpoints['3xl']).toBe('120rem');
  });

  test('resolves container sizes', () => {
    expect(result.variants.default.containers.sm).toBe('40rem');
    expect(result.variants.default.containers.md).toBe('48rem');
  });

  test('resolves tracking (letter spacing)', () => {
    expect(result.variants.default.tracking.tighter).toBe('-0.05em');
    expect(result.variants.default.tracking.wide).toBe('0.025em');
  });

  test('resolves leading (line height)', () => {
    expect(result.variants.default.leading.none).toBe('1');
    expect(result.variants.default.leading.tight).toBe('1.25');
    expect(result.variants.default.leading.loose).toBe('2');
  });
});

describe('Border & Effects', () => {
  test('resolves border radius', () => {
    expect(result.variants.default.radius.sm).toBe('0.125rem');
    expect(result.variants.default.radius.full).toBe('9999px');
    // --radius-custom-button becomes radius['custom-button']
    expect(result.variants.default.radius['custom-button']).toBeDefined();
  });

  test('resolves box shadows', () => {
    expect(result.variants.default.shadows.sm).toBeDefined();
    expect(result.variants.default.shadows.md).toBeDefined();
    expect(result.variants.default.shadows['elevation-1']).toBeDefined();
  });

  test('shadow namespaces exist', () => {
    // All shadow types should have namespace objects even if empty
    expect(result.variants.default.insetShadows).toBeDefined();
    expect(result.variants.default.dropShadows).toBeDefined();
    expect(result.variants.default.textShadows).toBeDefined();
  });

  test('resolves blur values', () => {
    expect(result.variants.default.blur.none).toBe('0');
    expect(result.variants.default.blur.sm).toBe('4px');
    expect(result.variants.default.blur.lg).toBe('16px');
  });
});

describe('Animations & Transforms', () => {
  test('resolves perspective', () => {
    expect(result.variants.default.perspective.near).toBe('500px');
    expect(result.variants.default.perspective.normal).toBe('1000px');
  });

  test('resolves aspect ratios', () => {
    expect(result.variants.default.aspect.square).toBe('1/1');
    expect(result.variants.default.aspect.video).toBe('16/9');
  });

  test('resolves easing functions', () => {
    expect(result.variants.default.ease.linear).toBe('linear');
    // --ease-in-out becomes ease['in-out']
    expect(result.variants.default.ease['in-out']).toBeDefined();
    expect(result.variants.default.ease.fluid).toBe(
      'cubic-bezier(0.3, 0, 0, 1)',
    );
  });

  test('resolves animations', () => {
    // Animations may be overridden by media query variants (reduced-motion: none)
    expect(result.variants.default.animations.spin).toBeDefined();
    expect(result.variants.default.animations.ping).toBeDefined();
    expect(result.variants.default.animations.pulse).toBeDefined();
  });
});

describe('Edge Cases', () => {
  test('handles special characters in values', () => {
    // Special chars variant exists
    expect(result.variants.specialChars).toBeDefined();
  });

  test('handles very long variable values', () => {
    expect(result.variants.longValues).toBeDefined();

    if (result.variants.longValues === undefined) {
      throw new Error('Long-values variant should be defined');
    }
    expect(result.variants.longValues.shadows.complex).toBeDefined();

    const complexShadow = result.variants.longValues.shadows.complex;
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
    expect(result.variants.mixed.colors.mixedValid).toBe('#555555');
  });

  test('resolves all raw variables', () => {
    expect(result.variables.length).toBeGreaterThan(MIN_VARIABLE_COUNT);
  });

  test('all theme namespaces exist', () => {
    expect(result.variants.default.colors).toBeDefined();
    expect(result.variants.default.spacing).toBeDefined();
    expect(result.variants.default.fonts).toBeDefined();
    expect(result.variants.default.fontSize).toBeDefined();
    expect(result.variants.default.fontWeight).toBeDefined();
    expect(result.variants.default.tracking).toBeDefined();
    expect(result.variants.default.leading).toBeDefined();
    expect(result.variants.default.breakpoints).toBeDefined();
    expect(result.variants.default.containers).toBeDefined();
    expect(result.variants.default.radius).toBeDefined();
    expect(result.variants.default.shadows).toBeDefined();
    expect(result.variants.default.insetShadows).toBeDefined();
    expect(result.variants.default.dropShadows).toBeDefined();
    expect(result.variants.default.textShadows).toBeDefined();
    expect(result.variants.default.blur).toBeDefined();
    expect(result.variants.default.perspective).toBeDefined();
    expect(result.variants.default.aspect).toBeDefined();
    expect(result.variants.default.ease).toBeDefined();
    expect(result.variants.default.animations).toBeDefined();
  });
});
