/**
 * @file Tests for unresolved variable detection
 */

import type { CSSVariable } from '../../../../src/v4/types';

import { describe, expect, test } from 'bun:test';

import {
  detectUnresolvedVariables,
  groupByLikelyCause,
  groupBySource,
} from '../../../../src/v4/parser/unresolved-detector';

const EXPECTED_MULTIPLE_REFS = 2;
const EXPECTED_THREE_GROUPS = 3;

describe('detectUnresolvedVariables', () => {
  test('detects external unresolved variable (font example)', () => {
    const original: Array<CSSVariable> = [
      {
        name: '--font-sans',
        value: 'var(--font-inter)',
        source: 'variant',
        variantName: 'theme-inter',
        selector: '.theme-inter',
      },
    ];

    const resolved: Array<CSSVariable> = [
      {
        name: '--font-sans',
        value: 'var(--font-inter)', // Still unresolved
        source: 'variant',
        variantName: 'theme-inter',
        selector: '.theme-inter',
      },
    ];

    const unresolved = detectUnresolvedVariables(original, resolved);

    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toMatchObject({
      variableName: '--font-sans',
      originalValue: 'var(--font-inter)',
      referencedVariable: '--font-inter',
      source: 'variant',
      variantName: 'theme-inter',
      likelyCause: 'unknown',
    });
  });

  test('detects Tailwind-specific external variables', () => {
    const original: Array<CSSVariable> = [
      {
        name: '--color-primary',
        value: 'var(--tw-color-blue-500)',
        source: 'theme',
      },
    ];

    const resolved: Array<CSSVariable> = [
      {
        name: '--color-primary',
        value: 'var(--tw-color-blue-500)', // Still unresolved
        source: 'theme',
      },
    ];

    const unresolved = detectUnresolvedVariables(original, resolved);

    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toMatchObject({
      variableName: '--color-primary',
      referencedVariable: '--tw-color-blue-500',
      likelyCause: 'external',
    });
  });

  test('detects self-referential variables', () => {
    const original: Array<CSSVariable> = [
      {
        name: '--font-sans',
        value: 'var(--font-sans)',
        source: 'theme',
      },
    ];

    const resolved: Array<CSSVariable> = [
      {
        name: '--font-sans',
        value: 'var(--font-sans)', // Self-referential
        source: 'theme',
      },
    ];

    const unresolved = detectUnresolvedVariables(original, resolved);

    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toMatchObject({
      variableName: '--font-sans',
      referencedVariable: '--font-sans',
      likelyCause: 'self-referential',
    });
  });

  test('detects variables with fallback values', () => {
    const original: Array<CSSVariable> = [
      {
        name: '--color-primary',
        value: 'var(--custom-color, #3b82f6)',
        source: 'theme',
      },
    ];

    const resolved: Array<CSSVariable> = [
      {
        name: '--color-primary',
        value: 'var(--custom-color, #3b82f6)', // Still unresolved
        source: 'theme',
      },
    ];

    const unresolved = detectUnresolvedVariables(original, resolved);

    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toMatchObject({
      variableName: '--color-primary',
      referencedVariable: '--custom-color',
      fallbackValue: '#3b82f6',
      likelyCause: 'unknown',
    });
  });

  test('detects multiple unresolved variables in one value', () => {
    const original: Array<CSSVariable> = [
      {
        name: '--spacing',
        value: 'calc(var(--base-spacing) * var(--scale-factor))',
        source: 'theme',
      },
    ];

    const resolved: Array<CSSVariable> = [
      {
        name: '--spacing',
        value: 'calc(var(--base-spacing) * var(--scale-factor))', // Both unresolved
        source: 'theme',
      },
    ];

    const unresolved = detectUnresolvedVariables(original, resolved);

    expect(unresolved).toHaveLength(EXPECTED_MULTIPLE_REFS);
    expect(unresolved[0]).toMatchObject({
      variableName: '--spacing',
      referencedVariable: '--base-spacing',
    });
    expect(unresolved[1]).toMatchObject({
      variableName: '--spacing',
      referencedVariable: '--scale-factor',
    });
  });

  test('skips fully resolved variables', () => {
    const original: Array<CSSVariable> = [
      {
        name: '--color-primary',
        value: 'var(--color-blue)',
        source: 'theme',
      },
    ];

    const resolved: Array<CSSVariable> = [
      {
        name: '--color-primary',
        value: '#3b82f6', // Fully resolved
        source: 'theme',
      },
    ];

    const unresolved = detectUnresolvedVariables(original, resolved);

    expect(unresolved).toHaveLength(0);
  });

  test('skips variables without var() in original', () => {
    const original: Array<CSSVariable> = [
      {
        name: '--color-primary',
        value: '#3b82f6', // No var()
        source: 'theme',
      },
    ];

    const resolved: Array<CSSVariable> = [
      {
        name: '--color-primary',
        value: '#3b82f6',
        source: 'theme',
      },
    ];

    const unresolved = detectUnresolvedVariables(original, resolved);

    expect(unresolved).toHaveLength(0);
  });

  test('handles variant-specific variables', () => {
    const original: Array<CSSVariable> = [
      {
        name: '--font-sans',
        value: 'var(--font-inter)',
        source: 'variant',
        variantName: 'theme-inter',
        selector: '.theme-inter .theme-container',
      },
      {
        name: '--font-sans',
        value: 'var(--font-noto-sans)',
        source: 'variant',
        variantName: 'theme-noto-sans',
        selector: '.theme-noto-sans .theme-container',
      },
    ];

    const resolved: Array<CSSVariable> = [
      {
        name: '--font-sans',
        value: 'var(--font-inter)',
        source: 'variant',
        variantName: 'theme-inter',
        selector: '.theme-inter .theme-container',
      },
      {
        name: '--font-sans',
        value: 'var(--font-noto-sans)',
        source: 'variant',
        variantName: 'theme-noto-sans',
        selector: '.theme-noto-sans .theme-container',
      },
    ];

    const unresolved = detectUnresolvedVariables(original, resolved);

    expect(unresolved).toHaveLength(EXPECTED_MULTIPLE_REFS);
    expect(unresolved[0]).toMatchObject({
      variableName: '--font-sans',
      referencedVariable: '--font-inter',
      variantName: 'theme-inter',
      selector: '.theme-inter .theme-container',
    });
    expect(unresolved[1]).toMatchObject({
      variableName: '--font-sans',
      referencedVariable: '--font-noto-sans',
      variantName: 'theme-noto-sans',
      selector: '.theme-noto-sans .theme-container',
    });
  });

  test('handles missing resolved variables (filtered out)', () => {
    const original: Array<CSSVariable> = [
      {
        name: '--color-primary',
        value: 'var(--missing)',
        source: 'theme',
      },
    ];

    const resolved: Array<CSSVariable> = []; // Variable was filtered out

    const unresolved = detectUnresolvedVariables(original, resolved);

    expect(unresolved).toHaveLength(0);
  });

  test('handles partially resolved variables', () => {
    const original: Array<CSSVariable> = [
      {
        name: '--color',
        value: 'rgb(var(--r), var(--g), var(--b))',
        source: 'theme',
      },
    ];

    const resolved: Array<CSSVariable> = [
      {
        name: '--color',
        value: 'rgb(255, 128, var(--b))', // Partially resolved
        source: 'theme',
      },
    ];

    const unresolved = detectUnresolvedVariables(original, resolved);

    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toMatchObject({
      variableName: '--color',
      referencedVariable: '--b',
    });
  });
});

describe('groupByLikelyCause', () => {
  test('groups unresolved variables by likely cause', () => {
    const unresolved = [
      {
        variableName: '--font-sans',
        originalValue: 'var(--font-inter)',
        referencedVariable: '--font-inter',
        source: 'theme' as const,
        likelyCause: 'unknown' as const,
      },
      {
        variableName: '--color',
        originalValue: 'var(--tw-color-blue)',
        referencedVariable: '--tw-color-blue',
        source: 'theme' as const,
        likelyCause: 'external' as const,
      },
      {
        variableName: '--spacing',
        originalValue: 'var(--spacing)',
        referencedVariable: '--spacing',
        source: 'theme' as const,
        likelyCause: 'self-referential' as const,
      },
      {
        variableName: '--font-mono',
        originalValue: 'var(--font-jetbrains)',
        referencedVariable: '--font-jetbrains',
        source: 'theme' as const,
        likelyCause: 'unknown' as const,
      },
    ];

    const grouped = groupByLikelyCause(unresolved);

    expect(grouped.size).toBe(EXPECTED_THREE_GROUPS);
    expect(grouped.get('unknown')).toHaveLength(EXPECTED_MULTIPLE_REFS);
    expect(grouped.get('external')).toHaveLength(1);
    expect(grouped.get('self-referential')).toHaveLength(1);
  });

  test('handles empty array', () => {
    const grouped = groupByLikelyCause([]);
    expect(grouped.size).toBe(0);
  });
});

describe('groupBySource', () => {
  test('groups unresolved variables by source', () => {
    const unresolved = [
      {
        variableName: '--font-sans',
        originalValue: 'var(--font-inter)',
        referencedVariable: '--font-inter',
        source: 'theme' as const,
        likelyCause: 'unknown' as const,
      },
      {
        variableName: '--color',
        originalValue: 'var(--custom-color)',
        referencedVariable: '--custom-color',
        source: 'root' as const,
        likelyCause: 'unknown' as const,
      },
      {
        variableName: '--spacing',
        originalValue: 'var(--custom-spacing)',
        referencedVariable: '--custom-spacing',
        source: 'variant' as const,
        variantName: 'compact',
        likelyCause: 'unknown' as const,
      },
      {
        variableName: '--font-mono',
        originalValue: 'var(--font-jetbrains)',
        referencedVariable: '--font-jetbrains',
        source: 'theme' as const,
        likelyCause: 'unknown' as const,
      },
    ];

    const grouped = groupBySource(unresolved);

    expect(grouped.size).toBe(EXPECTED_THREE_GROUPS);
    expect(grouped.get('theme')).toHaveLength(EXPECTED_MULTIPLE_REFS);
    expect(grouped.get('root')).toHaveLength(1);
    expect(grouped.get('variant')).toHaveLength(1);
  });

  test('handles empty array', () => {
    const grouped = groupBySource([]);
    expect(grouped.size).toBe(0);
  });
});
