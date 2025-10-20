/**
 * Unit tests for shared file generator module
 * Tests theme file generation, conflict reporting, and error handling
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { generateThemeFiles } from '../../../../src/v4/shared/file-generator';

describe('generateThemeFiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'file-gen-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should generate types.ts file', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      false,
      false,
      false,
      false,
    );

    const typesContent = await readFile(join(outputDir, 'types.ts'), 'utf-8');

    expect(result.files).toContain(inputFile);
    expect(typesContent).toContain('export interface DefaultTheme');
  });

  it('should generate runtime files when generateRuntime is true', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    await generateThemeFiles(
      inputFile,
      outputDir,
      false,
      { variants: true, selectors: true, files: false, variables: false },
      false,
      false,
    );

    const themeContent = await readFile(join(outputDir, 'theme.ts'), 'utf-8');
    const indexContent = await readFile(join(outputDir, 'index.ts'), 'utf-8');

    expect(themeContent).toContain('export const');
    expect(indexContent).toContain("export type * from './types'");
    expect(indexContent).toContain("export * from './theme'");
  });

  it('should skip runtime files when generateRuntime is false', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    await generateThemeFiles(inputFile, outputDir, false, false, false, false);

    const { existsSync } = await import('node:fs');

    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
    expect(existsSync(join(outputDir, 'theme.ts'))).toBe(false);
    expect(existsSync(join(outputDir, 'index.ts'))).toBe(false);
  });

  it('should resolve imports when enabled', async () => {
    const baseFile = join(tempDir, 'base.css');
    const mainFile = join(tempDir, 'main.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(baseFile, '@theme { --color-secondary: red; }', 'utf-8');
    await writeFile(
      mainFile,
      `@import "./base.css";\n@theme { --color-primary: blue; }`,
      'utf-8',
    );

    const result = await generateThemeFiles(
      mainFile,
      outputDir,
      true,
      false,
      false,
      false,
    );

    expect(result.files).toContain(mainFile);
    expect(result.files).toContain(baseFile);
  });

  it('should skip imports when resolveImports is false', async () => {
    const baseFile = join(tempDir, 'base.css');
    const mainFile = join(tempDir, 'main.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(baseFile, '@theme { --color-secondary: red; }', 'utf-8');
    await writeFile(
      mainFile,
      `@import "./base.css";\n@theme { --color-primary: blue; }`,
      'utf-8',
    );

    const result = await generateThemeFiles(
      mainFile,
      outputDir,
      false,
      false,
      false,
      false,
    );

    expect(result.files).toContain(mainFile);
    expect(result.files).not.toContain(baseFile);
  });

  it('should create output directory if it does not exist', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'nested', 'output', 'dir');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    await generateThemeFiles(inputFile, outputDir, false, false, false, false);

    const { existsSync } = await import('node:fs');

    expect(existsSync(outputDir)).toBe(true);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should handle non-existent input file with error', async () => {
    const inputFile = join(tempDir, 'missing.css');
    const outputDir = join(tempDir, 'output');

    expect(
      generateThemeFiles(inputFile, outputDir, false, false, false, false),
    ).rejects.toThrow();
  });

  it('should return files array from result', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      false,
      false,
      false,
      false,
    );

    expect(result).toHaveProperty('files');
    expect(Array.isArray(result.files)).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('should work with debug mode enabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      false,
      false,
      false,
      true,
    );

    expect(result.files).toContain(inputFile);
  });

  it('should use custom basePath when provided', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');
    const customBasePath = tempDir;

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      false,
      false,
      false,
      false,
      customBasePath,
    );

    expect(result.files).toContain(inputFile);
  });

  it('should handle empty CSS file', async () => {
    const inputFile = join(tempDir, 'empty.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '', 'utf-8');

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      false,
      false,
      false,
      false,
    );

    expect(result.files).toContain(inputFile);

    const typesContent = await readFile(join(outputDir, 'types.ts'), 'utf-8');
    expect(typesContent).toContain('export interface DefaultTheme');
  });

  it('should handle runtime options with all flags enabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    await generateThemeFiles(
      inputFile,
      outputDir,
      false,
      { variants: true, selectors: true, files: true, variables: true },
      false,
      false,
    );

    const themeContent = await readFile(join(outputDir, 'theme.ts'), 'utf-8');

    expect(themeContent).toContain('export const');
  });

  it('should handle runtime options with selective flags', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    await generateThemeFiles(
      inputFile,
      outputDir,
      false,
      { variants: true, selectors: false, files: false, variables: false },
      false,
      false,
    );

    const themeContent = await readFile(join(outputDir, 'theme.ts'), 'utf-8');

    expect(themeContent).toContain('export const');
  });

  it('should generate conflict reports by default when conflicts exist', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    // CSS with conflicts: variable + direct rule
    const cssWithConflicts = `
      @theme { --radius-lg: 0.5rem; }
      .theme-mono {
        --radius-lg: 0.45em;
        .rounded-lg { border-radius: 0; }
      }
    `;

    await writeFile(inputFile, cssWithConflicts, 'utf-8');

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      false,
      false,
      false,
      false,
    );

    const { existsSync } = await import('node:fs');

    // Reports should be generated by default
    expect(result.conflictCount).toBeGreaterThan(0);
    expect(existsSync(join(outputDir, 'conflicts.md'))).toBe(true);
    expect(existsSync(join(outputDir, 'conflicts.json'))).toBe(true);
  });

  it('should skip conflict reports when disabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    const cssWithConflicts = `
      @theme { --radius-lg: 0.5rem; }
      .theme-mono {
        --radius-lg: 0.45em;
        .rounded-lg { border-radius: 0; }
      }
    `;

    await writeFile(inputFile, cssWithConflicts, 'utf-8');

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      false,
      false,
      false,
      false,
      undefined,
      { conflicts: false, unresolved: true },
    );

    const { existsSync } = await import('node:fs');

    // Conflict reports should not be generated
    expect(result.conflictCount).toBeUndefined();
    expect(existsSync(join(outputDir, 'conflicts.md'))).toBe(false);
    expect(existsSync(join(outputDir, 'conflicts.json'))).toBe(false);
  });

  it('should skip unresolved reports when disabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    const cssWithUnresolved = `
      @theme {
        --font-sans: var(--font-inter);
        --color-primary: blue;
      }
    `;

    await writeFile(inputFile, cssWithUnresolved, 'utf-8');

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      false,
      false,
      false,
      false,
      undefined,
      { conflicts: true, unresolved: false },
    );

    const { existsSync } = await import('node:fs');

    // Unresolved reports should not be generated
    expect(result.unresolvedCount).toBeUndefined();
    expect(existsSync(join(outputDir, 'unresolved.md'))).toBe(false);
    expect(existsSync(join(outputDir, 'unresolved.json'))).toBe(false);
  });

  it('should skip all reports when both disabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    const cssWithIssues = `
      @theme {
        --font-sans: var(--font-inter);
        --radius-lg: 0.5rem;
      }
      .theme-mono {
        .rounded-lg { border-radius: 0; }
      }
    `;

    await writeFile(inputFile, cssWithIssues, 'utf-8');

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      false,
      false,
      false,
      false,
      undefined,
      { conflicts: false, unresolved: false },
    );

    const { existsSync } = await import('node:fs');

    // No reports should be generated
    expect(result.conflictCount).toBeUndefined();
    expect(result.unresolvedCount).toBeUndefined();
    expect(existsSync(join(outputDir, 'conflicts.md'))).toBe(false);
    expect(existsSync(join(outputDir, 'conflicts.json'))).toBe(false);
    expect(existsSync(join(outputDir, 'unresolved.md'))).toBe(false);
    expect(existsSync(join(outputDir, 'unresolved.json'))).toBe(false);
  });
});
