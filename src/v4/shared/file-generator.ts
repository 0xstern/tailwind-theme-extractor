/**
 * Shared file generation logic for CLI and Vite plugin
 */

import type { CSSRuleConflict } from '../parser/conflict-resolver';
import type { RuntimeGenerationOptions } from '../types';

import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveTheme } from '../index';
import { writeConflictReports } from '../parser/conflict-reporter';
import { DEFAULT_INTERFACE_NAME, OUTPUT_FILES } from './constants';
import {
  generateRuntimeFile,
  generateTypeDeclarations,
} from './type-generator';

/**
 * Prepares runtime file write promises
 *
 * @param runtimeOptions - Runtime generation options or false
 * @param result - Theme resolution result
 * @param outputDir - Output directory path
 * @returns Array of write promises
 */
async function prepareRuntimeFileWrites(
  runtimeOptions: RuntimeGenerationOptions | false,
  result: ReturnType<typeof resolveTheme> extends Promise<infer T> ? T : never,
  outputDir: string,
): Promise<Array<Promise<void>>> {
  if (runtimeOptions === false) {
    return [];
  }

  const runtimeFile = generateRuntimeFile(
    result,
    DEFAULT_INTERFACE_NAME,
    runtimeOptions,
  );
  const themePath = path.join(outputDir, OUTPUT_FILES.THEME);
  const indexTs = `export type * from './types';\nexport * from './theme';\n`;

  return [
    fs.writeFile(themePath, runtimeFile, 'utf-8'),
    fs.writeFile(path.join(outputDir, OUTPUT_FILES.INDEX), indexTs, 'utf-8'),
  ];
}

/**
 * Attempts to find package version from package.json
 *
 * @returns Package version or undefined if not found
 */
async function findPackageVersion(): Promise<string | undefined> {
  const possiblePaths = [
    path.join(__dirname, '../../package.json'), // From dist/v4/shared
    path.join(__dirname, '../../../package.json'), // Fallback
    path.join(process.cwd(), 'package.json'), // Last resort
  ];

  for (const packageJsonPath of possiblePaths) {
    try {
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf-8'),
      ) as { version?: string };
      if (packageJson.version !== undefined) {
        return packageJson.version;
      }
    } catch {
      // Try next path
      continue;
    }
  }

  return undefined;
}

/**
 * Processes and writes conflict reports if conflicts exist
 *
 * @param result - Theme resolution result
 * @param outputDir - Output directory path
 * @param relativeSourcePath - Relative path to source file
 * @returns Conflict info or undefined
 */
async function processConflictReports(
  result: ReturnType<typeof resolveTheme> extends Promise<infer T> ? T : never,
  outputDir: string,
  relativeSourcePath: string,
): Promise<{ count: number; reportPath: string } | undefined> {
  const conflicts =
    result.cssConflicts !== undefined && Array.isArray(result.cssConflicts)
      ? (result.cssConflicts as Array<CSSRuleConflict>)
      : undefined;

  if (conflicts === undefined || conflicts.length === 0) {
    return undefined;
  }

  const version = await findPackageVersion();
  const reportPaths = await writeConflictReports(outputDir, conflicts, {
    generatedAt: new Date().toISOString(),
    source: relativeSourcePath,
    version,
  });

  return {
    count: conflicts.length,
    reportPath: reportPaths.markdown,
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
 * - Conditional: conflicts.md and conflicts.json (if CSS conflicts detected)
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
 * @returns Promise resolving to object with files and optional conflict info
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
): Promise<{
  files: Array<string>;
  conflictCount?: number;
  conflictReportPath?: string;
}> {
  try {
    const result = await resolveTheme({
      input: inputPath,
      resolveImports,
      includeTailwindDefaults,
      debug,
      basePath,
    });

    const relativeSourcePath = path.relative(outputDir, inputPath);
    await fs.mkdir(outputDir, { recursive: true });

    const typeDeclarations = generateTypeDeclarations(
      result,
      DEFAULT_INTERFACE_NAME,
      relativeSourcePath,
    );

    const typesPath = path.join(outputDir, OUTPUT_FILES.TYPES);
    const writePromises = [fs.writeFile(typesPath, typeDeclarations, 'utf-8')];

    const runtimeWrites = await prepareRuntimeFileWrites(
      runtimeOptions,
      result,
      outputDir,
    );
    writePromises.push(...runtimeWrites);

    const conflictInfo = await processConflictReports(
      result,
      outputDir,
      relativeSourcePath,
    );

    await Promise.all(writePromises);

    return {
      files: result.files,
      conflictCount: conflictInfo?.count,
      conflictReportPath: conflictInfo?.reportPath,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `  ✖  Failed to generate Tailwind theme types from ${inputPath}: ${errorMessage}`,
    );
    throw error;
  }
}
