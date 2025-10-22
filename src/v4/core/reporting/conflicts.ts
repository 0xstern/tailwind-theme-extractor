/**
 * CSS conflict reporting and file generation
 * Generates human-readable and machine-readable conflict reports
 */

import type { CSSRuleConflict } from '../analysis/conflicts';

import { JSON_INDENT_SPACES } from '../constants/formatting';
import { groupBy } from '../utils/grouping';
import { writeReportFiles } from '../utils/report_writer';
import { capitalizeFirst } from '../utils/string';

/**
 * Metadata for conflict report generation
 */
export interface ConflictReportMetadata {
  /** Timestamp when report was generated */
  generatedAt: string;
  /** Source CSS file path */
  source: string;
  /** Package version */
  version?: string;
}

/**
 * Summary statistics for conflicts
 */
interface ConflictSummary {
  /** Total number of conflicts detected */
  total: number;
  /** Number of auto-resolved conflicts */
  autoResolved: number;
  /** Number of conflicts requiring manual review */
  manualReview: number;
}

/**
 * JSON structure for conflict report
 */
export interface ConflictReportJSON {
  generatedAt: string;
  source: string;
  version?: string;
  summary: ConflictSummary;
  conflicts: Array<{
    variantName: string;
    themeProperty: string;
    themeKey: string;
    selector: string;
    variableValue: string;
    ruleValue: string;
    confidence: 'high' | 'medium' | 'low';
    canResolve: boolean;
    applied: boolean;
    reason?: string;
    inMediaQuery?: boolean;
    mediaQuery?: string;
  }>;
}

/**
 * Runtime type guard for conflict report JSON structure
 *
 * @param data - The data to validate
 * @returns True if the data matches ConflictReportJSON structure
 */
export function isConflictReportJSON(
  data: unknown,
): data is ConflictReportJSON {
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
    typeof obj.conflicts === 'object' &&
    Array.isArray(obj.conflicts)
  );
}

/**
 * Calculates summary statistics from conflicts
 * @param conflicts - Array of CSS rule conflicts
 * @returns Summary statistics
 */
function calculateSummary(conflicts: Array<CSSRuleConflict>): ConflictSummary {
  const autoResolved = conflicts.filter(
    (c) => c.canResolve && c.confidence === 'high',
  ).length;

  return {
    total: conflicts.length,
    autoResolved,
    manualReview: conflicts.length - autoResolved,
  };
}

/**
 * Groups conflicts by variant name
 * @param conflicts - Array of conflicts
 * @returns Map of variant name to conflicts
 */
function groupByVariant(
  conflicts: Array<CSSRuleConflict>,
): Map<string, Array<CSSRuleConflict>> {
  return groupBy(conflicts, (conflict) => conflict.variantName);
}

/**
 * Generates header section of Markdown report
 * @param metadata - Report metadata
 * @returns Array of header lines
 */
function generateMarkdownHeader(
  metadata: ConflictReportMetadata,
): Array<string> {
  const lines: Array<string> = [];
  lines.push('# CSS Rule Conflicts\n');
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
 * @param summary - Conflict summary
 * @returns Array of summary lines
 */
function generateMarkdownSummary(summary: ConflictSummary): Array<string> {
  const lines: Array<string> = [];
  lines.push('## Summary\n');
  lines.push(`- **Total conflicts:** ${summary.total}`);
  lines.push(`- **Auto-resolved:** ${summary.autoResolved} (high confidence)`);
  lines.push(
    `- **Manual review needed:** ${summary.manualReview} (medium/low confidence)`,
  );
  lines.push('\n---\n');
  return lines;
}

/**
 * Generates auto-resolved conflicts section
 * @param conflicts - All conflicts
 * @returns Array of lines for auto-resolved section
 */
function generateAutoResolvedSection(
  conflicts: Array<CSSRuleConflict>,
): Array<string> {
  const lines: Array<string> = [];
  const autoResolved = conflicts.filter(
    (c) => c.canResolve && c.confidence === 'high',
  );

  if (autoResolved.length === 0) {
    return lines;
  }

  lines.push('## Auto-Resolved Conflicts\n');
  lines.push('These conflicts were automatically applied to variant themes:\n');

  const resolvedByVariant = groupByVariant(autoResolved);

  for (const [variantName, variantConflicts] of resolvedByVariant) {
    lines.push(`### Variant: \`${variantName}\`\n`);
    for (const conflict of variantConflicts) {
      lines.push(`#### \`${conflict.themeProperty}.${conflict.themeKey}\``);
      lines.push(`- **Location:** \`${conflict.ruleSelector}\``);
      lines.push(`- **Variable value:** \`${conflict.variableValue}\``);
      lines.push(`- **Rule value:** \`${conflict.ruleValue}\``);
      lines.push(`- **Confidence:** ${capitalizeFirst(conflict.confidence)}`);
      lines.push('- **Status:** ✅ Applied\n');
    }
  }
  lines.push('---\n');
  return lines;
}

/**
 * Generates manual review section
 * @param conflicts - All conflicts
 * @returns Array of lines for manual review section
 */
function generateManualReviewSection(
  conflicts: Array<CSSRuleConflict>,
): Array<string> {
  const lines: Array<string> = [];
  const manualReview = conflicts.filter(
    (c) => !c.canResolve || c.confidence !== 'high',
  );

  if (manualReview.length === 0) {
    return lines;
  }

  lines.push('## Manual Review Required\n');
  lines.push('These conflicts were detected but NOT automatically applied:\n');

  const reviewByVariant = groupByVariant(manualReview);

  for (const [variantName, variantConflicts] of reviewByVariant) {
    lines.push(`### Variant: \`${variantName}\`\n`);
    for (const conflict of variantConflicts) {
      lines.push(`#### \`${conflict.themeProperty}.${conflict.themeKey}\``);
      lines.push(`- **Location:** \`${conflict.ruleSelector}\``);

      if (
        conflict.cssRule.inMediaQuery === true &&
        conflict.cssRule.mediaQuery !== undefined
      ) {
        lines.push(`- **Media Query:** \`${conflict.cssRule.mediaQuery}\``);
      }

      lines.push(`- **Variable value:** \`${conflict.variableValue}\``);
      lines.push(`- **Rule value:** \`${conflict.ruleValue}\``);
      lines.push(`- **Confidence:** ${capitalizeFirst(conflict.confidence)}`);

      if (conflict.cssRule.reason !== undefined) {
        lines.push(`- **Reason:** ${conflict.cssRule.reason}`);
      }

      lines.push('- **Status:** ⚠️ Skipped');
      lines.push(
        `- **Action:** ${getSuggestedAction(conflict.cssRule.reason)}\n`,
      );
    }
  }
  lines.push('---\n');
  return lines;
}

/**
 * Generates recommendations section
 * @param conflicts - All conflicts
 * @returns Array of lines for recommendations section
 */
function generateRecommendationsSection(
  conflicts: Array<CSSRuleConflict>,
): Array<string> {
  const lines: Array<string> = [];
  const manualReview = conflicts.filter(
    (c) => !c.canResolve || c.confidence !== 'high',
  );

  if (manualReview.length === 0) {
    return lines;
  }

  lines.push('## Recommendations\n');

  const pseudoClassCount = manualReview.filter((c) =>
    c.cssRule.reason?.includes('Pseudo-class'),
  ).length;
  const mediaQueryCount = manualReview.filter((c) =>
    c.cssRule.reason?.includes('media query'),
  ).length;
  const dynamicValueCount = manualReview.filter((c) =>
    c.cssRule.reason?.includes('Dynamic CSS'),
  ).length;

  if (pseudoClassCount > 0) {
    lines.push(
      `1. **High-priority:** Review ${pseudoClassCount} conflict${pseudoClassCount === 1 ? '' : 's'} with pseudo-class selectors`,
    );
  }
  if (mediaQueryCount > 0) {
    lines.push(
      `2. **Consider:** Extract media-query-specific values to separate theme keys (${mediaQueryCount} conflict${mediaQueryCount === 1 ? '' : 's'})`,
    );
  }
  if (dynamicValueCount > 0) {
    lines.push(
      `3. **Review:** ${dynamicValueCount} conflict${dynamicValueCount === 1 ? '' : 's'} with dynamic CSS values`,
    );
  }

  lines.push(
    '4. **Cleanup:** Consider removing redundant CSS rules that match variable values exactly\n',
  );

  return lines;
}

/**
 * Generates footer section
 * @param metadata - Report metadata
 * @returns Array of footer lines
 */
function generateMarkdownFooter(
  metadata: ConflictReportMetadata,
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
 * Generates Markdown report from conflicts
 * @param conflicts - Array of CSS rule conflicts
 * @param metadata - Report metadata
 * @returns Markdown content
 */
export function generateMarkdownReport(
  conflicts: Array<CSSRuleConflict>,
  metadata: ConflictReportMetadata,
): string {
  const summary = calculateSummary(conflicts);
  const lines: Array<string> = [];

  lines.push(...generateMarkdownHeader(metadata));
  lines.push(...generateMarkdownSummary(summary));
  lines.push(...generateAutoResolvedSection(conflicts));
  lines.push(...generateManualReviewSection(conflicts));
  lines.push(...generateRecommendationsSection(conflicts));
  lines.push(...generateMarkdownFooter(metadata));

  return lines.join('\n');
}

/**
 * Generates JSON report from conflicts
 * @param conflicts - Array of CSS rule conflicts
 * @param metadata - Report metadata
 * @returns JSON content
 */
export function generateJSONReport(
  conflicts: Array<CSSRuleConflict>,
  metadata: ConflictReportMetadata,
): string {
  const summary = calculateSummary(conflicts);

  const report: ConflictReportJSON = {
    generatedAt: metadata.generatedAt,
    source: metadata.source,
    version: metadata.version,
    summary,
    conflicts: conflicts.map((c) => ({
      variantName: c.variantName,
      themeProperty: String(c.themeProperty),
      themeKey: c.themeKey,
      selector: c.ruleSelector,
      variableValue: c.variableValue,
      ruleValue: c.ruleValue,
      confidence: c.confidence,
      canResolve: c.canResolve,
      applied: c.canResolve && c.confidence === 'high',
      reason: c.cssRule.reason,
      inMediaQuery: c.cssRule.inMediaQuery,
      mediaQuery: c.cssRule.mediaQuery,
    })),
  };

  return JSON.stringify(report, null, JSON_INDENT_SPACES);
}

/**
 * Writes conflict reports to files
 * @param outputDir - Directory to write reports to
 * @param conflicts - Array of CSS rule conflicts
 * @param metadata - Report metadata
 * @returns Promise resolving to written file paths
 */
export async function writeConflictReports(
  outputDir: string,
  conflicts: Array<CSSRuleConflict>,
  metadata: ConflictReportMetadata,
): Promise<{ markdown: string; json: string }> {
  const markdownContent = generateMarkdownReport(conflicts, metadata);
  const jsonContent = generateJSONReport(conflicts, metadata);

  return writeReportFiles(outputDir, 'conflicts', markdownContent, jsonContent);
}

/**
 * Gets suggested action based on conflict reason
 * @param reason - Conflict reason
 * @returns Suggested action text
 */
function getSuggestedAction(reason?: string): string {
  if (reason === undefined) {
    return 'Review if this override is intentional';
  }

  if (reason.includes('Pseudo-class')) {
    return 'Review if this state-dependent override is intentional';
  }

  if (reason.includes('Pseudo-element')) {
    return 'Consider extracting pseudo-element styles to separate theme';
  }

  if (reason.includes('media query')) {
    return 'Consider extracting to separate media-query-specific variable';
  }

  if (reason.includes('Dynamic CSS')) {
    return 'Consider simplifying to static value or documenting dependency';
  }

  if (reason.includes('combinator') || reason.includes('Descendant')) {
    return 'Consider simplifying selector or using separate theme key';
  }

  if (reason.includes('@apply')) {
    return 'Expand @apply directive to explicit CSS properties';
  }

  return 'Review if this override is intentional';
}
