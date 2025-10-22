/**
 * File writing utilities for report generation
 * Centralizes file I/O operations for consistency
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Writes both markdown and JSON report files to a directory
 *
 * This utility ensures consistent file writing behavior across all report
 * generators (conflicts, unresolved variables, etc.). It handles directory
 * creation and writes both formats in parallel for efficiency.
 *
 * @param outputDir - Directory to write reports to (will be created if needed)
 * @param baseFilename - Base name for files (without extension)
 * @param markdownContent - Content for the .md file
 * @param jsonContent - Content for the .json file
 * @returns Promise resolving to absolute paths of written files
 *
 * @example
 * ```typescript
 * const paths = await writeReportFiles(
 *   './reports',
 *   'conflicts',
 *   '# Conflicts\n...',
 *   '{"conflicts": [...]}'
 * );
 * // {
 * //   markdown: '/absolute/path/reports/conflicts.md',
 * //   json: '/absolute/path/reports/conflicts.json'
 * // }
 * ```
 */
export async function writeReportFiles(
  outputDir: string,
  baseFilename: string,
  markdownContent: string,
  jsonContent: string,
): Promise<{ markdown: string; json: string }> {
  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Construct file paths
  const markdownPath = join(outputDir, `${baseFilename}.md`);
  const jsonPath = join(outputDir, `${baseFilename}.json`);

  // Write both files in parallel for performance
  await Promise.all([
    writeFile(markdownPath, markdownContent, 'utf-8'),
    writeFile(jsonPath, jsonContent, 'utf-8'),
  ]);

  return {
    markdown: markdownPath,
    json: jsonPath,
  };
}
