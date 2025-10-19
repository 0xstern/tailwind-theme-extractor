/**
 * CSS `@import` resolver for Tailwind theme files
 * Recursively resolves and inlines `@import` statements
 */

import type { AtRule, Root } from 'postcss';

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import postcss from 'postcss';

/**
 * Maximum import depth to prevent stack overflow from deeply nested imports
 */
const MAX_IMPORT_DEPTH = 50;

/**
 * Compiled regex patterns for parseImportPath (avoid recompilation on each call)
 */
const URL_IMPORT_REGEX = /^url\(['"]?([^'"]+)['"]?\)/;
const STRING_IMPORT_REGEX = /^['"]([^'"]+)['"]/;

/**
 * Resolves all `@import` statements in a PostCSS AST recursively
 *
 * This function performs graceful error handling by design:
 * - Missing files: `@import` statements referencing non-existent files are silently removed
 * - Invalid CSS: Malformed CSS in imported files causes the `@import` to be removed
 * - Permission errors: Files that can't be read due to permissions are skipped
 * - Circular imports: Already-processed files are skipped to prevent infinite loops
 * - Deep nesting: Import depth is limited to 50 levels to prevent stack overflow
 *
 * When errors occur, the `@import` rule is removed from the AST, allowing the rest of the
 * CSS to be parsed successfully. Enable `debug` mode to log warnings for troubleshooting.
 *
 * @param root - The PostCSS root node to process
 * @param basePath - Base directory path for resolving relative imports
 * @param processedFiles - Set of already processed file paths to prevent circular imports
 * @param debug - Enable debug logging for troubleshooting failed imports
 * @param depth - Current import depth (internal use for recursion tracking)
 * @returns Array of file paths that were processed
 * @throws Error if import depth exceeds MAX_IMPORT_DEPTH
 */
export async function resolveImports(
  root: Root,
  basePath: string,
  processedFiles: Set<string> = new Set(),
  debug: boolean = false,
  depth: number = 0,
): Promise<Array<string>> {
  // Prevent stack overflow from deeply nested imports
  if (depth > MAX_IMPORT_DEPTH) {
    throw new Error(
      `Import depth exceeded maximum of ${MAX_IMPORT_DEPTH} levels. This may indicate circular imports or excessively nested file structure.`,
    );
  }
  const importedFiles: Array<string> = [];
  const importsToProcess: Array<{
    atRule: AtRule;
    importPath: string;
  }> = [];

  // Collect all `@import` rules
  root.walkAtRules('import', (atRule: AtRule) => {
    const importPath = parseImportPath(atRule.params);

    if (importPath !== null && !importPath.startsWith('tailwindcss')) {
      // Skip Tailwind's own imports
      importsToProcess.push({ atRule, importPath });
    }
  });

  // Process imports in parallel for better performance
  const results = await Promise.allSettled(
    importsToProcess.map(async ({ atRule, importPath }) => {
      const resolvedPath = resolve(basePath, importPath);

      // Skip if already processed (circular import prevention)
      if (processedFiles.has(resolvedPath)) {
        return { atRule, action: 'skip' as const };
      }

      try {
        // Read the imported file
        const importedCss = await readFile(resolvedPath, 'utf-8');

        // Parse the imported CSS
        const importedRoot = postcss.parse(importedCss);

        // Mark as processed before recursing to prevent circular imports
        processedFiles.add(resolvedPath);

        // Recursively resolve imports in the imported file
        const nestedFiles = await resolveImports(
          importedRoot,
          dirname(resolvedPath),
          processedFiles,
          debug,
          depth + 1,
        );

        return {
          atRule,
          action: 'replace' as const,
          importedRoot,
          resolvedPath,
          nestedFiles,
        };
      } catch (error: unknown) {
        // If file can't be read, we'll remove the `@import` rule
        if (debug) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.warn(
            `[Tailwind Theme Resolver] Failed to resolve import: ${importPath}`,
          );
          console.warn(`  Resolved path: ${resolvedPath}`);
          console.warn(`  Error: ${errorMessage}`);
        }
        return { atRule, action: 'error' as const };
      }
    }),
  );

  // Apply the results to the AST
  for (const result of results) {
    if (result.status === 'rejected') {
      // This should not happen since we catch errors above, but handle defensively
      continue;
    }

    const { value } = result;

    if (value.action === 'skip' || value.action === 'error') {
      value.atRule.remove();
    } else {
      // value.action === 'replace'
      importedFiles.push(value.resolvedPath, ...value.nestedFiles);
      value.atRule.replaceWith(value.importedRoot.nodes);
    }
  }

  return importedFiles;
}

/**
 * Parses an `@import` rule parameter to extract the file path
 *
 * Handles various formats:
 * - `@import` "file.css"
 * - `@import` 'file.css'
 * - `@import` url("file.css")
 * - `@import` url('file.css')
 *
 * @param params - The raw params string from the `@import` at-rule
 * @returns The resolved file path, or null if parsing fails
 */
function parseImportPath(params: string): string | null {
  // Remove whitespace
  const trimmed = params.trim();

  // Handle url() syntax
  const urlMatch = trimmed.match(URL_IMPORT_REGEX);
  if (urlMatch?.[1] !== undefined) {
    return urlMatch[1];
  }

  // Handle direct string syntax
  const stringMatch = trimmed.match(STRING_IMPORT_REGEX);
  if (stringMatch?.[1] !== undefined) {
    return stringMatch[1];
  }

  return null;
}
