/**
 * CSS `@import` resolver for Tailwind theme files
 * Recursively resolves and inlines `@import` statements
 */

import type { AtRule, Root } from 'postcss';

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import postcss from 'postcss';

/**
 * Resolves all `@import` statements in a PostCSS AST recursively
 *
 * This function performs graceful error handling by design:
 * - Missing files: `@import` statements referencing non-existent files are silently removed
 * - Invalid CSS: Malformed CSS in imported files causes the `@import` to be removed
 * - Permission errors: Files that can't be read due to permissions are skipped
 * - Circular imports: Already-processed files are skipped to prevent infinite loops
 *
 * When errors occur, the `@import` rule is removed from the AST, allowing the rest of the
 * CSS to be parsed successfully. Enable `debug` mode to log warnings for troubleshooting.
 *
 * @param root - The PostCSS root node to process
 * @param basePath - Base directory path for resolving relative imports
 * @param processedFiles - Set of already processed file paths to prevent circular imports
 * @param debug - Enable debug logging for troubleshooting failed imports
 * @returns Array of file paths that were processed
 */
export async function resolveImports(
  root: Root,
  basePath: string,
  processedFiles: Set<string> = new Set(),
  debug: boolean = false,
): Promise<Array<string>> {
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

  // Process each import
  for (const { atRule, importPath } of importsToProcess) {
    const resolvedPath = resolve(basePath, importPath);

    // Skip if already processed (circular import prevention)
    if (processedFiles.has(resolvedPath)) {
      atRule.remove();
      continue;
    }

    try {
      // Read the imported file
      const importedCss = await readFile(resolvedPath, 'utf-8');

      // Parse the imported CSS
      const importedRoot = postcss.parse(importedCss);

      // Recursively resolve imports in the imported file
      processedFiles.add(resolvedPath);
      const nestedFiles = await resolveImports(
        importedRoot,
        dirname(resolvedPath),
        processedFiles,
        debug,
      );
      importedFiles.push(resolvedPath, ...nestedFiles);

      // Replace the `@import` rule with the actual content
      atRule.replaceWith(importedRoot.nodes);
    } catch (error: unknown) {
      // If file can't be read, remove the `@import` rule
      // This allows graceful handling of missing files or invalid CSS
      if (debug) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `[Tailwind Theme Extractor] Failed to resolve import: ${importPath}`,
        );
        console.warn(`  Resolved path: ${resolvedPath}`);
        console.warn(`  Error: ${errorMessage}`);
      }
      atRule.remove();
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
 * @returns The extracted file path, or null if parsing fails
 */
function parseImportPath(params: string): string | null {
  // Remove whitespace
  const trimmed = params.trim();

  // Handle url() syntax
  const urlMatch = trimmed.match(/^url\(['"]?([^'"]+)['"]?\)/);
  if (urlMatch?.[1] !== undefined) {
    return urlMatch[1];
  }

  // Handle direct string syntax
  const stringMatch = trimmed.match(/^['"]([^'"]+)['"]/);
  if (stringMatch?.[1] !== undefined) {
    return stringMatch[1];
  }

  return null;
}
