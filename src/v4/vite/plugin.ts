/**
 * Vite plugin for automatic theme type generation
 * Watches CSS files and regenerates TypeScript types on change
 */

import type { HmrContext, PluginOption } from 'vite';

import type { OverrideOptions, RuntimeGenerationOptions } from '../types';

import { existsSync } from 'node:fs';
import path from 'node:path';

import { DEFAULT_OUTPUT_DIRS } from '../shared/constants';
import { generateThemeFiles } from '../shared/file-generator';
import { normalizeRuntimeOptions } from '../shared/utils';

/**
 * Re-export RuntimeGenerationOptions for convenience
 */
export type { RuntimeGenerationOptions };

export interface VitePluginOptions {
  /**
   * Path to your CSS input file (relative to Vite project root)
   */
  input: string;

  /**
   * Output directory for generated files (relative to Vite project root)
   * @default 'src/generated/tailwindcss' if src/ exists, otherwise 'generated/tailwindcss'
   */
  outputDir?: string;

  /**
   * Whether to resolve `@import` statements
   * @default true
   */
  resolveImports?: boolean;

  /**
   * Control what gets generated in the runtime file
   * - `false`: No runtime file (types only)
   * - `true`: Generate variants and selectors (optimized for production, excludes debug data)
   * - object: Granular control - set `files: true` and `variables: true` for debugging
   * @default true
   *
   * @example
   * // Production (default)
   * generateRuntime: true
   *
   * // Development with debug data
   * generateRuntime: {
   *   variants: true,
   *   selectors: true,
   *   files: true,      // Include processed file list
   *   variables: true,  // Include raw CSS variables
   * }
   */
  generateRuntime?: boolean | RuntimeGenerationOptions;

  /**
   * Whether to include Tailwind CSS defaults from node_modules
   * @default true
   */
  includeTailwindDefaults?: boolean;

  /**
   * Enable debug logging for troubleshooting
   * @default false
   */
  debug?: boolean;

  /**
   * Theme value overrides
   * Apply custom overrides to theme values for specific variants or globally
   * @default undefined
   *
   * @example
   * overrides: {
   *   'dark': { 'colors.background': '#000000' },
   *   '*': { 'fonts.sans': 'Inter, sans-serif' }
   * }
   */
  overrides?: OverrideOptions;
}

export function tailwindResolver(options: VitePluginOptions): PluginOption {
  const {
    input,
    resolveImports = true,
    generateRuntime = true,
    includeTailwindDefaults = true,
    debug = false,
    overrides,
  } = options;

  const runtimeOptions = normalizeRuntimeOptions(generateRuntime);

  let projectRoot = '';
  let watchedFiles: Set<string> = new Set();
  let resolvedOutputDir = '';

  /**
   * Regenerates theme files and updates watched files
   *
   * @param addWatchFile - Optional callback to add files to Vite's watch list (buildStart only)
   * @param sourceFile - Optional source file that triggered regeneration (HMR only)
   */
  async function regenerateThemeFiles(
    addWatchFile?: (file: string) => void,
    sourceFile?: string,
  ): Promise<void> {
    const fullInputPath = path.resolve(projectRoot, input);
    const fullOutputDir = path.resolve(projectRoot, resolvedOutputDir);
    const basePath = path.dirname(fullInputPath);

    // Extract report options from runtime options
    const reportOptions =
      runtimeOptions !== false && runtimeOptions.reports !== undefined
        ? typeof runtimeOptions.reports === 'boolean'
          ? runtimeOptions.reports
            ? { conflicts: true, unresolved: true }
            : { conflicts: false, unresolved: false }
          : runtimeOptions.reports
        : { conflicts: true, unresolved: true };

    const result = await generateThemeFiles(
      fullInputPath,
      fullOutputDir,
      resolveImports,
      runtimeOptions,
      includeTailwindDefaults,
      debug,
      basePath,
      reportOptions,
      overrides,
    );

    // Update watched files set
    watchedFiles = new Set(result.files);

    // Add files to Vite's watch list if callback provided (buildStart only)
    if (addWatchFile !== undefined) {
      for (const file of result.files) {
        addWatchFile(file);
      }
    }

    // Log if source file provided (HMR only)
    if (sourceFile !== undefined) {
      console.log(
        `  ℹ  Tailwind theme updated from ${path.basename(sourceFile)}`,
      );
    }
  }

  return {
    name: 'vite-plugin-tailwind-resolver',

    configResolved(config) {
      projectRoot = config.root;

      // Auto-detect output directory based on project structure
      if (options.outputDir !== undefined) {
        resolvedOutputDir = options.outputDir;
      } else {
        const srcPath = path.join(projectRoot, 'src');
        const srcExists = existsSync(srcPath);
        resolvedOutputDir = srcExists
          ? DEFAULT_OUTPUT_DIRS.WITH_SRC
          : DEFAULT_OUTPUT_DIRS.WITHOUT_SRC;
      }
    },

    async buildStart() {
      await regenerateThemeFiles((file) => this.addWatchFile(file));
    },

    async handleHotUpdate({ file }: HmrContext) {
      // Regenerate types when any watched CSS file changes
      if (watchedFiles.has(file)) {
        await regenerateThemeFiles(undefined, file);
      }

      return undefined;
    },
  };
}
