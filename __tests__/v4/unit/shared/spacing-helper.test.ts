/**
 * Tests for spacing helper utilities
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import { beforeEach, describe, expect, test } from 'bun:test';

import { createSpacingHelper } from '../../../../src/v4/shared/spacing-helper';

describe('createSpacingHelper', () => {
  describe('Basic functionality', () => {
    test('creates callable spacing object', () => {
      const spacing = createSpacingHelper(
        { base: '0.25rem', xs: '0.75rem' },
        '0.25rem',
      );

      // Should be callable
      expect(typeof spacing).toBe('function');

      // Should have properties
      expect(spacing.base).toBe('0.25rem');
      expect(spacing.xs).toBe('0.75rem');
    });

    test('allows function calls with numbers', () => {
      const spacing = createSpacingHelper({ base: '0.25rem' }, '0.25rem');

      expect(spacing(4)).toBe('calc(0.25rem * 4)');
      expect(spacing(16)).toBe('calc(0.25rem * 16)');
      expect(spacing(0)).toBe('calc(0.25rem * 0)');
    });

    test('allows property access for static values', () => {
      const spacing = createSpacingHelper(
        {
          base: '0.25rem',
          xs: '0.75rem',
          sm: '1rem',
          md: '1.5rem',
          lg: '2rem',
        },
        '0.25rem',
      );

      expect(spacing.xs).toBe('0.75rem');
      expect(spacing.sm).toBe('1rem');
      expect(spacing.md).toBe('1.5rem');
      expect(spacing.lg).toBe('2rem');
    });

    test('allows bracket notation for property access', () => {
      const spacing = createSpacingHelper(
        { base: '0.25rem', xs: '0.75rem' },
        '0.25rem',
      );

      expect(spacing['xs']).toBe('0.75rem');
      expect(spacing['base']).toBe('0.25rem');
    });
  });

  describe('Fallback behavior', () => {
    test('uses fallback when base is not defined in spacing values', () => {
      const spacing = createSpacingHelper({ xs: '0.75rem' }, '0.5rem');

      expect(spacing(8)).toBe('calc(0.5rem * 8)');
      expect(spacing.xs).toBe('0.75rem');
    });

    test('prefers spacing.base over fallback', () => {
      const spacing = createSpacingHelper(
        { base: '0.25rem', xs: '0.75rem' },
        '1rem',
      );

      // Should use 0.25rem (from spacing.base), not 1rem (fallback)
      expect(spacing(4)).toBe('calc(0.25rem * 4)');
    });
  });

  describe('Negative values', () => {
    test('handles negative multipliers', () => {
      const spacing = createSpacingHelper({ base: '0.25rem' }, '0.25rem');

      expect(spacing(-2)).toBe('calc(0.25rem * -2)');
      expect(spacing(-16)).toBe('calc(0.25rem * -16)');
    });
  });

  describe('Edge cases', () => {
    test('handles zero multiplier', () => {
      const spacing = createSpacingHelper({ base: '0.25rem' }, '0.25rem');

      expect(spacing(0)).toBe('calc(0.25rem * 0)');
    });

    test('handles decimal multipliers', () => {
      const spacing = createSpacingHelper({ base: '0.25rem' }, '0.25rem');

      expect(spacing(0.5)).toBe('calc(0.25rem * 0.5)');
      expect(spacing(1.5)).toBe('calc(0.25rem * 1.5)');
      expect(spacing(2.25)).toBe('calc(0.25rem * 2.25)');
    });

    test('handles empty spacing object', () => {
      const spacing = createSpacingHelper({}, '0.25rem');

      expect(spacing(4)).toBe('calc(0.25rem * 4)');
    });

    test('handles non-rem units', () => {
      const spacing = createSpacingHelper({ base: '4px' }, '4px');

      expect(spacing(2)).toBe('calc(4px * 2)');
    });

    test('handles complex CSS units', () => {
      const spacing = createSpacingHelper({ base: '0.5em' }, '0.5em');

      expect(spacing(3)).toBe('calc(0.5em * 3)');
    });
  });

  describe('Real-world usage', () => {
    let defaultSpacing: Record<string, string> & ((n: number) => string);
    let darkSpacing: Record<string, string> & ((n: number) => string);

    beforeEach(() => {
      // Simulate default theme with full spacing scale
      defaultSpacing = createSpacingHelper(
        {
          base: '0.25rem',
          xs: '0.75rem',
          sm: '1rem',
          md: '1.5rem',
          lg: '2rem',
          xl: '3rem',
        },
        '0.25rem',
      );

      // Simulate dark theme without custom spacing (falls back to default base)
      // In reality, if there's no spacing, the helper won't be generated at all
      const fallbackBase = defaultSpacing.base ?? '0.25rem';
      darkSpacing = createSpacingHelper({}, fallbackBase);
    });

    test('default theme works with both static and dynamic values', () => {
      // Static values
      expect(defaultSpacing.xs).toBe('0.75rem');
      expect(defaultSpacing.md).toBe('1.5rem');

      // Dynamic values
      expect(defaultSpacing(4)).toBe('calc(0.25rem * 4)');
      expect(defaultSpacing(16)).toBe('calc(0.25rem * 16)');
    });

    test('dark theme falls back to default spacing', () => {
      // Should use default base unit
      expect(darkSpacing(4)).toBe('calc(0.25rem * 4)');
      expect(darkSpacing(8)).toBe('calc(0.25rem * 8)');
    });

    test('works in style objects', () => {
      const styles = {
        padding: defaultSpacing(4),
        margin: defaultSpacing(2),
        gap: defaultSpacing(3),
        width: defaultSpacing(64),
      };

      expect(styles).toEqual({
        padding: 'calc(0.25rem * 4)',
        margin: 'calc(0.25rem * 2)',
        gap: 'calc(0.25rem * 3)',
        width: 'calc(0.25rem * 64)',
      });
    });

    test('works with dynamic props', () => {
      const size = 8;
      const dynamicStyle = {
        padding: defaultSpacing(size),
        margin: defaultSpacing(size / 2),
      };

      expect(dynamicStyle).toEqual({
        padding: 'calc(0.25rem * 8)',
        margin: 'calc(0.25rem * 4)',
      });
    });
  });

  describe('Type safety simulation', () => {
    test('returned object has both function and record properties', () => {
      const spacing = createSpacingHelper(
        { base: '0.25rem', xs: '0.75rem' },
        '0.25rem',
      );

      // Check it behaves as a function
      const result = spacing(4);
      expect(typeof result).toBe('string');

      // Check it has object properties
      expect('base' in spacing).toBe(true);
      expect('xs' in spacing).toBe(true);

      // Check Object.keys works
      const keys = Object.keys(spacing);
      expect(keys).toContain('base');
      expect(keys).toContain('xs');
    });
  });
});
