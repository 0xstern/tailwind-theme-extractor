/**
 * Main CSS parser for resolving Tailwind v4 theme variables
 * Entry point for parsing CSS files and building theme objects
 */

import type { ParseOptions, ParseResult, Theme } from '../../types';

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import postcss from 'postcss';

import { narrowParseResult } from '../../types';
import { buildThemes } from '../theme/builder';
import { loadTailwindDefaults } from '../theme/defaults';
import { extractVariables } from './extractor';
import { resolveImports } from './imports';

/**
 * Reads CSS content from either a file or inline string
 * @param options - Parse options with input or css
 * @returns CSS content, base directory, and initial processed files
 */
async function readCSSContent(options: ParseOptions): Promise<{
  cssContent: string;
  baseDir: string;
  processedFiles: Array<string>;
}> {
  const { input, css, basePath } = options;

  if (input === undefined && css === undefined) {
    throw new Error('Either input or css must be provided');
  }

  if (input !== undefined) {
    const cssContent = await readFile(input, 'utf-8');
    const baseDir = dirname(resolve(input));
    const processedFiles = [resolve(input)];
    return { cssContent, baseDir, processedFiles };
  }

  return {
    cssContent: css as string,
    baseDir: basePath ?? process.cwd(),
    processedFiles: [],
  };
}

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
 * // With theme overrides
 * const result = await parseCSS({
 *   input: './src/theme.css',
 *   overrides: {
 *     'dark': { 'colors.background': '#000000' },
 *     '*': { 'fonts.sans': 'Inter, sans-serif' }
 *   }
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
    basePath,
    resolveImports: shouldResolveImports = true,
    debug = false,
    overrides,
    nesting,
  } = options;

  // Read CSS content from file or inline string
  const { cssContent, baseDir, processedFiles } = await readCSSContent(options);

  // Parse CSS with PostCSS
  const root = postcss.parse(cssContent);

  // Run independent async operations in parallel for better performance
  const [importedFiles, defaultsResult] = await Promise.all([
    shouldResolveImports
      ? resolveImports(root, baseDir, new Set(processedFiles), debug)
      : Promise.resolve([]),
    // Load Tailwind defaults for var() resolution with nesting config
    // Use basePath if provided, otherwise fall back to process.cwd()
    // (baseDir is the CSS file's directory, not the project root)
    // Pass nesting config to ensure defaults respect the same nesting rules as user variables
    loadTailwindDefaults(basePath ?? process.cwd(), nesting),
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

  // Extract default variables for resolution (preserves original variable names)
  const defaultVariables = defaultsResult?.variables;

  // Build structured theme objects (base + variants) and resolve all variables
  // Detects and applies CSS rule overrides and unresolved variable references
  const {
    theme,
    variants,
    deprecationWarnings,
    cssConflicts,
    variables,
    unresolvedVariables,
  } = buildThemes(
    rawVariables,
    keyframes,
    cssRules,
    defaultVariables,
    overrides,
    nesting,
    debug,
  );

  // Assemble the result with base Theme typing
  const baseResult: ParseResult<Theme> = {
    theme,
    variants,
    variables,
    files: processedFiles,
    deprecationWarnings,
    cssConflicts,
    unresolvedVariables,
  };

  // Type-safe narrowing to TTheme (runtime structure is identical)
  return narrowParseResult<TTheme>(baseResult);
}
