/**
 * Main CSS parser for resolving Tailwind v4 theme variables
 * Entry point for parsing CSS files and building theme objects
 */

import type { ParseOptions, ParseResult, Theme } from '../types';

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import postcss from 'postcss';

import { narrowParseResult } from '../types';
import { resolveImports } from './import-resolver';
import { loadTailwindDefaults } from './tailwind-defaults';
import { buildThemes } from './theme-builder';
import { extractVariables } from './variable-extractor';

/**
 * Parses CSS file(s) and resolves Tailwind v4 theme variables
 *
 * This is the main entry point for CSS parsing. It handles:
 * - Reading CSS files or parsing raw CSS strings
 * - Recursively resolving @import statements
 * - Resolving variables from @theme and :root blocks
 * - Building a structured theme object
 *
 * Error Handling:
 * - File not found: Throws error if the specified filePath doesn't exist
 * - Missing imports: Failed @import statements are silently skipped (see resolveImports)
 * - Invalid CSS syntax: PostCSS parsing errors will throw and should be caught by caller
 * - Enable `debug` option to log warnings for import resolution failures
 *
 * @template TTheme - The concrete theme type (e.g., GeneratedTheme from generated types)
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
 *   css: '@theme { --color-primary: #3b82f6; }'
 * });
 *
 * // Enable debug mode for troubleshooting
 * const result = await parseCSS({
 *   input: './src/theme.css',
 *   debug: true
 * });
 *
 * // With type parameter for full type safety
 * import type { GeneratedTheme } from './generated/tailwindcss';
 *
 * const result = await parseCSS<GeneratedTheme>({
 *   input: './src/theme.css'
 * });
 * ```
 */
export async function parseCSS<TTheme extends Theme = Theme>(
  options: ParseOptions,
): Promise<ParseResult<TTheme>> {
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

  // Extract variables, keyframes, and CSS rules from @theme, :root, and variant selectors
  const {
    variables: rawVariables,
    keyframes,
    cssRules,
  } = extractVariables(root);

  // Build structured theme objects (base + variants) and resolve all variables
  // Detects and applies CSS rule overrides
  const { theme, variants, deprecationWarnings, cssConflicts, variables } =
    buildThemes(rawVariables, keyframes, cssRules, defaultTheme);

  // Assemble the result with base Theme typing
  const baseResult: ParseResult<Theme> = {
    theme,
    variants,
    variables,
    files: processedFiles,
    deprecationWarnings,
    cssConflicts,
  };

  // Type-safe narrowing to TTheme (runtime structure is identical)
  return narrowParseResult<TTheme>(baseResult);
}
