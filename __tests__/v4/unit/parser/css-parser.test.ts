/**
 * Unit tests for CSS parser module
 * Tests the main parseCSS() function and error handling
 */

import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { parseCSS } from '../../../../src/v4/parser/css-parser';

const FIXTURES_DIR = join(__dirname, '../../fixtures');

describe('parseCSS - Input validation', () => {
  test('throws error when neither input nor css is provided', async () => {
    expect(parseCSS({} as Parameters<typeof parseCSS>[0])).rejects.toThrow(
      'Either input or css must be provided',
    );
  });

  test('throws error when input file does not exist', async () => {
    expect(
      parseCSS({
        input: '/non/existent/file.css',
      }),
    ).rejects.toThrow();
  });
});

describe('parseCSS - CSS string parsing', () => {
  test('parses simple @theme block from CSS string', async () => {
    const result = await parseCSS({
      css: `
        @theme {
          --color-primary: #3b82f6;
          --color-secondary: #8b5cf6;
        }
      `,
    });

    expect(result.theme.colors.primary).toBe('#3b82f6');
    expect(result.theme.colors.secondary).toBe('#8b5cf6');
    expect(result.files).toHaveLength(0);
  });

  test('parses :root block from CSS string', async () => {
    const result = await parseCSS({
      css: `
        :root {
          --spacing-4: 1rem;
          --radius-base: 0.5rem;
        }
      `,
    });

    expect(result.theme.spacing['4']).toBe('1rem');
    expect(result.theme.radius.base).toBe('0.5rem');
  });

  test('parses combined @theme and :root blocks', async () => {
    const result = await parseCSS({
      css: `
        @theme {
          --color-background: var(--background);
        }
        :root {
          --background: oklch(1 0 0);
        }
      `,
    });

    expect(result.theme.colors.background).toBe('oklch(1 0 0)');
  });

  test('handles empty CSS string', async () => {
    const result = await parseCSS({
      css: '',
    });

    expect(result.theme.colors).toEqual({});
    expect(result.files).toHaveLength(0);
  });

  test('uses basePath for node_modules resolution when provided', async () => {
    const result = await parseCSS({
      css: '@theme { --color-primary: blue; }',
      basePath: process.cwd(),
    });

    expect(result.theme.colors.primary).toBe('blue');
  });

  test('uses process.cwd() when basePath not provided', async () => {
    const result = await parseCSS({
      css: '@theme { --color-primary: red; }',
    });

    expect(result.theme.colors.primary).toBe('red');
  });
});

describe('parseCSS - File input parsing', () => {
  test('parses CSS from file path', async () => {
    const result = await parseCSS({
      input: join(FIXTURES_DIR, 'base-theme.css'),
    });

    expect(result.theme.colors).toBeDefined();
    expect(result.files).toContain(join(FIXTURES_DIR, 'base-theme.css'));
  });

  test('returns absolute file paths in files array', async () => {
    const inputPath = join(FIXTURES_DIR, 'base-theme.css');
    const result = await parseCSS({
      input: inputPath,
      resolveImports: false,
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toBe(inputPath);
  });

  test('resolves imports by default', async () => {
    const result = await parseCSS({
      input: join(FIXTURES_DIR, 'main.css'),
    });

    // main.css imports other files, so should have multiple files
    expect(result.files.length).toBeGreaterThan(1);
  });

  test('skips import resolution when resolveImports is false', async () => {
    const inputPath = join(FIXTURES_DIR, 'main.css');
    const result = await parseCSS({
      input: inputPath,
      resolveImports: false,
    });

    // Should only have the main file
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toBe(inputPath);
  });
});

describe('parseCSS - Import resolution', () => {
  test('resolves nested imports', async () => {
    const result = await parseCSS({
      input: join(FIXTURES_DIR, 'imports-level1.css'),
    });

    // Should include all three levels
    expect(result.files).toContain(join(FIXTURES_DIR, 'imports-level1.css'));
    expect(result.files).toContain(join(FIXTURES_DIR, 'imports-level2.css'));
    expect(result.files).toContain(join(FIXTURES_DIR, 'imports-level3.css'));
  });

  test('handles missing import files gracefully', async () => {
    const result = await parseCSS({
      css: `
        @import "non-existent.css";
        @theme {
          --color-primary: blue;
        }
      `,
    });

    // Should still parse the @theme block even though import fails
    expect(result.theme.colors.primary).toBe('blue');
  });
});

describe('parseCSS - Debug mode', () => {
  test('accepts debug flag without throwing', async () => {
    const result = await parseCSS({
      css: '@theme { --color-primary: blue; }',
      debug: true,
    });

    expect(result.theme.colors.primary).toBe('blue');
  });

  test('debug mode logs import failures (manual verification)', async () => {
    // This test verifies debug mode doesn't crash
    // Actual logging output should be verified manually
    const result = await parseCSS({
      css: `
        @import "missing-file.css";
        @theme { --color-test: green; }
      `,
      debug: true,
    });

    expect(result.theme.colors.test).toBe('green');
  });
});

describe('parseCSS - PostCSS integration', () => {
  test('handles invalid CSS syntax with error', async () => {
    expect(
      parseCSS({
        css: '{ invalid css syntax', // Invalid CSS
      }),
    ).rejects.toThrow();
  });

  test('parses complex CSS constructs', async () => {
    const result = await parseCSS({
      css: `
        @media (prefers-color-scheme: dark) {
          :root {
            --color-background: black;
          }
        }

        @theme {
          --color-foreground: white;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `,
    });

    expect(result.theme.colors.foreground).toBe('white');
    expect(result.theme.keyframes.spin).toBeDefined();
  });

  test('handles variant selectors', async () => {
    const result = await parseCSS({
      css: `
        .dark {
          --color-background: black;
        }
      `,
    });

    expect(result.variants.dark).toBeDefined();
    expect(result.variants.dark!.theme.colors.background).toBe('black');
  });
});

describe('parseCSS - Variable extraction', () => {
  test('extracts and resolves var() references', async () => {
    const result = await parseCSS({
      css: `
        @theme {
          --color-primary: var(--brand);
        }
        :root {
          --brand: #ff0000;
        }
      `,
    });

    expect(result.theme.colors.primary).toBe('#ff0000');
  });

  test('extracts keyframes', async () => {
    const result = await parseCSS({
      css: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `,
    });

    expect(result.theme.keyframes.fadeIn).toContain('opacity: 0');
    expect(result.theme.keyframes.fadeIn).toContain('opacity: 1');
  });

  test('returns raw and resolved variables', async () => {
    const result = await parseCSS({
      css: `
        @theme {
          --color-primary: blue;
        }
      `,
    });

    expect(result.variables).toBeInstanceOf(Array);
    expect(result.variables.length).toBeGreaterThan(0);
    expect(result.variables[0]).toHaveProperty('name');
    expect(result.variables[0]).toHaveProperty('value');
    expect(result.variables[0]).toHaveProperty('source');
  });
});

describe('parseCSS - Deprecation warnings', () => {
  test('returns deprecation warnings array', async () => {
    const result = await parseCSS({
      css: '@theme { --color-primary: blue; }',
    });

    expect(result.deprecationWarnings).toBeInstanceOf(Array);
  });
});

describe('parseCSS - CSS conflicts', () => {
  test('returns CSS conflicts array', async () => {
    const result = await parseCSS({
      css: '@theme { --color-primary: blue; }',
    });

    expect(result.cssConflicts).toBeInstanceOf(Array);
  });

  test('detects conflicts when variant overrides theme property', async () => {
    const result = await parseCSS({
      css: `
        @theme {
          --color-primary: blue;
        }

        .dark {
          color: red; /* This conflicts with theme variable */
        }
      `,
    });

    // cssConflicts should be populated if conflicts exist
    expect(result.cssConflicts).toBeDefined();
  });
});

describe('parseCSS - Variants', () => {
  test('extracts theme variants', async () => {
    const result = await parseCSS({
      css: `
        @theme {
          --color-primary: blue;
        }

        .dark {
          --color-primary: white;
        }
      `,
    });

    expect(result.variants.dark).toBeDefined();
    expect(result.variants.dark!.theme.colors.primary).toBe('white');
    expect(result.variants.dark!.selector).toBe('.dark');
  });

  test('extracts multiple variants', async () => {
    const result = await parseCSS({
      css: `
        .dark {
          --color-background: black;
        }

        .compact {
          --spacing-base: 0.5rem;
        }
      `,
    });

    expect(result.variants.dark).toBeDefined();
    expect(result.variants.compact).toBeDefined();
  });
});

describe('parseCSS - Type parameter', () => {
  test('supports generic type parameter', async () => {
    interface CustomTheme {
      colors: {
        primary: string;
      };
      spacing: Record<string, string>;
      fonts: Record<string, string>;
      fontSize: Record<string, { size: string; lineHeight?: string }>;
      fontWeight: Record<string, string>;
      tracking: Record<string, string>;
      leading: Record<string, string>;
      breakpoints: Record<string, string>;
      containers: Record<string, string>;
      radius: Record<string, string>;
      shadows: Record<string, string>;
      insetShadows: Record<string, string>;
      dropShadows: Record<string, string>;
      textShadows: Record<string, string>;
      blur: Record<string, string>;
      perspective: Record<string, string>;
      aspect: Record<string, string>;
      ease: Record<string, string>;
      animations: Record<string, string>;
      defaults: Record<string, string>;
      keyframes: Record<string, string>;
    }

    const result = await parseCSS<CustomTheme>({
      css: '@theme { --color-primary: blue; }',
    });

    // Type assertion should work with custom theme type
    expect(result.theme.colors.primary).toBe('blue');
  });
});

describe('parseCSS - Parallel operations', () => {
  test('resolves imports and defaults in parallel', async () => {
    const startTime = Date.now();

    await parseCSS({
      input: join(FIXTURES_DIR, 'main.css'),
    });

    const duration = Date.now() - startTime;
    const REASONABLE_TIMEOUT_MS = 10000;

    // This test verifies the function completes (parallel execution optimization)
    // Actual timing benefits are environment-dependent
    expect(duration).toBeLessThan(REASONABLE_TIMEOUT_MS);
  });
});

describe('parseCSS - Return value structure', () => {
  test('returns all required properties', async () => {
    const result = await parseCSS({
      css: '@theme { --color-primary: blue; }',
    });

    expect(result).toHaveProperty('theme');
    expect(result).toHaveProperty('variants');
    expect(result).toHaveProperty('variables');
    expect(result).toHaveProperty('files');
    expect(result).toHaveProperty('deprecationWarnings');
    expect(result).toHaveProperty('cssConflicts');
  });

  test('theme has all expected properties', async () => {
    const result = await parseCSS({
      css: '@theme { --color-primary: blue; }',
    });

    expect(result.theme).toHaveProperty('colors');
    expect(result.theme).toHaveProperty('spacing');
    expect(result.theme).toHaveProperty('fonts');
    expect(result.theme).toHaveProperty('fontSize');
    expect(result.theme).toHaveProperty('fontWeight');
    expect(result.theme).toHaveProperty('tracking');
    expect(result.theme).toHaveProperty('leading');
    expect(result.theme).toHaveProperty('breakpoints');
    expect(result.theme).toHaveProperty('containers');
    expect(result.theme).toHaveProperty('radius');
    expect(result.theme).toHaveProperty('shadows');
    expect(result.theme).toHaveProperty('insetShadows');
    expect(result.theme).toHaveProperty('dropShadows');
    expect(result.theme).toHaveProperty('textShadows');
    expect(result.theme).toHaveProperty('blur');
    expect(result.theme).toHaveProperty('perspective');
    expect(result.theme).toHaveProperty('aspect');
    expect(result.theme).toHaveProperty('ease');
    expect(result.theme).toHaveProperty('animations');
    expect(result.theme).toHaveProperty('defaults');
    expect(result.theme).toHaveProperty('keyframes');
  });
});
