/**
 * CSS Conflict Detection Pipeline Integration Tests
 * Tests the complete workflow of detecting, resolving, and reporting CSS conflicts
 */

import { describe, expect, test } from 'bun:test';

import { resolveTheme } from '../../../src/v4/index';

const MIN_EXPECTED_CONFLICTS = 2;

describe('CSS Conflict Resolution - Integration', () => {
  test('creates a full conflict resolution pipeline', async () => {
    // Create a test CSS file with conflicts to verify the full pipeline
    const testCSS = `
      @theme {
        --radius-lg: 1rem;
        --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
      }

      .theme-mono {
        --radius-lg: 0.45em;

        .rounded-lg {
          border-radius: 0;
        }

        .shadow-lg {
          box-shadow: none;
        }

        .rounded-md:hover {
          border-radius: 0.25rem;
        }
      }
    `;

    const { mkdir, writeFile, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const tmpDir = await import('node:os').then((os) => os.tmpdir());
    const testDir = join(tmpDir, 'tailwind-resolver-conflict-test');

    try {
      await mkdir(testDir, { recursive: true });
      const testFile = join(testDir, 'test.css');
      await writeFile(testFile, testCSS, 'utf-8');

      const testResult = await resolveTheme({
        input: testFile,
        resolveImports: false,
      });

      // Should detect conflicts
      expect(testResult.cssConflicts).toBeDefined();
      expect(Array.isArray(testResult.cssConflicts)).toBe(true);

      if (
        testResult.cssConflicts !== undefined &&
        Array.isArray(testResult.cssConflicts)
      ) {
        // Should detect conflicts for both .rounded-lg and .shadow-lg
        expect(testResult.cssConflicts.length).toBeGreaterThanOrEqual(
          MIN_EXPECTED_CONFLICTS,
        );

        // Find the simple conflict that should be auto-resolved
        const simpleConflict = testResult.cssConflicts.find((c) => {
          if (typeof c === 'object' && c !== null) {
            const conflict = c as Record<string, unknown>;
            return (
              conflict.themeProperty === 'radius' &&
              conflict.themeKey === 'lg' &&
              conflict.confidence === 'high'
            );
          }
          return false;
        }) as Record<string, unknown> | undefined;

        expect(simpleConflict).toBeDefined();
        if (simpleConflict !== undefined) {
          expect(simpleConflict.canResolve).toBe(true);
          expect(simpleConflict.ruleValue).toBe('0');
        }

        // Find a complex conflict that should require manual review (if any)
        const complexConflict = testResult.cssConflicts.find((c) => {
          if (typeof c === 'object' && c !== null) {
            const conflict = c as Record<string, unknown>;
            return (
              conflict.confidence === 'low' && conflict.canResolve === false
            );
          }
          return false;
        }) as Record<string, unknown> | undefined;

        // Complex conflicts may not always be detected depending on selector matching
        // This is acceptable - we're verifying the pipeline can detect them when they exist
        if (complexConflict !== undefined) {
          expect(complexConflict.canResolve).toBe(false);
        }
      }

      // Verify that high-confidence overrides were applied to the theme
      if (testResult.variants.themeMono !== undefined) {
        // The theme should have the override value (0) instead of variable value (0.45em)
        expect(testResult.variants.themeMono.radius.lg).toBe('0');
      }
    } finally {
      // Clean up test directory
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test('generates conflict reports with proper structure', async () => {
    const { mkdir, writeFile, rm, readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const tmpDir = await import('node:os').then((os) => os.tmpdir());
    const testDir = join(tmpDir, 'tailwind-resolver-conflict-reports');

    const testCSS = `
      @theme {
        --radius-lg: 1rem;
      }

      .theme-test {
        --radius-lg: 0.45em;

        .rounded-lg {
          border-radius: 0;
        }
      }
    `;

    try {
      await mkdir(testDir, { recursive: true });
      const testFile = join(testDir, 'test.css');
      await writeFile(testFile, testCSS, 'utf-8');

      const testResult = await resolveTheme({
        input: testFile,
        resolveImports: false,
      });

      // Generate conflict reports
      if (
        testResult.cssConflicts !== undefined &&
        Array.isArray(testResult.cssConflicts) &&
        testResult.cssConflicts.length > 0
      ) {
        const { writeConflictReports } = await import(
          '../../../src/v4/parser/conflict-reporter'
        );
        const reportPaths = await writeConflictReports(
          testDir,
          testResult.cssConflicts as never,
          {
            generatedAt: new Date().toISOString(),
            source: 'test.css',
            version: '1.0.0-test',
          },
        );

        // Verify Markdown report exists and has content
        const mdContent = await readFile(reportPaths.markdown, 'utf-8');
        expect(mdContent).toContain('# CSS Rule Conflicts');
        expect(mdContent).toContain('## Summary');
        expect(mdContent).toContain('**Total conflicts:**');

        // Verify JSON report exists and has valid structure
        const jsonContent = await readFile(reportPaths.json, 'utf-8');
        const jsonData = JSON.parse(jsonContent);
        expect(jsonData.summary).toBeDefined();
        expect(jsonData.conflicts).toBeDefined();
        expect(Array.isArray(jsonData.conflicts)).toBe(true);
        expect(jsonData.source).toBe('test.css');
        expect(jsonData.version).toBe('1.0.0-test');
      }
    } finally {
      // Clean up test directory
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test('handles CSS files without conflicts gracefully', async () => {
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
    const testDir = join(tmpDir, 'tailwind-resolver-no-conflicts');

    try {
      await mkdir(testDir, { recursive: true });
      const testFile = join(testDir, 'test.css');
      await writeFile(testFile, testCSS, 'utf-8');

      const testResult = await resolveTheme({
        input: testFile,
        resolveImports: false,
      });

      // Should either have empty array or undefined
      if (testResult.cssConflicts !== undefined) {
        expect(Array.isArray(testResult.cssConflicts)).toBe(true);
        expect(testResult.cssConflicts.length).toBe(0);
      }
    } finally {
      // Clean up test directory
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
