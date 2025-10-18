/**
 * Vite plugin for automatic theme type generation
 * Watches CSS files and regenerates TypeScript types on change
 */

import type { HmrContext, PluginOption } from 'vite';

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { extractTheme } from '../index';
import {
  generateRuntimeFile,
  generateTypeDeclarations,
} from './type-generator';

/**
 * Output file names used by the plugin
 */
export const OUTPUT_FILES = {
  TYPES: 'themes.d.ts',
  RUNTIME: 'themes.ts',
  INDEX_TS: 'index.ts',
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
export const DEFAULT_INTERFACE_NAME = 'GeneratedTheme';

export interface VitePluginOptions {
  /**
   * Path to your CSS input file (relative to project root)
   */
  input: string;

  /**
   * Output directory for generated files (relative to project root)
   * @default 'src/generated/tailwindcss' if src/ exists, otherwise 'generated/tailwindcss'
   */
  outputDir?: string;

  /**
   * Whether to resolve `@import` statements
   * @default true
   */
  resolveImports?: boolean;

  /**
   * Whether to generate runtime theme object (not just types)
   * @default true
   */
  generateRuntime?: boolean;

  /**
   * Name of the generated interface
   * @default 'GeneratedTheme'
   */
  interfaceName?: string;

  /**
   * Enable debug logging for troubleshooting
   * @default false
   */
  debug?: boolean;
}

export function tailwindThemeExtractor(
  options: VitePluginOptions,
): PluginOption {
  const {
    input,
    resolveImports = true,
    generateRuntime = true,
    interfaceName = DEFAULT_INTERFACE_NAME,
    debug = false,
  } = options;

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
      generateRuntime,
      interfaceName,
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
        `  ℹ  Tailwind theme types updated from ${path.basename(sourceFile)}`,
      );
    }
  }

  return {
    name: 'vite-plugin-tailwind-theme-extractor',

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
 * - Missing `@import` files: Silently skipped (see extractTheme)
 * - Invalid CSS syntax: Throws error with parse details
 * - File system errors: Throws if output directory cannot be created or files cannot be written
 * - Enable `debug` parameter to log warnings for import resolution failures
 *
 * Generated Files:
 * - Always: themes.d.ts (TypeScript type declarations with module augmentation)
 * - Conditional: themes.ts (runtime theme object, if generateRuntime is true)
 * - Conditional: index.ts (re-exports runtime, if generateRuntime is true)
 *
 * Module Augmentation:
 * The themes.d.ts file uses TypeScript module augmentation to extend the library's
 * Theme interface globally. This provides automatic type hints when importing from
 * the main package, as long as the output directory is in tsconfig.json includes.
 *
 * @param inputPath - Absolute path to the CSS input file
 * @param outputDir - Absolute path to the output directory
 * @param resolveImports - Whether to resolve `@import` statements recursively
 * @param generateRuntime - Whether to generate runtime theme object (not just types)
 * @param interfaceName - Name of the generated TypeScript interface
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
  generateRuntime: boolean,
  interfaceName: string,
  debug: boolean = false,
  basePath?: string,
): Promise<{ files: Array<string> }> {
  try {
    const result = await extractTheme({
      input: inputPath,
      resolveImports,
      debug,
      basePath,
    });

    // Calculate relative path from output directory to source file
    const relativeSourcePath = path.relative(outputDir, inputPath);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Always generate type declarations (.d.ts)
    const typeDeclarations = generateTypeDeclarations(
      result,
      interfaceName,
      relativeSourcePath,
    );

    const dtsPath = path.join(outputDir, OUTPUT_FILES.TYPES);

    // Prepare all file writes
    const writePromises = [fs.writeFile(dtsPath, typeDeclarations, 'utf-8')];

    // Conditionally generate runtime file (.ts)
    if (generateRuntime) {
      const runtimeFile = generateRuntimeFile(result, interfaceName);
      const tsPath = path.join(outputDir, OUTPUT_FILES.RUNTIME);

      // Create an index.ts that re-exports everything for clean imports
      const runtimeModuleName = path.basename(OUTPUT_FILES.RUNTIME, '.ts');
      const indexTs = `export * from './${runtimeModuleName}';\n`;

      writePromises.push(
        fs.writeFile(tsPath, runtimeFile, 'utf-8'),
        fs.writeFile(
          path.join(outputDir, OUTPUT_FILES.INDEX_TS),
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
      `  ✖  Failed to generate Tailwind theme types: ${errorMessage}`,
    );
    throw error;
  }
}
