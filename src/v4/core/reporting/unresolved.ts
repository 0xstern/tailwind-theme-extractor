/**
 * Unresolved variable reporting and file generation
 * Generates human-readable and machine-readable reports for unresolved var() references
 */

import type {
  UnresolvedCause,
  UnresolvedVariable,
} from '../analysis/unresolved';

import { groupByLikelyCause } from '../analysis/unresolved';
import { JSON_INDENT_SPACES } from '../constants/formatting';
import { writeReportFiles } from '../utils/report_writer';
import { capitalizeFirst } from '../utils/string';

/**
 * Metadata for unresolved variable report generation
 */
export interface UnresolvedReportMetadata {
  /** Timestamp when report was generated */
  generatedAt: string;
  /** Source CSS file path */
  source: string;
  /** Package version */
  version?: string;
}

/**
 * Summary statistics for unresolved variables
 */
interface UnresolvedSummary {
  /** Total number of unresolved variables */
  total: number;
  /** Number of external references (plugins, runtime injection, etc.) */
  external: number;
  /** Number of self-referential (intentionally skipped) */
  selfReferential: number;
  /** Number of unknown causes */
  unknown: number;
}

/**
 * JSON structure for unresolved variable report
 */
export interface UnresolvedReportJSON {
  generatedAt: string;
  source: string;
  version?: string;
  summary: UnresolvedSummary;
  unresolved: Array<{
    variableName: string;
    originalValue: string;
    referencedVariable: string;
    fallbackValue?: string;
    source: 'theme' | 'root' | 'variant';
    variantName?: string;
    selector?: string;
    likelyCause: UnresolvedCause;
  }>;
}

/**
 * Runtime type guard for unresolved report JSON structure
 *
 * @param data - The data to validate
 * @returns True if the data matches UnresolvedReportJSON structure
 */
export function isUnresolvedReportJSON(
  data: unknown,
): data is UnresolvedReportJSON {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.generatedAt === 'string' &&
    typeof obj.source === 'string' &&
    (obj.version === undefined || typeof obj.version === 'string') &&
    typeof obj.summary === 'object' &&
    obj.summary !== null &&
    typeof obj.unresolved === 'object' &&
    Array.isArray(obj.unresolved)
  );
}

/**
 * Calculates summary statistics from unresolved variables
 *
 * @param unresolved - Array of unresolved variables
 * @returns Summary statistics
 */
function calculateSummary(
  unresolved: Array<UnresolvedVariable>,
): UnresolvedSummary {
  const grouped = groupByLikelyCause(unresolved);

  return {
    total: unresolved.length,
    external: grouped.get('external')?.length ?? 0,
    selfReferential: grouped.get('self-referential')?.length ?? 0,
    unknown: grouped.get('unknown')?.length ?? 0,
  };
}

/**
 * Generates header section of Markdown report
 *
 * @param metadata - Report metadata
 * @returns Array of header lines
 */
function generateMarkdownHeader(
  metadata: UnresolvedReportMetadata,
): Array<string> {
  const lines: Array<string> = [];
  lines.push('# Unresolved CSS Variables\n');
  lines.push(`**Generated:** ${metadata.generatedAt}`);
  lines.push(`**Source:** ${metadata.source}`);
  if (metadata.version !== undefined) {
    lines.push(`**Version:** ${metadata.version}`);
  }
  lines.push('');
  return lines;
}

/**
 * Generates summary section of Markdown report
 *
 * @param summary - Unresolved variable summary
 * @returns Array of summary lines
 */
function generateMarkdownSummary(summary: UnresolvedSummary): Array<string> {
  const lines: Array<string> = [];
  lines.push('## Summary\n');
  lines.push(`- **Total unresolved:** ${summary.total}`);
  lines.push(
    `- **External references:** ${summary.external} (plugins, runtime injection, external stylesheets)`,
  );
  lines.push(`- **Self-referential (skipped):** ${summary.selfReferential}`);
  lines.push(`- **Unknown:** ${summary.unknown}`);
  lines.push('\n---\n');
  return lines;
}

/**
 * Gets action suggestion based on likely cause
 *
 * @param cause - Likely cause of unresolved variable
 * @returns Suggested action text
 */
function getSuggestedAction(cause: UnresolvedCause): string {
  switch (cause) {
    case 'external':
      return 'Verify this variable is loaded at runtime (framework fonts, plugins, external stylesheets)';
    case 'self-referential':
      return 'Intentionally skipped to use Tailwind defaults - this is expected';
    case 'unknown':
      return 'Review if this variable should be defined in your theme or loaded externally';
  }
}

/**
 * Gets severity icon based on likely cause
 *
 * @param cause - Likely cause of unresolved variable
 * @returns Emoji icon
 */
function getSeverityIcon(cause: UnresolvedCause): string {
  switch (cause) {
    case 'external':
      return '\u2139\uFE0F'; // ℹ️ info
    case 'self-referential':
      return '\u2705'; // ✅ check
    case 'unknown':
      return '\u26A0\uFE0F'; // ⚠️ warning
  }
}

/**
 * Formats cause text for display
 *
 * @param cause - Cause enum value
 * @returns Human-readable cause text
 */
function formatCause(cause: UnresolvedCause): string {
  switch (cause) {
    case 'external':
      return 'External Reference';
    case 'self-referential':
      return 'Self-referential (Intentional)';
    case 'unknown':
      return 'Unknown';
  }
}

/**
 * Generates section for unresolved variables grouped by cause
 *
 * @param unresolved - Array of unresolved variables
 * @returns Array of lines for the section
 */
function generateUnresolvedSection(
  unresolved: Array<UnresolvedVariable>,
): Array<string> {
  const lines: Array<string> = [];

  if (unresolved.length === 0) {
    return lines;
  }

  lines.push('## Unresolved Variables\n');
  lines.push('Variables with `var()` references that could not be resolved:\n');

  const groupedByCause = groupByLikelyCause(unresolved);

  // Order causes by severity: unknown, external, self-referential
  const orderedCauses: Array<UnresolvedCause> = [
    'unknown',
    'external',
    'self-referential',
  ];

  for (const cause of orderedCauses) {
    const items = groupedByCause.get(cause);
    if (items === undefined || items.length === 0) {
      continue;
    }

    lines.push(`### ${getSeverityIcon(cause)} ${formatCause(cause)}\n`);

    for (const item of items) {
      lines.push(`#### \`${item.variableName}\``);
      lines.push(`- **Referenced:** \`${item.referencedVariable}\``);
      lines.push(`- **Original value:** \`${item.originalValue}\``);

      if (item.fallbackValue !== undefined) {
        lines.push(`- **Fallback:** \`${item.fallbackValue}\``);
      }

      lines.push(`- **Source:** ${capitalizeFirst(item.source)}`);

      if (item.variantName !== undefined) {
        lines.push(`- **Variant:** \`${item.variantName}\``);
      }

      if (item.selector !== undefined) {
        lines.push(`- **Selector:** \`${item.selector}\``);
      }

      lines.push(`- **Action:** ${getSuggestedAction(cause)}\n`);
    }
  }

  lines.push('---\n');
  return lines;
}

/**
 * Generates recommendations section
 *
 * @param summary - Summary statistics
 * @returns Array of lines for recommendations section
 */
function generateRecommendationsSection(
  summary: UnresolvedSummary,
): Array<string> {
  const lines: Array<string> = [];

  // Only show recommendations if there are actionable items
  const actionable = summary.unknown + summary.external;

  if (actionable === 0) {
    return lines;
  }

  lines.push('## Recommendations\n');

  if (summary.unknown > 0) {
    lines.push(
      `1. **Review:** ${summary.unknown} unknown variable${summary.unknown === 1 ? '' : 's'} - define in your theme or verify ${summary.unknown === 1 ? 'it is' : 'they are'} loaded externally`,
    );
  }

  if (summary.external > 0) {
    lines.push(
      `2. **Verify:** ${summary.external} external variable${summary.external === 1 ? '' : 's'} (plugins, runtime injection, external stylesheets) - ensure ${summary.external === 1 ? 'it is' : 'they are'} loaded correctly`,
    );
  }

  if (summary.selfReferential > 0) {
    lines.push(
      `3. **Expected:** ${summary.selfReferential} self-referential variable${summary.selfReferential === 1 ? '' : 's'} intentionally skipped to use Tailwind defaults`,
    );
  }

  lines.push('');
  return lines;
}

/**
 * Generates footer section
 *
 * @param metadata - Report metadata
 * @returns Array of footer lines
 */
function generateMarkdownFooter(
  metadata: UnresolvedReportMetadata,
): Array<string> {
  const lines: Array<string> = [];
  lines.push('---\n');
  if (metadata.version !== undefined) {
    lines.push(`_Generated by tailwind-resolver v${metadata.version}_`);
  } else {
    lines.push('_Generated by tailwind-resolver_');
  }
  return lines;
}

/**
 * Generates Markdown report from unresolved variables
 *
 * @param unresolved - Array of unresolved variables
 * @param metadata - Report metadata
 * @returns Markdown content
 */
export function generateMarkdownReport(
  unresolved: Array<UnresolvedVariable>,
  metadata: UnresolvedReportMetadata,
): string {
  const summary = calculateSummary(unresolved);
  const lines: Array<string> = [];

  lines.push(...generateMarkdownHeader(metadata));
  lines.push(...generateMarkdownSummary(summary));
  lines.push(...generateUnresolvedSection(unresolved));
  lines.push(...generateRecommendationsSection(summary));
  lines.push(...generateMarkdownFooter(metadata));

  return lines.join('\n');
}

/**
 * Generates JSON report from unresolved variables
 *
 * @param unresolved - Array of unresolved variables
 * @param metadata - Report metadata
 * @returns JSON content
 */
export function generateJSONReport(
  unresolved: Array<UnresolvedVariable>,
  metadata: UnresolvedReportMetadata,
): string {
  const summary = calculateSummary(unresolved);

  const report: UnresolvedReportJSON = {
    generatedAt: metadata.generatedAt,
    source: metadata.source,
    version: metadata.version,
    summary,
    unresolved: unresolved.map((u) => ({
      variableName: u.variableName,
      originalValue: u.originalValue,
      referencedVariable: u.referencedVariable,
      fallbackValue: u.fallbackValue,
      source: u.source,
      variantName: u.variantName,
      selector: u.selector,
      likelyCause: u.likelyCause,
    })),
  };

  return JSON.stringify(report, null, JSON_INDENT_SPACES);
}

/**
 * Writes unresolved variable reports to files
 *
 * @param outputDir - Directory to write reports to
 * @param unresolved - Array of unresolved variables
 * @param metadata - Report metadata
 * @returns Promise resolving to written file paths
 */
export async function writeUnresolvedReports(
  outputDir: string,
  unresolved: Array<UnresolvedVariable>,
  metadata: UnresolvedReportMetadata,
): Promise<{ markdown: string; json: string }> {
  const markdownContent = generateMarkdownReport(unresolved, metadata);
  const jsonContent = generateJSONReport(unresolved, metadata);

  return writeReportFiles(
    outputDir,
    'unresolved',
    markdownContent,
    jsonContent,
  );
}
