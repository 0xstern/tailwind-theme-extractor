/**
 * Theme overrides tests
 * Tests for parsing and applying theme value overrides
 */

import type {
  CSSVariable,
  OverrideOptions,
  Theme,
  ThemeVariant,
} from '../../../../src/v4/types';

import { describe, expect, test } from 'bun:test';

import {
  applyThemeOverrides,
  injectVariableOverrides,
  resolveVariantName,
} from '../../../../src/v4/parser/theme-overrides';

const ZERO_OVERRIDES = 0;
const ONE_OVERRIDE = 1;
const TWO_OVERRIDES = 2;
const THREE_OVERRIDES = 3;
const FOUR_OVERRIDES = 4;

describe('resolveVariantName', () => {
  const variants = {
    dark: {
      selector: '[data-theme="dark"]',
      theme: {} as Theme,
    },
    compact: {
      selector: '[data-theme="compact"]',
      theme: {} as Theme,
    },
    compactDark: {
      selector: '[data-theme="compact"].dark',
      theme: {} as Theme,
    },
  };

  test('resolves wildcard to all variants including default', () => {
    const result = resolveVariantName('*', variants);

    expect(result).toContain('default');
    expect(result).toContain('dark');
    expect(result).toContain('compact');
    expect(result).toContain('compactDark');
    expect(result.length).toBe(FOUR_OVERRIDES);
  });

  test('resolves "default" to default variant', () => {
    const result = resolveVariantName('default', variants);

    expect(result).toEqual(['default']);
  });

  test('resolves "base" to default variant', () => {
    const result = resolveVariantName('base', variants);

    expect(result).toEqual(['default']);
  });

  test('resolves direct variant name match', () => {
    const result = resolveVariantName('dark', variants);

    expect(result).toEqual(['dark']);
  });

  test('resolves exact CSS selector match', () => {
    const result = resolveVariantName('[data-theme="dark"]', variants);

    expect(result).toEqual(['dark']);
  });

  test('resolves substring CSS selector match', () => {
    const result = resolveVariantName('[data-theme="compact"]', variants);

    expect(result.length).toBe(TWO_OVERRIDES);
    expect(result).toContain('compact');
    expect(result).toContain('compactDark');
  });

  test('returns empty array for non-matching selector', () => {
    const result = resolveVariantName('nonexistent', variants);

    expect(result).toEqual([]);
  });

  test('handles empty variants object', () => {
    const result = resolveVariantName('dark', {});

    expect(result).toEqual([]);
  });
});

describe('applyThemeOverrides - Flat Notation', () => {
  test('applies simple flat override to default theme', () => {
    const baseTheme: Theme = {
      colors: { primary: '##0000ff' },
      radius: { lg: '1rem' },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {
        'radius.lg': '0',
      },
    };

    applyThemeOverrides(baseTheme, {}, overrides);

    expect(baseTheme.radius.lg).toBe('0');
  });

  test('applies flat override to variant theme', () => {
    const baseTheme: Theme = {} as Theme;
    const variants = {
      dark: {
        selector: '[data-theme="dark"]',
        theme: {
          colors: { background: '#000' },
          radius: { lg: '1rem' },
        } as Theme,
      },
    };

    const overrides: OverrideOptions = {
      dark: {
        'radius.lg': '0.5rem',
      },
    };

    applyThemeOverrides(baseTheme, variants, overrides);

    expect(variants.dark.theme.radius.lg).toBe('0.5rem');
  });

  test('applies multiple flat overrides', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
      radius: { lg: '1rem', md: '0.5rem' },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {
        'radius.lg': '0',
        'radius.md': '0',
      },
    };

    applyThemeOverrides(baseTheme, {}, overrides);

    expect(baseTheme.radius.lg).toBe('0');
    expect(baseTheme.radius.md).toBe('0');
  });

  test('applies deep path override', () => {
    const baseTheme: Theme = {
      colors: {
        primary: {
          500: '#0000ff',
          600: '#0000cc',
        },
      },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {
        'colors.primary.500': '#ff0000',
      },
    };

    applyThemeOverrides(baseTheme, {}, overrides);

    expect((baseTheme.colors.primary as Record<string, string>)[500]).toBe(
      '#ff0000',
    );
  });

  test('skips override for non-existent path', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {
        'radius.lg': '0',
      },
    };

    applyThemeOverrides(baseTheme, {}, overrides);

    expect(baseTheme.radius).toBeUndefined();
  });
});

describe('applyThemeOverrides - Nested Notation', () => {
  test('applies nested object override', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
      radius: { lg: '1rem' },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {
        radius: {
          lg: '0',
        },
      },
    };

    applyThemeOverrides(baseTheme, {}, overrides);

    expect(baseTheme.radius.lg).toBe('0');
  });

  test('applies deeply nested object override', () => {
    const baseTheme: Theme = {
      colors: {
        primary: {
          500: '#0000ff',
        },
      },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {
        colors: {
          primary: {
            500: '#ff0000',
          },
        },
      },
    };

    applyThemeOverrides(baseTheme, {}, overrides);

    expect((baseTheme.colors.primary as Record<string, string>)[500]).toBe(
      '#ff0000',
    );
  });

  test('applies multiple nested overrides', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
      radius: { lg: '1rem', md: '0.5rem' },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {
        radius: {
          lg: '0',
          md: '0',
        },
      },
    };

    applyThemeOverrides(baseTheme, {}, overrides);

    expect(baseTheme.radius.lg).toBe('0');
    expect(baseTheme.radius.md).toBe('0');
  });
});

describe('applyThemeOverrides - Wildcard', () => {
  test('applies override to all variants with wildcard', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
      radius: { lg: '1rem' },
    } as Theme;

    const variants = {
      dark: {
        selector: '[data-theme="dark"]',
        theme: {
          colors: { background: '#000' },
          radius: { lg: '1rem' },
        } as Theme,
      },
      light: {
        selector: '[data-theme="light"]',
        theme: {
          colors: { background: '#fff' },
          radius: { lg: '1rem' },
        } as Theme,
      },
    };

    const overrides: OverrideOptions = {
      '*': {
        'radius.lg': '0',
      },
    };

    applyThemeOverrides(baseTheme, variants, overrides);

    expect(baseTheme.radius.lg).toBe('0');
    expect(variants.dark.theme.radius.lg).toBe('0');
    expect(variants.light.theme.radius.lg).toBe('0');
  });

  test('wildcard override works with multiple properties', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
      radius: { lg: '1rem', md: '0.5rem' },
    } as Theme;

    const variants = {
      dark: {
        selector: '[data-theme="dark"]',
        theme: {
          colors: { background: '#000' },
          radius: { lg: '1rem', md: '0.5rem' },
        } as Theme,
      },
    };

    const overrides: OverrideOptions = {
      '*': {
        'radius.lg': '0',
        'radius.md': '0',
      },
    };

    applyThemeOverrides(baseTheme, variants, overrides);

    expect(baseTheme.radius.lg).toBe('0');
    expect(baseTheme.radius.md).toBe('0');
    expect(variants.dark.theme.radius.lg).toBe('0');
    expect(variants.dark.theme.radius.md).toBe('0');
  });
});

describe('applyThemeOverrides - CSS Selector Matching', () => {
  test('applies override via CSS selector', () => {
    const baseTheme: Theme = {} as Theme;
    const variants = {
      dark: {
        selector: '[data-theme="dark"]',
        theme: {
          colors: { background: '#000' },
          radius: { lg: '1rem' },
        } as Theme,
      },
    };

    const overrides: OverrideOptions = {
      '[data-theme="dark"]': {
        'radius.lg': '0',
      },
    };

    applyThemeOverrides(baseTheme, variants, overrides);

    expect(variants.dark.theme.radius.lg).toBe('0');
  });

  test('applies override via partial selector match', () => {
    const baseTheme: Theme = {} as Theme;
    const variants = {
      compact: {
        selector: '[data-theme="compact"]',
        theme: {
          radius: { lg: '1rem' },
        } as Theme,
      },
      compactDark: {
        selector: '[data-theme="compact"].dark',
        theme: {
          radius: { lg: '1rem' },
        } as Theme,
      },
    };

    const overrides: OverrideOptions = {
      '[data-theme="compact"]': {
        'radius.lg': '0',
      },
    };

    applyThemeOverrides(baseTheme, variants, overrides);

    expect(variants.compact.theme.radius.lg).toBe('0');
    expect(variants.compactDark.theme.radius.lg).toBe('0');
  });
});

describe('applyThemeOverrides - Detailed Override Values', () => {
  test('applies detailed override with force flag', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
      radius: { lg: '1rem' },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {
        'radius.lg': {
          value: '0',
          force: true,
        },
      },
    };

    applyThemeOverrides(baseTheme, {}, overrides);

    expect(baseTheme.radius.lg).toBe('0');
  });

  test('applies detailed override with resolveVars flag', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
      radius: { lg: '1rem' },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {
        'radius.lg': {
          value: '0',
          resolveVars: false,
        },
      },
    };

    applyThemeOverrides(baseTheme, {}, overrides);

    expect(baseTheme.radius.lg).toBe('0');
  });
});

describe('applyThemeOverrides - Debug Logging', () => {
  test('returns logs when debug is enabled', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
      radius: { lg: '1rem' },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {
        'radius.lg': '0',
      },
    };

    const logs = applyThemeOverrides(baseTheme, {}, overrides, true);

    expect(logs.length).toBeGreaterThan(ZERO_OVERRIDES);
    expect(logs.some((log) => log.includes('Applied to'))).toBe(true);
  });

  test('returns empty logs when debug is disabled', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
      radius: { lg: '1rem' },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {
        'radius.lg': '0',
      },
    };

    const logs = applyThemeOverrides(baseTheme, {}, overrides, false);

    expect(logs.length).toBe(ZERO_OVERRIDES);
  });

  test('logs skipped overrides in debug mode', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {
        'radius.lg': '0',
      },
    };

    const logs = applyThemeOverrides(baseTheme, {}, overrides, true);

    expect(logs.some((log) => log.includes('Skipped'))).toBe(true);
  });
});

describe('applyThemeOverrides - Edge Cases', () => {
  test('handles empty overrides', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
      radius: { lg: '1rem' },
    } as Theme;

    const overrides: OverrideOptions = {};

    expect(() => applyThemeOverrides(baseTheme, {}, overrides)).not.toThrow();
  });

  test('handles non-matching variant selector', () => {
    const baseTheme: Theme = {} as Theme;
    const variants = {
      dark: {
        selector: '[data-theme="dark"]',
        theme: {
          radius: { lg: '1rem' },
        } as Theme,
      },
    };

    const overrides: OverrideOptions = {
      nonexistent: {
        'radius.lg': '0',
      },
    };

    expect(() =>
      applyThemeOverrides(baseTheme, variants, overrides),
    ).not.toThrow();
  });

  test('handles empty config for selector', () => {
    const baseTheme: Theme = {
      colors: { primary: '#0000ff' },
      radius: { lg: '1rem' },
    } as Theme;

    const overrides: OverrideOptions = {
      default: {},
    };

    expect(() => applyThemeOverrides(baseTheme, {}, overrides)).not.toThrow();
  });

  test('handles undefined variant theme', () => {
    const baseTheme: Theme = {} as Theme;
    const variants: Record<string, ThemeVariant> = {
      dark: {
        selector: '[data-theme="dark"]',
        theme: undefined as unknown as Theme,
      },
    };

    const overrides: OverrideOptions = {
      dark: {
        'radius.lg': '0',
      },
    };

    expect(() =>
      applyThemeOverrides(baseTheme, variants, overrides),
    ).not.toThrow();
  });
});

describe('injectVariableOverrides', () => {
  test('injects variable for default selector', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      default: {
        'fonts.sans': 'Inter, sans-serif',
      },
    };

    injectVariableOverrides(variables, overrides);

    expect(variables.length).toBe(ONE_OVERRIDE);
    expect(variables[0]).toMatchObject({
      name: '--fonts-sans',
      value: 'Inter, sans-serif',
      source: 'theme',
    });
  });

  test('injects variable for wildcard selector', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      '*': {
        'fonts.sans': 'Inter, sans-serif',
      },
    };

    injectVariableOverrides(variables, overrides);

    expect(variables.length).toBe(ONE_OVERRIDE);
    expect(variables[0]?.name).toBe('--fonts-sans');
  });

  test('injects variable for base selector', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      base: {
        'fonts.sans': 'Inter, sans-serif',
      },
    };

    injectVariableOverrides(variables, overrides);

    expect(variables.length).toBe(ONE_OVERRIDE);
  });

  test('skips injection for variant-specific selector', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      dark: {
        'fonts.sans': 'Inter, sans-serif',
      },
    };

    injectVariableOverrides(variables, overrides);

    expect(variables.length).toBe(ZERO_OVERRIDES);
  });

  test('injects multiple variables', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      default: {
        'fonts.sans': 'Inter, sans-serif',
        'fonts.mono': 'JetBrains Mono, monospace',
      },
    };

    injectVariableOverrides(variables, overrides);

    expect(variables.length).toBe(TWO_OVERRIDES);
  });

  test('injects deep path variable', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      default: {
        'colors.primary.500': '#ff0000',
      },
    };

    injectVariableOverrides(variables, overrides);

    expect(variables.length).toBe(ONE_OVERRIDE);
    expect(variables[0]?.name).toBe('--colors-primary-500');
  });

  test('respects resolveVars flag', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      default: {
        'fonts.sans': {
          value: 'Inter, sans-serif',
          resolveVars: false,
        },
      },
    };

    injectVariableOverrides(variables, overrides);

    expect(variables.length).toBe(ZERO_OVERRIDES);
  });

  test('injects when resolveVars is true', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      default: {
        'fonts.sans': {
          value: 'Inter, sans-serif',
          resolveVars: true,
        },
      },
    };

    injectVariableOverrides(variables, overrides);

    expect(variables.length).toBe(ONE_OVERRIDE);
  });

  test('handles nested notation', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      default: {
        fonts: {
          sans: 'Inter, sans-serif',
          mono: 'JetBrains Mono, monospace',
        },
      },
    };

    injectVariableOverrides(variables, overrides);

    expect(variables.length).toBe(TWO_OVERRIDES);
  });

  test('returns logs in debug mode', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      default: {
        'fonts.sans': 'Inter, sans-serif',
      },
    };

    const logs = injectVariableOverrides(variables, overrides, true);

    expect(logs.length).toBeGreaterThan(ZERO_OVERRIDES);
    expect(logs.some((log) => log.includes('Injected variable'))).toBe(true);
  });

  test('returns empty logs when debug is disabled', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      default: {
        'fonts.sans': 'Inter, sans-serif',
      },
    };

    const logs = injectVariableOverrides(variables, overrides, false);

    expect(logs.length).toBe(ZERO_OVERRIDES);
  });
});

describe('injectVariableOverrides - Edge Cases', () => {
  test('handles empty overrides', () => {
    const variables: Array<CSSVariable> = [];
    const overrides: OverrideOptions = {};

    expect(() => injectVariableOverrides(variables, overrides)).not.toThrow();
    expect(variables.length).toBe(ZERO_OVERRIDES);
  });

  test('handles empty config gracefully', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      default: {},
    };

    injectVariableOverrides(variables, overrides);

    expect(variables.length).toBe(ZERO_OVERRIDES);
  });

  test('handles multiple selectors', () => {
    const variables: Array<CSSVariable> = [];

    const overrides: OverrideOptions = {
      default: {
        'fonts.sans': 'Inter, sans-serif',
      },
      '*': {
        'fonts.mono': 'JetBrains Mono, monospace',
      },
      base: {
        'colors.primary': '#ff0000',
      },
    };

    injectVariableOverrides(variables, overrides);

    expect(variables.length).toBe(THREE_OVERRIDES);
  });
});
