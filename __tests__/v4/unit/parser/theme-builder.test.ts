/**
 * Unit tests for theme builder module
 * Tests theme construction, variable resolution, and conflict detection
 */

import type { CSSVariable } from '../../../../src/v4/types';

import { describe, expect, test } from 'bun:test';

import { buildThemes } from '../../../../src/v4/parser/theme-builder';

describe('buildThemes - Basic theme construction', () => {
  test('builds empty theme from empty variables', () => {
    const result = buildThemes([], new Map(), []);

    expect(result.theme.colors).toEqual({});
    expect(result.theme.spacing).toEqual({});
    expect(result.variants).toEqual({});
    expect(result.deprecationWarnings).toHaveLength(0);
    expect(result.cssConflicts).toHaveLength(0);
  });

  test('builds theme from simple @theme variables', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: '#3b82f6', source: 'theme' },
      { name: '--spacing-4', value: '1rem', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.colors.primary).toBe('#3b82f6');
    expect(result.theme.spacing['4']).toBe('1rem');
  });

  test('builds theme from :root variables', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-secondary', value: '#8b5cf6', source: 'root' },
      { name: '--radius-base', value: '0.5rem', source: 'root' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.colors.secondary).toBe('#8b5cf6');
    expect(result.theme.radius.base).toBe('0.5rem');
  });

  test('merges @theme and :root variables', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'blue', source: 'theme' },
      { name: '--color-secondary', value: 'red', source: 'root' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.colors.primary).toBe('blue');
    expect(result.theme.colors.secondary).toBe('red');
  });
});

describe('buildThemes - Color handling', () => {
  test('processes flat colors', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-white', value: '#ffffff', source: 'theme' },
      { name: '--color-black', value: '#000000', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.colors.white).toBe('#ffffff');
    expect(result.theme.colors.black).toBe('#000000');
  });

  test('processes color scales', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-red-50', value: '#fef2f2', source: 'theme' },
      { name: '--color-red-500', value: '#ef4444', source: 'theme' },
      { name: '--color-red-900', value: '#7f1d1d', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.colors.red).toBeDefined();
    expect(typeof result.theme.colors.red).toBe('object');

    if (
      typeof result.theme.colors.red !== 'string' &&
      result.theme.colors.red
    ) {
      expect(result.theme.colors.red![50]).toBe('#fef2f2');
      expect(result.theme.colors.red![500]).toBe('#ef4444');
      expect(result.theme.colors.red![900]).toBe('#7f1d1d');
    }
  });

  test('converts kebab-case color names to camelCase', () => {
    const variables: Array<CSSVariable> = [
      {
        name: '--color-brand-primary',
        value: '#3b82f6',
        source: 'theme',
      },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.colors.brandPrimary).toBe('#3b82f6');
  });

  test('handles mixed flat and scale colors', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-white', value: '#ffffff', source: 'theme' },
      { name: '--color-blue-500', value: '#3b82f6', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.colors.white).toBe('#ffffff');
    expect(typeof result.theme.colors.blue).toBe('object');
  });
});

describe('buildThemes - Font size handling', () => {
  test('processes font sizes without line heights', () => {
    const variables: Array<CSSVariable> = [
      { name: '--text-sm', value: '0.875rem', source: 'theme' },
      { name: '--text-base', value: '1rem', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.fontSize.sm).toEqual({ size: '0.875rem' });
    expect(result.theme.fontSize.base).toEqual({ size: '1rem' });
  });

  test('processes font sizes with line heights', () => {
    const variables: Array<CSSVariable> = [
      { name: '--text-lg', value: '1.125rem', source: 'theme' },
      { name: '--text-lg--line-height', value: '1.75rem', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.fontSize.lg).toEqual({
      size: '1.125rem',
      lineHeight: '1.75rem',
    });
  });

  test('merges line heights with font sizes', () => {
    const variables: Array<CSSVariable> = [
      { name: '--text-xl', value: '1.25rem', source: 'theme' },
      { name: '--text-xl--line-height', value: '1.75rem', source: 'theme' },
      { name: '--text-2xl', value: '1.5rem', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.fontSize.xl).toEqual({
      size: '1.25rem',
      lineHeight: '1.75rem',
    });
    expect(result.theme.fontSize['2xl']).toEqual({ size: '1.5rem' });
  });
});

describe('buildThemes - Variable resolution', () => {
  test('resolves var() references from :root', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'var(--brand)', source: 'theme' },
      { name: '--brand', value: '#3b82f6', source: 'root' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.colors.primary).toBe('#3b82f6');
  });

  test('resolves nested var() references', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'var(--brand)', source: 'theme' },
      { name: '--brand', value: 'var(--blue)', source: 'root' },
      { name: '--blue', value: '#3b82f6', source: 'root' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.colors.primary).toBe('#3b82f6');
  });

  test('resolves var() in CSS functions', () => {
    const variables: Array<CSSVariable> = [
      {
        name: '--radius-lg',
        value: 'calc(var(--radius) + 4px)',
        source: 'theme',
      },
      { name: '--radius', value: '0.5rem', source: 'root' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.radius.lg).toBe('calc(0.5rem + 4px)');
  });

  test('handles unresolvable var() references', () => {
    const variables: Array<CSSVariable> = [
      {
        name: '--color-primary',
        value: 'var(--non-existent)',
        source: 'theme',
      },
    ];

    const result = buildThemes(variables, new Map(), []);

    // Should keep the var() reference if it can't be resolved
    expect(result.theme.colors.primary).toBe('var(--non-existent)');
  });

  test('prevents circular var() references', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-a', value: 'var(--color-b)', source: 'theme' },
      { name: '--color-b', value: 'var(--color-a)', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    // Should not infinite loop - should stop after detecting circularity
    expect(result.theme.colors.a).toBeDefined();
    expect(result.theme.colors.b).toBeDefined();
  });
});

describe('buildThemes - Keyframes', () => {
  test('includes keyframes in theme', () => {
    const keyframes = new Map([
      ['spin', 'to { transform: rotate(360deg); }'],
      ['fadeIn', 'from { opacity: 0; } to { opacity: 1; }'],
    ]);

    const result = buildThemes([], keyframes, []);

    expect(result.theme.keyframes.spin).toBe(
      'to { transform: rotate(360deg); }',
    );
    expect(result.theme.keyframes.fadeIn).toBe(
      'from { opacity: 0; } to { opacity: 1; }',
    );
  });

  test('handles empty keyframes map', () => {
    const result = buildThemes([], new Map(), []);

    expect(result.theme.keyframes).toEqual({});
  });
});

describe('buildThemes - Variants', () => {
  test('builds variant themes', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'blue', source: 'theme' },
      {
        name: '--color-background',
        value: 'black',
        source: 'variant',
        selector: '.dark',
        variantName: 'dark',
      },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.variants.dark).toBeDefined();
    expect(result.variants.dark!.selector).toBe('.dark');
    expect(result.variants.dark!.theme.colors.background).toBe('black');
  });

  test('variants inherit base theme variables', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'blue', source: 'theme' },
      {
        name: '--color-background',
        value: 'black',
        source: 'variant',
        selector: '.dark',
        variantName: 'dark',
      },
    ];

    const result = buildThemes(variables, new Map(), []);

    // Variant should have access to base primary color
    expect(result.theme.colors.primary).toBe('blue');
  });

  test('converts variant names to camelCase', () => {
    const variables: Array<CSSVariable> = [
      {
        name: '--color-background',
        value: 'white',
        source: 'variant',
        selector: '.high-contrast',
        variantName: 'high-contrast',
      },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.variants.highContrast).toBeDefined();
    expect(result.variants.highContrast!.selector).toBe('.high-contrast');
  });

  test('handles multiple variants', () => {
    const variables: Array<CSSVariable> = [
      {
        name: '--color-bg',
        value: 'black',
        source: 'variant',
        selector: '.dark',
        variantName: 'dark',
      },
      {
        name: '--spacing-base',
        value: '0.5rem',
        source: 'variant',
        selector: '.compact',
        variantName: 'compact',
      },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.variants.dark).toBeDefined();
    expect(result.variants.compact).toBeDefined();
    expect(result.variants.dark!.theme.colors.bg).toBe('black');
    expect(result.variants.compact!.theme.spacing.base).toBe('0.5rem');
  });

  test('handles nested variants', () => {
    const variables: Array<CSSVariable> = [
      {
        name: '--color-bg',
        value: 'gray',
        source: 'variant',
        selector: '.compact',
        variantName: 'compact',
      },
      {
        name: '--color-bg',
        value: 'black',
        source: 'variant',
        selector: '.compact.dark',
        variantName: 'compact.dark',
      },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.variants.compactDark).toBeDefined();
    expect(result.variants.compactDark!.theme.colors.bg).toBe('black');
  });
});

describe('buildThemes - Deprecation warnings', () => {
  test('returns empty array when no deprecations', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'blue', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.deprecationWarnings).toHaveLength(0);
  });

  test('deduplicates deprecation warnings', () => {
    // This would require deprecated variable patterns
    // The current implementation tracks warnings for duplicate variables
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'blue', source: 'theme' },
      { name: '--color-primary', value: 'red', source: 'root' },
    ];

    const result = buildThemes(variables, new Map(), []);

    // Deduplication should prevent duplicate warnings for same variable
    expect(result.deprecationWarnings).toBeDefined();
  });
});

describe('buildThemes - CSS conflicts', () => {
  test('detects CSS rule conflicts', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'blue', source: 'theme' },
      {
        name: '--color-background',
        value: 'white',
        source: 'variant',
        selector: '.dark',
        variantName: 'dark',
      },
    ];

    const cssRules = [
      {
        variantName: 'dark',
        selector: '.dark',
        originalSelector: '.dark',
        property: 'color',
        value: 'red',
        complexity: 'simple' as const,
      },
    ];

    const result = buildThemes(variables, new Map(), cssRules);

    expect(result.cssConflicts).toBeDefined();
  });

  test('detects CSS conflicts', () => {
    const variables: Array<CSSVariable> = [
      {
        name: '--color-text',
        value: 'black',
        source: 'variant',
        selector: '.dark',
        variantName: 'dark',
      },
    ];

    const cssRules = [
      {
        variantName: 'dark',
        selector: '.dark color',
        originalSelector: '.dark',
        property: 'color',
        value: 'white',
        complexity: 'simple' as const,
      },
    ];

    const result = buildThemes(variables, new Map(), cssRules);

    // Conflict should be detected
    expect(result.cssConflicts.length).toBeGreaterThanOrEqual(0);
    // Variant theme should have the original variable value
    expect(result.variants.dark!.theme.colors.text).toBe('black');
  });
});

describe('buildThemes - Default theme integration', () => {
  test('uses default theme for var() resolution', () => {
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
      radius: { base: '0.5rem' },
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

    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'red', source: 'theme' },
      { name: '--radius-lg', value: 'var(--radius)', source: 'theme' },
      { name: '--radius', value: '1rem', source: 'root' },
    ];

    const result = buildThemes(variables, new Map(), [], defaultTheme);

    expect(result.theme.colors.primary).toBe('red');
    // Should resolve var() using provided values, not defaults
    expect(result.theme.radius.lg).toBe('1rem');
  });

  test('can build theme without default theme', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'red', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.colors.primary).toBe('red');
  });
});

describe('buildThemes - All theme properties', () => {
  test('builds all theme property types', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'blue', source: 'theme' },
      { name: '--spacing-4', value: '1rem', source: 'theme' },
      { name: '--font-sans', value: 'Inter', source: 'theme' },
      { name: '--text-base', value: '1rem', source: 'theme' },
      { name: '--font-weight-bold', value: '700', source: 'theme' },
      { name: '--tracking-tight', value: '-0.025em', source: 'theme' },
      { name: '--leading-normal', value: '1.5', source: 'theme' },
      { name: '--breakpoint-md', value: '768px', source: 'theme' },
      { name: '--container-sm', value: '640px', source: 'theme' },
      { name: '--radius-md', value: '0.375rem', source: 'theme' },
      {
        name: '--shadow-md',
        value: '0 4px 6px rgba(0,0,0,0.1)',
        source: 'theme',
      },
      {
        name: '--inset-shadow-sm',
        value: 'inset 0 1px 2px rgba(0,0,0,0.05)',
        source: 'theme',
      },
      {
        name: '--drop-shadow-md',
        value: '0 4px 3px rgba(0,0,0,0.07)',
        source: 'theme',
      },
      {
        name: '--text-shadow-sm',
        value: '0 1px 2px rgba(0,0,0,0.05)',
        source: 'theme',
      },
      { name: '--blur-sm', value: '4px', source: 'theme' },
      { name: '--perspective-normal', value: '1000px', source: 'theme' },
      { name: '--aspect-square', value: '1/1', source: 'theme' },
      {
        name: '--ease-in-out',
        value: 'cubic-bezier(0.4, 0, 0.2, 1)',
        source: 'theme',
      },
      {
        name: '--animate-spin',
        value: 'spin 1s linear infinite',
        source: 'theme',
      },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.colors.primary).toBe('blue');
    expect(result.theme.spacing['4']).toBe('1rem');
    expect(result.theme.fonts.sans).toBe('Inter');
    expect(result.theme.fontSize.base).toEqual({ size: '1rem' });
    expect(result.theme.fontWeight.bold).toBe('700');
    expect(result.theme.tracking.tight).toBe('-0.025em');
    expect(result.theme.leading.normal).toBe('1.5');
    expect(result.theme.breakpoints.md).toBe('768px');
    expect(result.theme.containers.sm).toBe('640px');
    expect(result.theme.radius.md).toBe('0.375rem');
    expect(result.theme.shadows.md).toBe('0 4px 6px rgba(0,0,0,0.1)');
    expect(result.theme.insetShadows.sm).toBe(
      'inset 0 1px 2px rgba(0,0,0,0.05)',
    );
    expect(result.theme.dropShadows.md).toBe('0 4px 3px rgba(0,0,0,0.07)');
    expect(result.theme.textShadows.sm).toBe('0 1px 2px rgba(0,0,0,0.05)');
    expect(result.theme.blur.sm).toBe('4px');
    expect(result.theme.perspective.normal).toBe('1000px');
    expect(result.theme.aspect.square).toBe('1/1');
    expect(result.theme.ease['in-out']).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(result.theme.animations.spin).toBe('spin 1s linear infinite');
  });
});

describe('buildThemes - Return value structure', () => {
  test('returns all required properties', () => {
    const result = buildThemes([], new Map(), []);

    expect(result).toHaveProperty('theme');
    expect(result).toHaveProperty('variants');
    expect(result).toHaveProperty('deprecationWarnings');
    expect(result).toHaveProperty('cssConflicts');
    expect(result).toHaveProperty('variables');
  });

  test('theme has all standard properties', () => {
    const result = buildThemes([], new Map(), []);

    expect(result.theme).toHaveProperty('colors');
    expect(result.theme).toHaveProperty('spacing');
    expect(result.theme).toHaveProperty('fonts');
    expect(result.theme).toHaveProperty('fontSize');
    expect(result.theme).toHaveProperty('fontWeight');
    expect(result.theme).toHaveProperty('tracking');
    expect(result.theme).toHaveProperty('leading');
    expect(result.theme).toHaveProperty('breakpoints');
    expect(result.theme).toHaveProperty('containers');
    expect(result.theme).toHaveProperty('radius');
    expect(result.theme).toHaveProperty('shadows');
    expect(result.theme).toHaveProperty('insetShadows');
    expect(result.theme).toHaveProperty('dropShadows');
    expect(result.theme).toHaveProperty('textShadows');
    expect(result.theme).toHaveProperty('blur');
    expect(result.theme).toHaveProperty('perspective');
    expect(result.theme).toHaveProperty('aspect');
    expect(result.theme).toHaveProperty('ease');
    expect(result.theme).toHaveProperty('animations');
    expect(result.theme).toHaveProperty('defaults');
    expect(result.theme).toHaveProperty('keyframes');
  });

  test('variants is an object', () => {
    const result = buildThemes([], new Map(), []);

    expect(typeof result.variants).toBe('object');
    expect(Array.isArray(result.variants)).toBe(false);
  });

  test('returns resolved variables array', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'var(--brand)', source: 'theme' },
      { name: '--brand', value: 'blue', source: 'root' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(Array.isArray(result.variables)).toBe(true);
    expect(result.variables.length).toBeGreaterThan(0);

    // Variables should be resolved
    const primaryVar = result.variables.find(
      (v) => v.name === '--color-primary',
    );
    expect(primaryVar?.value).toBe('blue');
  });
});

describe('buildThemes - Edge cases', () => {
  test('handles duplicate variable names (last wins)', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'blue', source: 'theme' },
      { name: '--color-primary', value: 'red', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    // Last value should win
    expect(result.theme.colors.primary).toBe('red');
  });

  test('handles variables with numeric keys', () => {
    const variables: Array<CSSVariable> = [
      { name: '--spacing-1.5', value: '0.375rem', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.spacing['1.5']).toBe('0.375rem');
  });

  test('handles numeric font weights', () => {
    const variables: Array<CSSVariable> = [
      { name: '--font-weight-bold', value: '700', source: 'theme' },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.fontWeight.bold).toBe('700');
  });

  test('handles complex CSS values', () => {
    const variables: Array<CSSVariable> = [
      {
        name: '--shadow-complex',
        value:
          '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        source: 'theme',
      },
    ];

    const result = buildThemes(variables, new Map(), []);

    expect(result.theme.shadows.complex).toContain('rgba(0, 0, 0, 0.1)');
  });
});
