/**
 * Unit tests for CLI module
 * Tests argument parsing, validation, and file generation workflow
 */

import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

describe('CLI - File generation integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should generate theme files from CSS input', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    // Import and use generateThemeFiles directly since we can't easily test CLI process
    const { generateThemeFiles } = await import(
      '../../../../src/v4/shared/file-generator'
    );

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      { variants: true, selectors: true, files: false, variables: false },
      false,
      false,
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
    expect(existsSync(join(outputDir, 'theme.ts'))).toBe(true);
    expect(existsSync(join(outputDir, 'index.ts'))).toBe(true);
  });

  it('should generate types only when runtime is disabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../../src/v4/shared/file-generator'
    );

    await generateThemeFiles(inputFile, outputDir, true, false, false, false);

    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
    expect(existsSync(join(outputDir, 'theme.ts'))).toBe(false);
    expect(existsSync(join(outputDir, 'index.ts'))).toBe(false);
  });

  it('should include debug data when debug mode is enabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../../src/v4/shared/file-generator'
    );

    await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      { variants: true, selectors: true, files: true, variables: true },
      false,
      true,
    );

    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
    expect(existsSync(join(outputDir, 'theme.ts'))).toBe(true);
  });

  it('should auto-detect output directory when not specified', async () => {
    const { autoDetectOutputDir } = await import(
      '../../../../src/v4/shared/utils'
    );

    const result = autoDetectOutputDir(tempDir);

    expect(result).toMatch(/^(src\/)?generated\/tailwindcss$/);
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

    const { generateThemeFiles } = await import(
      '../../../../src/v4/shared/file-generator'
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

  it('should handle missing input file with error', async () => {
    const inputFile = join(tempDir, 'missing.css');
    const outputDir = join(tempDir, 'output');

    const { generateThemeFiles } = await import(
      '../../../../src/v4/shared/file-generator'
    );

    expect(
      generateThemeFiles(inputFile, outputDir, true, false, false, false),
    ).rejects.toThrow();
  });

  it('should create output directory if it does not exist', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'nested', 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../../src/v4/shared/file-generator'
    );

    await generateThemeFiles(inputFile, outputDir, true, false, false, false);

    expect(existsSync(outputDir)).toBe(true);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should handle empty CSS file', async () => {
    const inputFile = join(tempDir, 'empty.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../../src/v4/shared/file-generator'
    );

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      false,
      false,
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should generate runtime with production defaults', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../../src/v4/shared/file-generator'
    );

    await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      { variants: true, selectors: true, files: false, variables: false },
      false,
      false,
    );

    const themeContent = await Bun.file(join(outputDir, 'theme.ts')).text();

    expect(themeContent).toContain('export const variants');
    expect(themeContent).toContain('export const selectors');
    expect(themeContent).not.toContain('export const files');
    expect(themeContent).not.toContain('export const variables');
  });

  it('should generate runtime with debug data when enabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../../src/v4/shared/file-generator'
    );

    await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      { variants: true, selectors: true, files: true, variables: true },
      false,
      false,
    );

    const themeContent = await Bun.file(join(outputDir, 'theme.ts')).text();

    expect(themeContent).toContain('export const variants');
    expect(themeContent).toContain('export const selectors');
    expect(themeContent).toContain('export const files');
    expect(themeContent).toContain('export const variables');
  });

  it('should use custom base path for node_modules resolution', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');
    const customBasePath = tempDir;

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../../src/v4/shared/file-generator'
    );

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      false,
      false,
      customBasePath,
    );

    expect(result.files).toContain(inputFile);
  });
});

describe('CLI - Utility functions', () => {
  it('should normalize runtime options correctly', async () => {
    const { normalizeRuntimeOptions } = await import(
      '../../../../src/v4/shared/utils'
    );

    const productionOptions = normalizeRuntimeOptions(true);
    expect(productionOptions).toEqual({
      variants: true,
      selectors: true,
      files: false,
      variables: false,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });

    const debugOptions = normalizeRuntimeOptions({
      variants: true,
      selectors: true,
      files: true,
      variables: true,
    });
    expect(debugOptions).toEqual({
      variants: true,
      selectors: true,
      files: true,
      variables: true,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });

    const noRuntime = normalizeRuntimeOptions(false);
    expect(noRuntime).toBe(false);
  });

  it('should detect output directory correctly', async () => {
    const { autoDetectOutputDir } = await import(
      '../../../../src/v4/shared/utils'
    );

    const result = autoDetectOutputDir(process.cwd());

    expect(result).toMatch(/^(src\/)?generated\/tailwindcss$/);
  });
});

describe('CLI - Constants', () => {
  it('should have correct output file names', async () => {
    const { OUTPUT_FILES } = await import(
      '../../../../src/v4/shared/constants'
    );

    expect(OUTPUT_FILES.TYPES).toBe('types.ts');
    expect(OUTPUT_FILES.THEME).toBe('theme.ts');
    expect(OUTPUT_FILES.INDEX).toBe('index.ts');
  });
});
