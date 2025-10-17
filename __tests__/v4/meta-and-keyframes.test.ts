import { describe, expect, test } from 'bun:test';

import { extractTheme } from '../../src/v4/index';

// Test constants
const EXPECTED_KEYFRAME_COUNT_THREE = 3;
const EXPECTED_KEYFRAME_COUNT_FOUR = 4;

describe('Meta Variables (--default-*)', () => {
  test('extracts --default-* meta variables', async () => {
    const result = await extractTheme({
      css: `
        @theme {
          --default-transition-duration: 150ms;
          --default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          --default-font-family: var(--font-sans);
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.theme.defaults.transitionDuration).toBe('150ms');
    expect(result.theme.defaults.transitionTimingFunction).toBe(
      'cubic-bezier(0.4, 0, 0.2, 1)',
    );
    expect(result.theme.defaults.fontFamily).toBe('var(--font-sans)');
  });

  test('converts --default-* keys to camelCase', async () => {
    const result = await extractTheme({
      css: `
        @theme {
          --default-font-feature-settings: "liga" 1;
          --default-line-height-base: 1.5;
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.theme.defaults.fontFeatureSettings).toBe('"liga" 1');
    expect(result.theme.defaults.lineHeightBase).toBe('1.5');
  });

  test('works with custom meta variables', async () => {
    const result = await extractTheme({
      css: `
        @theme {
          --default-border-width: 1px;
          --default-spacing-unit: 0.25rem;
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.theme.defaults.borderWidth).toBe('1px');
    expect(result.theme.defaults.spacingUnit).toBe('0.25rem');
  });

  test('preserves --theme() function calls', async () => {
    const result = await extractTheme({
      css: `
        @theme {
          --default-font-family: --theme(--font-sans, sans-serif);
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.theme.defaults.fontFamily).toBe(
      '--theme(--font-sans, sans-serif)',
    );
  });
});

describe('@keyframes Extraction', () => {
  test('extracts @keyframes rules', async () => {
    const result = await extractTheme({
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

    expect(result.theme.keyframes.spin).toBeDefined();
    expect(result.theme.keyframes.spin).toContain('rotate(360deg)');

    expect(result.theme.keyframes.ping).toBeDefined();
    expect(result.theme.keyframes.ping).toContain('scale(2)');
  });

  test('preserves complete keyframe definitions', async () => {
    const result = await extractTheme({
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

    expect(result.theme.keyframes.bounce).toBeDefined();
    expect(result.theme.keyframes.bounce).toContain('@keyframes bounce');
    expect(result.theme.keyframes.bounce).toContain('translateY(-25%)');
    expect(result.theme.keyframes.bounce).toContain('cubic-bezier');
  });

  test('extracts multiple keyframes', async () => {
    const result = await extractTheme({
      css: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `,
      includeTailwindDefaults: false,
    });

    expect(Object.keys(result.theme.keyframes)).toHaveLength(
      EXPECTED_KEYFRAME_COUNT_THREE,
    );
    expect(result.theme.keyframes.fadeIn).toContain('opacity: 0');
    expect(result.theme.keyframes.fadeOut).toContain('opacity: 1');
    expect(result.theme.keyframes.slideUp).toContain('translateY(100%)');
  });

  test('works alongside --animate-* variables', async () => {
    const result = await extractTheme({
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
    expect(result.theme.animations.spin).toBe('spin 1s linear infinite');
    expect(result.theme.animations.ping).toBe(
      'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
    );

    // Keyframe definitions
    expect(result.theme.keyframes.spin).toContain('rotate(360deg)');
    expect(result.theme.keyframes.ping).toContain('scale(2)');
  });
});

describe('Meta Variables + Keyframes Combined', () => {
  test('extracts both meta variables and keyframes', async () => {
    const result = await extractTheme({
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
    expect(result.theme.defaults.transitionDuration).toBe('300ms');

    // Regular colors
    expect(result.theme.colors.primary).toBe('#3b82f6');

    // Keyframes
    expect(result.theme.keyframes.pulse).toContain('opacity: 0.5');
  });

  test('handles empty defaults and keyframes gracefully', async () => {
    const result = await extractTheme({
      css: `
        @theme {
          --color-primary: #3b82f6;
        }
      `,
      includeTailwindDefaults: false,
    });

    expect(result.theme.defaults).toEqual({});
    expect(result.theme.keyframes).toEqual({});
    expect(result.theme.colors.primary).toBe('#3b82f6');
  });
});

describe('Tailwind v4 Real-World Examples', () => {
  test('handles Tailwind-like meta variables', async () => {
    const result = await extractTheme({
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

    expect(result.theme.defaults).toEqual({
      transitionDuration: '150ms',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontFeatureSettings: 'normal',
      fontVariationSettings: 'normal',
    });
  });

  test('handles Tailwind-like keyframes', async () => {
    const result = await extractTheme({
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

    expect(Object.keys(result.theme.keyframes)).toHaveLength(
      EXPECTED_KEYFRAME_COUNT_FOUR,
    );
    expect(result.theme.keyframes.spin).toContain('rotate(360deg)');
    expect(result.theme.keyframes.ping).toContain('scale(2)');
    expect(result.theme.keyframes.pulse).toContain('opacity: 0.5');
    expect(result.theme.keyframes.bounce).toContain('translateY(-25%)');
  });
});
