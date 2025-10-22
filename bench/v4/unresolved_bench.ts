/**
 * Benchmarks for unresolved variable detection performance
 * Tests detection of var() references that couldn't be resolved
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import type { CSSVariable } from '../../src/v4/types';

import { bench, group, run } from 'mitata';

import {
  detectUnresolvedVariables,
  groupByLikelyCause,
  groupBySource,
} from '../../src/v4/core/analysis/unresolved';

// Generate realistic test data
function createOriginalVariables(count: number): Array<CSSVariable> {
  const variables: Array<CSSVariable> = [];

  for (let i = 0; i < count; i++) {
    // Mix of resolved and unresolved variables
    if (i % 3 === 0) {
      // Unresolved external reference
      variables.push({
        name: `--color-${i}`,
        value: `var(--tw-color-${i})`,
        source: 'theme',
      });
    } else if (i % 3 === 1) {
      // Unresolved unknown reference
      variables.push({
        name: `--spacing-${i}`,
        value: `var(--external-spacing-${i})`,
        source: 'root',
      });
    } else {
      // Already resolved
      variables.push({
        name: `--radius-${i}`,
        value: '4px',
        source: 'theme',
      });
    }
  }

  return variables;
}

function createResolvedVariables(count: number): Array<CSSVariable> {
  const variables: Array<CSSVariable> = [];

  for (let i = 0; i < count; i++) {
    if (i % 3 === 0) {
      // Still unresolved (external)
      variables.push({
        name: `--color-${i}`,
        value: `var(--tw-color-${i})`,
        source: 'theme',
      });
    } else if (i % 3 === 1) {
      // Still unresolved (unknown)
      variables.push({
        name: `--spacing-${i}`,
        value: `var(--external-spacing-${i})`,
        source: 'root',
      });
    } else {
      // Successfully resolved
      variables.push({
        name: `--radius-${i}`,
        value: '4px',
        source: 'theme',
      });
    }
  }

  return variables;
}

function createVariantVariables(count: number): Array<CSSVariable> {
  const variables: Array<CSSVariable> = [];

  for (let i = 0; i < count; i++) {
    variables.push({
      name: `--color-${i}`,
      value: `var(--theme-color-${i})`,
      source: 'variant',
      variantName: 'dark',
      selector: '[data-theme="dark"]',
    });
  }

  return variables;
}

// Benchmark detectUnresolvedVariables (main function)
group('detectUnresolvedVariables', () => {
  bench('small dataset (10 variables, 6 unresolved)', () => {
    const original = createOriginalVariables(10);
    const resolved = createResolvedVariables(10);
    detectUnresolvedVariables(original, resolved);
  });

  bench('medium dataset (50 variables, 33 unresolved)', () => {
    const original = createOriginalVariables(50);
    const resolved = createResolvedVariables(50);
    detectUnresolvedVariables(original, resolved);
  });

  bench('large dataset (200 variables, 133 unresolved)', () => {
    const original = createOriginalVariables(200);
    const resolved = createResolvedVariables(200);
    detectUnresolvedVariables(original, resolved);
  });

  bench('variant variables (50 unresolved)', () => {
    const original = createVariantVariables(50);
    const resolved = createVariantVariables(50);
    detectUnresolvedVariables(original, resolved);
  });

  bench('no unresolved variables (100 variables)', () => {
    const variables: Array<CSSVariable> = [];
    for (let i = 0; i < 100; i++) {
      variables.push({
        name: `--var-${i}`,
        value: '4px',
        source: 'theme',
      });
    }
    detectUnresolvedVariables(variables, variables);
  });

  bench('all unresolved variables (100 variables)', () => {
    const variables: Array<CSSVariable> = [];
    for (let i = 0; i < 100; i++) {
      variables.push({
        name: `--var-${i}`,
        value: `var(--external-${i})`,
        source: 'theme',
      });
    }
    detectUnresolvedVariables(variables, variables);
  });

  bench('self-referential variables (50 variables)', () => {
    const variables: Array<CSSVariable> = [];
    for (let i = 0; i < 50; i++) {
      variables.push({
        name: `--var-${i}`,
        value: `var(--var-${i}, fallback)`,
        source: 'theme',
      });
    }
    detectUnresolvedVariables(variables, variables);
  });
});

// Benchmark grouping functions
group('groupByLikelyCause', () => {
  bench('group 50 unresolved variables', () => {
    const original = createOriginalVariables(75);
    const resolved = createResolvedVariables(75);
    const unresolved = detectUnresolvedVariables(original, resolved);
    groupByLikelyCause(unresolved);
  });

  bench('group 200 unresolved variables', () => {
    const original = createOriginalVariables(300);
    const resolved = createResolvedVariables(300);
    const unresolved = detectUnresolvedVariables(original, resolved);
    groupByLikelyCause(unresolved);
  });
});

group('groupBySource', () => {
  bench('group 50 unresolved variables', () => {
    const original = createOriginalVariables(75);
    const resolved = createResolvedVariables(75);
    const unresolved = detectUnresolvedVariables(original, resolved);
    groupBySource(unresolved);
  });

  bench('group 200 unresolved variables', () => {
    const original = createOriginalVariables(300);
    const resolved = createResolvedVariables(300);
    const unresolved = detectUnresolvedVariables(original, resolved);
    groupBySource(unresolved);
  });
});

// Realistic workload simulation
group('realistic workload', () => {
  bench('process shadcn theme (100 variables, 20 unresolved)', () => {
    const original: Array<CSSVariable> = [
      // Resolved theme colors
      { name: '--color-background', value: '0 0% 100%', source: 'theme' },
      { name: '--color-foreground', value: '240 10% 3.9%', source: 'theme' },
      { name: '--color-primary', value: '240 5.9% 10%', source: 'theme' },
      // Unresolved Tailwind internals
      { name: '--color-ring', value: 'var(--tw-ring-color)', source: 'theme' },
      {
        name: '--color-shadow',
        value: 'var(--tw-shadow-color)',
        source: 'theme',
      },
      // Resolved spacing
      { name: '--spacing-4', value: '1rem', source: 'root' },
      { name: '--spacing-8', value: '2rem', source: 'root' },
      // Unresolved plugin variable
      {
        name: '--spacing-safe',
        value: 'var(--safe-area-inset-top)',
        source: 'root',
      },
    ];

    // Duplicate to create 100 variables
    const fullOriginal: Array<CSSVariable> = [];
    const fullResolved: Array<CSSVariable> = [];

    for (let i = 0; i < 13; i++) {
      for (const v of original) {
        const suffix = i === 0 ? '' : `-${i}`;
        fullOriginal.push({
          ...v,
          name: `${v.name}${suffix}`,
        });

        // Resolved versions keep unresolved var() references
        fullResolved.push({
          ...v,
          name: `${v.name}${suffix}`,
        });
      }
    }

    detectUnresolvedVariables(fullOriginal, fullResolved);
  });

  bench('process variant theme (dark mode with 50 variables)', () => {
    const variables: Array<CSSVariable> = [];

    // Theme colors that reference plugin variables
    for (let i = 0; i < 50; i++) {
      variables.push({
        name: `--color-${i}`,
        value: `var(--tw-dark-color-${i})`,
        source: 'variant',
        variantName: 'dark',
        selector: '[data-theme="dark"]',
      });
    }

    detectUnresolvedVariables(variables, variables);
  });

  bench('full pipeline: detect + group by cause + group by source', () => {
    const original = createOriginalVariables(100);
    const resolved = createResolvedVariables(100);

    const unresolved = detectUnresolvedVariables(original, resolved);
    groupByLikelyCause(unresolved);
    groupBySource(unresolved);
  });
});

await run();
