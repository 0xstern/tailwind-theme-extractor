/**
 * Unit tests for CSS import resolver
 * Tests recursive @import resolution, circular import prevention, and error handling
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import postcss from 'postcss';

import { resolveImports } from '../../../../src/v4/parser/import-resolver';

// Temp directory for test files
let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'import-resolver-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('resolveImports - Basic functionality', () => {
  test('resolves single @import statement', async () => {
    await writeFile(
      join(tempDir, 'imported.css'),
      '@theme { --color-primary: blue; }',
    );

    const root = postcss.parse('@import "imported.css";');
    const files = await resolveImports(root, tempDir);

    expect(files).toHaveLength(1);
    expect(files[0]).toBe(join(tempDir, 'imported.css'));

    // Import should be replaced with imported content
    const hasImportRule = root.nodes.some(
      (node) => node.type === 'atrule' && node.name === 'import',
    );
    expect(hasImportRule).toBe(false);

    // Should contain the imported @theme rule
    const hasThemeRule = root.nodes.some(
      (node) => node.type === 'atrule' && node.name === 'theme',
    );
    expect(hasThemeRule).toBe(true);
  });

  test('resolves multiple @import statements', async () => {
    await writeFile(join(tempDir, 'file1.css'), '--color-a: red;');
    await writeFile(join(tempDir, 'file2.css'), '--color-b: blue;');

    const root = postcss.parse(`
      @import "file1.css";
      @import "file2.css";
    `);

    const files = await resolveImports(root, tempDir);
    const EXPECTED_FILE_COUNT = 2;

    expect(files).toHaveLength(EXPECTED_FILE_COUNT);
    expect(files).toContain(join(tempDir, 'file1.css'));
    expect(files).toContain(join(tempDir, 'file2.css'));
  });

  test('returns empty array when no imports present', async () => {
    const root = postcss.parse('@theme { --color-primary: blue; }');
    const files = await resolveImports(root, tempDir);

    expect(files).toHaveLength(0);
  });
});

describe('resolveImports - Import path parsing', () => {
  test('handles double-quoted paths', async () => {
    await writeFile(join(tempDir, 'test.css'), '--color: red;');

    const root = postcss.parse('@import "test.css";');
    const files = await resolveImports(root, tempDir);

    expect(files).toHaveLength(1);
  });

  test('handles single-quoted paths', async () => {
    await writeFile(join(tempDir, 'test.css'), '--color: red;');

    const root = postcss.parse("@import 'test.css';");
    const files = await resolveImports(root, tempDir);

    expect(files).toHaveLength(1);
  });

  test('handles url() syntax with double quotes', async () => {
    await writeFile(join(tempDir, 'test.css'), '--color: red;');

    const root = postcss.parse('@import url("test.css");');
    const files = await resolveImports(root, tempDir);

    expect(files).toHaveLength(1);
  });

  test('handles url() syntax with single quotes', async () => {
    await writeFile(join(tempDir, 'test.css'), '--color: red;');

    const root = postcss.parse("@import url('test.css');");
    const files = await resolveImports(root, tempDir);

    expect(files).toHaveLength(1);
  });

  test('handles url() syntax without quotes', async () => {
    await writeFile(join(tempDir, 'test.css'), '--color: red;');

    const root = postcss.parse('@import url(test.css);');
    const files = await resolveImports(root, tempDir);

    expect(files).toHaveLength(1);
  });

  test('handles relative paths', async () => {
    const subDir = join(tempDir, 'styles');
    await writeFile(subDir + '.css', '--color: red;', { flag: 'w' });
    await rm(subDir + '.css');

    await writeFile(join(tempDir, 'styles.css'), '--color: red;');

    const root = postcss.parse('@import "./styles.css";');
    const files = await resolveImports(root, tempDir);

    expect(files).toHaveLength(1);
  });
});

describe('resolveImports - Nested imports', () => {
  test('resolves nested imports recursively', async () => {
    await writeFile(join(tempDir, 'level3.css'), '--color-c: green;');
    await writeFile(
      join(tempDir, 'level2.css'),
      '@import "level3.css";\n--color-b: blue;',
    );
    await writeFile(
      join(tempDir, 'level1.css'),
      '@import "level2.css";\n--color-a: red;',
    );

    const root = postcss.parse('@import "level1.css";');
    const files = await resolveImports(root, tempDir);
    const EXPECTED_NESTED_COUNT = 3;

    expect(files).toHaveLength(EXPECTED_NESTED_COUNT);
    expect(files).toContain(join(tempDir, 'level1.css'));
    expect(files).toContain(join(tempDir, 'level2.css'));
    expect(files).toContain(join(tempDir, 'level3.css'));
  });

  test('tracks depth parameter correctly', async () => {
    await writeFile(join(tempDir, 'file.css'), '--color: red;');

    const root = postcss.parse('@import "file.css";');
    const TEST_DEPTH = 10;

    // Start at depth 10
    const files = await resolveImports(
      root,
      tempDir,
      new Set(),
      false,
      TEST_DEPTH,
    );

    expect(files).toHaveLength(1);
  });
});

describe('resolveImports - Circular import prevention', () => {
  test('prevents circular imports using processedFiles set', async () => {
    const file1Path = join(tempDir, 'file1.css');
    const file2Path = join(tempDir, 'file2.css');

    await writeFile(file1Path, '@import "file2.css";');
    await writeFile(file2Path, '@import "file1.css";');

    const root = postcss.parse('@import "file1.css";');
    const processedFiles = new Set<string>();

    const files = await resolveImports(root, tempDir, processedFiles);
    const MAX_CIRCULAR_FILES = 2;

    // Should process file1 and file2 once each, then stop
    expect(files.length).toBeLessThanOrEqual(MAX_CIRCULAR_FILES);
    expect(processedFiles.has(file1Path)).toBe(true);
  });

  test('skips already processed files', async () => {
    await writeFile(join(tempDir, 'file.css'), '--color: red;');

    const filePath = join(tempDir, 'file.css');
    const processedFiles = new Set([filePath]);

    const root = postcss.parse('@import "file.css";');
    const files = await resolveImports(root, tempDir, processedFiles);

    // Should skip because already in processedFiles
    expect(files).toHaveLength(0);
  });
});

describe('resolveImports - Error handling', () => {
  test('silently removes @import for missing file', async () => {
    const root = postcss.parse(`
      @import "non-existent.css";
      @theme { --color-primary: blue; }
    `);

    const files = await resolveImports(root, tempDir, new Set(), false);

    expect(files).toHaveLength(0);

    // Import should be removed
    const hasImportRule = root.nodes.some(
      (node) => node.type === 'atrule' && node.name === 'import',
    );
    expect(hasImportRule).toBe(false);

    // Theme rule should still be present
    const hasThemeRule = root.nodes.some(
      (node) => node.type === 'atrule' && node.name === 'theme',
    );
    expect(hasThemeRule).toBe(true);
  });

  test('continues processing other imports when one fails', async () => {
    await writeFile(join(tempDir, 'valid.css'), '--color: blue;');

    const root = postcss.parse(`
      @import "non-existent.css";
      @import "valid.css";
    `);

    const files = await resolveImports(root, tempDir);

    expect(files).toHaveLength(1);
    expect(files[0]).toBe(join(tempDir, 'valid.css'));
  });

  test('handles invalid CSS in imported file gracefully', async () => {
    await writeFile(join(tempDir, 'invalid.css'), '{ invalid css }');

    const root = postcss.parse('@import "invalid.css";');
    const files = await resolveImports(root, tempDir, new Set(), false);

    // Should remove the import rule when parsing fails
    expect(files).toHaveLength(0);
  });

  test('throws error when import depth exceeds maximum', async () => {
    await writeFile(join(tempDir, 'file.css'), '--color: red;');

    const root = postcss.parse('@import "file.css";');
    const EXCEEDED_DEPTH = 51;

    // Start at depth 51 (exceeds MAX_IMPORT_DEPTH of 50)
    await expect(
      resolveImports(root, tempDir, new Set(), false, EXCEEDED_DEPTH),
    ).rejects.toThrow(/Import depth exceeded maximum/);
  });

  test('enforces maximum import depth of 50 levels', async () => {
    const MAX_IMPORT_DEPTH = 50;
    const CHAIN_LENGTH = 52;
    const FIRST_FILE_INDEX = 0;
    const LAST_PROCESSED_INDEX = 49;

    // Create a deep chain: level1 -> level2 -> ... -> level52
    // Each file imports the next one
    for (let i = CHAIN_LENGTH; i > 0; i--) {
      const content =
        i === CHAIN_LENGTH ? '--color: final;' : `@import "level${i + 1}.css";`;
      await writeFile(join(tempDir, `level${i}.css`), content);
    }

    const root = postcss.parse('@import "level1.css";');
    const files = await resolveImports(root, tempDir, new Set(), false, 0);

    // Should process exactly 50 files (level1 through level50)
    // level51 and level52 are beyond the depth limit and won't be processed
    // The depth limit throws an error which is caught and handled gracefully
    expect(files).toHaveLength(MAX_IMPORT_DEPTH);

    // Verify we got level1 through level50
    expect(files[FIRST_FILE_INDEX]).toContain('level1.css');
    expect(files[LAST_PROCESSED_INDEX]).toContain('level50.css');

    // level51 and level52 should NOT be in the list
    expect(files.some((f) => f.includes('level51.css'))).toBe(false);
    expect(files.some((f) => f.includes('level52.css'))).toBe(false);
  });
});

describe('resolveImports - Debug mode', () => {
  test('debug mode does not throw on missing file', async () => {
    const root = postcss.parse('@import "missing.css";');

    // Should not throw even with debug enabled
    const files = await resolveImports(root, tempDir, new Set(), true);

    expect(files).toHaveLength(0);
  });

  test('debug mode processes valid files normally', async () => {
    await writeFile(join(tempDir, 'file.css'), '--color: red;');

    const root = postcss.parse('@import "file.css";');
    const files = await resolveImports(root, tempDir, new Set(), true);

    expect(files).toHaveLength(1);
  });
});

describe('resolveImports - Tailwind imports', () => {
  test('skips tailwindcss imports', async () => {
    const root = postcss.parse(`
      @import "tailwindcss";
      @import "tailwindcss/theme";
      @import "tailwindcss/utilities";
    `);

    const files = await resolveImports(root, tempDir);
    const TAILWIND_IMPORT_COUNT = 3;

    // Tailwind imports are skipped, so no files are resolved
    expect(files).toHaveLength(0);

    // Tailwind imports should still be in the AST (they're just skipped, not removed)
    const importRules = root.nodes.filter(
      (node) => node.type === 'atrule' && node.name === 'import',
    );
    expect(importRules.length).toBe(TAILWIND_IMPORT_COUNT);
  });

  test('processes non-tailwind imports alongside tailwind imports', async () => {
    await writeFile(join(tempDir, 'custom.css'), '--color: red;');

    const root = postcss.parse(`
      @import "tailwindcss";
      @import "custom.css";
    `);

    const files = await resolveImports(root, tempDir);
    const EXPECTED_CUSTOM_FILES = 1;

    expect(files).toHaveLength(EXPECTED_CUSTOM_FILES);
    expect(files[0]).toBe(join(tempDir, 'custom.css'));
  });
});

describe('resolveImports - Parallel processing', () => {
  test('processes multiple imports in parallel', async () => {
    await writeFile(join(tempDir, 'file1.css'), '--color-1: red;');
    await writeFile(join(tempDir, 'file2.css'), '--color-2: blue;');
    await writeFile(join(tempDir, 'file3.css'), '--color-3: green;');

    const root = postcss.parse(`
      @import "file1.css";
      @import "file2.css";
      @import "file3.css";
    `);

    const startTime = Date.now();
    const files = await resolveImports(root, tempDir);
    const duration = Date.now() - startTime;
    const EXPECTED_PARALLEL_FILES = 3;
    const REASONABLE_DURATION_MS = 1000;

    expect(files).toHaveLength(EXPECTED_PARALLEL_FILES);

    // Parallel processing should be faster than sequential
    // (This is a smoke test - actual timing depends on system)
    expect(duration).toBeLessThan(REASONABLE_DURATION_MS);
  });
});

describe('resolveImports - AST manipulation', () => {
  test('replaces @import with imported content', async () => {
    await writeFile(
      join(tempDir, 'imported.css'),
      `:root { --color-primary: blue; }`,
    );

    const root = postcss.parse('@import "imported.css";');
    await resolveImports(root, tempDir);

    // Should have :root rule instead of @import
    const hasRootRule = root.nodes.some(
      (node) => node.type === 'rule' && node.selector === ':root',
    );
    expect(hasRootRule).toBe(true);
  });

  test('preserves original file order', async () => {
    await writeFile(join(tempDir, 'file1.css'), '/* File 1 */');
    await writeFile(join(tempDir, 'file2.css'), '/* File 2 */');

    const root = postcss.parse(`
      @import "file1.css";
      /* Original comment */
      @import "file2.css";
    `);

    await resolveImports(root, tempDir);

    const comments = root.nodes
      .filter((node) => node.type === 'comment')
      .map((node) => ('text' in node ? node.text : ''));

    // Comments should be in the order they appear
    expect(comments[0]).toContain('File 1');
    expect(comments[1]).toContain('Original comment');
    expect(comments[2]).toContain('File 2');
  });

  test('handles empty imported files', async () => {
    await writeFile(join(tempDir, 'empty.css'), '');

    const root = postcss.parse('@import "empty.css";');
    const files = await resolveImports(root, tempDir);

    expect(files).toHaveLength(1);

    // Import should be removed (replaced with empty content)
    const hasImportRule = root.nodes.some(
      (node) => node.type === 'atrule' && node.name === 'import',
    );
    expect(hasImportRule).toBe(false);
  });

  test('handles imported files with only comments', async () => {
    await writeFile(join(tempDir, 'comments.css'), '/* Just a comment */');

    const root = postcss.parse('@import "comments.css";');
    await resolveImports(root, tempDir);

    const hasComment = root.nodes.some((node) => node.type === 'comment');
    expect(hasComment).toBe(true);
  });
});

describe('resolveImports - Edge cases', () => {
  test('handles imports with whitespace in path', async () => {
    const fileName = 'file with spaces.css';
    await writeFile(join(tempDir, fileName), '--color: red;');

    const root = postcss.parse(`@import "${fileName}";`);
    const files = await resolveImports(root, tempDir);

    expect(files).toHaveLength(1);
  });

  test('resolves imports with different base paths', async () => {
    const subDir = join(tempDir, 'subdirectory');
    await Bun.write(join(subDir, 'file.css'), '--color: red;');

    const root = postcss.parse('@import "file.css";');
    const files = await resolveImports(root, subDir);

    expect(files).toHaveLength(1);
    expect(files[0]).toBe(join(subDir, 'file.css'));
  });

  test('handles malformed @import statements', async () => {
    const root = postcss.parse(`
      @import;
      @import "";
      @theme { --color: blue; }
    `);

    const files = await resolveImports(root, tempDir, new Set(), false);

    // Should handle gracefully and not crash
    expect(files).toHaveLength(0);
  });
});

describe('resolveImports - Return value', () => {
  test('returns array of imported file paths', async () => {
    await writeFile(join(tempDir, 'file.css'), '--color: red;');

    const root = postcss.parse('@import "file.css";');
    const files = await resolveImports(root, tempDir);

    expect(Array.isArray(files)).toBe(true);
    expect(files[0]).toBe(join(tempDir, 'file.css'));
  });

  test('includes nested imports in return array', async () => {
    await writeFile(join(tempDir, 'level2.css'), '--color-b: blue;');
    await writeFile(
      join(tempDir, 'level1.css'),
      '@import "level2.css";\n--color-a: red;',
    );

    const root = postcss.parse('@import "level1.css";');
    const files = await resolveImports(root, tempDir);

    expect(files).toContain(join(tempDir, 'level1.css'));
    expect(files).toContain(join(tempDir, 'level2.css'));
  });
});
