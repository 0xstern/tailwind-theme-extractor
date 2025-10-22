/**
 * Benchmarks for CSS rule conflict detection and resolution
 * Tests detectConflicts, applyOverride, and filtering performance
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable complexity */

import type { CSSRuleOverride } from '../../src/v4/core/extraction/rules';
import type { Theme } from '../../src/v4/types';

import { bench, group, run } from 'mitata';

import {
  applyOverride,
  detectConflicts,
  filterResolvableConflicts,
  groupConflictsByVariant,
} from '../../src/v4/core/analysis/conflicts';

// Helper to create sample CSS rule overrides
function createCSSRules(count: number): Array<CSSRuleOverride> {
  const rules: Array<CSSRuleOverride> = [];

  for (let i = 0; i < count; i++) {
    const complexity = i % 3 === 0 ? 'complex' : 'simple';
    const variantName = i % 2 === 0 ? 'themeMono' : 'themeDark';

    rules.push({
      selector: `.rounded-${i % 5 === 0 ? 'lg' : i % 5 === 1 ? 'md' : i % 5 === 2 ? 'sm' : i % 5 === 3 ? 'xl' : 'full'}`,
      property: 'border-radius',
      value: i % 2 === 0 ? '0' : `${i}px`,
      variantName,
      originalSelector:
        variantName === 'themeMono' ? '.theme-mono' : '.theme-dark',
      complexity: complexity as 'simple' | 'complex',
      reason: complexity === 'complex' ? 'Pseudo-class selectors' : undefined,
    });

    // Add shadow rules
    if (i % 3 === 0) {
      rules.push({
        selector: `.shadow-${i % 3 === 0 ? 'sm' : 'lg'}`,
        property: 'box-shadow',
        value: i % 2 === 0 ? 'none' : `0 ${i}px ${i * 2}px rgba(0,0,0,0.1)`,
        variantName,
        originalSelector:
          variantName === 'themeMono' ? '.theme-mono' : '.theme-dark',
        complexity: 'simple' as const,
      });
    }
  }

  return rules;
}

// Helper to create sample theme variants
function createVariants(): Record<string, { selector: string; theme: Theme }> {
  return {
    themeMono: {
      selector: '.theme-mono',
      theme: {
        colors: {},
        spacing: {},
        fontSize: {},
        fonts: {},
        fontWeight: {},
        tracking: {},
        leading: {},
        breakpoints: {},
        containers: {},
        radius: {
          sm: '0.125rem',
          md: '0.375rem',
          lg: '0.5rem',
          xl: '0.75rem',
          full: '9999px',
        },
        shadows: {
          sm: '0 1px 2px rgba(0,0,0,0.05)',
          lg: '0 10px 15px rgba(0,0,0,0.1)',
        },
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
      },
    },
    themeDark: {
      selector: '.theme-dark',
      theme: {
        colors: {},
        spacing: {},
        fontSize: {},
        fonts: {},
        fontWeight: {},
        tracking: {},
        leading: {},
        breakpoints: {},
        containers: {},
        radius: {
          sm: '0.25rem',
          md: '0.5rem',
          lg: '0.75rem',
          xl: '1rem',
          full: '9999px',
        },
        shadows: {
          sm: '0 2px 4px rgba(0,0,0,0.1)',
          lg: '0 20px 25px rgba(0,0,0,0.15)',
        },
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
      },
    },
  };
}

const variants = createVariants();

// Benchmark detectConflicts with different scales
group('detectConflicts - scale', () => {
  bench('5 CSS rules (typical variant)', () => {
    const rules = createCSSRules(5);
    detectConflicts(rules, variants);
  });

  bench('20 CSS rules (complex theme)', () => {
    const rules = createCSSRules(20);
    detectConflicts(rules, variants);
  });

  bench('50 CSS rules (large design system)', () => {
    const rules = createCSSRules(50);
    detectConflicts(rules, variants);
  });

  bench('100 CSS rules (very large)', () => {
    const rules = createCSSRules(100);
    detectConflicts(rules, variants);
  });
});

// Benchmark conflict detection with different complexity ratios
group('detectConflicts - complexity', () => {
  bench('all simple rules', () => {
    const rules = createCSSRules(20).map((rule) => ({
      ...rule,
      complexity: 'simple' as const,
      reason: undefined,
    }));
    detectConflicts(rules, variants);
  });

  bench('all complex rules', () => {
    const rules = createCSSRules(20).map((rule) => ({
      ...rule,
      complexity: 'complex' as const,
      reason: 'Pseudo-class selectors',
    }));
    detectConflicts(rules, variants);
  });

  bench('mixed complexity (50/50)', () => {
    const rules = createCSSRules(20);
    detectConflicts(rules, variants);
  });
});

// Benchmark helper functions
group('helper functions', () => {
  const rules = createCSSRules(50);
  const conflicts = detectConflicts(rules, variants);

  bench('filterResolvableConflicts - 50 conflicts', () => {
    filterResolvableConflicts(conflicts);
  });

  bench('groupConflictsByVariant - 50 conflicts across 2 variants', () => {
    groupConflictsByVariant(conflicts);
  });

  bench('applyOverride - single conflict', () => {
    const theme = { ...variants.themeMono!.theme };
    const resolvable = filterResolvableConflicts(conflicts);
    if (resolvable[0] !== undefined) {
      applyOverride(theme, resolvable[0]);
    }
  });

  bench('applyOverride - batch 10 conflicts', () => {
    const theme = { ...variants.themeMono!.theme };
    const resolvable = filterResolvableConflicts(conflicts).slice(0, 10);
    for (const conflict of resolvable) {
      applyOverride(theme, conflict);
    }
  });
});

// Benchmark realistic workloads
group('realistic workload', () => {
  bench('shadcn theme (15 rules, 2 variants)', () => {
    const rules: Array<CSSRuleOverride> = [
      {
        selector: '.rounded-lg',
        property: 'border-radius',
        value: '0',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
      {
        selector: '.rounded-md',
        property: 'border-radius',
        value: '0',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
      {
        selector: '.rounded-sm',
        property: 'border-radius',
        value: '0',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
      {
        selector: '.shadow-sm',
        property: 'box-shadow',
        value: 'none',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
      {
        selector: '.shadow-lg',
        property: 'box-shadow',
        value: 'none',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
      {
        selector: '.rounded-lg',
        property: 'border-radius',
        value: '4px',
        variantName: 'themeDark',
        originalSelector: '.theme-dark',
        complexity: 'simple',
      },
      {
        selector: '.rounded-xl',
        property: 'border-radius',
        value: '8px',
        variantName: 'themeDark',
        originalSelector: '.theme-dark',
        complexity: 'simple',
      },
      {
        selector: '.shadow-lg',
        property: 'box-shadow',
        value: '0 20px 30px rgba(0,0,0,0.2)',
        variantName: 'themeDark',
        originalSelector: '.theme-dark',
        complexity: 'simple',
      },
      {
        selector: '.rounded-lg:hover',
        property: 'border-radius',
        value: '2px',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'complex',
        reason: 'Pseudo-class selectors',
      },
      {
        selector: '.shadow-sm',
        property: 'box-shadow',
        value: 'var(--shadow-custom)',
        variantName: 'themeDark',
        originalSelector: '.theme-dark',
        complexity: 'complex',
        reason: 'Dynamic CSS function values',
      },
    ];

    const conflicts = detectConflicts(rules, variants);
    const resolvable = filterResolvableConflicts(conflicts);
    const theme = { ...variants.themeMono!.theme };
    for (const conflict of resolvable) {
      applyOverride(theme, conflict);
    }
  });

  bench('full pipeline: detect + filter + group + apply (50 rules)', () => {
    const rules = createCSSRules(50);
    const conflicts = detectConflicts(rules, variants);
    const resolvable = filterResolvableConflicts(conflicts);
    const grouped = groupConflictsByVariant(conflicts);
    const theme = { ...variants.themeMono!.theme };
    for (const conflict of resolvable) {
      applyOverride(theme, conflict);
    }
    return { conflicts, resolvable, grouped, theme };
  });
});

await run();
