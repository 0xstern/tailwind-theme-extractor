/**
 * Main CSS parser for extracting Tailwind v4 theme variables
 * Entry point for parsing CSS files and building theme objects
 */

import type { ParseOptions, ParseResult } from '../types';

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import postcss from 'postcss';

import { resolveImports } from './import-resolver';
import { loadTailwindDefaults } from './tailwind-defaults';
import { buildThemes } from './theme-builder';
import { extractVariables } from './variable-extractor';

/**
 * Parses CSS file(s) and extracts Tailwind v4 theme variables
 *
 * This is the main entry point for CSS parsing. It handles:
 * - Reading CSS files or parsing raw CSS strings
 * - Recursively resolving `@import` statements
 * - Extracting variables from `@theme` and :root blocks
 * - Building a structured theme object
 *
 * Error Handling:
 * - File not found: Throws error if the specified filePath doesn't exist
 * - Missing imports: Failed `@import` statements are silently skipped (see resolveImports)
 * - Invalid CSS syntax: PostCSS parsing errors will throw and should be caught by caller
 * - Enable `debug` option to log warnings for import resolution failures
 *
 * @param options - Parse options specifying the CSS source and behavior
 * @returns Promise resolving to the parse result with theme, variables, and processed files
 * @throws Error if neither input nor css is provided
 * @throws Error if input is provided but file cannot be read
 * @throws Error if CSS syntax is invalid and cannot be parsed by PostCSS
 *
 * @example
 * ```typescript
 * // Parse from file
 * const result = await parseCSS({
 *   input: './src/theme.css',
 *   resolveImports: true
 * });
 *
 * // Parse from string
 * const result = await parseCSS({
 *   css: '`@theme` { --color-primary: #3b82f6; }'
 * });
 *
 * // Enable debug mode for troubleshooting
 * const result = await parseCSS({
 *   input: './src/theme.css',
 *   debug: true
 * });
 * ```
 */
export async function parseCSS(options: ParseOptions): Promise<ParseResult> {
  const {
    input,
    css,
    basePath,
    resolveImports: shouldResolveImports = true,
    debug = false,
  } = options;

  // Validate input
  if (input === undefined && css === undefined) {
    throw new Error('Either input or css must be provided');
  }

  let cssContent: string;
  let baseDir: string;
  const processedFiles: Array<string> = [];

  // Read CSS content
  if (input !== undefined) {
    cssContent = await readFile(input, 'utf-8');
    baseDir = dirname(resolve(input));
    processedFiles.push(resolve(input));
  } else {
    cssContent = css as string;
    baseDir = basePath ?? process.cwd();
  }

  // Parse CSS with PostCSS
  const root = postcss.parse(cssContent);

  // Run independent async operations in parallel for better performance
  const [importedFiles, defaultTheme] = await Promise.all([
    shouldResolveImports
      ? resolveImports(root, baseDir, new Set(processedFiles), debug)
      : Promise.resolve([]),
    // Load Tailwind defaults for var() resolution
    // Use basePath if provided, otherwise fall back to process.cwd()
    // (baseDir is the CSS file's directory, not the project root)
    loadTailwindDefaults(basePath ?? process.cwd()),
  ]);

  // Track imported files
  if (shouldResolveImports) {
    processedFiles.push(...importedFiles);
  }

  // Extract variables and keyframes from @theme, :root, and variant selectors
  const { variables: rawVariables, keyframes } = extractVariables(root);

  // Build structured theme objects (base + variants) and resolve all variables
  const { theme, variants, deprecationWarnings, variables } = buildThemes(
    rawVariables,
    keyframes,
    defaultTheme,
  );

  return {
    theme,
    variants,
    variables,
    files: processedFiles,
    deprecationWarnings,
  };
}
