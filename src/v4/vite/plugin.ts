/**
 * Vite plugin for automatic theme type generation
 * Watches CSS files and regenerates TypeScript types on change
 */

import type { HmrContext, PluginOption } from 'vite';

import type { RuntimeGenerationOptions } from '../types';

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveTheme } from '../index';
import {
  generateRuntimeFile,
  generateTypeDeclarations,
} from './type-generator';

/**
 * Output file names used by the plugin
 */
export const OUTPUT_FILES = {
  TYPES: 'types.ts',
  THEME: 'theme.ts',
  INDEX: 'index.ts',
} as const;

/**
 * Default output directories based on project structure
 */
export const DEFAULT_OUTPUT_DIRS = {
  WITH_SRC: 'src/generated/tailwindcss',
  WITHOUT_SRC: 'generated/tailwindcss',
} as const;

/**
 * Default interface name for generated theme types
 */
export const DEFAULT_INTERFACE_NAME = 'DefaultTheme';

/**
 * Re-export RuntimeGenerationOptions for convenience
 * (Defined in ../types.ts)
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
   * - `true`: Generate all runtime data (variants, selectors, files, variables)
   * - object: Granular control over what to include
   * @default true
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
}

/**
 * Normalizes generateRuntime option to RuntimeGenerationOptions
 *
 * @param generateRuntime - The runtime generation option (boolean or object)
 * @returns Normalized runtime generation options or false
 */
function normalizeRuntimeOptions(
  generateRuntime: boolean | RuntimeGenerationOptions | undefined,
): RuntimeGenerationOptions | false {
  // If false, no runtime generation
  if (generateRuntime === false) {
    return false;
  }

  // If true or undefined, generate everything with production defaults
  if (generateRuntime === true || generateRuntime === undefined) {
    return {
      variants: true,
      selectors: true,
      files: false,
      variables: false,
    };
  }

  // Object - merge with defaults
  return {
    variants: generateRuntime.variants ?? true,
    selectors: generateRuntime.selectors ?? true,
    files: generateRuntime.files ?? false,
    variables: generateRuntime.variables ?? false,
  };
}

export function tailwindResolver(options: VitePluginOptions): PluginOption {
  const {
    input,
    resolveImports = true,
    generateRuntime = true,
    includeTailwindDefaults = true,
    debug = false,
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

    const result = await generateThemeFiles(
      fullInputPath,
      fullOutputDir,
      resolveImports,
      runtimeOptions,
      includeTailwindDefaults,
      debug,
      basePath,
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

/**
 * Generates TypeScript theme type declarations and runtime files from CSS
 *
 * This function is used by both the Vite plugin and the CLI tool to generate
 * theme files. It handles the full pipeline from parsing CSS to writing output files.
 *
 * Error Handling:
 * - Input file not found: Throws error and logs to console
 * - Missing `@import` files: Silently skipped (see resolveTheme)
 * - Invalid CSS syntax: Throws error with parse details
 * - File system errors: Throws if output directory cannot be created or files cannot be written
 * - Enable `debug` parameter to log warnings for import resolution failures
 *
 * Generated Files:
 * - Always: types.ts (TypeScript interfaces including Tailwind and DefaultTheme)
 * - Conditional: theme.ts (runtime theme objects, if runtimeOptions is not false)
 * - Conditional: index.ts (re-exports from types.ts and theme.ts, if runtimeOptions is not false)
 *
 * Type Safety:
 * The types.ts file generates a Tailwind interface that users pass as a generic parameter
 * to resolveTheme<Tailwind>() for full type safety with autocomplete for all theme properties.
 *
 * @param inputPath - Absolute path to the CSS input file
 * @param outputDir - Absolute path to the output directory
 * @param resolveImports - Whether to resolve `@import` statements recursively
 * @param runtimeOptions - Controls what gets generated in runtime file (false = no runtime file)
 * @param includeTailwindDefaults - Whether to include Tailwind CSS defaults from node_modules
 * @param debug - Enable debug logging for troubleshooting
 * @param basePath - Base path for resolving node_modules (defaults to input file's directory)
 * @returns Promise resolving to object containing list of processed files
 * @throws Error if input file cannot be read or parsed
 * @throws Error if output files cannot be written
 */
export async function generateThemeFiles(
  inputPath: string,
  outputDir: string,
  resolveImports: boolean,
  runtimeOptions: RuntimeGenerationOptions | false,
  includeTailwindDefaults: boolean,
  debug: boolean = false,
  basePath?: string,
): Promise<{ files: Array<string> }> {
  try {
    const result = await resolveTheme({
      input: inputPath,
      resolveImports,
      includeTailwindDefaults,
      debug,
      basePath,
    });

    // Calculate relative path from output directory to source file
    const relativeSourcePath = path.relative(outputDir, inputPath);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Always generate type declarations (types.ts)
    const typeDeclarations = generateTypeDeclarations(
      result,
      DEFAULT_INTERFACE_NAME,
      relativeSourcePath,
    );

    const typesPath = path.join(outputDir, OUTPUT_FILES.TYPES);

    // Prepare all file writes
    const writePromises = [fs.writeFile(typesPath, typeDeclarations, 'utf-8')];

    // Conditionally generate runtime file (theme.ts) and index
    if (runtimeOptions !== false) {
      const runtimeFile = generateRuntimeFile(
        result,
        DEFAULT_INTERFACE_NAME,
        runtimeOptions,
      );
      const themePath = path.join(outputDir, OUTPUT_FILES.THEME);

      // Create an index.ts that re-exports everything for clean imports
      const indexTs = `export type * from './types';\nexport * from './theme';\n`;

      writePromises.push(
        fs.writeFile(themePath, runtimeFile, 'utf-8'),
        fs.writeFile(
          path.join(outputDir, OUTPUT_FILES.INDEX),
          indexTs,
          'utf-8',
        ),
      );
    }

    // Write all files in parallel
    await Promise.all(writePromises);

    // Return the list of files that were processed (for Vite to watch)
    return { files: result.files };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `  ✖  Failed to generate Tailwind theme types from ${inputPath}: ${errorMessage}`,
    );
    throw error;
  }
}
