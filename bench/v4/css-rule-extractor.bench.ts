/**
 * Benchmarks for CSS rule extraction and complexity analysis
 * Tests extractCSSRules and classification performance
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import { bench, group, run } from 'mitata';
import postcss from 'postcss';

import {
  extractCSSRules,
  filterResolvableRules,
  groupRulesByVariant,
  mapPropertyToTheme,
} from '../../src/v4/parser/css-rule-extractor';

// Helper to create a variant rule with nested CSS rules
function createVariantRule(cssContent: string): postcss.Rule {
  const root = postcss.parse(cssContent);
  return root.first as postcss.Rule;
}

// Benchmark extractCSSRules with different scales
group('extractCSSRules - scale', () => {
  bench('single simple rule', () => {
    const rule = createVariantRule(`
      .theme-mono {
        .rounded-lg { border-radius: 0; }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });

  bench('multiple simple rules (5)', () => {
    const rule = createVariantRule(`
      .theme-mono {
        .rounded-lg { border-radius: 0; }
        .rounded-xl { border-radius: 4px; }
        .shadow-sm { box-shadow: none; }
        .shadow-lg { box-shadow: 0 10px 15px rgba(0,0,0,0.1); }
        .blur-sm { filter: blur(4px); }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });

  bench('complex rules with pseudo-classes', () => {
    const rule = createVariantRule(`
      .theme-mono {
        .rounded-lg:hover { border-radius: 0; }
        .shadow-sm:focus { box-shadow: none; }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });

  bench('rules with dynamic values', () => {
    const rule = createVariantRule(`
      .theme-mono {
        .rounded-lg { border-radius: calc(var(--radius) * 2); }
        .shadow-sm { box-shadow: var(--shadow-sm); }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });

  bench('rules in media queries', () => {
    const rule = createVariantRule(`
      .theme-mono {
        @media (min-width: 768px) {
          .rounded-lg { border-radius: 0; }
          .shadow-sm { box-shadow: none; }
        }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });

  bench('mixed complexity (10 rules)', () => {
    const rule = createVariantRule(`
      .theme-mono {
        .rounded-lg { border-radius: 0; }
        .rounded-xl:hover { border-radius: 4px; }
        .shadow-sm { box-shadow: none; }
        .shadow-lg { box-shadow: var(--shadow-lg); }
        .blur-sm { filter: blur(4px); }
        @media (min-width: 768px) {
          .rounded-md { border-radius: 2px; }
          .shadow-md { box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        }
        .text-shadow-sm { text-shadow: none; }
        .blur-lg::before { filter: blur(16px); }
        .rounded-full { border-radius: 9999px; }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });
});

// Benchmark complexity classification patterns
group('complexity classification', () => {
  bench('simple static value', () => {
    const rule = createVariantRule(`
      .theme-mono {
        .rounded-lg { border-radius: 0; }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });

  bench('pseudo-class selector', () => {
    const rule = createVariantRule(`
      .theme-mono {
        .rounded-lg:hover { border-radius: 0; }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });

  bench('pseudo-element selector', () => {
    const rule = createVariantRule(`
      .theme-mono {
        .rounded-lg::before { border-radius: 0; }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });

  bench('dynamic CSS function', () => {
    const rule = createVariantRule(`
      .theme-mono {
        .rounded-lg { border-radius: calc(1rem * 2); }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });

  bench('descendant selector', () => {
    const rule = createVariantRule(`
      .theme-mono {
        .container .rounded-lg { border-radius: 0; }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });

  bench('multiple declarations (>3)', () => {
    const rule = createVariantRule(`
      .theme-mono {
        .rounded-lg {
          border-radius: 0;
          padding: 1rem;
          gap: 0.5rem;
          box-shadow: none;
        }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });
});

// Benchmark helper functions
group('helper functions', () => {
  bench('mapPropertyToTheme - mapped property', () => {
    mapPropertyToTheme('border-radius');
  });

  bench('mapPropertyToTheme - unmapped property', () => {
    mapPropertyToTheme('color');
  });

  bench('mapPropertyToTheme - batch 20 properties', () => {
    const properties = [
      'border-radius',
      'box-shadow',
      'text-shadow',
      'filter',
      'padding',
      'color',
      'background',
      'margin',
      'border-radius',
      'box-shadow',
      'text-shadow',
      'filter',
      'padding',
      'gap',
      'padding-block',
      'padding-inline',
      'color',
      'background',
      'margin',
      'display',
    ];
    for (const prop of properties) {
      mapPropertyToTheme(prop);
    }
  });

  const sampleRules = Array.from({ length: 50 }, (_, i) => ({
    selector: `.rounded-${i}`,
    property: 'border-radius',
    value: `${i}px`,
    variantName:
      i % 3 === 0 ? 'themeMono' : i % 3 === 1 ? 'themeDark' : 'themeLight',
    originalSelector: '.theme',
    complexity: 'simple' as const,
  }));

  bench('filterResolvableRules - 50 mixed rules', () => {
    const mixedRules = sampleRules.map((rule, i) => ({
      ...rule,
      complexity: (i % 2 === 0 ? 'simple' : 'complex') as 'simple' | 'complex',
    }));
    filterResolvableRules(mixedRules);
  });

  bench('groupRulesByVariant - 50 rules across 3 variants', () => {
    groupRulesByVariant(sampleRules);
  });
});

// Benchmark realistic workload
group('realistic workload', () => {
  bench('shadcn theme with 15 rule overrides', () => {
    const rule = createVariantRule(`
      .theme-mono {
        .rounded-lg { border-radius: 0; }
        .rounded-md { border-radius: 0; }
        .rounded-sm { border-radius: 0; }
        .rounded-xl { border-radius: 0; }
        .rounded-2xl { border-radius: 0; }
        .shadow-sm { box-shadow: none; }
        .shadow-md { box-shadow: none; }
        .shadow-lg { box-shadow: none; }
        .blur-sm { filter: blur(0); }
        .blur-md { filter: blur(0); }
        @media (min-width: 768px) {
          .rounded-lg { border-radius: 2px; }
          .shadow-lg { box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        }
        .text-shadow-sm { text-shadow: none; }
        .rounded-full { border-radius: 0; }
        [data-slot='card'] { border-radius: 0; }
      }
    `);
    extractCSSRules(rule, 'themeMono');
  });

  bench('multi-variant extraction (3 variants)', () => {
    const variants = [
      {
        name: 'themeMono',
        css: `.theme-mono { .rounded-lg { border-radius: 0; } .shadow-sm { box-shadow: none; } }`,
      },
      {
        name: 'themeDark',
        css: `.theme-dark { .rounded-xl { border-radius: 4px; } .shadow-lg { box-shadow: var(--shadow); } }`,
      },
      {
        name: 'themeScaled',
        css: `.theme-scaled { .blur-sm { filter: blur(2px); } .rounded-md { border-radius: calc(var(--radius) * 0.5); } }`,
      },
    ];

    for (const variant of variants) {
      const rule = createVariantRule(variant.css);
      extractCSSRules(rule, variant.name);
    }
  });
});

await run();
