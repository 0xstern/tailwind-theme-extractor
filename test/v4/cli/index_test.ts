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
      '../../../src/v4/shared/file_generator'
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
      '../../../src/v4/shared/file_generator'
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
      '../../../src/v4/shared/file_generator'
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
      '../../../src/v4/shared/utils'
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
      '../../../src/v4/shared/file_generator'
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
      '../../../src/v4/shared/file_generator'
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
      '../../../src/v4/shared/file_generator'
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
      '../../../src/v4/shared/file_generator'
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
      '../../../src/v4/shared/file_generator'
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
      '../../../src/v4/shared/file_generator'
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
      '../../../src/v4/shared/file_generator'
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
      '../../../src/v4/shared/utils'
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
      '../../../src/v4/shared/utils'
    );

    const result = autoDetectOutputDir(process.cwd());

    expect(result).toMatch(/^(src\/)?generated\/tailwindcss$/);
  });
});

describe('CLI - Constants', () => {
  it('should have correct output file names', async () => {
    const { OUTPUT_FILES } = await import('../../../src/v4/shared/constants');

    expect(OUTPUT_FILES.TYPES).toBe('types.ts');
    expect(OUTPUT_FILES.THEME).toBe('theme.ts');
    expect(OUTPUT_FILES.INDEX).toBe('index.ts');
  });
});

describe('CLI - Granular Tailwind Defaults', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cli-defaults-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should accept boolean true for includeTailwindDefaults', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      true, // Include all defaults
      false,
    );

    // Should succeed
    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should exclude all Tailwind defaults when includeTailwindDefaults is false', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      false, // Exclude all defaults
      false,
    );

    const typesContent = await Bun.file(join(outputDir, 'types.ts')).text();

    // Should only have custom color
    expect(typesContent).toContain('custom');
    // Should not have Tailwind default colors
    expect(typesContent).not.toContain('slate');
    expect(typesContent).not.toContain('gray');
    expect(typesContent).not.toContain('zinc');
  });

  it('should accept granular options object for includeTailwindDefaults', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(
      inputFile,
      '@theme { --color-custom: red; --spacing-custom: 1rem; }',
      'utf-8',
    );

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      {
        colors: true,
        spacing: true,
        shadows: false,
        radius: false,
      },
      false,
    );

    // Should succeed
    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should exclude only specified Tailwind default categories', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      {
        colors: false, // Exclude colors
        spacing: true,
        fonts: true,
        fontSize: true,
        fontWeight: true,
        tracking: true,
        leading: true,
        breakpoints: true,
        containers: true,
        radius: true,
        shadows: true,
        insetShadows: true,
        dropShadows: true,
        textShadows: true,
        blur: true,
        perspective: true,
        aspect: true,
        ease: true,
        animations: true,
        defaults: true,
        keyframes: true,
      },
      false,
    );

    const typesContent = await Bun.file(join(outputDir, 'types.ts')).text();

    // Should have custom color
    expect(typesContent).toContain('custom');
    // Should not have Tailwind default colors (excluded)
    expect(typesContent).not.toContain('slate');
    expect(typesContent).not.toContain('gray');
    expect(typesContent).not.toContain('zinc');
  });

  it('should test granular defaults using mergeThemes with fixture', async () => {
    const { mergeThemes } = await import('../../../src/v4/core/theme/defaults');
    const { resolveTheme } = await import('../../../src/v4/index');

    const fixtureDir = join(process.cwd(), 'test/v4/fixtures');
    const baseThemePath = join(fixtureDir, 'base_theme.css');

    // Parse the base theme fixture to use as "defaults"
    const defaultsResult = await resolveTheme({
      input: baseThemePath,
      resolveImports: false,
      includeTailwindDefaults: false,
    });

    // Create a minimal user theme
    const userThemePath = join(tempDir, 'user.css');
    await writeFile(userThemePath, '@theme { --color-custom: blue; }', 'utf-8');

    const userResult = await resolveTheme({
      input: userThemePath,
      resolveImports: false,
      includeTailwindDefaults: false,
    });

    // Get the actual theme objects from variants.default
    const defaultTheme = defaultsResult.variants.default;
    const userTheme = userResult.variants.default;

    // Test: Include only colors and spacing
    const mergedIncludeOnly = mergeThemes(defaultTheme, userTheme, {
      colors: true,
      spacing: true,
      shadows: false,
      radius: false,
      fonts: false,
      fontSize: false,
      fontWeight: false,
      tracking: false,
      leading: false,
      breakpoints: false,
      containers: false,
      insetShadows: false,
      dropShadows: false,
      textShadows: false,
      blur: false,
      perspective: false,
      aspect: false,
      ease: false,
      animations: false,
      defaults: false,
      keyframes: false,
    });

    // Should have colors from both defaults and user
    expect(mergedIncludeOnly.colors.custom).toBe('blue');
    expect(mergedIncludeOnly.colors.red).toBeDefined();
    expect(mergedIncludeOnly.colors.white).toBe('#ffffff');

    // Should have spacing from defaults
    expect(mergedIncludeOnly.spacing['1']).toBe('0.25rem');

    // Should NOT have shadows from defaults (excluded)
    expect(Object.keys(mergedIncludeOnly.shadows)).toHaveLength(0);
    expect(Object.keys(mergedIncludeOnly.radius)).toHaveLength(0);

    // Test: Exclude only colors
    const mergedExcludeColors = mergeThemes(defaultTheme, userTheme, {
      colors: false,
      spacing: true,
      fonts: true,
      fontSize: true,
      shadows: true,
      radius: true,
      fontWeight: true,
      tracking: true,
      leading: true,
      breakpoints: true,
      containers: true,
      insetShadows: true,
      dropShadows: true,
      textShadows: true,
      blur: true,
      perspective: true,
      aspect: true,
      ease: true,
      animations: true,
      defaults: true,
      keyframes: true,
    });

    // Should only have user colors (no defaults merged)
    expect(mergedExcludeColors.colors.custom).toBe('blue');
    expect(mergedExcludeColors.colors.red).toBeUndefined();

    // Should have other defaults
    expect(mergedExcludeColors.spacing['1']).toBe('0.25rem');
    expect(mergedExcludeColors.radius.lg).toBe('0.5rem');
  });
});

describe('CLI - Granular Report Options', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cli-reports-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should generate all reports when reportOptions enables all', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    // Create CSS with conflicts
    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary: blue;
      }
      @media (prefers-color-scheme: dark) {
        @theme {
          --color-primary: darkblue;
        }
      }
      .custom {
        --color-primary: red;
      }
    `,
      'utf-8',
    );

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      false,
      false,
      undefined,
      { conflicts: true, unresolved: true },
    );

    // Should have conflict info (if conflicts exist)
    if (result.conflictCount !== undefined && result.conflictCount > 0) {
      expect(result.conflictReportPath).toBeDefined();
      expect(existsSync(join(outputDir, 'conflicts.md'))).toBe(true);
      expect(existsSync(join(outputDir, 'conflicts.json'))).toBe(true);
    }
  });

  it('should not generate conflict reports when disabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    // Create CSS with conflicts
    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary: blue;
      }
      @media (prefers-color-scheme: dark) {
        @theme {
          --color-primary: darkblue;
        }
      }
      .custom {
        --color-primary: red;
      }
    `,
      'utf-8',
    );

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      false,
      false,
      undefined,
      { conflicts: false, unresolved: true },
    );

    // Should not have conflict reports
    expect(result.conflictCount).toBeUndefined();
    expect(result.conflictReportPath).toBeUndefined();
    expect(existsSync(join(outputDir, 'conflicts.md'))).toBe(false);
    expect(existsSync(join(outputDir, 'conflicts.json'))).toBe(false);
  });

  it('should not generate unresolved reports when disabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    // Create CSS with unresolved variable references
    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary: var(--color-base);
      }
    `,
      'utf-8',
    );

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      false,
      false,
      undefined,
      { conflicts: true, unresolved: false },
    );

    // Should not have unresolved reports
    expect(result.unresolvedCount).toBeUndefined();
    expect(result.unresolvedReportPath).toBeUndefined();
    expect(existsSync(join(outputDir, 'unresolved.md'))).toBe(false);
    expect(existsSync(join(outputDir, 'unresolved.json'))).toBe(false);
  });

  it('should not generate any reports when all disabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary: blue;
      }
      @media (prefers-color-scheme: dark) {
        @theme {
          --color-primary: darkblue;
        }
      }
    `,
      'utf-8',
    );

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      false,
      false,
      undefined,
      { conflicts: false, unresolved: false },
    );

    // Should not have any reports
    expect(result.conflictCount).toBeUndefined();
    expect(result.conflictReportPath).toBeUndefined();
    expect(result.unresolvedCount).toBeUndefined();
    expect(result.unresolvedReportPath).toBeUndefined();
    expect(existsSync(join(outputDir, 'conflicts.md'))).toBe(false);
    expect(existsSync(join(outputDir, 'unresolved.md'))).toBe(false);
  });

  it('should generate only conflict reports when unresolved disabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary: blue;
      }
      @media (prefers-color-scheme: dark) {
        @theme {
          --color-primary: darkblue;
        }
      }
    `,
      'utf-8',
    );

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      false,
      false,
      undefined,
      { conflicts: true, unresolved: false },
    );

    // Should not have unresolved reports
    expect(result.unresolvedCount).toBeUndefined();
    expect(result.unresolvedReportPath).toBeUndefined();

    // May or may not have conflict reports depending on if conflicts exist
    if (result.conflictCount !== undefined && result.conflictCount > 0) {
      expect(result.conflictReportPath).toBeDefined();
    }
  });

  it('should use default report options when not specified', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary: blue;
      }
      @media (prefers-color-scheme: dark) {
        @theme {
          --color-primary: darkblue;
        }
      }
    `,
      'utf-8',
    );

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      false,
      false,
      undefined,
      undefined, // Default should be all enabled
    );

    // Should potentially have conflict reports if conflicts exist
    // (default is to generate all reports)
    expect(result.files).toContain(inputFile);
  });
});

describe('CLI - Argument Parsing and Validation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cli-args-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should handle --include-defaults with comma-separated values', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Simulate --include-defaults colors,spacing
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      {
        colors: true,
        spacing: true,
        // All others should be false
        fonts: false,
        fontSize: false,
        fontWeight: false,
        tracking: false,
        leading: false,
        breakpoints: false,
        containers: false,
        radius: false,
        shadows: false,
        insetShadows: false,
        dropShadows: false,
        textShadows: false,
        blur: false,
        perspective: false,
        aspect: false,
        ease: false,
        animations: false,
        defaults: false,
        keyframes: false,
      },
      false,
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should handle --exclude-defaults with comma-separated values', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Simulate --exclude-defaults shadows,animations
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      {
        colors: true,
        spacing: true,
        fonts: true,
        fontSize: true,
        fontWeight: true,
        tracking: true,
        leading: true,
        breakpoints: true,
        containers: true,
        radius: true,
        shadows: false, // Excluded
        insetShadows: true,
        dropShadows: true,
        textShadows: true,
        blur: true,
        perspective: true,
        aspect: true,
        ease: true,
        animations: false, // Excluded
        defaults: true,
        keyframes: true,
      },
      false,
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should handle --reports with comma-separated values', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary: blue;
      }
      @media (prefers-color-scheme: dark) {
        @theme {
          --color-primary: darkblue;
        }
      }
    `,
      'utf-8',
    );

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Simulate --reports conflicts
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      false,
      false,
      undefined,
      {
        conflicts: true,
        unresolved: false,
      },
    );

    expect(result.files).toContain(inputFile);
    expect(result.unresolvedCount).toBeUndefined();
    expect(result.unresolvedReportPath).toBeUndefined();
  });

  it('should handle --exclude-reports with comma-separated values', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary: blue;
      }
    `,
      'utf-8',
    );

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Simulate --exclude-reports unresolved
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      false,
      false,
      undefined,
      {
        conflicts: true,
        unresolved: false,
      },
    );

    expect(result.files).toContain(inputFile);
    expect(result.unresolvedCount).toBeUndefined();
    expect(result.unresolvedReportPath).toBeUndefined();
  });

  it('should handle single category in --include-defaults', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Simulate --include-defaults colors
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      {
        colors: true,
        spacing: false,
        fonts: false,
        fontSize: false,
        fontWeight: false,
        tracking: false,
        leading: false,
        breakpoints: false,
        containers: false,
        radius: false,
        shadows: false,
        insetShadows: false,
        dropShadows: false,
        textShadows: false,
        blur: false,
        perspective: false,
        aspect: false,
        ease: false,
        animations: false,
        defaults: false,
        keyframes: false,
      },
      false,
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should handle whitespace in category lists', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Simulate --include-defaults " colors , spacing " (with whitespace)
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      {
        colors: true,
        spacing: true,
        fonts: false,
        fontSize: false,
        fontWeight: false,
        tracking: false,
        leading: false,
        breakpoints: false,
        containers: false,
        radius: false,
        shadows: false,
        insetShadows: false,
        dropShadows: false,
        textShadows: false,
        blur: false,
        perspective: false,
        aspect: false,
        ease: false,
        animations: false,
        defaults: false,
        keyframes: false,
      },
      false,
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should handle all categories listed explicitly', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Simulate --include-defaults with all 21 categories
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      {
        colors: true,
        spacing: true,
        fonts: true,
        fontSize: true,
        fontWeight: true,
        tracking: true,
        leading: true,
        breakpoints: true,
        containers: true,
        radius: true,
        shadows: true,
        insetShadows: true,
        dropShadows: true,
        textShadows: true,
        blur: true,
        perspective: true,
        aspect: true,
        ease: true,
        animations: true,
        defaults: true,
        keyframes: true,
      },
      false,
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should handle combining defaults and reports options', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary: blue;
      }
    `,
      'utf-8',
    );

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Simulate --include-defaults colors,spacing --reports conflicts
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      {
        colors: true,
        spacing: true,
        fonts: false,
        fontSize: false,
        fontWeight: false,
        tracking: false,
        leading: false,
        breakpoints: false,
        containers: false,
        radius: false,
        shadows: false,
        insetShadows: false,
        dropShadows: false,
        textShadows: false,
        blur: false,
        perspective: false,
        aspect: false,
        ease: false,
        animations: false,
        defaults: false,
        keyframes: false,
      },
      false,
      undefined,
      {
        conflicts: true,
        unresolved: false,
      },
    );

    expect(result.files).toContain(inputFile);
    expect(result.unresolvedCount).toBeUndefined();
  });
});

describe('CLI - Edge Cases', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cli-edge-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should handle empty defaults options object', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Pass empty object - should default all to true
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      {},
      false,
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should handle partial defaults options object', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Only specify a few properties - others should default to true
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      {
        colors: false,
        shadows: false,
      },
      false,
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should handle all defaults set to false', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // All categories explicitly false
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      {
        colors: false,
        spacing: false,
        fonts: false,
        fontSize: false,
        fontWeight: false,
        tracking: false,
        leading: false,
        breakpoints: false,
        containers: false,
        radius: false,
        shadows: false,
        insetShadows: false,
        dropShadows: false,
        textShadows: false,
        blur: false,
        perspective: false,
        aspect: false,
        ease: false,
        animations: false,
        defaults: false,
        keyframes: false,
      },
      false,
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });

  it('should handle both reports set to false', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary: blue;
      }
      @media (prefers-color-scheme: dark) {
        @theme {
          --color-primary: darkblue;
        }
      }
    `,
      'utf-8',
    );

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      false,
      false,
      false,
      undefined,
      {
        conflicts: false,
        unresolved: false,
      },
    );

    expect(result.files).toContain(inputFile);
    expect(result.conflictCount).toBeUndefined();
    expect(result.unresolvedCount).toBeUndefined();
    expect(existsSync(join(outputDir, 'conflicts.md'))).toBe(false);
    expect(existsSync(join(outputDir, 'unresolved.md'))).toBe(false);
  });

  it('should handle runtime disabled with granular defaults', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Runtime disabled (false) + granular defaults
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      false, // No runtime
      false,
      {
        colors: true,
        spacing: true,
        fonts: false,
        fontSize: false,
        fontWeight: false,
        tracking: false,
        leading: false,
        breakpoints: false,
        containers: false,
        radius: false,
        shadows: false,
        insetShadows: false,
        dropShadows: false,
        textShadows: false,
        blur: false,
        perspective: false,
        aspect: false,
        ease: false,
        animations: false,
        defaults: false,
        keyframes: false,
      },
      false,
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
    // Runtime disabled, so no theme.ts
    expect(existsSync(join(outputDir, 'theme.ts'))).toBe(false);
  });

  it('should handle debug mode with granular options', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(inputFile, '@theme { --color-custom: red; }', 'utf-8');

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Debug mode + granular defaults + granular reports
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      { variants: true, selectors: true, files: true, variables: true },
      {
        colors: true,
        spacing: false,
        fonts: false,
        fontSize: false,
        fontWeight: false,
        tracking: false,
        leading: false,
        breakpoints: false,
        containers: false,
        radius: false,
        shadows: false,
        insetShadows: false,
        dropShadows: false,
        textShadows: false,
        blur: false,
        perspective: false,
        aspect: false,
        ease: false,
        animations: false,
        defaults: false,
        keyframes: false,
      },
      true, // Debug mode
      undefined,
      {
        conflicts: true,
        unresolved: false,
      },
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
    expect(existsSync(join(outputDir, 'theme.ts'))).toBe(true);

    const themeContent = await Bun.file(join(outputDir, 'theme.ts')).text();
    expect(themeContent).toContain('export const files');
    expect(themeContent).toContain('export const variables');
  });

  it('should handle complex combinations of all options', async () => {
    const inputFile = join(tempDir, 'input.css');
    const outputDir = join(tempDir, 'output');

    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary: blue;
        --color-secondary: var(--color-base);
      }
      @media (prefers-color-scheme: dark) {
        @theme {
          --color-primary: darkblue;
        }
      }
    `,
      'utf-8',
    );

    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    // Complex scenario: runtime + granular defaults + granular reports + debug
    const result = await generateThemeFiles(
      inputFile,
      outputDir,
      true,
      { variants: true, selectors: false, files: true, variables: false },
      {
        colors: true,
        spacing: true,
        fonts: false,
        fontSize: true,
        fontWeight: false,
        tracking: false,
        leading: false,
        breakpoints: true,
        containers: false,
        radius: true,
        shadows: false,
        insetShadows: false,
        dropShadows: false,
        textShadows: false,
        blur: false,
        perspective: false,
        aspect: false,
        ease: false,
        animations: true,
        defaults: false,
        keyframes: true,
      },
      true,
      undefined,
      {
        conflicts: false,
        unresolved: true,
      },
    );

    expect(result.files).toContain(inputFile);
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
    expect(existsSync(join(outputDir, 'theme.ts'))).toBe(true);

    // Should not have conflict reports (disabled)
    expect(result.conflictCount).toBeUndefined();
    expect(existsSync(join(outputDir, 'conflicts.md'))).toBe(false);

    // May have unresolved reports (enabled)
    if (result.unresolvedCount !== undefined && result.unresolvedCount > 0) {
      expect(result.unresolvedReportPath).toBeDefined();
    }
  });
});
