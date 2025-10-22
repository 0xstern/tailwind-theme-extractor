/**
 * Unit tests for initial keyword filtering
 * Tests the `initial` keyword feature for removing Tailwind defaults
 */

import type { CSSVariable, Theme } from '../../../src/v4/types';

import { describe, expect, test } from 'bun:test';

import {
  extractInitialExclusions,
  filterDefaultsByExclusions,
  filterThemeByExclusions,
  matchesExclusion,
} from '../../../src/v4/core/theme/filters';

describe('extractInitialExclusions', () => {
  test('extracts single color exclusion', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-lime-500', value: 'initial', source: 'theme' },
    ];

    const exclusions = extractInitialExclusions(variables);

    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]).toEqual({
      pattern: '--color-lime-500',
      namespace: 'color',
      keyPattern: 'lime-500',
      isWildcard: false,
    });
  });

  test('extracts wildcard color scale exclusion', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-lime-*', value: 'initial', source: 'theme' },
    ];

    const exclusions = extractInitialExclusions(variables);

    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]).toEqual({
      pattern: '--color-lime-*',
      namespace: 'color',
      keyPattern: 'lime-*',
      isWildcard: true,
    });
  });

  test('extracts namespace-wide wildcard exclusion', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-*', value: 'initial', source: 'theme' },
    ];

    const exclusions = extractInitialExclusions(variables);

    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]).toEqual({
      pattern: '--color-*',
      namespace: 'color',
      keyPattern: '*',
      isWildcard: true,
    });
  });

  test('extracts multiple exclusions', () => {
    const EXPECTED_EXCLUSIONS_COUNT = 3;
    const variables: Array<CSSVariable> = [
      { name: '--color-lime-*', value: 'initial', source: 'theme' },
      { name: '--color-fuchsia-*', value: 'initial', source: 'theme' },
      { name: '--spacing-4', value: 'initial', source: 'theme' },
    ];

    const exclusions = extractInitialExclusions(variables);

    expect(exclusions).toHaveLength(EXPECTED_EXCLUSIONS_COUNT);
    expect(exclusions[0]?.keyPattern).toBe('lime-*');
    expect(exclusions[1]?.keyPattern).toBe('fuchsia-*');
    expect(exclusions[2]?.keyPattern).toBe('4');
  });

  test('ignores non-initial values', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: '#ff0000', source: 'theme' },
      { name: '--color-lime-*', value: 'initial', source: 'theme' },
    ];

    const exclusions = extractInitialExclusions(variables);

    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]?.keyPattern).toBe('lime-*');
  });

  test('ignores initial from non-theme sources', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'initial', source: 'root' },
      {
        name: '--color-secondary',
        value: 'initial',
        source: 'variant',
        selector: '.dark',
        variantName: 'dark',
      },
    ];

    const exclusions = extractInitialExclusions(variables);

    expect(exclusions).toHaveLength(0);
  });

  test('handles spacing namespace', () => {
    const variables: Array<CSSVariable> = [
      { name: '--spacing-*', value: 'initial', source: 'theme' },
    ];

    const exclusions = extractInitialExclusions(variables);

    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]).toEqual({
      pattern: '--spacing-*',
      namespace: 'spacing',
      keyPattern: '*',
      isWildcard: true,
    });
  });

  test('handles multi-word namespaces', () => {
    const EXPECTED_EXCLUSIONS_COUNT = 2;
    const variables: Array<CSSVariable> = [
      { name: '--font-weight-bold', value: 'initial', source: 'theme' },
      { name: '--text-shadow-sm', value: 'initial', source: 'theme' },
    ];

    const exclusions = extractInitialExclusions(variables);

    expect(exclusions).toHaveLength(EXPECTED_EXCLUSIONS_COUNT);
    expect(exclusions[0]?.namespace).toBe('font-weight');
    expect(exclusions[1]?.namespace).toBe('text-shadow');
  });

  test('handles initial value with whitespace', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-lime-*', value: '  initial  ', source: 'theme' },
    ];

    const exclusions = extractInitialExclusions(variables);

    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]?.keyPattern).toBe('lime-*');
  });
});

describe('matchesExclusion', () => {
  test('matches exact pattern', () => {
    const exclusion = {
      pattern: '--color-lime-500',
      namespace: 'color',
      keyPattern: 'lime-500',
      isWildcard: false,
    };

    expect(matchesExclusion('--color-lime-500', exclusion)).toBe(true);
    expect(matchesExclusion('--color-lime-600', exclusion)).toBe(false);
    expect(matchesExclusion('--color-red-500', exclusion)).toBe(false);
  });

  test('matches prefix wildcard pattern', () => {
    const exclusion = {
      pattern: '--color-lime-*',
      namespace: 'color',
      keyPattern: 'lime-*',
      isWildcard: true,
    };

    expect(matchesExclusion('--color-lime-50', exclusion)).toBe(true);
    expect(matchesExclusion('--color-lime-500', exclusion)).toBe(true);
    expect(matchesExclusion('--color-lime-900', exclusion)).toBe(true);
    expect(matchesExclusion('--color-red-500', exclusion)).toBe(false);
    expect(matchesExclusion('--color-fuchsia-500', exclusion)).toBe(false);
  });

  test('matches namespace-wide wildcard', () => {
    const exclusion = {
      pattern: '--color-*',
      namespace: 'color',
      keyPattern: '*',
      isWildcard: true,
    };

    expect(matchesExclusion('--color-red-500', exclusion)).toBe(true);
    expect(matchesExclusion('--color-lime-500', exclusion)).toBe(true);
    expect(matchesExclusion('--color-blue-900', exclusion)).toBe(true);
    expect(matchesExclusion('--spacing-4', exclusion)).toBe(false);
  });

  test('requires matching namespace', () => {
    const exclusion = {
      pattern: '--color-lime-*',
      namespace: 'color',
      keyPattern: 'lime-*',
      isWildcard: true,
    };

    expect(matchesExclusion('--spacing-lime-500', exclusion)).toBe(false);
  });

  test('handles complex color names', () => {
    const exclusion = {
      pattern: '--color-tooltip-outline-*',
      namespace: 'color',
      keyPattern: 'tooltip-outline-*',
      isWildcard: true,
    };

    expect(matchesExclusion('--color-tooltip-outline-50', exclusion)).toBe(
      true,
    );
    expect(matchesExclusion('--color-tooltip-outline-500', exclusion)).toBe(
      true,
    );
    expect(matchesExclusion('--color-tooltip-50', exclusion)).toBe(false);
  });
});

describe('filterDefaultsByExclusions', () => {
  test('filters single exact match', () => {
    const defaults: Array<CSSVariable> = [
      { name: '--color-lime-500', value: '#84cc16', source: 'theme' },
      { name: '--color-red-500', value: '#ef4444', source: 'theme' },
    ];

    const exclusions = [
      {
        pattern: '--color-lime-500',
        namespace: 'color',
        keyPattern: 'lime-500',
        isWildcard: false,
      },
    ];

    const filtered = filterDefaultsByExclusions(defaults, exclusions);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe('--color-red-500');
  });

  test('filters wildcard pattern', () => {
    const defaults: Array<CSSVariable> = [
      { name: '--color-lime-50', value: '#f7fee7', source: 'theme' },
      { name: '--color-lime-500', value: '#84cc16', source: 'theme' },
      { name: '--color-lime-900', value: '#365314', source: 'theme' },
      { name: '--color-red-500', value: '#ef4444', source: 'theme' },
    ];

    const exclusions = [
      {
        pattern: '--color-lime-*',
        namespace: 'color',
        keyPattern: 'lime-*',
        isWildcard: true,
      },
    ];

    const filtered = filterDefaultsByExclusions(defaults, exclusions);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe('--color-red-500');
  });

  test('filters namespace-wide wildcard', () => {
    const defaults: Array<CSSVariable> = [
      { name: '--color-lime-500', value: '#84cc16', source: 'theme' },
      { name: '--color-red-500', value: '#ef4444', source: 'theme' },
      { name: '--color-blue-500', value: '#3b82f6', source: 'theme' },
      { name: '--spacing-4', value: '1rem', source: 'theme' },
    ];

    const exclusions = [
      {
        pattern: '--color-*',
        namespace: 'color',
        keyPattern: '*',
        isWildcard: true,
      },
    ];

    const filtered = filterDefaultsByExclusions(defaults, exclusions);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe('--spacing-4');
  });

  test('filters multiple exclusion patterns', () => {
    const EXPECTED_REMAINING_COUNT = 2;
    const defaults: Array<CSSVariable> = [
      { name: '--color-lime-500', value: '#84cc16', source: 'theme' },
      { name: '--color-fuchsia-500', value: '#d946ef', source: 'theme' },
      { name: '--color-red-500', value: '#ef4444', source: 'theme' },
      { name: '--spacing-4', value: '1rem', source: 'theme' },
    ];

    const exclusions = [
      {
        pattern: '--color-lime-*',
        namespace: 'color',
        keyPattern: 'lime-*',
        isWildcard: true,
      },
      {
        pattern: '--color-fuchsia-*',
        namespace: 'color',
        keyPattern: 'fuchsia-*',
        isWildcard: true,
      },
    ];

    const filtered = filterDefaultsByExclusions(defaults, exclusions);

    expect(filtered).toHaveLength(EXPECTED_REMAINING_COUNT);
    expect(filtered[0]?.name).toBe('--color-red-500');
    expect(filtered[1]?.name).toBe('--spacing-4');
  });

  test('returns original array when no exclusions', () => {
    const defaults: Array<CSSVariable> = [
      { name: '--color-lime-500', value: '#84cc16', source: 'theme' },
    ];

    const filtered = filterDefaultsByExclusions(defaults, []);

    expect(filtered).toBe(defaults); // Same reference
  });

  test('returns empty array when all excluded', () => {
    const defaults: Array<CSSVariable> = [
      { name: '--color-lime-500', value: '#84cc16', source: 'theme' },
      { name: '--color-red-500', value: '#ef4444', source: 'theme' },
    ];

    const exclusions = [
      {
        pattern: '--color-*',
        namespace: 'color',
        keyPattern: '*',
        isWildcard: true,
      },
    ];

    const filtered = filterDefaultsByExclusions(defaults, exclusions);

    expect(filtered).toHaveLength(0);
  });
});

describe('filterThemeByExclusions', () => {
  test('filters flat colors', () => {
    const theme: Theme = {
      colors: {
        lime: '#84cc16',
        red: '#ef4444',
        blue: '#3b82f6',
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

    const exclusions = [
      {
        pattern: '--color-lime',
        namespace: 'color',
        keyPattern: 'lime',
        isWildcard: false,
      },
    ];

    const filtered = filterThemeByExclusions(theme, exclusions);

    expect(filtered.colors.lime).toBeUndefined();
    expect(filtered.colors.red).toBe('#ef4444');
    expect(filtered.colors.blue).toBe('#3b82f6');
  });

  test('filters color scale variants', () => {
    const theme: Theme = {
      colors: {
        lime: { 50: '#f7fee7', 500: '#84cc16', 900: '#365314' },
        red: { 500: '#ef4444' },
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

    const exclusions = [
      {
        pattern: '--color-lime-*',
        namespace: 'color',
        keyPattern: 'lime-*',
        isWildcard: true,
      },
    ];

    const filtered = filterThemeByExclusions(theme, exclusions);

    expect(filtered.colors.lime).toBeUndefined();
    expect(filtered.colors.red).toBeDefined();
  });

  test('filters partial color scale', () => {
    const theme: Theme = {
      colors: {
        lime: { 50: '#f7fee7', 500: '#84cc16', 900: '#365314' },
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

    const exclusions = [
      {
        pattern: '--color-lime-500',
        namespace: 'color',
        keyPattern: 'lime-500',
        isWildcard: false,
      },
    ];

    const filtered = filterThemeByExclusions(theme, exclusions);

    expect(filtered.colors.lime).toBeDefined();
    if (typeof filtered.colors.lime !== 'string') {
      expect(filtered.colors.lime![50]).toBe('#f7fee7');
      expect(filtered.colors.lime![500]).toBeUndefined();
      expect(filtered.colors.lime![900]).toBe('#365314');
    }
  });

  test('filters spacing values', () => {
    const theme: Theme = {
      colors: {},
      spacing: { '4': '1rem', '8': '2rem', '12': '3rem' },
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

    const exclusions = [
      {
        pattern: '--spacing-4',
        namespace: 'spacing',
        keyPattern: '4',
        isWildcard: false,
      },
    ];

    const filtered = filterThemeByExclusions(theme, exclusions);

    expect(filtered.spacing['4']).toBeUndefined();
    expect(filtered.spacing['8']).toBe('2rem');
    expect(filtered.spacing['12']).toBe('3rem');
  });

  test('filters font sizes', () => {
    const theme: Theme = {
      colors: {},
      spacing: {},
      fonts: {},
      fontSize: {
        base: { size: '1rem', lineHeight: '1.5' },
        lg: { size: '1.125rem' },
      },
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

    const exclusions = [
      {
        pattern: '--text-base',
        namespace: 'text',
        keyPattern: 'base',
        isWildcard: false,
      },
    ];

    const filtered = filterThemeByExclusions(theme, exclusions);

    expect(filtered.fontSize.base).toBeUndefined();
    expect(filtered.fontSize.lg).toEqual({ size: '1.125rem' });
  });

  test('filters multiple properties', () => {
    const theme: Theme = {
      colors: { lime: '#84cc16', red: '#ef4444' },
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

    const exclusions = [
      {
        pattern: '--color-lime',
        namespace: 'color',
        keyPattern: 'lime',
        isWildcard: false,
      },
      {
        pattern: '--spacing-4',
        namespace: 'spacing',
        keyPattern: '4',
        isWildcard: false,
      },
    ];

    const filtered = filterThemeByExclusions(theme, exclusions);

    expect(filtered.colors.lime).toBeUndefined();
    expect(filtered.colors.red).toBe('#ef4444');
    expect(filtered.spacing['4']).toBeUndefined();
    expect(filtered.spacing['8']).toBe('2rem');
  });

  test('returns original theme when no exclusions', () => {
    const theme: Theme = {
      colors: { lime: '#84cc16' },
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

    const filtered = filterThemeByExclusions(theme, []);

    expect(filtered).toBe(theme); // Same reference
  });

  test('preserves keyframes', () => {
    const theme: Theme = {
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
      keyframes: { spin: 'to { transform: rotate(360deg); }' },
    };

    const exclusions = [
      {
        pattern: '--color-*',
        namespace: 'color',
        keyPattern: '*',
        isWildcard: true,
      },
    ];

    const filtered = filterThemeByExclusions(theme, exclusions);

    expect(filtered.keyframes.spin).toBe('to { transform: rotate(360deg); }');
  });
});
