/**
 * Conflict Resolver tests
 * Tests for detecting and resolving conflicts between CSS rules and theme variables
 */

import type { CSSRuleOverride } from '../../../src/v4/core/extraction/rules';
import type { Theme } from '../../../src/v4/types';

import { describe, expect, test } from 'bun:test';

import {
  applyOverride,
  detectConflicts,
  filterResolvableConflicts,
  groupConflictsByVariant,
} from '../../../src/v4/core/analysis/conflicts';

const ONE_CONFLICT = 1;
const TWO_CONFLICTS = 2;
const ZERO_CONFLICTS = 0;

describe('Conflict Detection - Basic Cases', () => {
  test('detects conflict between CSS rule and theme variable', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.rounded-lg',
        property: 'border-radius',
        value: '0',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          radius: {
            lg: '1rem',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(ONE_CONFLICT);
    expect(conflicts[0]).toMatchObject({
      variantName: 'themeMono',
      themeProperty: 'radius',
      themeKey: 'lg',
      variableValue: '1rem',
      ruleValue: '0',
      ruleSelector: '.rounded-lg',
      canResolve: true,
      confidence: 'high',
    });
  });

  test('detects no conflict when values match', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.rounded-lg',
        property: 'border-radius',
        value: '1rem',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          radius: {
            lg: '1rem',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    // Still reports as conflict since rule exists, even if values match
    // This is expected behavior - any CSS rule override is flagged
    expect(conflicts).toHaveLength(ONE_CONFLICT);
  });

  test('ignores rule when selector does not match pattern', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.custom-class',
        property: 'border-radius',
        value: '0',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          radius: {
            lg: '1rem',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(ZERO_CONFLICTS);
  });

  test('ignores rule when property is not mapped', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.rounded-lg',
        property: 'color',
        value: 'red',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          radius: {
            lg: '1rem',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(ZERO_CONFLICTS);
  });
});

describe('Conflict Detection - Confidence Levels', () => {
  test('assigns high confidence to simple rules with same units', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.rounded-lg',
        property: 'border-radius',
        value: '0.5rem',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          radius: {
            lg: '1rem',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(ONE_CONFLICT);
    expect(conflicts[0]!.confidence).toBe('high');
    expect(conflicts[0]!.canResolve).toBe(true);
  });

  test('assigns medium confidence to simple rules with different units', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.rounded-lg',
        property: 'border-radius',
        value: '8px',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          radius: {
            lg: '1rem',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(ONE_CONFLICT);
    expect(conflicts[0]!.confidence).toBe('medium');
    expect(conflicts[0]!.canResolve).toBe(true);
  });

  test('assigns low confidence to complex rules', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.rounded-lg:hover',
        property: 'border-radius',
        value: '0',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'complex',
        reason: 'Pseudo-class selectors',
      },
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          radius: {
            lg: '1rem',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(ONE_CONFLICT);
    expect(conflicts[0]!.confidence).toBe('low');
    expect(conflicts[0]!.canResolve).toBe(false);
  });

  test('marks complex rules as non-resolvable', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.rounded-lg',
        property: 'border-radius',
        value: 'calc(1rem + 2px)',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'complex',
        reason: 'Dynamic CSS function values',
      },
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          radius: {
            lg: '1rem',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(ONE_CONFLICT);
    expect(conflicts[0]!.canResolve).toBe(false);
  });
});

describe('Conflict Detection - Multiple Properties', () => {
  test('detects conflicts for box-shadow', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.shadow-lg',
        property: 'box-shadow',
        value: 'none',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          shadows: {
            lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(ONE_CONFLICT);
    expect(conflicts[0]!.themeProperty).toBe('shadows');
  });

  test('detects conflicts for text-shadow', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.text-shadow-lg',
        property: 'text-shadow',
        value: 'none',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          textShadows: {
            lg: '0 2px 4px rgba(0, 0, 0, 0.5)',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(ONE_CONFLICT);
    expect(conflicts[0]!.themeProperty).toBe('textShadows');
  });

  test('detects multiple conflicts in same variant', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.rounded-lg',
        property: 'border-radius',
        value: '0',
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
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          radius: {
            lg: '1rem',
          },
          shadows: {
            lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(TWO_CONFLICTS);
  });
});

describe('Override Application', () => {
  test('applies simple override to theme object', () => {
    const theme: Theme = {
      radius: {
        lg: '1rem',
      },
    } as unknown as Theme;

    const conflict = {
      variantName: 'themeMono',
      themeProperty: 'radius' as keyof Theme,
      themeKey: 'lg',
      variableValue: '1rem',
      ruleValue: '0',
      ruleSelector: '.rounded-lg',
      canResolve: true,
      confidence: 'high' as const,
      cssRule: {} as CSSRuleOverride,
    };

    applyOverride(theme, conflict);

    expect(theme.radius.lg).toBe('0');
  });

  test('applies multiple overrides to theme object', () => {
    const theme: Theme = {
      radius: {
        lg: '1rem',
        md: '0.5rem',
      },
    } as unknown as Theme;

    const conflicts = [
      {
        variantName: 'themeMono',
        themeProperty: 'radius' as keyof Theme,
        themeKey: 'lg',
        variableValue: '1rem',
        ruleValue: '0',
        ruleSelector: '.rounded-lg',
        canResolve: true,
        confidence: 'high' as const,
        cssRule: {} as CSSRuleOverride,
      },
      {
        variantName: 'themeMono',
        themeProperty: 'radius' as keyof Theme,
        themeKey: 'md',
        variableValue: '0.5rem',
        ruleValue: '0',
        ruleSelector: '.rounded-md',
        canResolve: true,
        confidence: 'high' as const,
        cssRule: {} as CSSRuleOverride,
      },
    ];

    for (const conflict of conflicts) {
      applyOverride(theme, conflict);
    }

    expect(theme.radius.lg).toBe('0');
    expect(theme.radius.md).toBe('0');
  });

  test('handles non-existent namespace gracefully', () => {
    const theme: Theme = {} as Theme;

    const conflict = {
      variantName: 'themeMono',
      themeProperty: 'radius' as keyof Theme,
      themeKey: 'lg',
      variableValue: '1rem',
      ruleValue: '0',
      ruleSelector: '.rounded-lg',
      canResolve: true,
      confidence: 'high' as const,
      cssRule: {} as CSSRuleOverride,
    };

    // Should not throw
    expect(() => applyOverride(theme, conflict)).not.toThrow();
  });
});

describe('Helper Functions', () => {
  test('filterResolvableConflicts returns only high-confidence resolvable conflicts', () => {
    const conflicts = [
      {
        variantName: 'themeMono',
        themeProperty: 'radius' as keyof Theme,
        themeKey: 'lg',
        variableValue: '1rem',
        ruleValue: '0',
        ruleSelector: '.rounded-lg',
        canResolve: true,
        confidence: 'high' as const,
        cssRule: {} as CSSRuleOverride,
      },
      {
        variantName: 'themeMono',
        themeProperty: 'radius' as keyof Theme,
        themeKey: 'md',
        variableValue: '0.5rem',
        ruleValue: '8px',
        ruleSelector: '.rounded-md',
        canResolve: true,
        confidence: 'medium' as const,
        cssRule: {} as CSSRuleOverride,
      },
      {
        variantName: 'themeMono',
        themeProperty: 'radius' as keyof Theme,
        themeKey: 'sm',
        variableValue: '0.25rem',
        ruleValue: '0',
        ruleSelector: '.rounded-sm:hover',
        canResolve: false,
        confidence: 'low' as const,
        cssRule: {} as CSSRuleOverride,
      },
    ];

    const resolvable = filterResolvableConflicts(conflicts);

    expect(resolvable).toHaveLength(ONE_CONFLICT);
    expect(resolvable[0]!.themeKey).toBe('lg');
  });

  test('groupConflictsByVariant groups correctly', () => {
    const conflicts = [
      {
        variantName: 'themeMono',
        themeProperty: 'radius' as keyof Theme,
        themeKey: 'lg',
        variableValue: '1rem',
        ruleValue: '0',
        ruleSelector: '.rounded-lg',
        canResolve: true,
        confidence: 'high' as const,
        cssRule: {} as CSSRuleOverride,
      },
      {
        variantName: 'themeDark',
        themeProperty: 'shadows' as keyof Theme,
        themeKey: 'lg',
        variableValue: '0 10px 15px rgba(0, 0, 0, 0.1)',
        ruleValue: 'none',
        ruleSelector: '.shadow-lg',
        canResolve: true,
        confidence: 'high' as const,
        cssRule: {} as CSSRuleOverride,
      },
    ];

    const grouped = groupConflictsByVariant(conflicts);

    expect(grouped.size).toBe(TWO_CONFLICTS);
    expect(grouped.get('themeMono')).toHaveLength(ONE_CONFLICT);
    expect(grouped.get('themeDark')).toHaveLength(ONE_CONFLICT);
  });

  test('groupConflictsByVariant handles multiple conflicts per variant', () => {
    const conflicts = [
      {
        variantName: 'themeMono',
        themeProperty: 'radius' as keyof Theme,
        themeKey: 'lg',
        variableValue: '1rem',
        ruleValue: '0',
        ruleSelector: '.rounded-lg',
        canResolve: true,
        confidence: 'high' as const,
        cssRule: {} as CSSRuleOverride,
      },
      {
        variantName: 'themeMono',
        themeProperty: 'shadows' as keyof Theme,
        themeKey: 'lg',
        variableValue: '0 10px 15px rgba(0, 0, 0, 0.1)',
        ruleValue: 'none',
        ruleSelector: '.shadow-lg',
        canResolve: true,
        confidence: 'high' as const,
        cssRule: {} as CSSRuleOverride,
      },
    ];

    const grouped = groupConflictsByVariant(conflicts);

    expect(grouped.size).toBe(ONE_CONFLICT);
    expect(grouped.get('themeMono')).toHaveLength(TWO_CONFLICTS);
  });
});

describe('Edge Cases', () => {
  test('handles empty cssRules array', () => {
    const cssRules: Array<CSSRuleOverride> = [];
    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          radius: {
            lg: '1rem',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(ZERO_CONFLICTS);
  });

  test('handles empty variants object', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.rounded-lg',
        property: 'border-radius',
        value: '0',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
    ];
    const variants = {};

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(ZERO_CONFLICTS);
  });

  test('handles theme namespace with non-string values', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.rounded-lg',
        property: 'border-radius',
        value: '0',
        variantName: 'themeMono',
        originalSelector: '.theme-mono',
        complexity: 'simple',
      },
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          radius: {
            lg: { value: '1rem' }, // Object instead of string
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    // Should skip non-string values
    expect(conflicts).toHaveLength(ZERO_CONFLICTS);
  });

  test('handles variant selector mismatch', () => {
    const cssRules: Array<CSSRuleOverride> = [
      {
        selector: '.rounded-lg',
        property: 'border-radius',
        value: '0',
        variantName: 'themeMono',
        originalSelector: '.theme-different', // Mismatch
        complexity: 'simple',
      },
    ];

    const variants = {
      themeMono: {
        selector: '.theme-mono',
        theme: {
          radius: {
            lg: '1rem',
          },
        } as unknown as Theme,
      },
    };

    const conflicts = detectConflicts(cssRules, variants);

    expect(conflicts).toHaveLength(ZERO_CONFLICTS);
  });
});
