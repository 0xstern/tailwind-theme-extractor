/**
 * Main CSS parser for extracting Tailwind v4 theme variables
 * Entry point for parsing CSS files and building theme objects
 */

import type { ParseOptions, ParseResult } from '../types';

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import postcss from 'postcss';

import { resolveImports } from './import-resolver';
import { buildThemes } from './theme-builder';
import { extractVariables } from './variable-extractor';

/**
 * Parses CSS file(s) and extracts Tailwind v4 theme variables
 *
 * This is the main entry point for CSS parsing. It handles:
 * - Reading CSS files or parsing raw CSS strings
 * - Recursively resolving @import statements
 * - Extracting variables from @theme and :root blocks
 * - Building a structured theme object
 *
 * Error Handling:
 * - File not found: Throws error if the specified filePath doesn't exist
 * - Missing imports: Failed @import statements are silently skipped (see resolveImports)
 * - Invalid CSS syntax: PostCSS parsing errors will throw and should be caught by caller
 * - Enable `debug` option to log warnings for import resolution failures
 *
 * @param options - Parse options specifying the CSS source and behavior
 * @returns Promise resolving to the parse result with theme, variables, and processed files
 * @throws Error if neither filePath nor css is provided
 * @throws Error if filePath is provided but file cannot be read
 * @throws Error if CSS syntax is invalid and cannot be parsed by PostCSS
 *
 * @example
 * ```typescript
 * // Parse from file
 * const result = await parseCSS({
 *   filePath: './src/theme.css',
 *   resolveImports: true
 * });
 *
 * // Parse from string
 * const result = await parseCSS({
 *   css: '@theme { --color-primary: #3b82f6; }'
 * });
 *
 * // Enable debug mode for troubleshooting
 * const result = await parseCSS({
 *   filePath: './src/theme.css',
 *   debug: true
 * });
 * ```
 */
export async function parseCSS(options: ParseOptions): Promise<ParseResult> {
  const {
    filePath,
    css,
    basePath,
    resolveImports: shouldResolveImports = true,
    debug = false,
  } = options;

  // Validate input
  if (filePath === undefined && css === undefined) {
    throw new Error('Either filePath or css must be provided');
  }

  let cssContent: string;
  let baseDir: string;
  const processedFiles: Array<string> = [];

  // Read CSS content
  if (filePath !== undefined) {
    cssContent = await readFile(filePath, 'utf-8');
    baseDir = dirname(resolve(filePath));
    processedFiles.push(resolve(filePath));
  } else {
    cssContent = css as string;
    baseDir = basePath ?? process.cwd();
  }

  // Parse CSS with PostCSS
  const root = postcss.parse(cssContent);

  // Resolve imports if requested
  if (shouldResolveImports) {
    const importedFiles = await resolveImports(
      root,
      baseDir,
      new Set(processedFiles),
      debug,
    );
    processedFiles.push(...importedFiles);
  }

  // Extract variables and keyframes from @theme, :root, and variant selectors
  const { variables, keyframes } = extractVariables(root);

  // Build structured theme objects (base + variants)
  const { theme, variants, deprecationWarnings } = buildThemes(
    variables,
    keyframes,
  );

  return {
    theme,
    variants,
    variables,
    files: processedFiles,
    deprecationWarnings,
  };
}
