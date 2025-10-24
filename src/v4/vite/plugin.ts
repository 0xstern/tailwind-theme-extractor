/**
 * Vite plugin for automatic theme type generation
 * Watches CSS files and regenerates TypeScript types on change
 */

import type { HmrContext, PluginOption } from 'vite';

import type {
  NestingOptions,
  OverrideOptions,
  RuntimeGenerationOptions,
  SharedThemeOptions,
  TailwindDefaultsOptions,
} from '../types';

import { existsSync } from 'node:fs';
import path from 'node:path';

import { DEFAULT_OUTPUT_DIRS } from '../shared/constants';
import { generateThemeFiles } from '../shared/file_generator';
import { normalizeRuntimeOptions } from '../shared/utils';

/**
 * Re-export for convenience
 */
export type {
  NestingOptions,
  OverrideOptions,
  RuntimeGenerationOptions,
  SharedThemeOptions,
  TailwindDefaultsOptions,
};

/**
 * Vite plugin configuration options
 *
 * @example
 * ```typescript
 * // Minimal configuration
 * {
 *   input: 'src/theme.css'
 * }
 *
 * // Production configuration
 * {
 *   input: 'src/theme.css',
 *   outputDir: 'src/generated/tailwindcss',
 *   generateRuntime: true,
 *   includeDefaults: true
 * }
 *
 * // Development configuration with all debug data
 * {
 *   input: 'src/theme.css',
 *   debug: true,
 *   generateRuntime: {
 *     variants: true,
 *     selectors: true,
 *     files: true,
 *     variables: true,
 *     reports: true
 *   }
 * }
 *
 * // Complete configuration showing all options
 * {
 *   input: 'src/theme.css',
 *   outputDir: 'src/generated/tailwindcss',
 *   resolveImports: true,
 *   generateRuntime: {
 *     variants: true,
 *     selectors: true,
 *     files: false,
 *     variables: false,
 *     reports: {
 *       conflicts: true,
 *       unresolved: true
 *     }
 *   },
 *   includeDefaults: {
 *     colors: true,
 *     spacing: true,
 *     fonts: true,
 *     fontSize: true,
 *     fontWeight: true,
 *     shadows: false
 *   },
 *   overrides: {
 *     '*': { 'fonts.sans': 'Inter' },
 *     'dark': { 'colors.background': '#000' }
 *   },
 *   nesting: {
 *     default: { maxDepth: 1, flattenMode: 'camelcase' },
 *     colors: { maxDepth: 2, flattenMode: 'literal', consecutiveDashes: 'exclude' }
 *   },
 *   debug: false
 * }
 * ```
 */
export interface VitePluginOptions extends SharedThemeOptions {
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
   * Control what gets generated in the runtime file
   * - `false`: No runtime file (types only)
   * - `true`: Generate variants and selectors (optimized for production)
   * - object: Granular control over variants, selectors, files, variables, and reports
   * @default true
   *
   * @example
   * ```typescript
   * // Production (default)
   * generateRuntime: true
   *
   * // Development with debug data
   * generateRuntime: {
   *   variants: true,
   *   selectors: true,
   *   files: true,
   *   variables: true,
   *   reports: { conflicts: true, unresolved: true }
   * }
   *
   * // Minimal (no reports)
   * generateRuntime: {
   *   variants: true,
   *   selectors: true,
   *   files: false,
   *   variables: false,
   *   reports: false
   * }
   * ```
   */
  generateRuntime?: boolean | RuntimeGenerationOptions;
}

export function tailwindResolver(options: VitePluginOptions): PluginOption {
  const {
    input,
    resolveImports = true,
    generateRuntime = true,
    includeDefaults = true,
    debug = false,
    overrides,
    nesting,
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
      includeDefaults,
      debug,
      basePath,
      reportOptions,
      overrides,
      nesting,
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
