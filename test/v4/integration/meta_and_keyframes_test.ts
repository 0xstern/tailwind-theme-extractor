import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4';

// Test constants
const EXPECTED_KEYFRAME_COUNT_THREE = 3;
const EXPECTED_KEYFRAME_COUNT_FOUR = 4;

describe('Meta Variables (--default-*)', () => {
  test('resolves --default-* meta variables', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --default-transition-duration: 150ms;
          --default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          --default-font-family: var(--font-sans);
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.variants.default.defaults.transitionDuration).toBe('150ms');
    expect(result.variants.default.defaults.transitionTimingFunction).toBe(
      'cubic-bezier(0.4, 0, 0.2, 1)',
    );
    expect(result.variants.default.defaults.fontFamily).toBe(
      'var(--font-sans)',
    );
  });

  test('converts --default-* keys to camelCase', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --default-font-feature-settings: "liga" 1;
          --default-line-height-base: 1.5;
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.variants.default.defaults.fontFeatureSettings).toBe(
      '"liga" 1',
    );
    expect(result.variants.default.defaults.lineHeightBase).toBe('1.5');
  });

  test('works with custom meta variables', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --default-border-width: 1px;
          --default-spacing-unit: 0.25rem;
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.variants.default.defaults.borderWidth).toBe('1px');
    expect(result.variants.default.defaults.spacingUnit).toBe('0.25rem');
  });

  test('preserves --theme() function calls', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --default-font-family: --theme(--font-sans, sans-serif);
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.variants.default.defaults.fontFamily).toBe(
      '--theme(--font-sans, sans-serif)',
    );
  });
});

describe('@keyframes Resolution', () => {
  test('resolves @keyframes rules', async () => {
    const result = await resolveTheme({
      css: `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.variants.default.keyframes.spin).toBeDefined();
    expect(result.variants.default.keyframes.spin).toContain('rotate(360deg)');

    expect(result.variants.default.keyframes.ping).toBeDefined();
    expect(result.variants.default.keyframes.ping).toContain('scale(2)');
  });

  test('preserves complete keyframe definitions', async () => {
    const result = await resolveTheme({
      css: `
        @keyframes bounce {
          0%, 100% {
            transform: translateY(-25%);
            animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
          }
          50% {
            transform: none;
            animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
          }
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.variants.default.keyframes.bounce).toBeDefined();
    expect(result.variants.default.keyframes.bounce).toContain(
      '@keyframes bounce',
    );
    expect(result.variants.default.keyframes.bounce).toContain(
      'translateY(-25%)',
    );
    expect(result.variants.default.keyframes.bounce).toContain('cubic-bezier');
  });

  test('resolves multiple keyframes', async () => {
    const result = await resolveTheme({
      css: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `,
      includeTailwindDefaults: false,
    });

    expect(Object.keys(result.variants.default.keyframes)).toHaveLength(
      EXPECTED_KEYFRAME_COUNT_THREE,
    );
    expect(result.variants.default.keyframes.fadeIn).toContain('opacity: 0');
    expect(result.variants.default.keyframes.fadeOut).toContain('opacity: 1');
    expect(result.variants.default.keyframes.slideUp).toContain(
      'translateY(100%)',
    );
  });

  test('works alongside --animate-* variables', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --animate-spin: spin 1s linear infinite;
          --animate-ping: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `,
      includeTailwindDefaults: false,
    });

    // Animation variables
    expect(result.variants.default.animations.spin).toBe(
      'spin 1s linear infinite',
    );
    expect(result.variants.default.animations.ping).toBe(
      'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
    );

    // Keyframe definitions
    expect(result.variants.default.keyframes.spin).toContain('rotate(360deg)');
    expect(result.variants.default.keyframes.ping).toContain('scale(2)');
  });
});

describe('Meta Variables + Keyframes Combined', () => {
  test('resolves both meta variables and keyframes', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --default-transition-duration: 300ms;
          --color-primary: #3b82f6;
        }

        @keyframes pulse {
          50% { opacity: 0.5; }
        }
      `,
      includeTailwindDefaults: false,
    });

    // Meta variables
    expect(result.variants.default.defaults.transitionDuration).toBe('300ms');

    // Regular colors
    expect(result.variants.default.colors.primary).toBe('#3b82f6');

    // Keyframes
    expect(result.variants.default.keyframes.pulse).toContain('opacity: 0.5');
  });

  test('handles empty defaults and keyframes gracefully', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --color-primary: #3b82f6;
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.variants.default.defaults).toEqual({});
    expect(result.variants.default.keyframes).toEqual({});
    expect(result.variants.default.colors.primary).toBe('#3b82f6');
  });
});

describe('Tailwind v4 Real-World Examples', () => {
  test('handles Tailwind-like meta variables', async () => {
    const result = await resolveTheme({
      css: `
        @theme {
          --default-transition-duration: 150ms;
          --default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          --default-font-family: ui-sans-serif, system-ui, sans-serif;
          --default-font-feature-settings: normal;
          --default-font-variation-settings: normal;
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.variants.default.defaults).toEqual({
      transitionDuration: '150ms',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontFeatureSettings: 'normal',
      fontVariationSettings: 'normal',
    });
  });

  test('handles Tailwind-like keyframes', async () => {
    const result = await resolveTheme({
      css: `
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        @keyframes pulse {
          50% {
            opacity: 0.5;
          }
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(-25%);
            animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
          }
          50% {
            transform: none;
            animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
          }
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(Object.keys(result.variants.default.keyframes)).toHaveLength(
      EXPECTED_KEYFRAME_COUNT_FOUR,
    );
    expect(result.variants.default.keyframes.spin).toContain('rotate(360deg)');
    expect(result.variants.default.keyframes.ping).toContain('scale(2)');
    expect(result.variants.default.keyframes.pulse).toContain('opacity: 0.5');
    expect(result.variants.default.keyframes.bounce).toContain(
      'translateY(-25%)',
    );
  });
});
