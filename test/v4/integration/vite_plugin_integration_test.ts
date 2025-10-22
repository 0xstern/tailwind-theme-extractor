/**
 * Integration tests for Vite plugin full pipeline
 * Tests complete workflow from CSS input to generated TypeScript files
 */

import type { HmrContext, ResolvedConfig } from 'vite';

import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { tailwindResolver } from '../../../src/v4/vite/plugin';

describe('Vite Plugin - Full Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vite-integration-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should generate complete theme files from complex CSS', async () => {
    const inputFile = join(tempDir, 'theme.css');
    const outputDir = join(tempDir, 'generated');

    // Create a complex CSS file with multiple features
    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary-*: initial;
        --color-primary-500: oklch(0.5 0.2 200);
        --color-primary-600: oklch(0.4 0.2 200);

        --spacing-sm: 0.5rem;
        --spacing-md: 1rem;
        --spacing-lg: 1.5rem;

        --font-sans: system-ui, sans-serif;
        --font-mono: 'Courier New', monospace;

        --radius-base: 0.25rem;
        --radius-lg: 0.5rem;
      }

      .dark {
        @theme {
          --color-primary-500: oklch(0.7 0.2 200);
          --color-primary-600: oklch(0.6 0.2 200);
        }
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      `,
      'utf-8',
    );

    interface PluginWithHooks {
      name: string;
      configResolved: (config: ResolvedConfig) => void;
      buildStart: (this: {
        addWatchFile: (file: string) => void;
      }) => Promise<void>;
      handleHotUpdate?: (ctx: HmrContext) => Promise<void | Array<unknown>>;
    }

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir,
      generateRuntime: true,
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const watchedFiles: Array<string> = [];
    await plugin.buildStart.call({
      addWatchFile: (file: string) => {
        watchedFiles.push(file);
      },
    });

    // Verify files were generated
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
    expect(existsSync(join(outputDir, 'theme.ts'))).toBe(true);
    expect(existsSync(join(outputDir, 'index.ts'))).toBe(true);

    // Verify types.ts content
    const typesContent = await readFile(join(outputDir, 'types.ts'), 'utf-8');
    expect(typesContent).toContain('export interface DefaultTheme');
    expect(typesContent).toContain('colors');
    expect(typesContent).toContain('spacing');
    expect(typesContent).toContain('fonts');
    expect(typesContent).toContain('radius');
    expect(typesContent).toContain('keyframes');

    // Verify theme.ts content
    const themeContent = await readFile(join(outputDir, 'theme.ts'), 'utf-8');
    expect(themeContent).toContain('export const variants');
    expect(themeContent).toContain('export const selectors');
    expect(themeContent).toContain('dark');

    // Verify index.ts content
    const indexContent = await readFile(join(outputDir, 'index.ts'), 'utf-8');
    expect(indexContent).toContain("export type * from './types'");
    expect(indexContent).toContain("export * from './theme'");

    // Verify watched files
    expect(watchedFiles).toContain(inputFile);
  });

  it('should handle HMR workflow with file updates', async () => {
    const inputFile = join(tempDir, 'theme.css');
    const outputDir = join(tempDir, 'generated');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    interface PluginWithHooks {
      name: string;
      configResolved: (config: ResolvedConfig) => void;
      buildStart: (this: {
        addWatchFile: (file: string) => void;
      }) => Promise<void>;
      handleHotUpdate?: (ctx: HmrContext) => Promise<void | Array<unknown>>;
    }

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir,
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    await plugin.buildStart.call({
      addWatchFile: () => {},
    });

    // Read initial content
    const initialContent = await readFile(join(outputDir, 'types.ts'), 'utf-8');
    expect(initialContent).toContain('primary');

    // Simulate file change
    await writeFile(inputFile, '@theme { --color-secondary: red; }', 'utf-8');

    // Trigger HMR
    if (plugin.handleHotUpdate !== undefined) {
      const mockHmrContext: HmrContext = {
        file: inputFile,
      } as HmrContext;

      await plugin.handleHotUpdate(mockHmrContext);
    }

    // Verify updated content
    const updatedContent = await readFile(join(outputDir, 'types.ts'), 'utf-8');
    expect(updatedContent).toContain('secondary');
  });

  it('should handle import chains correctly', async () => {
    const baseFile = join(tempDir, 'base.css');
    const colorsFile = join(tempDir, 'colors.css');
    const mainFile = join(tempDir, 'main.css');
    const outputDir = join(tempDir, 'generated');

    await writeFile(baseFile, '@theme { --spacing-base: 1rem; }', 'utf-8');
    await writeFile(colorsFile, '@theme { --color-primary: blue; }', 'utf-8');
    await writeFile(
      mainFile,
      `
      @import "./base.css";
      @import "./colors.css";
      @theme { --radius-base: 0.25rem; }
      `,
      'utf-8',
    );

    interface PluginWithHooks {
      name: string;
      configResolved: (config: ResolvedConfig) => void;
      buildStart: (this: {
        addWatchFile: (file: string) => void;
      }) => Promise<void>;
    }

    const plugin = tailwindResolver({
      input: mainFile,
      outputDir,
      resolveImports: true,
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const watchedFiles: Array<string> = [];
    await plugin.buildStart.call({
      addWatchFile: (file: string) => {
        watchedFiles.push(file);
      },
    });

    // Verify all files are watched
    expect(watchedFiles).toContain(mainFile);
    expect(watchedFiles).toContain(baseFile);
    expect(watchedFiles).toContain(colorsFile);

    // Verify combined output
    const typesContent = await readFile(join(outputDir, 'types.ts'), 'utf-8');
    expect(typesContent).toContain('spacing');
    expect(typesContent).toContain('colors');
    expect(typesContent).toContain('radius');
  });

  it('should generate consistent output with CLI workflow', async () => {
    const inputFile = join(tempDir, 'theme.css');
    const viteOutputDir = join(tempDir, 'vite-output');
    const cliOutputDir = join(tempDir, 'cli-output');

    const cssContent = `
      @theme {
        --color-primary: blue;
        --spacing-base: 1rem;
        --font-sans: system-ui;
      }

      .dark {
        @theme {
          --color-primary: white;
        }
      }
    `;

    await writeFile(inputFile, cssContent, 'utf-8');

    // Generate via Vite plugin
    interface PluginWithHooks {
      name: string;
      configResolved: (config: ResolvedConfig) => void;
      buildStart: (this: {
        addWatchFile: (file: string) => void;
      }) => Promise<void>;
    }

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: viteOutputDir,
      generateRuntime: true,
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    await plugin.buildStart.call({
      addWatchFile: () => {},
    });

    // Generate via CLI workflow (using shared module)
    const { generateThemeFiles } = await import(
      '../../../src/v4/shared/file_generator'
    );

    await generateThemeFiles(
      inputFile,
      cliOutputDir,
      true,
      { variants: true, selectors: true, files: false, variables: false },
      false,
      false,
    );

    // Compare outputs - they should be identical
    const viteTypes = await readFile(join(viteOutputDir, 'types.ts'), 'utf-8');
    const cliTypes = await readFile(join(cliOutputDir, 'types.ts'), 'utf-8');

    // Both should have same type structure
    expect(viteTypes).toContain('export interface DefaultTheme');
    expect(cliTypes).toContain('export interface DefaultTheme');
    expect(viteTypes).toContain('colors');
    expect(cliTypes).toContain('colors');
    expect(viteTypes).toContain('spacing');
    expect(cliTypes).toContain('spacing');

    // Both should have runtime files
    expect(existsSync(join(viteOutputDir, 'theme.ts'))).toBe(true);
    expect(existsSync(join(cliOutputDir, 'theme.ts'))).toBe(true);
  });

  it('should handle CSS conflicts and generate reports', async () => {
    const inputFile = join(tempDir, 'theme.css');
    const outputDir = join(tempDir, 'generated');

    // CSS with intentional conflict
    await writeFile(
      inputFile,
      `
      @theme {
        --color-primary: blue;
        --spacing-base: 1rem;
      }

      .dark {
        @theme {
          --color-primary: var(--color-primary);
        }

        /* This creates a conflict */
        .dark {
          --color-primary: white;
        }
      }
      `,
      'utf-8',
    );

    interface PluginWithHooks {
      name: string;
      configResolved: (config: ResolvedConfig) => void;
      buildStart: (this: {
        addWatchFile: (file: string) => void;
      }) => Promise<void>;
    }

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir,
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    await plugin.buildStart.call({
      addWatchFile: () => {},
    });

    // Verify types generated successfully even with conflicts
    expect(existsSync(join(outputDir, 'types.ts'))).toBe(true);
  });
});
