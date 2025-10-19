/**
 * Tests for variable resolution utilities
 */

import { describe, expect, test } from 'bun:test';

import {
  extractVariantName,
  kebabToCamelCase,
  parseColorScale,
  parseFontSizeLineHeight,
  parseVariableName,
} from '../../../../src/v4/parser/variable-extractor';

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
  test('parses simple color scales', () => {
    expect(parseColorScale('red-500')).toEqual({
      colorName: 'red',
      variant: '500',
    });
    expect(parseColorScale('blue-50')).toEqual({
      colorName: 'blue',
      variant: '50',
    });
  });

  test('parses multi-word color names', () => {
    expect(parseColorScale('tooltip-outline-50')).toEqual({
      colorName: 'tooltipOutline',
      variant: '50',
    });
    expect(parseColorScale('brand-primary-500')).toEqual({
      colorName: 'brandPrimary',
      variant: '500',
    });
  });

  test('parses variants with suffixes', () => {
    expect(parseColorScale('button-500-hover')).toEqual({
      colorName: 'button',
      variant: '500-hover',
    });
    expect(parseColorScale('interactive-500-active')).toEqual({
      colorName: 'interactive',
      variant: '500-active',
    });
  });

  test('parses custom numeric variants', () => {
    expect(parseColorScale('brand-1500')).toEqual({
      colorName: 'brand',
      variant: '1500',
    });
    expect(parseColorScale('special-25')).toEqual({
      colorName: 'special',
      variant: '25',
    });
  });

  test('returns null for flat colors', () => {
    expect(parseColorScale('primary')).toBe(null);
    expect(parseColorScale('white')).toBe(null);
    expect(parseColorScale('brand-main')).toBe(null);
  });

  test('returns null for invalid patterns', () => {
    expect(parseColorScale('invalid')).toBe(null);
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
