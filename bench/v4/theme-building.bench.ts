/**
 * Benchmarks for theme building performance
 * Tests the optimizations in theme-builder.ts including variant resolution map caching
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import type { CSSVariable } from '../../src/v4/types';

import { bench, group, run } from 'mitata';

import { buildThemes } from '../../src/v4/parser/theme-builder';

// Helper to create realistic CSS variables
function createColorScale(
  name: string,
  source: 'theme' | 'root' | 'variant' = 'theme',
): Array<CSSVariable> {
  const stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  return stops.map((stop) => ({
    name: `--color-${name}-${stop}`,
    value: `oklch(${50 + stop / 20} 0.1 ${stop})`,
    source,
  }));
}

function createFontSizes(
  source: 'theme' | 'root' | 'variant' = 'theme',
): Array<CSSVariable> {
  const sizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
  return sizes.flatMap((size) => [
    {
      name: `--text-${size}`,
      value: `${0.75 + sizes.indexOf(size) * 0.125}rem`,
      source,
    },
    {
      name: `--text-${size}--line-height`,
      value: '1.5',
      source,
    },
  ]);
}

function createSpacing(
  source: 'theme' | 'root' | 'variant' = 'theme',
): Array<CSSVariable> {
  const values = [0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96];
  return values.map((val) => ({
    name: `--spacing-${val}`,
    value: `${val * 0.25}rem`,
    source,
  }));
}

function createVariantVariables(
  variantName: string,
  selector: string,
  count: number,
): Array<CSSVariable> {
  const variables: Array<CSSVariable> = [];
  for (let i = 0; i < count; i++) {
    variables.push({
      name: `--color-primary-${i}`,
      value: `oklch(0.5 0.1 ${i * 10})`,
      source: 'variant',
      variantName,
      selector,
    });
  }
  return variables;
}

// Benchmark theme building with different scales
group('buildThemes - scale', () => {
  bench('minimal theme (10 variables)', () => {
    const variables: Array<CSSVariable> = [
      { name: '--color-primary', value: 'blue', source: 'theme' },
      { name: '--color-secondary', value: 'green', source: 'theme' },
      { name: '--spacing-4', value: '1rem', source: 'theme' },
      { name: '--spacing-8', value: '2rem', source: 'theme' },
      { name: '--text-base', value: '1rem', source: 'theme' },
      { name: '--text-lg', value: '1.125rem', source: 'theme' },
      { name: '--radius-sm', value: '0.25rem', source: 'theme' },
      { name: '--radius-md', value: '0.5rem', source: 'theme' },
      {
        name: '--shadow-sm',
        value: '0 1px 2px rgba(0,0,0,0.05)',
        source: 'theme',
      },
      {
        name: '--shadow-md',
        value: '0 4px 6px rgba(0,0,0,0.1)',
        source: 'theme',
      },
    ];

    buildThemes(variables, new Map(), []);
  });

  bench('medium theme (100 variables)', () => {
    const variables: Array<CSSVariable> = [
      ...createColorScale('red'),
      ...createColorScale('blue'),
      ...createColorScale('green'),
      ...createColorScale('gray'),
      ...createFontSizes(),
      ...createSpacing(),
    ];

    buildThemes(variables, new Map(), []);
  });

  bench('large theme (300+ variables, Tailwind defaults)', () => {
    const colorScales = [
      'red',
      'orange',
      'amber',
      'yellow',
      'lime',
      'green',
      'emerald',
      'teal',
      'cyan',
      'sky',
      'blue',
      'indigo',
      'violet',
      'purple',
      'fuchsia',
      'pink',
      'rose',
      'slate',
      'gray',
      'zinc',
      'neutral',
      'stone',
    ];

    const variables: Array<CSSVariable> = [
      ...colorScales.flatMap((name) => createColorScale(name)),
      ...createFontSizes(),
      ...createSpacing(),
    ];

    buildThemes(variables, new Map(), []);
  });
});

// Benchmark with variants (tests caching effectiveness)
group('buildThemes - variants', () => {
  bench('single variant (dark mode)', () => {
    const variables: Array<CSSVariable> = [
      ...createColorScale('red'),
      ...createColorScale('blue'),
      ...createFontSizes(),
      {
        name: '--color-background',
        value: '#000',
        source: 'variant',
        variantName: 'dark',
        selector: '.dark',
      },
      {
        name: '--color-foreground',
        value: '#fff',
        source: 'variant',
        variantName: 'dark',
        selector: '.dark',
      },
    ];

    buildThemes(variables, new Map(), []);
  });

  bench('5 variants (typical shadcn setup)', () => {
    const base = [
      ...createColorScale('red'),
      ...createColorScale('blue'),
      ...createFontSizes(),
      ...createSpacing(),
    ];

    const variants = [
      ...createVariantVariables('dark', '.dark', 10),
      ...createVariantVariables('theme-mono', '[data-theme="mono"]', 10),
      ...createVariantVariables(
        'theme-rounded-none',
        '[data-theme="rounded-none"]',
        5,
      ),
      ...createVariantVariables(
        'theme-radius-sm',
        '[data-theme="radius-sm"]',
        5,
      ),
      ...createVariantVariables(
        'theme-radius-lg',
        '[data-theme="radius-lg"]',
        5,
      ),
    ];

    buildThemes([...base, ...variants], new Map(), []);
  });

  bench('15 variants (complex multi-theme)', () => {
    const base = [
      ...createColorScale('red'),
      ...createColorScale('blue'),
      ...createColorScale('green'),
      ...createFontSizes(),
      ...createSpacing(),
    ];

    const variants = [
      'dark',
      'theme-mono',
      'theme-mono.dark',
      'theme-rounded-none',
      'theme-rounded-none.dark',
      'theme-radius-xs',
      'theme-radius-sm',
      'theme-radius-md',
      'theme-radius-lg',
      'theme-radius-xl',
      'theme-font-normal',
      'theme-font-compact',
      'theme-font-comfortable',
      'compact.dark',
      'comfortable.dark',
    ].flatMap((name) =>
      createVariantVariables(name, `[data-theme="${name}"]`, 8),
    );

    buildThemes([...base, ...variants], new Map(), []);
  });
});

// Benchmark var() resolution
group('buildThemes - var() resolution', () => {
  bench('simple var() references', () => {
    const variables: Array<CSSVariable> = [
      { name: '--primary', value: '#3b82f6', source: 'root' },
      { name: '--color-primary', value: 'var(--primary)', source: 'theme' },
      { name: '--color-secondary', value: 'var(--primary)', source: 'theme' },
    ];

    buildThemes(variables, new Map(), []);
  });

  bench('nested var() references (2 levels)', () => {
    const variables: Array<CSSVariable> = [
      { name: '--base', value: '#3b82f6', source: 'root' },
      { name: '--primary', value: 'var(--base)', source: 'root' },
      { name: '--color-primary', value: 'var(--primary)', source: 'theme' },
      { name: '--color-secondary', value: 'var(--primary)', source: 'theme' },
    ];

    buildThemes(variables, new Map(), []);
  });

  bench('nested var() references (3 levels)', () => {
    const variables: Array<CSSVariable> = [
      { name: '--base', value: '#3b82f6', source: 'root' },
      { name: '--level1', value: 'var(--base)', source: 'root' },
      { name: '--level2', value: 'var(--level1)', source: 'root' },
      { name: '--color-primary', value: 'var(--level2)', source: 'theme' },
    ];

    buildThemes(variables, new Map(), []);
  });

  bench('var() in CSS functions', () => {
    const variables: Array<CSSVariable> = [
      { name: '--radius', value: '0.5rem', source: 'root' },
      { name: '--spacing', value: '1rem', source: 'root' },
      {
        name: '--radius-lg',
        value: 'calc(var(--radius) + 4px)',
        source: 'theme',
      },
      {
        name: '--spacing-lg',
        value: 'calc(var(--spacing) * 2)',
        source: 'theme',
      },
      {
        name: '--complex',
        value: 'min(var(--radius), var(--spacing))',
        source: 'theme',
      },
    ];

    buildThemes(variables, new Map(), []);
  });

  bench('50 var() references (cache effectiveness)', () => {
    const baseVars: Array<CSSVariable> = [];
    const derivedVars: Array<CSSVariable> = [];

    for (let i = 0; i < 50; i++) {
      baseVars.push({
        name: `--base-${i}`,
        value: `#${i.toString(16).padStart(6, '0')}`,
        source: 'root',
      });
      derivedVars.push({
        name: `--color-${i}`,
        value: `var(--base-${i})`,
        source: 'theme',
      });
    }

    buildThemes([...baseVars, ...derivedVars], new Map(), []);
  });
});

// Benchmark realistic shadcn-like workload
group('realistic workload', () => {
  bench('shadcn UI theme (300+ variables, 5 variants)', () => {
    // Base Tailwind defaults
    const colorScales = [
      'red',
      'blue',
      'green',
      'yellow',
      'purple',
      'pink',
      'gray',
    ];
    const base: Array<CSSVariable> = [
      ...colorScales.flatMap((name) => createColorScale(name)),
      ...createFontSizes(),
      ...createSpacing(),
    ];

    // Semantic tokens with var() references
    const semanticTokens: Array<CSSVariable> = [
      { name: '--background', value: '#ffffff', source: 'root' },
      { name: '--foreground', value: '#000000', source: 'root' },
      { name: '--primary', value: 'var(--color-blue-500)', source: 'root' },
      {
        name: '--color-background',
        value: 'var(--background)',
        source: 'theme',
      },
      {
        name: '--color-foreground',
        value: 'var(--foreground)',
        source: 'theme',
      },
    ];

    // Variants
    const darkMode: Array<CSSVariable> = [
      {
        name: '--background',
        value: '#000000',
        source: 'variant',
        variantName: 'dark',
        selector: '.dark',
      },
      {
        name: '--foreground',
        value: '#ffffff',
        source: 'variant',
        variantName: 'dark',
        selector: '.dark',
      },
    ];

    const themeVariants: Array<CSSVariable> = [
      'theme-mono',
      'theme-rounded-none',
      'theme-radius-lg',
      'compact',
    ].flatMap((name) =>
      createVariantVariables(name, `[data-theme="${name}"]`, 5),
    );

    buildThemes(
      [...base, ...semanticTokens, ...darkMode, ...themeVariants],
      new Map(),
      [],
    );
  });
});

await run();
