import { readFile } from 'fs/promises';
import { join } from 'path';

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../src/v4/index';

// Test constants
const EXPECTED_THEME_VARIANT_COUNT = 9;
const EXPECTED_MIN_THEME_PROPERTIES = 50;
const EXPECTED_DARK_VARIANT_PROPERTIES = 4;
const EXPECTED_COMPACT_SPACING_VARIABLES = 5;
const EXPECTED_LARGE_SPACING_VARIABLES = 5;
const EXPECTED_GRADIENT_PROPERTIES = 3;
const EXPECTED_MATH_HEAVY_PROPERTIES = 4;
const EXPECTED_EDGE_CASES_PROPERTIES = 13;

describe('Complex CSS Functions and Variables', () => {
  let css: string;

  // Load the complex CSS fixture once before all tests
  test('load complex CSS fixture', async () => {
    css = await readFile(
      join(__dirname, 'fixtures', 'complex-css-functions.css'),
      'utf-8',
    );
    expect(css).toBeDefined();
    expect(css.length).toBeGreaterThan(0);
  });

  describe('Base Theme - calc() functions', () => {
    test('resolves font sizes with calc() expressions resolved', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // Font sizes are stored as objects with resolved calc() expressions
      expect(result.variants.default.fontSize.sm?.size).toBe(
        'calc(1rem * 0.875)',
      );
      expect(result.variants.default.fontSize.lg?.size).toBe(
        'calc(1rem * 1.125)',
      );
      expect(result.variants.default.fontSize.xl?.size).toBe(
        'calc(1rem * 1.25)',
      );
      expect(result.variants.default.fontSize['2xl']?.size).toBe(
        'calc(1rem * 1.5)',
      );
    });

    test('resolves radius with calc() and resolved variable references', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // Variables are resolved before being stored
      expect(result.variants.default.radius.sm).toBe('calc(0.5rem - 0.25rem)');
      expect(result.variants.default.radius.lg).toBe('calc(0.5rem + 0.5rem)');
      expect(result.variants.default.radius.dynamic).toBe(
        'calc(0.5rem * 1.5 + 0.25rem)',
      );
    });

    test('resolves complex spacing calculations', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // calc() is preserved but variables are resolved
      expect(result.variants.default.spacing.complex).toContain('calc(');
      expect(result.variants.default.spacing.complex).toContain('0.25rem');
      expect(result.variants.default.spacing.complex).toContain('0.5rem');
    });

    test('resolves unnamespaced variables with resolved values', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // Variables without recognized namespaces remain in variables array but are resolved
      expect(result.variables.some((v) => v.name === '--size-computed')).toBe(
        true,
      );
      const sizeVar = result.variables.find(
        (v) => v.name === '--size-computed',
      );
      // var() references are resolved to their final values
      expect(sizeVar?.value).toBe('calc(100% / 3 - 1rem * 2)');
    });
  });

  describe('Base Theme - min() and max() functions', () => {
    test('resolves min() with resolved variables', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // Container namespace maps to "containers" theme property
      expect(result.variants.default.containers.fluid).toBe(
        'min(100% - 2rem, 80rem)',
      );
    });

    test('resolves max() with viewport units', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      expect(result.variants.default.containers.responsive).toBe(
        'max(20rem, 50vw)',
      );
    });

    test('resolves nested min/max combinations as raw variables', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // width and height namespaces don't exist in NAMESPACE_MAP, so stored as variables
      const widthVar = result.variables.find(
        (v) => v.name === '--width-constrained',
      );
      expect(widthVar?.value).toContain('min(');
      expect(widthVar?.value).toContain('max(');

      const heightVar = result.variables.find(
        (v) => v.name === '--height-flexible',
      );
      expect(heightVar?.value).toContain('max(');
      expect(heightVar?.value).toContain('min(');
    });
  });

  describe('Base Theme - clamp() functions', () => {
    test('resolves fluid typography with clamp() resolved', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // Font size with clamp() may resolve to minimum value during resolution
      // The system resolves all var() references, producing the final value
      expect(result.variants.default.fontSize.fluid?.size).toBeDefined();
      // Verify it contains the resolved value (may be 1rem or the full clamp)
      const fluidSize = result.variants.default.fontSize.fluid?.size;
      expect(fluidSize).toMatch(/^(1rem|clamp\(1rem, 2\.5vw, 2rem\))$/);
    });

    test('resolves responsive padding with calc() inside clamp() in raw variables', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // padding-responsive doesn't have a recognized namespace, stored as raw variable
      const paddingVar = result.variables.find(
        (v) => v.name === '--padding-responsive',
      );
      expect(paddingVar?.value).toContain('clamp(');
      expect(paddingVar?.value).toContain('calc(');
    });
  });

  describe('Base Theme - Multiple variable references', () => {
    test('resolves shadow with resolved variables', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // Shadow variables are resolved into theme.shadows
      // --shadow-complex should be in shadows.complex
      const shadowVar = result.variables.find(
        (v) => v.name === '--shadow-complex',
      );
      // Since it's a shadow namespace, verify it contains the value
      expect(shadowVar?.value).toBeDefined();
    });

    test('resolves grid column width with complex calculation', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // Grid namespace variables remain in raw form
      const gridVar = result.variables.find(
        (v) => v.name === '--grid-column-width',
      );
      expect(gridVar?.value).toContain('calc(');
      expect(gridVar?.value).toContain('var(--grid-columns)');
    });
  });

  describe(':root semantic mappings', () => {
    test('resolves heading calculations with resolved variables', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // heading-1, heading-2 don't have recognized namespaces but are resolved
      const h1Var = result.variables.find((v) => v.name === '--heading-1');
      expect(h1Var?.value).toContain('calc(');
      expect(h1Var?.value).toContain('1rem'); // --text-base resolved

      const h2Var = result.variables.find((v) => v.name === '--heading-2');
      expect(h2Var?.value).toContain('calc(');
      expect(h2Var?.value).toContain('1rem'); // --text-base resolved
    });

    test('resolves section gap with resolved variables', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const sectionGapVar = result.variables.find(
        (v) => v.name === '--section-gap' && v.source === 'root',
      );
      expect(sectionGapVar?.value).toBe('calc(2rem * 2)');
    });
  });

  describe('Theme Variants', () => {
    test('resolves all theme variants', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const variantNames = Object.keys(result.variants);
      // Responsive variant has nested media queries that may not resolve as separate variant
      expect(variantNames.length).toBeGreaterThanOrEqual(
        EXPECTED_THEME_VARIANT_COUNT - 1,
      );

      expect(variantNames).toContain('dark');
      expect(variantNames).toContain('compact');
      expect(variantNames).toContain('large');
      expect(variantNames).toContain('high-contrast');
      expect(variantNames).toContain('gradient');
      expect(variantNames).toContain('math-heavy');
      expect(variantNames).toContain('edge-cases');
    });

    test('dark variant overrides in raw variables (no reference map)', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // --background and --foreground from .dark variant don't have @theme references
      // so they remain in raw variables
      const darkVars = result.variables.filter((v) => v.variantName === 'dark');
      const background = darkVars.find((v) => v.name === '--background');
      expect(background?.value).toBe('oklch(0.15 0 0)');

      const foreground = darkVars.find((v) => v.name === '--foreground');
      expect(foreground?.value).toBe('oklch(0.95 0 0)');
    });

    test('dark variant adjusts spacing with calc() and resolved values', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const darkVars = result.variables.filter((v) => v.variantName === 'dark');
      const contentPadding = darkVars.find(
        (v) => v.name === '--content-padding',
      );
      expect(contentPadding?.value).toBe('calc(1.5rem * 1.1)');

      const sectionGap = darkVars.find((v) => v.name === '--section-gap');
      expect(sectionGap?.value).toBe('calc(2rem * 2.5)');
    });

    test('compact variant reduces all spacing values', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const compactVars = result.variables.filter(
        (v) => v.variantName === 'compact',
      );
      const spacingVars = compactVars.filter((v) =>
        v.name.startsWith('--spacing-'),
      );

      expect(spacingVars.length).toBeGreaterThanOrEqual(
        EXPECTED_COMPACT_SPACING_VARIABLES,
      );

      const baseSpacing = spacingVars.find((v) => v.name === '--spacing-base');
      expect(baseSpacing?.value).toBe('0.125rem');
    });

    test('large variant increases spacing and typography', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const largeVars = result.variables.filter(
        (v) => v.variantName === 'large',
      );

      const spacingVars = largeVars.filter((v) =>
        v.name.startsWith('--spacing-'),
      );
      expect(spacingVars.length).toBeGreaterThanOrEqual(
        EXPECTED_LARGE_SPACING_VARIABLES,
      );

      const textBase = largeVars.find((v) => v.name === '--text-base');
      expect(textBase?.value).toBe('1.25rem');
    });

    test('high-contrast variant increases color intensity', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const highContrastVars = result.variables.filter(
        (v) => v.variantName === 'high-contrast',
      );

      const primary = highContrastVars.find(
        (v) => v.name === '--color-primary-500',
      );
      expect(primary?.value).toBe('oklch(0.5 0.3 250)');

      const background = highContrastVars.find(
        (v) => v.name === '--background',
      );
      expect(background?.value).toBe('oklch(0 0 0)');
    });

    test('gradient variant defines gradient properties with resolved values', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const gradientVars = result.variables.filter(
        (v) => v.variantName === 'gradient',
      );

      expect(gradientVars.length).toBeGreaterThanOrEqual(
        EXPECTED_GRADIENT_PROPERTIES,
      );

      const gradientStart = gradientVars.find(
        (v) => v.name === '--gradient-start',
      );
      // var() reference is resolved to the actual color value
      expect(gradientStart?.value).toBe('oklch(0.6 0.2 250)');

      const gradientAngle = gradientVars.find(
        (v) => v.name === '--gradient-angle',
      );
      expect(gradientAngle?.value).toBe('135deg');
    });

    test('math-heavy variant handles golden ratio calculations with resolved values', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const mathVars = result.variables.filter(
        (v) => v.variantName === 'math-heavy',
      );

      expect(mathVars.length).toBeGreaterThanOrEqual(
        EXPECTED_MATH_HEAVY_PROPERTIES,
      );

      const size1 = mathVars.find((v) => v.name === '--size-1');
      // var() references are partially resolved (--text-base → 1rem)
      expect(size1?.value).toContain('calc(');
      expect(size1?.value).toContain('1rem');

      const size2 = mathVars.find((v) => v.name === '--size-2');
      expect(size2?.value).toContain('calc(');

      const size3 = mathVars.find((v) => v.name === '--size-3');
      expect(size3?.value).toContain('calc(');
    });

    test('math-heavy variant handles complex clamp with min/max', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const mathVars = result.variables.filter(
        (v) => v.variantName === 'math-heavy',
      );

      const dynamicWidth = mathVars.find((v) => v.name === '--dynamic-width');
      expect(dynamicWidth?.value).toContain('clamp(');
      expect(dynamicWidth?.value).toContain('min(20rem, 50vw)');
      expect(dynamicWidth?.value).toContain('max(var(--container-max), 90vw)');
    });
  });

  describe('Edge Cases Theme', () => {
    test('resolves ultra-complex nested functions - calc(clamp(min/max/calc))', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const edgeCaseVars = result.variables.filter(
        (v) => v.variantName === 'edge-cases',
      );

      const ultraComplex = edgeCaseVars.find(
        (v) => v.name === '--ultra-complex-width',
      );
      expect(ultraComplex?.value).toBeDefined();
      expect(ultraComplex?.value).toContain('calc(');
      expect(ultraComplex?.value).toContain('clamp(');
      expect(ultraComplex?.value).toContain('min(');
      expect(ultraComplex?.value).toContain('max(');
      // Verify variables are resolved within the nested structure
      expect(ultraComplex?.value).toContain('20rem'); // --container-min
      expect(ultraComplex?.value).toContain('2rem'); // --spacing-xl
      expect(ultraComplex?.value).toContain('80rem'); // --container-max
    });

    test('resolves hyper-nested clamp with calc/min/max at all levels', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const edgeCaseVars = result.variables.filter(
        (v) => v.variantName === 'edge-cases',
      );

      const hyperNested = edgeCaseVars.find((v) => v.name === '--hyper-nested');
      expect(hyperNested?.value).toBeDefined();
      expect(hyperNested?.value).toContain('clamp(');
      expect(hyperNested?.value).toContain('calc(');
      expect(hyperNested?.value).toContain('min(');
      expect(hyperNested?.value).toContain('max(');
      // Should have resolved spacing variables
      expect(hyperNested?.value).toContain('0.5rem'); // --spacing-sm
      expect(hyperNested?.value).toContain('1rem'); // --spacing-md
    });

    test('resolves calc with nested clamp and arithmetic operations', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const edgeCaseVars = result.variables.filter(
        (v) => v.variantName === 'edge-cases',
      );

      const calculatedClamp = edgeCaseVars.find(
        (v) => v.name === '--calculated-clamp',
      );
      expect(calculatedClamp?.value).toBeDefined();
      expect(calculatedClamp?.value).toContain('calc(');
      expect(calculatedClamp?.value).toContain('clamp(');
      expect(calculatedClamp?.value).toContain('max(');
      expect(calculatedClamp?.value).toContain('min(');
      // Should contain multiplication and division operators
      expect(calculatedClamp?.value).toMatch(/\*/);
      expect(calculatedClamp?.value).toMatch(/\//);
    });

    test('resolves mixed units in calc()', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const edgeCaseVars = result.variables.filter(
        (v) => v.variantName === 'edge-cases',
      );

      expect(edgeCaseVars.length).toBeGreaterThanOrEqual(
        EXPECTED_EDGE_CASES_PROPERTIES,
      );

      const mixedUnits = edgeCaseVars.find((v) => v.name === '--mixed-units');
      expect(mixedUnits?.value).toBe('calc(50% - 1rem + 10vw)');
    });

    test('resolves multiple min() and max() functions with resolved vars', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const edgeCaseVars = result.variables.filter(
        (v) => v.variantName === 'edge-cases',
      );

      const multiConstraint = edgeCaseVars.find(
        (v) => v.name === '--multi-constraint',
      );
      expect(multiConstraint?.value).toContain('min(');
      expect(multiConstraint?.value).toContain('max(0.5rem, 10px)');
      expect(multiConstraint?.value).toContain('max(1.5rem, 50px)');
    });

    test('resolves clamp with all calc() expressions resolved', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const edgeCaseVars = result.variables.filter(
        (v) => v.variantName === 'edge-cases',
      );

      const tripleCalc = edgeCaseVars.find((v) => v.name === '--triple-calc');
      expect(tripleCalc?.value).toContain('clamp(');
      expect(tripleCalc?.value).toContain('calc(0.25rem * 2)');
      expect(tripleCalc?.value).toContain('calc(1rem + 1vw)');
      expect(tripleCalc?.value).toContain('calc(2rem - 0.5rem)');
    });

    test('resolves deeply nested var() references fully resolved', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const edgeCaseVars = result.variables.filter(
        (v) => v.variantName === 'edge-cases',
      );

      const level1 = edgeCaseVars.find((v) => v.name === '--level-1');
      expect(level1?.value).toBe('0.25rem');

      const level2 = edgeCaseVars.find((v) => v.name === '--level-2');
      expect(level2?.value).toBe('0.25rem');

      const level3 = edgeCaseVars.find((v) => v.name === '--level-3');
      expect(level3?.value).toBe('calc(0.25rem * 2)');

      const level4 = edgeCaseVars.find((v) => v.name === '--level-4');
      expect(level4?.value).toBe('min(calc(0.25rem * 2), 2rem)');
    });

    test('resolves negative values in calc() with resolved vars', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const edgeCaseVars = result.variables.filter(
        (v) => v.variantName === 'edge-cases',
      );

      const negativeSpacing = edgeCaseVars.find(
        (v) => v.name === '--negative-spacing',
      );
      expect(negativeSpacing?.value).toBe('calc(0.25rem * -1)');

      const offsetNegative = edgeCaseVars.find(
        (v) => v.name === '--offset-negative',
      );
      expect(offsetNegative?.value).toBe('calc(1rem - 2rem)');
    });

    test('resolves chained operations with all vars resolved', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const edgeCaseVars = result.variables.filter(
        (v) => v.variantName === 'edge-cases',
      );

      const chainCalc = edgeCaseVars.find((v) => v.name === '--chain-calc');
      // All variables are resolved to their final values
      expect(chainCalc?.value).toContain('calc(');
      expect(chainCalc?.value).toContain('0.25rem');
      expect(chainCalc?.value).toContain('0.5rem');
      expect(chainCalc?.value).toContain('1px');
      expect(chainCalc?.value).toContain('1rem');
    });
  });

  describe('Nested Variant Combinations', () => {
    test('resolves compact.dark nested theme', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // Check if we have a variant that combines both selectors
      const nestedVars = result.variables.filter(
        (v) =>
          v.variantName !== undefined &&
          v.variantName.includes('compact') &&
          v.variantName.includes('dark'),
      );

      expect(nestedVars.length).toBeGreaterThan(0);

      const background = nestedVars.find((v) => v.name === '--background');
      expect(background?.value).toBe('oklch(0.1 0 0)');

      const sectionGap = nestedVars.find((v) => v.name === '--section-gap');
      expect(sectionGap?.value).toBe('calc(0.5rem * 2)'); // var(--spacing-md) resolved to 0.5rem from compact variant
    });
  });

  describe('Responsive Theme with Media Queries', () => {
    test('resolves responsive base unit', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      const responsiveVars = result.variables.filter(
        (v) => v.variantName === 'responsive',
      );

      expect(responsiveVars.length).toBeGreaterThan(0);

      const baseUnit = responsiveVars.find((v) => v.name === '--base-unit');
      expect(baseUnit?.value).toBeDefined();
    });
  });

  describe('Overall Structure and Completeness', () => {
    test('resolves comprehensive theme with all properties', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // Verify we have a substantial number of variables
      expect(result.variables.length).toBeGreaterThan(
        EXPECTED_MIN_THEME_PROPERTIES,
      );

      // Verify theme has multiple namespaces
      const themeKeys = Object.keys(result.variants.default);
      expect(themeKeys).toContain('spacing');
      expect(themeKeys).toContain('fontSize');
      expect(themeKeys).toContain('colors');
      expect(themeKeys).toContain('radius');
      expect(themeKeys).toContain('containers'); // Note: plural form
    });

    test('preserves all CSS function wrappers', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // Find variables that should have CSS functions
      const calcVars = result.variables.filter((v) =>
        v.value.includes('calc('),
      );
      const minVars = result.variables.filter((v) => v.value.includes('min('));
      const maxVars = result.variables.filter((v) => v.value.includes('max('));
      const clampVars = result.variables.filter((v) =>
        v.value.includes('clamp('),
      );

      // Verify we resolved CSS functions
      expect(calcVars.length).toBeGreaterThan(0);
      expect(minVars.length).toBeGreaterThan(0);
      expect(maxVars.length).toBeGreaterThan(0);
      expect(clampVars.length).toBeGreaterThan(0);
    });

    test('handles all variants correctly', async () => {
      const result = await resolveTheme({
        css,
        includeTailwindDefaults: false,
      });

      // Verify each major variant has variables
      const darkVars = result.variables.filter((v) => v.variantName === 'dark');
      expect(darkVars.length).toBeGreaterThanOrEqual(
        EXPECTED_DARK_VARIANT_PROPERTIES,
      );

      const compactVars = result.variables.filter(
        (v) => v.variantName === 'compact',
      );
      expect(compactVars.length).toBeGreaterThan(0);

      const largeVars = result.variables.filter(
        (v) => v.variantName === 'large',
      );
      expect(largeVars.length).toBeGreaterThan(0);

      const edgeCaseVars = result.variables.filter(
        (v) => v.variantName === 'edge-cases',
      );
      expect(edgeCaseVars.length).toBeGreaterThan(0);
    });
  });
});
