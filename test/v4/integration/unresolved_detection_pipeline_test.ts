/**
 * Unresolved Variable Detection Pipeline Integration Tests
 * Tests the complete workflow of detecting, categorizing, and reporting unresolved variables
 */

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4';
import { isUnresolvedReportJSON } from '../../../src/v4/core/reporting/unresolved';

/**
 * Safely parse and validate JSON with type guard
 *
 * @param jsonString - The JSON string to parse
 * @param guard - Type guard function to validate the parsed data
 * @returns The validated, type-safe parsed data
 */
function parseJSON<T>(
  jsonString: string,
  guard: (data: unknown) => data is T,
): T {
  const parsed: unknown = JSON.parse(jsonString);
  if (!guard(parsed)) {
    throw new Error('JSON data failed type validation');
  }
  return parsed;
}

const MIN_EXPECTED_UNRESOLVED = 4;
const MIN_EXPECTED_VARIANT_UNRESOLVED = 2;

describe('Unresolved Variable Detection - Integration', () => {
  test('detects unresolved variables in the full pipeline', async () => {
    // Create a test CSS file with various unresolved variable scenarios
    const testCSS = `
      @theme {
        --font-sans: var(--font-inter);
        --font-mono: var(--font-jetbrains);
        --color-primary: #3b82f6;
      }

      .theme-custom {
        --spacing-base: var(--custom-spacing);
        --color-accent: var(--tw-color-accent);
      }
    `;

    const { mkdir, writeFile, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const tmpDir = await import('node:os').then((os) => os.tmpdir());
    const testDir = join(tmpDir, 'tailwind-resolver-unresolved-test');

    try {
      await mkdir(testDir, { recursive: true });
      const testFile = join(testDir, 'test.css');
      await writeFile(testFile, testCSS, 'utf-8');

      const testResult = await resolveTheme({
        input: testFile,
        resolveImports: false,
        includeTailwindDefaults: false,
      });

      // Should detect unresolved variables
      expect(testResult.unresolvedVariables).toBeDefined();
      expect(Array.isArray(testResult.unresolvedVariables)).toBe(true);

      if (
        testResult.unresolvedVariables !== undefined &&
        Array.isArray(testResult.unresolvedVariables)
      ) {
        // Should detect at least 4 unresolved variables
        expect(testResult.unresolvedVariables.length).toBeGreaterThanOrEqual(
          MIN_EXPECTED_UNRESOLVED,
        );

        // Find unknown cause variable (font-inter)
        const unknownVar = testResult.unresolvedVariables.find((v) => {
          if (typeof v === 'object' && v !== null) {
            const variable = v as Record<string, unknown>;
            return (
              variable.variableName === '--font-sans' &&
              variable.referencedVariable === '--font-inter' &&
              variable.likelyCause === 'unknown'
            );
          }
          return false;
        }) as Record<string, unknown> | undefined;

        expect(unknownVar).toBeDefined();
        if (unknownVar !== undefined) {
          expect(unknownVar.source).toBe('theme');
        }

        // Find external cause variable (--tw- prefix)
        const externalVar = testResult.unresolvedVariables.find((v) => {
          if (typeof v === 'object' && v !== null) {
            const variable = v as Record<string, unknown>;
            return (
              variable.referencedVariable === '--tw-color-accent' &&
              variable.likelyCause === 'external'
            );
          }
          return false;
        }) as Record<string, unknown> | undefined;

        expect(externalVar).toBeDefined();
        if (externalVar !== undefined) {
          expect(externalVar.source).toBe('variant');
        }
      }
    } finally {
      // Clean up test directory
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test('generates unresolved variable reports with proper structure', async () => {
    const { mkdir, writeFile, rm, readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const tmpDir = await import('node:os').then((os) => os.tmpdir());
    const testDir = join(tmpDir, 'tailwind-resolver-unresolved-reports');

    const testCSS = `
      @theme {
        --font-sans: var(--font-inter);
        --color-primary: var(--tw-primary);
      }
    `;

    try {
      await mkdir(testDir, { recursive: true });
      const testFile = join(testDir, 'test.css');
      await writeFile(testFile, testCSS, 'utf-8');

      const testResult = await resolveTheme({
        input: testFile,
        resolveImports: false,
        includeTailwindDefaults: false,
      });

      // Generate unresolved variable reports
      if (
        testResult.unresolvedVariables !== undefined &&
        Array.isArray(testResult.unresolvedVariables) &&
        testResult.unresolvedVariables.length > 0
      ) {
        const { writeUnresolvedReports } = await import(
          '../../../src/v4/core/reporting/unresolved'
        );
        const reportPaths = await writeUnresolvedReports(
          testDir,
          testResult.unresolvedVariables as never,
          {
            generatedAt: new Date().toISOString(),
            source: 'test.css',
            version: '1.0.0-test',
          },
        );

        // Verify Markdown report exists and has content
        const mdContent = await readFile(reportPaths.markdown, 'utf-8');
        expect(mdContent).toContain('# Unresolved CSS Variables');
        expect(mdContent).toContain('## Summary');
        expect(mdContent).toContain('**Total unresolved:**');
        expect(mdContent).toContain('--font-inter');
        expect(mdContent).toContain('--tw-primary');

        // Verify JSON report exists and has valid structure
        const jsonContent = await readFile(reportPaths.json, 'utf-8');
        const parsedData = parseJSON(jsonContent, isUnresolvedReportJSON);
        expect(parsedData.summary).toBeDefined();
        expect(parsedData.summary.total).toBeGreaterThan(0);
        expect(parsedData.unresolved).toBeDefined();
        expect(Array.isArray(parsedData.unresolved)).toBe(true);
        expect(parsedData.source).toBe('test.css');
        expect(parsedData.version).toBe('1.0.0-test');
      }
    } finally {
      // Clean up test directory
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test('handles CSS files without unresolved variables gracefully', async () => {
    const testCSS = `
      @theme {
        --radius-lg: 1rem;
        --color-primary: blue;
      }

      .theme-clean {
        --radius-md: 0.5rem;
        --color-secondary: red;
      }
    `;

    const { mkdir, writeFile, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const tmpDir = await import('node:os').then((os) => os.tmpdir());
    const testDir = join(tmpDir, 'tailwind-resolver-no-unresolved');

    try {
      await mkdir(testDir, { recursive: true });
      const testFile = join(testDir, 'test.css');
      await writeFile(testFile, testCSS, 'utf-8');

      const testResult = await resolveTheme({
        input: testFile,
        resolveImports: false,
        includeTailwindDefaults: false,
      });

      // Should either have empty array or undefined
      if (testResult.unresolvedVariables !== undefined) {
        expect(Array.isArray(testResult.unresolvedVariables)).toBe(true);
        expect(testResult.unresolvedVariables.length).toBe(0);
      }
    } finally {
      // Clean up test directory
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test('detects unresolved variables in variants', async () => {
    const testCSS = `
      @theme {
        --color-primary: blue;
      }

      .theme-custom {
        --font-heading: var(--font-display);
        --color-accent: var(--custom-accent);
      }
    `;

    const { mkdir, writeFile, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const tmpDir = await import('node:os').then((os) => os.tmpdir());
    const testDir = join(tmpDir, 'tailwind-resolver-variant-unresolved');

    try {
      await mkdir(testDir, { recursive: true });
      const testFile = join(testDir, 'test.css');
      await writeFile(testFile, testCSS, 'utf-8');

      const testResult = await resolveTheme({
        input: testFile,
        resolveImports: false,
        includeTailwindDefaults: false,
      });

      if (
        testResult.unresolvedVariables !== undefined &&
        Array.isArray(testResult.unresolvedVariables)
      ) {
        // Should detect variant-specific unresolved variables
        const variantVars = testResult.unresolvedVariables.filter((v) => {
          if (typeof v === 'object' && v !== null) {
            const variable = v as Record<string, unknown>;
            return (
              variable.source === 'variant' &&
              variable.variantName === 'theme-custom'
            );
          }
          return false;
        });

        expect(variantVars.length).toBeGreaterThanOrEqual(
          MIN_EXPECTED_VARIANT_UNRESOLVED,
        );
      }
    } finally {
      // Clean up test directory
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
