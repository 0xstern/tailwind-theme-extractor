/**
 * CSS Rule Extractor tests
 * Tests for extracting and classifying CSS rules from variant selectors
 */

import { describe, expect, test } from 'bun:test';
import postcss from 'postcss';

import {
  extractCSSRules,
  filterResolvableRules,
  groupRulesByVariant,
  mapPropertyToTheme,
} from '../../src/v4/parser/css-rule-extractor';

const SIMPLE_RULE_COUNT = 1;
const COMPLEX_RULE_COUNT = 1;
const MAX_SIMPLE_DECLARATIONS = 3;
const THREE_RULES = 3;
const TWO_RULES = 2;
const TWO_SIMPLE_RULES = 2;
const TWO_VARIANTS = 2;

describe('CSS Rule Extraction - Simple Rules', () => {
  test('extracts simple static value rule', () => {
    const css = `
      .theme-test {
        .rounded-lg {
          border-radius: 0;
        }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules).toHaveLength(SIMPLE_RULE_COUNT);
    expect(rules[0]).toMatchObject({
      selector: '.rounded-lg',
      property: 'border-radius',
      value: '0',
      variantName: 'theme-test',
      complexity: 'simple',
    });
  });

  test('classifies static values as simple', () => {
    const css = `
      .theme-test {
        .shadow-lg { box-shadow: none; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules[0].complexity).toBe('simple');
    expect(rules[0].reason).toBeUndefined();
  });

  test('extracts multiple simple rules', () => {
    const css = `
      .theme-mono {
        .rounded-lg { border-radius: 0; }
        .rounded-xl { border-radius: 0; }
        .shadow-lg { box-shadow: none; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-mono');

    expect(rules).toHaveLength(THREE_RULES);
    expect(rules.every((r) => r.complexity === 'simple')).toBe(true);
  });
});

describe('CSS Rule Extraction - Complex Rules', () => {
  test('classifies pseudo-class selectors as complex', () => {
    const css = `
      .theme-test {
        .rounded-lg:hover { border-radius: 0; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules[0].complexity).toBe('complex');
    expect(rules[0].reason).toBe('Pseudo-class selectors');
  });

  test('classifies pseudo-element selectors as complex', () => {
    const css = `
      .theme-test {
        .rounded-lg::before { border-radius: 0; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules[0].complexity).toBe('complex');
    expect(rules[0].reason).toBe('Pseudo-element selectors');
  });

  test('classifies dynamic values (calc) as complex', () => {
    const css = `
      .theme-test {
        .rounded-lg { border-radius: calc(1rem + 2px); }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules[0].complexity).toBe('complex');
    expect(rules[0].reason).toBe('Dynamic CSS function values');
  });

  test('classifies var() references as complex', () => {
    const css = `
      .theme-test {
        .rounded-lg { border-radius: var(--radius-base); }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules[0].complexity).toBe('complex');
    expect(rules[0].reason).toBe('Dynamic CSS function values');
  });

  test('classifies multiple declarations (>3) as complex', () => {
    const css = `
      .theme-test {
        .test {
          border-radius: 0;
          box-shadow: none;
          padding: 0;
          margin: 0;
        }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    const complexRules = rules.filter((r) => r.complexity === 'complex');
    expect(complexRules.length).toBeGreaterThan(0);
    expect(complexRules[0].reason).toBe(
      `Multiple property declarations (>${MAX_SIMPLE_DECLARATIONS})`,
    );
  });

  test('classifies descendant selectors as complex', () => {
    const css = `
      .theme-test {
        .parent .child { border-radius: 0; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules[0].complexity).toBe('complex');
    expect(rules[0].reason).toBe('Descendant selector');
  });

  test('classifies child combinator as complex', () => {
    const css = `
      .theme-test {
        .parent > .child { border-radius: 0; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules[0].complexity).toBe('complex');
    expect(rules[0].reason).toBe('Child combinator');
  });

  test('classifies sibling combinator as complex', () => {
    const css = `
      .theme-test {
        .a + .b { border-radius: 0; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules[0].complexity).toBe('complex');
    expect(rules[0].reason).toBe('Sibling combinator');
  });
});

describe('CSS Rule Extraction - Media Queries', () => {
  test('classifies media query nesting as complex', () => {
    const css = `
      .theme-test {
        @media (min-width: 1024px) {
          .rounded-lg { border-radius: 0; }
        }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules[0].complexity).toBe('complex');
    expect(rules[0].reason).toBe('Nested in media query');
    expect(rules[0].inMediaQuery).toBe(true);
    expect(rules[0].mediaQuery).toBe('(min-width: 1024px)');
  });

  test('extracts multiple rules from media query', () => {
    const css = `
      .theme-test {
        @media (min-width: 1024px) {
          .rounded-lg { border-radius: 0; }
          .shadow-lg { box-shadow: none; }
        }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules).toHaveLength(TWO_RULES);
    expect(rules.every((r) => r.inMediaQuery === true)).toBe(true);
    expect(rules.every((r) => r.complexity === 'complex')).toBe(true);
  });
});

describe('Property Mapping', () => {
  test('maps border-radius to radius namespace', () => {
    const mapping = mapPropertyToTheme('border-radius');
    expect(mapping).toBeDefined();
    expect(mapping?.themeProperty).toBe('radius');
  });

  test('maps box-shadow to shadows namespace', () => {
    const mapping = mapPropertyToTheme('box-shadow');
    expect(mapping).toBeDefined();
    expect(mapping?.themeProperty).toBe('shadows');
  });

  test('maps text-shadow to textShadows namespace', () => {
    const mapping = mapPropertyToTheme('text-shadow');
    expect(mapping).toBeDefined();
    expect(mapping?.themeProperty).toBe('textShadows');
  });

  test('maps filter to blur namespace', () => {
    const mapping = mapPropertyToTheme('filter');
    expect(mapping).toBeDefined();
    expect(mapping?.themeProperty).toBe('blur');
  });

  test('maps padding to spacing namespace', () => {
    const mapping = mapPropertyToTheme('padding');
    expect(mapping).toBeDefined();
    expect(mapping?.themeProperty).toBe('spacing');
  });

  test('returns null for unmapped properties', () => {
    const mapping = mapPropertyToTheme('color');
    expect(mapping).toBeNull();
  });
});

describe('Theme Key Extraction', () => {
  test('extracts theme key from .rounded-lg selector', () => {
    const css = `
      .theme-test {
        .rounded-lg { border-radius: 0; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    const mapping = mapPropertyToTheme('border-radius');
    const themeKey = mapping?.keyExtractor(rules[0].selector);
    expect(themeKey).toBe('lg');
  });

  test('extracts theme key from .shadow-xl selector', () => {
    const css = `
      .theme-test {
        .shadow-xl { box-shadow: none; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    const mapping = mapPropertyToTheme('box-shadow');
    const themeKey = mapping?.keyExtractor(rules[0].selector);
    expect(themeKey).toBe('xl');
  });

  test('returns null for non-matching selectors', () => {
    const mapping = mapPropertyToTheme('border-radius');
    const themeKey = mapping?.keyExtractor('.custom-class');
    expect(themeKey).toBeNull();
  });
});

describe('CSS Variable Skipping', () => {
  test('skips CSS variables (handled by variable-extractor)', () => {
    const css = `
      .theme-test {
        --radius-lg: 0.5rem;
        .rounded-lg { border-radius: 0; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    // Should only extract the .rounded-lg rule, not --radius-lg
    expect(rules).toHaveLength(SIMPLE_RULE_COUNT);
    expect(rules[0].selector).toBe('.rounded-lg');
  });

  test('only extracts rules with theme property mapping', () => {
    const css = `
      .theme-test {
        .custom { color: red; }
        .rounded-lg { border-radius: 0; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    // color is not mapped, so only border-radius rule extracted
    expect(rules).toHaveLength(SIMPLE_RULE_COUNT);
    expect(rules[0].property).toBe('border-radius');
  });
});

describe('Helper Functions', () => {
  test('filterResolvableRules returns only simple rules', () => {
    const css = `
      .theme-test {
        .rounded-lg { border-radius: 0; }
        .rounded-lg:hover { border-radius: 0.5rem; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const allRules = extractCSSRules(rule, 'theme-test');
    const resolvable = filterResolvableRules(allRules);

    expect(allRules).toHaveLength(TWO_RULES);
    expect(resolvable).toHaveLength(SIMPLE_RULE_COUNT);
    expect(resolvable[0].selector).toBe('.rounded-lg');
  });

  test('groupRulesByVariant groups correctly', () => {
    const css1 = `
      .theme-a {
        .rounded-lg { border-radius: 0; }
      }
    `;
    const css2 = `
      .theme-b {
        .shadow-lg { box-shadow: none; }
      }
    `;

    const root1 = postcss.parse(css1);
    const root2 = postcss.parse(css2);
    const rules1 = extractCSSRules(root1.first as postcss.Rule, 'theme-a');
    const rules2 = extractCSSRules(root2.first as postcss.Rule, 'theme-b');

    const grouped = groupRulesByVariant([...rules1, ...rules2]);

    expect(grouped.size).toBe(TWO_VARIANTS);
    expect(grouped.get('theme-a')).toHaveLength(SIMPLE_RULE_COUNT);
    expect(grouped.get('theme-b')).toHaveLength(SIMPLE_RULE_COUNT);
  });
});

describe('Edge Cases', () => {
  test('handles empty variant selector', () => {
    const css = `
      .theme-test {
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules).toHaveLength(0);
  });

  test('handles variant with only CSS variables', () => {
    const css = `
      .theme-test {
        --radius-lg: 0.5rem;
        --shadow-lg: none;
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules).toHaveLength(0);
  });

  test('stores original selector for context', () => {
    const css = `
      .theme-test .container {
        .rounded-lg { border-radius: 0; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    expect(rules[0].originalSelector).toBe('.theme-test .container');
  });

  test('handles mixed simple and complex rules', () => {
    const css = `
      .theme-test {
        .rounded-lg { border-radius: 0; }
        .rounded-lg:hover { border-radius: 0.5rem; }
        .shadow-lg { box-shadow: none; }
      }
    `;

    const root = postcss.parse(css);
    const rule = root.first as postcss.Rule;
    const rules = extractCSSRules(rule, 'theme-test');

    const simple = rules.filter((r) => r.complexity === 'simple');
    const complex = rules.filter((r) => r.complexity === 'complex');

    expect(simple.length).toBe(TWO_SIMPLE_RULES);
    expect(complex.length).toBe(COMPLEX_RULE_COUNT);
  });
});
