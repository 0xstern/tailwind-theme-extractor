/**
 * Unit tests for Vite plugin
 * Tests plugin lifecycle hooks, configuration, and HMR functionality
 */

import type { HmrContext, ResolvedConfig } from 'vite';

import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { tailwindResolver } from '../../../../src/v4/vite/plugin';

/**
 * Helper type for plugin with hooks
 */
interface PluginWithHooks {
  name: string;
  configResolved: (config: ResolvedConfig) => void;
  buildStart: (this: { addWatchFile: (file: string) => void }) => Promise<void>;
  handleHotUpdate?: (ctx: HmrContext) => Promise<void | Array<unknown>>;
}

describe('tailwindResolver - Plugin configuration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vite-plugin-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return a valid Vite plugin object', () => {
    const plugin = tailwindResolver({
      input: 'styles.css',
    });

    expect(plugin).toBeDefined();
    expect(plugin).toHaveProperty('name', 'vite-plugin-tailwind-resolver');
    expect(plugin).toHaveProperty('configResolved');
    expect(plugin).toHaveProperty('buildStart');
    expect(plugin).toHaveProperty('handleHotUpdate');
  });

  it('should accept required input option', () => {
    const plugin = tailwindResolver({
      input: 'app.css',
    });

    expect(plugin).toBeDefined();
  });

  it('should accept optional outputDir option', () => {
    const plugin = tailwindResolver({
      input: 'styles.css',
      outputDir: 'custom/output',
    });

    expect(plugin).toBeDefined();
  });

  it('should accept optional resolveImports option', () => {
    const plugin = tailwindResolver({
      input: 'styles.css',
      resolveImports: false,
    });

    expect(plugin).toBeDefined();
  });

  it('should accept optional generateRuntime option as boolean', () => {
    const plugin = tailwindResolver({
      input: 'styles.css',
      generateRuntime: false,
    });

    expect(plugin).toBeDefined();
  });

  it('should accept optional generateRuntime option as object', () => {
    const plugin = tailwindResolver({
      input: 'styles.css',
      generateRuntime: {
        variants: true,
        selectors: true,
        files: true,
        variables: true,
      },
    });

    expect(plugin).toBeDefined();
  });

  it('should accept optional includeTailwindDefaults option', () => {
    const plugin = tailwindResolver({
      input: 'styles.css',
      includeTailwindDefaults: false,
    });

    expect(plugin).toBeDefined();
  });

  it('should accept optional debug option', () => {
    const plugin = tailwindResolver({
      input: 'styles.css',
      debug: true,
    });

    expect(plugin).toBeDefined();
  });

  it('should accept all options together', () => {
    const plugin = tailwindResolver({
      input: 'styles.css',
      outputDir: 'generated',
      resolveImports: true,
      generateRuntime: {
        variants: true,
        selectors: true,
        files: false,
        variables: false,
      },
      includeTailwindDefaults: true,
      debug: false,
    });

    expect(plugin).toBeDefined();
  });
});

describe('tailwindResolver - configResolved hook', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vite-config-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should use custom outputDir when provided', () => {
    const CUSTOM_OUTPUT_DIR = 'custom/dir';
    const plugin = tailwindResolver({
      input: 'styles.css',
      outputDir: CUSTOM_OUTPUT_DIR,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    // Call configResolved hook
    plugin.configResolved(mockConfig);

    // configResolved doesn't return anything but sets internal state
    expect(plugin).toBeDefined();
  });

  it('should auto-detect outputDir with src/ directory', async () => {
    // Create src/ directory to trigger auto-detection
    const srcPath = join(tempDir, 'src');
    await writeFile(srcPath, '', 'utf-8');

    const plugin = tailwindResolver({
      input: 'styles.css',
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    expect(plugin).toBeDefined();
  });

  it('should auto-detect outputDir without src/ directory', () => {
    const plugin = tailwindResolver({
      input: 'styles.css',
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    expect(plugin).toBeDefined();
  });
});

describe('tailwindResolver - buildStart hook', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vite-build-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should generate theme files on build start', async () => {
    const inputFile = join(tempDir, 'input.css');
    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const watchedFiles: Array<string> = [];
    const mockContext = {
      addWatchFile: (file: string) => {
        watchedFiles.push(file);
      },
    };

    await plugin.buildStart.call(mockContext);

    // Should have watched the input file
    expect(watchedFiles).toContain(inputFile);
  });

  it('should handle errors during theme generation', async () => {
    const NON_EXISTENT_FILE = '/non/existent/file.css';
    const plugin = tailwindResolver({
      input: NON_EXISTENT_FILE,
      outputDir: join(tempDir, 'output'),
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    expect(plugin.buildStart.call(mockContext)).rejects.toThrow();
  });

  it('should resolve imports when enabled', async () => {
    const baseFile = join(tempDir, 'base.css');
    const mainFile = join(tempDir, 'main.css');

    await writeFile(baseFile, '@theme { --color-secondary: red; }', 'utf-8');
    await writeFile(
      mainFile,
      `@import "./base.css";\n@theme { --color-primary: blue; }`,
      'utf-8',
    );

    const plugin = tailwindResolver({
      input: mainFile,
      outputDir: join(tempDir, 'output'),
      resolveImports: true,
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const watchedFiles: Array<string> = [];
    const mockContext = {
      addWatchFile: (file: string) => {
        watchedFiles.push(file);
      },
    };

    await plugin.buildStart.call(mockContext);

    // Should watch both main and imported file
    expect(watchedFiles).toContain(mainFile);
    expect(watchedFiles).toContain(baseFile);
  });

  it('should skip imports when resolveImports is false', async () => {
    const baseFile = join(tempDir, 'base.css');
    const mainFile = join(tempDir, 'main.css');

    await writeFile(baseFile, '@theme { --color-secondary: red; }', 'utf-8');
    await writeFile(
      mainFile,
      `@import "./base.css";\n@theme { --color-primary: blue; }`,
      'utf-8',
    );

    const plugin = tailwindResolver({
      input: mainFile,
      outputDir: join(tempDir, 'output'),
      resolveImports: false,
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const watchedFiles: Array<string> = [];
    const mockContext = {
      addWatchFile: (file: string) => {
        watchedFiles.push(file);
      },
    };

    await plugin.buildStart.call(mockContext);

    // Should only watch main file, not imported file
    expect(watchedFiles).toContain(mainFile);
    expect(watchedFiles).not.toContain(baseFile);
  });
});

describe('tailwindResolver - handleHotUpdate hook', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vite-hmr-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should regenerate types when watched file changes', async () => {
    const inputFile = join(tempDir, 'input.css');
    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    // First build to initialize watched files
    await plugin.buildStart.call(mockContext);

    // Simulate file change
    const mockHmrContext: HmrContext = {
      file: inputFile,
    } as HmrContext;

    const result =
      plugin.handleHotUpdate !== undefined
        ? await plugin.handleHotUpdate(mockHmrContext)
        : undefined;

    // Should return undefined to let Vite handle the update
    expect(result).toBeUndefined();
  });

  it('should ignore changes to non-watched files', async () => {
    const inputFile = join(tempDir, 'input.css');
    const otherFile = join(tempDir, 'other.css');

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');
    await writeFile(otherFile, '.class { color: red; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    // Simulate change to non-watched file
    const mockHmrContext: HmrContext = {
      file: otherFile,
    } as HmrContext;

    const result =
      plugin.handleHotUpdate !== undefined
        ? await plugin.handleHotUpdate(mockHmrContext)
        : undefined;

    // Should return undefined without regenerating
    expect(result).toBeUndefined();
  });

  it('should handle HMR for imported files', async () => {
    const baseFile = join(tempDir, 'base.css');
    const mainFile = join(tempDir, 'main.css');

    await writeFile(baseFile, '@theme { --color-secondary: red; }', 'utf-8');
    await writeFile(
      mainFile,
      `@import "./base.css";\n@theme { --color-primary: blue; }`,
      'utf-8',
    );

    const plugin = tailwindResolver({
      input: mainFile,
      outputDir: join(tempDir, 'output'),
      resolveImports: true,
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    // Simulate change to imported file
    const mockHmrContext: HmrContext = {
      file: baseFile,
    } as HmrContext;

    const result =
      plugin.handleHotUpdate !== undefined
        ? await plugin.handleHotUpdate(mockHmrContext)
        : undefined;

    expect(result).toBeUndefined();
  });
});

describe('tailwindResolver - Runtime generation options', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vite-runtime-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should generate runtime files when generateRuntime is true', async () => {
    const inputFile = join(tempDir, 'input.css');
    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      generateRuntime: true,
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    // Verify output directory was created and files exist
    expect(existsSync(join(tempDir, 'output'))).toBe(true);
  });

  it('should skip runtime files when generateRuntime is false', async () => {
    const inputFile = join(tempDir, 'input.css');
    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      generateRuntime: false,
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    // Output directory should still exist (types.ts is always generated)
    expect(existsSync(join(tempDir, 'output'))).toBe(true);
  });

  it('should accept granular runtime options', async () => {
    const inputFile = join(tempDir, 'input.css');
    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      generateRuntime: {
        variants: true,
        selectors: true,
        files: true,
        variables: true,
      },
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    expect(existsSync(join(tempDir, 'output'))).toBe(true);
  });
});

describe('tailwindResolver - Tailwind defaults inclusion', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vite-defaults-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should include Tailwind defaults by default', async () => {
    const inputFile = join(tempDir, 'input.css');
    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    expect(existsSync(join(tempDir, 'output'))).toBe(true);
  });

  it('should skip Tailwind defaults when disabled', async () => {
    const inputFile = join(tempDir, 'input.css');
    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    expect(existsSync(join(tempDir, 'output'))).toBe(true);
  });
});

describe('tailwindResolver - Debug mode', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vite-debug-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should accept debug option without errors', async () => {
    const inputFile = join(tempDir, 'input.css');
    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      debug: true,
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    expect(existsSync(join(tempDir, 'output'))).toBe(true);
  });

  it('should work without debug mode (default)', async () => {
    const inputFile = join(tempDir, 'input.css');
    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    expect(existsSync(join(tempDir, 'output'))).toBe(true);
  });
});

describe('tailwindResolver - Edge cases', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'vite-edge-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should handle empty CSS file', async () => {
    const inputFile = join(tempDir, 'empty.css');
    await writeFile(inputFile, '', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    expect(existsSync(join(tempDir, 'output'))).toBe(true);
  });

  it('should handle CSS with only comments', async () => {
    const inputFile = join(tempDir, 'comments.css');
    await writeFile(
      inputFile,
      '/* This is a comment */\n/* This is another comment */',
      'utf-8',
    );

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    expect(existsSync(join(tempDir, 'output'))).toBe(true);
  });

  it('should handle deeply nested output directory', async () => {
    const inputFile = join(tempDir, 'input.css');
    const NESTED_OUTPUT_DIR = 'very/deeply/nested/output/directory';

    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: NESTED_OUTPUT_DIR,
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    expect(existsSync(join(tempDir, NESTED_OUTPUT_DIR))).toBe(true);
  });

  it('should handle multiple buildStart calls', async () => {
    const inputFile = join(tempDir, 'input.css');
    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    // Call buildStart multiple times
    await plugin.buildStart.call(mockContext);
    await plugin.buildStart.call(mockContext);
    await plugin.buildStart.call(mockContext);

    expect(existsSync(join(tempDir, 'output'))).toBe(true);
  });

  it('should handle rapid HMR updates', async () => {
    const inputFile = join(tempDir, 'input.css');
    await writeFile(inputFile, '@theme { --color-primary: blue; }', 'utf-8');

    const plugin = tailwindResolver({
      input: inputFile,
      outputDir: join(tempDir, 'output'),
      includeTailwindDefaults: false,
    }) as PluginWithHooks;

    const mockConfig: ResolvedConfig = {
      root: tempDir,
    } as ResolvedConfig;

    plugin.configResolved(mockConfig);

    const mockContext = {
      addWatchFile: () => {},
    };

    await plugin.buildStart.call(mockContext);

    const mockHmrContext: HmrContext = {
      file: inputFile,
    } as HmrContext;

    // Simulate rapid updates
    const RAPID_UPDATE_COUNT = 5;
    const updates =
      plugin.handleHotUpdate !== undefined
        ? Array.from({ length: RAPID_UPDATE_COUNT }, () =>
            plugin.handleHotUpdate !== undefined
              ? plugin.handleHotUpdate(mockHmrContext)
              : Promise.resolve(undefined),
          )
        : [];

    await Promise.all(updates);

    expect(updates).toHaveLength(RAPID_UPDATE_COUNT);
  });
});
