/**
 * Tests for variable resolution utilities
 */

import { describe, expect, test } from 'bun:test';

import {
  extractVariantName,
  kebabToCamelCase,
  parseColorScale,
  parseFontSizeLineHeight,
  parseNestedKey,
  parseVariableName,
} from '../../../src/v4/core/parser/extractor';

describe('extractVariantName', () => {
  test('extracts from data-theme attribute', () => {
    expect(extractVariantName('[data-theme="dark"]')).toBe('dark');
    expect(extractVariantName("[data-theme='midnight']")).toBe('midnight');
  });

  test('extracts from data-mode attribute', () => {
    expect(extractVariantName('[data-mode="dark"]')).toBe('dark');
    expect(extractVariantName("[data-custom='value']")).toBe('value');
  });

  test('extracts from class selector', () => {
    expect(extractVariantName('.dark')).toBe('dark');
    expect(extractVariantName('.midnight')).toBe('midnight');
    expect(extractVariantName('.high-contrast')).toBe('high-contrast');
  });

  test('extracts from media query', () => {
    expect(extractVariantName('prefers-color-scheme: dark')).toBe('dark');
    expect(extractVariantName('prefers-color-scheme: light')).toBe('light');
  });

  test('returns null for unrecognized patterns', () => {
    expect(extractVariantName('body')).toBe(null);
    expect(extractVariantName('#id-selector')).toBe(null);
    expect(extractVariantName('div > span')).toBe(null);
  });
});

describe('parseVariableName', () => {
  test('parses standard variable names', () => {
    const result = parseVariableName('--color-primary');
    expect(result).toEqual({ namespace: 'color', key: 'primary' });
  });

  test('parses color scales', () => {
    const result = parseVariableName('--color-red-500');
    expect(result).toEqual({ namespace: 'color', key: 'red-500' });
  });

  test('parses multi-word keys', () => {
    const result = parseVariableName('--color-tooltip-outline-50');
    expect(result).toEqual({ namespace: 'color', key: 'tooltip-outline-50' });
  });

  test('parses spacing', () => {
    const result = parseVariableName('--spacing-4');
    expect(result).toEqual({ namespace: 'spacing', key: '4' });
  });

  test('parses font families', () => {
    const result = parseVariableName('--font-sans');
    expect(result).toEqual({ namespace: 'font', key: 'sans' });
  });

  test('handles unknown singular variables with default key', () => {
    const result = parseVariableName('--invalid');
    expect(result).toEqual({ namespace: 'invalid', key: 'default' });
  });

  test('handles variable names without -- prefix', () => {
    const result = parseVariableName('color-primary');
    expect(result).toEqual({ namespace: 'color', key: 'primary' });
  });
});

describe('kebabToCamelCase', () => {
  test('converts simple kebab-case', () => {
    expect(kebabToCamelCase('tooltip-outline')).toBe('tooltipOutline');
    expect(kebabToCamelCase('brand-main')).toBe('brandMain');
  });

  test('converts multi-word kebab-case', () => {
    expect(kebabToCamelCase('button-primary-outline')).toBe(
      'buttonPrimaryOutline',
    );
    expect(kebabToCamelCase('tooltip-container-background')).toBe(
      'tooltipContainerBackground',
    );
  });

  test('handles single words', () => {
    expect(kebabToCamelCase('primary')).toBe('primary');
  });

  test('preserves existing camelCase', () => {
    expect(kebabToCamelCase('alreadyCamel')).toBe('alreadyCamel');
  });
});

describe('parseColorScale', () => {
  test('parses simple color scales with numbers', () => {
    expect(parseColorScale('red-500')).toEqual({
      parts: ['red', '500'],
    });
    expect(parseColorScale('blue-50')).toEqual({
      parts: ['blue', '50'],
    });
  });

  test('parses color scales with keyword variants', () => {
    expect(parseColorScale('green-base')).toEqual({
      parts: ['green', 'base'],
    });
    expect(parseColorScale('blue-dark')).toEqual({
      parts: ['blue', 'dark'],
    });
  });

  test('parses multi-level nested colors', () => {
    expect(parseColorScale('tooltip-outline-50')).toEqual({
      parts: ['tooltip', 'outline', '50'],
    });
    expect(parseColorScale('brand-primary-500')).toEqual({
      parts: ['brand', 'primary', '500'],
    });
    expect(parseColorScale('tooltip-outline-dark')).toEqual({
      parts: ['tooltip', 'outline', 'dark'],
    });
  });

  test('parses deep nesting with many levels', () => {
    expect(parseColorScale('a-b-c-d')).toEqual({
      parts: ['a', 'b', 'c', 'd'],
    });
  });

  test('handles consecutive dashes', () => {
    expect(parseColorScale('tooltip--outline-50')).toEqual({
      parts: ['tooltip-', 'outline', '50'],
    });
    expect(parseColorScale('a---b-c')).toEqual({
      parts: ['a--', 'b', 'c'],
    });
  });

  test('returns null for flat colors (no dash)', () => {
    expect(parseColorScale('primary')).toBe(null);
    expect(parseColorScale('white')).toBe(null);
    expect(parseColorScale('tooltipOutline')).toBe(null);
  });

  test('returns null for empty string', () => {
    expect(parseColorScale('')).toBe(null);
  });
});

describe('parseFontSizeLineHeight', () => {
  test('parses line height variables', () => {
    expect(parseFontSizeLineHeight('xs--line-height')).toBe('xs');
    expect(parseFontSizeLineHeight('2xl--line-height')).toBe('2xl');
    expect(parseFontSizeLineHeight('base--line-height')).toBe('base');
  });

  test('returns null for non-line-height variables', () => {
    expect(parseFontSizeLineHeight('xs')).toBe(null);
    expect(parseFontSizeLineHeight('2xl')).toBe(null);
    expect(parseFontSizeLineHeight('line-height')).toBe(null);
  });
});

describe('parseNestedKey', () => {
  describe('Basic functionality (no config)', () => {
    test('returns null for flat keys', () => {
      expect(parseNestedKey('primary')).toBe(null);
      expect(parseNestedKey('white')).toBe(null);
    });

    test('parses simple two-part keys', () => {
      expect(parseNestedKey('red-500')).toEqual({
        parts: ['red', '500'],
      });
      expect(parseNestedKey('blue-dark')).toEqual({
        parts: ['blue', 'dark'],
      });
    });

    test('parses multi-level nested keys', () => {
      expect(parseNestedKey('tooltip-outline-50')).toEqual({
        parts: ['tooltip', 'outline', '50'],
      });
      expect(parseNestedKey('a-b-c-d')).toEqual({
        parts: ['a', 'b', 'c', 'd'],
      });
    });

    test('handles consecutive dashes (default: exclude)', () => {
      // Default behavior is 'exclude' - should return null
      expect(parseNestedKey('button--primary')).toBe(null);
      expect(parseNestedKey('tooltip--outline-50')).toBe(null);
    });
  });

  describe('maxDepth configuration', () => {
    test('limits nesting depth to 1', () => {
      expect(parseNestedKey('a-b-c', { maxDepth: 1 })).toEqual({
        parts: ['a', 'bC'],
      });
      expect(parseNestedKey('tooltip-outline-50', { maxDepth: 1 })).toEqual({
        parts: ['tooltip', 'outline50'],
      });
    });

    test('limits nesting depth to 2', () => {
      expect(parseNestedKey('a-b-c-d', { maxDepth: 2 })).toEqual({
        parts: ['a', 'b', 'cD'],
      });
      expect(parseNestedKey('tooltip-outline-50', { maxDepth: 2 })).toEqual({
        parts: ['tooltip', 'outline', '50'],
      });
    });

    test('maxDepth larger than parts count has no effect', () => {
      expect(parseNestedKey('a-b', { maxDepth: 10 })).toEqual({
        parts: ['a', 'b'],
      });
    });

    test('maxDepth of 0 flattens everything to single camelCase key (default)', () => {
      expect(parseNestedKey('a-b-c', { maxDepth: 0 })).toEqual({
        parts: ['aBC'],
      });
      expect(parseNestedKey('brand-primary-dark', { maxDepth: 0 })).toEqual({
        parts: ['brandPrimaryDark'],
      });
    });

    test('maxDepth of 0 with flattenMode: camelcase', () => {
      expect(
        parseNestedKey('card-foreground', {
          maxDepth: 0,
          flattenMode: 'camelcase',
        }),
      ).toEqual({
        parts: ['cardForeground'],
      });
      expect(
        parseNestedKey('button-primary-text', {
          maxDepth: 0,
          flattenMode: 'camelcase',
        }),
      ).toEqual({
        parts: ['buttonPrimaryText'],
      });
    });

    test('maxDepth of 0 with flattenMode: literal', () => {
      expect(
        parseNestedKey('card-foreground', {
          maxDepth: 0,
          flattenMode: 'literal',
        }),
      ).toEqual({
        parts: ['card-foreground'],
      });
      expect(
        parseNestedKey('button-primary-text', {
          maxDepth: 0,
          flattenMode: 'literal',
        }),
      ).toEqual({
        parts: ['button-primary-text'],
      });
    });

    test('maxDepth of 0 with single part (no dash)', () => {
      // Single part should return null (flat key)
      expect(parseNestedKey('red', { maxDepth: 0 })).toBe(null);
      expect(
        parseNestedKey('primary', {
          maxDepth: 0,
          flattenMode: 'literal',
        }),
      ).toBe(null);
    });

    test('maxDepth of 0 with flattenMode: literal and consecutiveDashes: literal', () => {
      expect(
        parseNestedKey('button--primary', {
          maxDepth: 0,
          flattenMode: 'literal',
          consecutiveDashes: 'literal',
        }),
      ).toEqual({
        parts: ['button--primary'],
      });
    });
  });

  describe('consecutiveDashes configuration', () => {
    test('exclude mode: returns null for consecutive dashes (default)', () => {
      expect(
        parseNestedKey('button--primary', { consecutiveDashes: 'exclude' }),
      ).toBe(null);
      expect(
        parseNestedKey('tooltip--outline-50', { consecutiveDashes: 'exclude' }),
      ).toBe(null);
    });

    test('nest mode: treats consecutive dashes as single dash', () => {
      expect(
        parseNestedKey('button--primary', {
          consecutiveDashes: 'nest',
        }),
      ).toEqual({
        parts: ['button', 'primary'],
      });

      expect(
        parseNestedKey('tooltip--outline-50', {
          consecutiveDashes: 'nest',
        }),
      ).toEqual({
        parts: ['tooltip', 'outline', '50'],
      });
    });

    test('camelcase mode: treats consecutive dashes as camelCase boundary', () => {
      expect(
        parseNestedKey('button--primary', {
          consecutiveDashes: 'camelcase',
        }),
      ).toEqual({
        parts: ['buttonPrimary'],
      });

      expect(
        parseNestedKey('tooltip--outline-50', {
          consecutiveDashes: 'camelcase',
        }),
      ).toEqual({
        parts: ['tooltipOutline', '50'],
      });
    });

    test('literal mode: appends dash to previous part', () => {
      expect(
        parseNestedKey('button--primary', {
          consecutiveDashes: 'literal',
        }),
      ).toEqual({
        parts: ['button-', 'primary'],
      });

      expect(
        parseNestedKey('tooltip--outline-50', {
          consecutiveDashes: 'literal',
        }),
      ).toEqual({
        parts: ['tooltip-', 'outline', '50'],
      });
    });

    test('handles multiple consecutive dashes in different modes', () => {
      expect(parseNestedKey('a---b-c', { consecutiveDashes: 'nest' })).toEqual({
        parts: ['a', 'b', 'c'],
      });

      expect(
        parseNestedKey('a---b-c', { consecutiveDashes: 'camelcase' }),
      ).toEqual({
        parts: ['aB', 'c'],
      });

      expect(
        parseNestedKey('a---b-c', { consecutiveDashes: 'literal' }),
      ).toEqual({
        parts: ['a--', 'b', 'c'],
      });
    });
  });

  describe('Combined configurations', () => {
    test('maxDepth with consecutiveDashes camelcase mode', () => {
      expect(
        parseNestedKey('button--primary-hover', {
          maxDepth: 2,
          consecutiveDashes: 'camelcase',
        }),
      ).toEqual({
        parts: ['buttonPrimary', 'hover'],
      });
    });

    test('maxDepth 1 with consecutive dashes camelcase mode', () => {
      expect(
        parseNestedKey('button--primary-active', {
          maxDepth: 1,
          consecutiveDashes: 'camelcase',
        }),
      ).toEqual({
        parts: ['buttonPrimary', 'active'],
      });
    });

    test('maxDepth with consecutiveDashes nest mode', () => {
      expect(
        parseNestedKey('button--primary-hover', {
          maxDepth: 2,
          consecutiveDashes: 'nest',
        }),
      ).toEqual({
        parts: ['button', 'primary', 'hover'],
      });
    });
  });

  describe('flattenMode configuration', () => {
    test('camelcase mode (default) flattens to camelCase', () => {
      expect(
        parseNestedKey('blue-sky-light-50', {
          maxDepth: 2,
          flattenMode: 'camelcase',
        }),
      ).toEqual({
        parts: ['blue', 'sky', 'light50'],
      });

      expect(
        parseNestedKey('tooltip-outline-hover-active', {
          maxDepth: 2,
          flattenMode: 'camelcase',
        }),
      ).toEqual({
        parts: ['tooltip', 'outline', 'hoverActive'],
      });
    });

    test('literal mode flattens to kebab-case string', () => {
      expect(
        parseNestedKey('blue-sky-light-50', {
          maxDepth: 2,
          flattenMode: 'literal',
        }),
      ).toEqual({
        parts: ['blue', 'sky', 'light-50'],
      });

      expect(
        parseNestedKey('tooltip-outline-hover-active', {
          maxDepth: 2,
          flattenMode: 'literal',
        }),
      ).toEqual({
        parts: ['tooltip', 'outline', 'hover-active'],
      });
    });

    test('flattenMode only applies when maxDepth is reached', () => {
      // When maxDepth is not reached, flattenMode has no effect
      expect(
        parseNestedKey('a-b', {
          maxDepth: 5,
          flattenMode: 'literal',
        }),
      ).toEqual({
        parts: ['a', 'b'],
      });

      // When no maxDepth is set, flattenMode has no effect
      expect(
        parseNestedKey('a-b-c-d', {
          flattenMode: 'literal',
        }),
      ).toEqual({
        parts: ['a', 'b', 'c', 'd'],
      });
    });

    test('flattenMode with maxDepth 1', () => {
      expect(
        parseNestedKey('a-b-c-d', {
          maxDepth: 1,
          flattenMode: 'camelcase',
        }),
      ).toEqual({
        parts: ['a', 'bCD'],
      });

      expect(
        parseNestedKey('a-b-c-d', {
          maxDepth: 1,
          flattenMode: 'literal',
        }),
      ).toEqual({
        parts: ['a', 'b-c-d'],
      });
    });

    test('flattenMode with maxDepth 3', () => {
      expect(
        parseNestedKey('a-b-c-d-e-f', {
          maxDepth: 3,
          flattenMode: 'camelcase',
        }),
      ).toEqual({
        parts: ['a', 'b', 'c', 'dEF'],
      });

      expect(
        parseNestedKey('a-b-c-d-e-f', {
          maxDepth: 3,
          flattenMode: 'literal',
        }),
      ).toEqual({
        parts: ['a', 'b', 'c', 'd-e-f'],
      });
    });

    test('flattenMode with single part after maxDepth', () => {
      // With 3 parts total and maxDepth 2, we have 2 nesting levels, then flatten the rest
      expect(
        parseNestedKey('color-blue-500', {
          maxDepth: 2,
          flattenMode: 'camelcase',
        }),
      ).toEqual({
        parts: ['color', 'blue', '500'],
      });

      expect(
        parseNestedKey('color-blue-500', {
          maxDepth: 2,
          flattenMode: 'literal',
        }),
      ).toEqual({
        parts: ['color', 'blue', '500'],
      });
    });

    test('flattenMode with consecutiveDashes', () => {
      expect(
        parseNestedKey('button--primary-hover-active', {
          maxDepth: 2,
          consecutiveDashes: 'camelcase',
          flattenMode: 'camelcase',
        }),
      ).toEqual({
        parts: ['buttonPrimary', 'hover', 'active'],
      });

      expect(
        parseNestedKey('button--primary-hover-active', {
          maxDepth: 2,
          consecutiveDashes: 'camelcase',
          flattenMode: 'literal',
        }),
      ).toEqual({
        parts: ['buttonPrimary', 'hover', 'active'],
      });

      expect(
        parseNestedKey('tooltip--outline-hover-focus', {
          maxDepth: 2,
          consecutiveDashes: 'nest',
          flattenMode: 'literal',
        }),
      ).toEqual({
        parts: ['tooltip', 'outline', 'hover-focus'],
      });
    });

    test('default flatten behavior is camelcase (backward compatibility)', () => {
      // When flattenMode is not specified, should default to camelcase
      expect(
        parseNestedKey('a-b-c-d', {
          maxDepth: 2,
        }),
      ).toEqual({
        parts: ['a', 'b', 'cD'],
      });
    });
  });
});
