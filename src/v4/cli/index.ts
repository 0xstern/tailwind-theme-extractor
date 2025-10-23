#!/usr/bin/env node
/**
 * CLI tool for generating Tailwind theme types and runtime objects
 */
import type {
  NestingOptions,
  ReportGenerationOptions,
  RuntimeGenerationOptions,
  TailwindDefaultsOptions,
} from '../types';

import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { OUTPUT_FILES } from '../shared/constants';
import { generateThemeFiles } from '../shared/file_generator';
import { autoDetectOutputDir } from '../shared/utils';

interface CliOptions {
  input?: string;
  output?: string;
  runtime?: boolean;
  'include-defaults'?: string | boolean;
  'exclude-defaults'?: string | boolean;
  reports?: string | boolean;
  'exclude-reports'?: string | boolean;
  'nesting-max-depth'?: string;
  'nesting-consecutive-camel'?: boolean;
  'nesting-flatten-mode'?: string;
  debug?: boolean;
  help?: boolean;
}

const HELP_TEXT = `
Tailwind Theme Resolver CLI

Usage:
  tailwind-resolver [options]

Options:
  --input, -i <path>               Path to CSS input file (required)
  --output, -o <path>              Output directory (default: auto-detect)
  --runtime, -r                    Generate runtime theme object (default: true)
  --no-runtime                     Skip runtime generation (types only)
  --include-defaults [categories]  Include Tailwind defaults (default: all)
                                   Optionally specify comma-separated categories
  --exclude-defaults [categories]  Exclude Tailwind defaults (default: all)
                                   Optionally specify comma-separated categories
  --reports [categories]           Generate diagnostic reports (default: all)
                                   Optionally specify comma-separated categories
  --exclude-reports [categories]   Exclude diagnostic reports (default: all)
                                   Optionally specify comma-separated categories
  --nesting-max-depth <number>     Limit nesting depth for all namespaces
                                   After limit, flatten remaining parts
  --nesting-flatten-mode <mode>    How to flatten remaining parts after maxDepth
                                   Options: 'camelcase' (default), 'literal'
  --nesting-consecutive-camel      Treat consecutive dashes (--) as camelCase boundary
  --debug, -d                      Enable debug mode (logging + include debug data in runtime)
  --help, -h                       Show this help message

Valid default categories:
  colors, spacing, fonts, fontSize, fontWeight, tracking, leading, breakpoints,
  containers, radius, shadows, insetShadows, dropShadows, textShadows, blur,
  perspective, aspect, ease, animations, defaults, keyframes

Valid report categories:
  conflicts, unresolved

Examples:
  # Generate types and runtime (production optimized, includes all Tailwind defaults)
  tailwind-resolver -i src/styles.css

  # Include all Tailwind defaults (explicit)
  tailwind-resolver -i src/styles.css --include-defaults

  # Exclude all Tailwind defaults for smaller types file
  tailwind-resolver -i src/styles.css --exclude-defaults

  # Include only specific Tailwind defaults
  tailwind-resolver -i src/styles.css --include-defaults colors,spacing,fonts

  # Exclude specific Tailwind defaults (include everything else)
  tailwind-resolver -i src/styles.css --exclude-defaults shadows,animations

  # Debug mode: enable logging and include debug data
  tailwind-resolver -i src/styles.css --debug

  # Generate types only (no runtime)
  tailwind-resolver -i src/styles.css --no-runtime

  # Generate all diagnostic reports (explicit)
  tailwind-resolver -i src/styles.css --reports

  # Exclude all diagnostic reports
  tailwind-resolver -i src/styles.css --exclude-reports

  # Generate only conflict reports
  tailwind-resolver -i src/styles.css --reports conflicts

  # Exclude only conflict reports (generate unresolved only)
  tailwind-resolver -i src/styles.css --exclude-reports conflicts

  # Limit nesting depth to 2 levels with camelCase flattening (default)
  tailwind-resolver -i src/styles.css --nesting-max-depth 2

  # Limit nesting depth to 2 levels with literal flattening
  tailwind-resolver -i src/styles.css --nesting-max-depth 2 --nesting-flatten-mode literal

  # Treat consecutive dashes as camelCase boundaries
  tailwind-resolver -i src/styles.css --nesting-consecutive-camel

  # Combine nesting options
  tailwind-resolver -i src/styles.css --nesting-max-depth 2 --nesting-flatten-mode literal --nesting-consecutive-camel

  # Custom output directory
  tailwind-resolver -i src/styles.css -o src/theme

Generated Files:
  - ${OUTPUT_FILES.TYPES} (TypeScript interface definition)
  - ${OUTPUT_FILES.THEME} (Runtime theme objects, if --runtime enabled)
  - ${OUTPUT_FILES.INDEX} (Re-exports, if --runtime enabled)
  - conflicts.md (Human-readable conflict report, if conflicts detected and reports enabled)
  - conflicts.json (Machine-readable conflict report, if conflicts detected and reports enabled)
  - unresolved.md (Human-readable unresolved variable report, if detected and reports enabled)
  - unresolved.json (Machine-readable unresolved variable report, if detected and reports enabled)

Debug Mode (--debug):
  ✓ Show import resolution warnings
  ✓ Include 'files' array in runtime (processed file list)
  ✓ Include 'variables' array in runtime (raw CSS variables)
`;

/**
 * Index where actual CLI arguments start in process.argv (after node and script path)
 */
const CLI_ARGS_START_INDEX = 2;

/**
 * Parses CLI arguments and returns validated options
 *
 * @returns Validated CLI options
 */
function parseCliOptions(): CliOptions {
  const args = process.argv.slice(CLI_ARGS_START_INDEX);

  const { values } = parseArgs({
    options: {
      input: { type: 'string', short: 'i' },
      output: { type: 'string', short: 'o' },
      runtime: { type: 'boolean', short: 'r', default: true },
      'include-defaults': { type: 'string' },
      'exclude-defaults': { type: 'string' },
      reports: { type: 'string' },
      'exclude-reports': { type: 'string' },
      'nesting-max-depth': { type: 'string' },
      'nesting-consecutive-camel': { type: 'boolean', default: false },
      'nesting-flatten-mode': { type: 'string' },
      debug: { type: 'boolean', short: 'd', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });

  const options = values as CliOptions;

  // Handle flags when provided without a value
  // If flag is present but value is undefined, treat as boolean true (all)
  if (
    args.includes('--include-defaults') &&
    options['include-defaults'] === undefined
  ) {
    options['include-defaults'] = true;
  }
  if (
    args.includes('--exclude-defaults') &&
    options['exclude-defaults'] === undefined
  ) {
    options['exclude-defaults'] = true;
  }
  if (args.includes('--reports') && options.reports === undefined) {
    options.reports = true;
  }
  if (
    args.includes('--exclude-reports') &&
    options['exclude-reports'] === undefined
  ) {
    options['exclude-reports'] = true;
  }

  return options;
}

/**
 * Validates CLI options and shows help/errors if needed
 *
 * @param options - CLI options to validate
 */
function validateOptions(options: CliOptions): void {
  if (options.help === true) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (options.input === undefined) {
    console.error('Error: --input is required\n');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  // Validate defaults flags: only one of --include-defaults or --exclude-defaults
  const hasIncludeDefaults = options['include-defaults'] !== undefined;
  const hasExcludeDefaults = options['exclude-defaults'] !== undefined;

  if (hasIncludeDefaults && hasExcludeDefaults) {
    console.error(
      'Error: Cannot use both --include-defaults and --exclude-defaults together\n',
    );
    console.error(
      'Use only one of: --include-defaults or --exclude-defaults\n',
    );
    process.exit(1);
  }

  // Validate report flags: only one of --reports or --exclude-reports
  const hasReports = options.reports !== undefined;
  const hasExcludeReports = options['exclude-reports'] !== undefined;

  if (hasReports && hasExcludeReports) {
    console.error(
      'Error: Cannot use both --reports and --exclude-reports together\n',
    );
    console.error('Use only one of: --reports or --exclude-reports\n');
    process.exit(1);
  }
}

/**
 * Generic category parser that works for any options object
 *
 * @param categoriesStr - Comma-separated list of categories
 * @param validCategories - Array of valid category names
 * @param categoryType - Type description for error messages (e.g., "default", "report")
 * @param include - If true, create include list; if false, create exclude list
 * @returns Options object with boolean values for each category
 */
function parseCategories<T>(
  categoriesStr: string,
  validCategories: ReadonlyArray<string>,
  categoryType: string,
  include: boolean,
): T {
  const categories = categoriesStr
    .split(',')
    .map((cat) => cat.trim())
    .filter((cat) => cat.length > 0);

  // Validate all categories
  const invalidCategories = categories.filter(
    (cat) => !validCategories.includes(cat),
  );

  if (invalidCategories.length > 0) {
    console.error(
      `Error: Invalid ${categoryType} categories: ${invalidCategories.join(', ')}\n`,
    );
    console.error(`Valid ${categoryType} categories are:`);
    console.error(`  ${validCategories.join(', ')}\n`);
    process.exit(1);
  }

  // Build options object
  const options = {} as T;

  if (include) {
    // Include mode: only specified categories are true, rest are false
    for (const category of validCategories) {
      options[category as keyof T] = categories.includes(
        category,
      ) as T[keyof T];
    }
  } else {
    // Exclude mode: all categories true except specified ones
    for (const category of validCategories) {
      options[category as keyof T] = !categories.includes(
        category,
      ) as T[keyof T];
    }
  }

  return options;
}

/**
 * Valid Tailwind default category names
 */
const VALID_DEFAULT_CATEGORIES: ReadonlyArray<keyof TailwindDefaultsOptions> = [
  'colors',
  'spacing',
  'fonts',
  'fontSize',
  'fontWeight',
  'tracking',
  'leading',
  'breakpoints',
  'containers',
  'radius',
  'shadows',
  'insetShadows',
  'dropShadows',
  'textShadows',
  'blur',
  'perspective',
  'aspect',
  'ease',
  'animations',
  'defaults',
  'keyframes',
];

/**
 * Valid report category names
 */
const VALID_REPORT_CATEGORIES: ReadonlyArray<keyof ReportGenerationOptions> = [
  'conflicts',
  'unresolved',
];

/**
 * Determines includeDefaults value from CLI options
 *
 * @param options - CLI options
 * @returns includeDefaults value (boolean or granular options)
 */
function determineIncludeTailwindDefaults(
  options: CliOptions,
): boolean | TailwindDefaultsOptions {
  if (options['exclude-defaults'] === true) {
    // --exclude-defaults (no value) → exclude all
    return false;
  }

  if (typeof options['exclude-defaults'] === 'string') {
    // --exclude-defaults colors,spacing → exclude only these
    return parseCategories<TailwindDefaultsOptions>(
      options['exclude-defaults'],
      VALID_DEFAULT_CATEGORIES,
      'default',
      false,
    );
  }

  if (options['include-defaults'] === true) {
    // --include-defaults (no value) → include all (same as default)
    return true;
  }

  if (typeof options['include-defaults'] === 'string') {
    // --include-defaults colors,spacing → include only these
    return parseCategories<TailwindDefaultsOptions>(
      options['include-defaults'],
      VALID_DEFAULT_CATEGORIES,
      'default',
      true,
    );
  }

  // Default: include all
  return true;
}

/**
 * Determines report options from CLI options
 *
 * @param options - CLI options
 * @returns ReportGenerationOptions object
 */
function determineReportOptions(options: CliOptions): ReportGenerationOptions {
  if (options['exclude-reports'] === true) {
    // --exclude-reports (no value) → exclude all
    return {
      conflicts: false,
      unresolved: false,
    };
  }

  if (typeof options['exclude-reports'] === 'string') {
    // --exclude-reports conflicts → exclude only these
    return parseCategories<ReportGenerationOptions>(
      options['exclude-reports'],
      VALID_REPORT_CATEGORIES,
      'report',
      false,
    );
  }

  if (options.reports === true) {
    // --reports (no value) → include all (same as default)
    return {
      conflicts: true,
      unresolved: true,
    };
  }

  if (typeof options.reports === 'string') {
    // --reports conflicts → include only these
    return parseCategories<ReportGenerationOptions>(
      options.reports,
      VALID_REPORT_CATEGORIES,
      'report',
      true,
    );
  }

  // Default: include all
  return {
    conflicts: true,
    unresolved: true,
  };
}

/**
 * Validates and parses maxDepth option
 *
 * @param maxDepthStr - Max depth string from CLI
 * @returns Parsed max depth or undefined
 */
function parseMaxDepth(maxDepthStr: string | undefined): number | undefined {
  if (maxDepthStr === undefined) {
    return undefined;
  }

  const maxDepth = parseInt(maxDepthStr, 10);
  if (isNaN(maxDepth) || maxDepth < 0) {
    console.error(
      `Error: --nesting-max-depth must be a non-negative number (got: ${maxDepthStr})\n`,
    );
    process.exit(1);
  }

  return maxDepth;
}

/**
 * Validates and parses flattenMode option
 *
 * @param flattenModeStr - Flatten mode string from CLI
 * @returns Validated flatten mode or undefined
 */
function parseFlattenMode(
  flattenModeStr: string | undefined,
): 'camelcase' | 'literal' | undefined {
  if (flattenModeStr === undefined) {
    return undefined;
  }

  if (flattenModeStr !== 'camelcase' && flattenModeStr !== 'literal') {
    console.error(
      `Error: --nesting-flatten-mode must be 'camelcase' or 'literal' (got: ${flattenModeStr})\n`,
    );
    process.exit(1);
  }

  return flattenModeStr;
}

/**
 * Determines nesting options from CLI flags
 *
 * @param options - CLI options
 * @returns NestingOptions object or undefined
 */
function determineNestingOptions(
  options: CliOptions,
): NestingOptions | undefined {
  const maxDepth = parseMaxDepth(options['nesting-max-depth']);
  const consecutiveCamel = options['nesting-consecutive-camel'] ?? false;
  const flattenMode = parseFlattenMode(options['nesting-flatten-mode']);

  // If no nesting options provided, return undefined
  if (
    maxDepth === undefined &&
    !consecutiveCamel &&
    flattenMode === undefined
  ) {
    return undefined;
  }

  // Build default config object
  const defaultConfig = {
    ...(maxDepth !== undefined && { maxDepth }),
    ...(consecutiveCamel && { consecutiveDashesAsCamelCase: true }),
    ...(flattenMode !== undefined && { flattenMode }),
  };

  // Return nesting options with default config
  return {
    default: defaultConfig,
  };
}

/**
 * Determines defaults status string for logging
 *
 * @param options - CLI options
 * @returns Status string
 */
function getDefaultsStatus(options: CliOptions): string {
  if (options['exclude-defaults'] === true) {
    return 'all excluded';
  }
  if (typeof options['exclude-defaults'] === 'string') {
    return `excluding ${options['exclude-defaults']}`;
  }
  if (typeof options['include-defaults'] === 'string') {
    return `only ${options['include-defaults']}`;
  }
  return 'all included';
}

/**
 * Determines reports status string for logging
 *
 * @param options - CLI options
 * @returns Status string
 */
function getReportsStatus(options: CliOptions): string {
  if (options['exclude-reports'] === true) {
    return 'all disabled';
  }
  if (typeof options['exclude-reports'] === 'string') {
    return `excluding ${options['exclude-reports']}`;
  }
  if (typeof options.reports === 'string') {
    return `only ${options.reports}`;
  }
  return 'all enabled';
}

/**
 * Determines nesting status string for logging
 *
 * @param options - CLI options
 * @returns Status string
 */
function getNestingStatus(options: CliOptions): string {
  const maxDepth = options['nesting-max-depth'];
  const consecutiveCamel = options['nesting-consecutive-camel'] ?? false;
  const flattenMode = options['nesting-flatten-mode'];

  if (
    maxDepth === undefined &&
    !consecutiveCamel &&
    flattenMode === undefined
  ) {
    return 'default';
  }

  const parts: Array<string> = [];
  if (maxDepth !== undefined) {
    parts.push(`maxDepth=${maxDepth}`);
  }
  if (flattenMode !== undefined) {
    parts.push(`flatten=${flattenMode}`);
  }
  if (consecutiveCamel) {
    parts.push('consecutive-camel');
  }

  return parts.join(', ');
}

/**
 * Logs the configuration before generation
 *
 * @param options - CLI options
 * @param outputDir - Resolved output directory
 */
function logConfiguration(options: CliOptions, outputDir: string): void {
  console.log('Tailwind Theme Resolver\n');
  console.log(`  Input:    ${options.input}`);
  console.log(`  Output:   ${outputDir}`);
  console.log(`  Runtime:  ${options.runtime ? 'enabled' : 'disabled'}`);
  console.log(`  Defaults: ${getDefaultsStatus(options)}`);
  console.log(`  Reports:  ${getReportsStatus(options)}`);
  console.log(`  Nesting:  ${getNestingStatus(options)}`);
  console.log(`  Debug:    ${options.debug ? 'enabled' : 'disabled'}\n`);
}

/**
 * Logs success message with generated files
 *
 * @param outputDir - Output directory path
 * @param generateRuntime - Whether runtime files were generated
 * @param conflictCount - Number of CSS conflicts detected (optional)
 * @param conflictReportPath - Path to conflict report (optional)
 * @param unresolvedCount - Number of unresolved variables detected (optional)
 * @param unresolvedReportPath - Path to unresolved report (optional)
 */
function logSuccess(
  outputDir: string,
  generateRuntime: boolean,
  conflictCount?: number,
  conflictReportPath?: string,
  unresolvedCount?: number,
  unresolvedReportPath?: string,
): void {
  console.log('✓ Theme types generated successfully\n');
  console.log('Generated files:');
  console.log(`  - ${join(outputDir, OUTPUT_FILES.TYPES)}`);
  if (generateRuntime) {
    console.log(`  - ${join(outputDir, OUTPUT_FILES.THEME)}`);
    console.log(`  - ${join(outputDir, OUTPUT_FILES.INDEX)}`);
  }

  // Display conflict info if present
  if (conflictCount !== undefined && conflictReportPath !== undefined) {
    console.log('');
    console.log(
      `⚠  ${conflictCount} CSS conflict${conflictCount === 1 ? '' : 's'} detected (see ${conflictReportPath})`,
    );
  }

  // Display unresolved info if present
  if (unresolvedCount !== undefined && unresolvedReportPath !== undefined) {
    console.log('');
    console.log(
      `ℹ  ${unresolvedCount} unresolved variable${unresolvedCount === 1 ? '' : 's'} detected (see ${unresolvedReportPath})`,
    );
  }
}

async function main(): Promise<void> {
  try {
    const options = parseCliOptions();
    validateOptions(options);

    const outputDir = options.output ?? autoDetectOutputDir(process.cwd());
    logConfiguration(options, outputDir);

    // Derive basePath from input file's directory for resolving node_modules
    const inputPath = options.input as string;
    const absoluteInputPath = resolve(process.cwd(), inputPath);
    const absoluteOutputDir = resolve(process.cwd(), outputDir);
    const basePath = dirname(absoluteInputPath);

    // Convert boolean runtime option to RuntimeGenerationOptions
    // When --debug is enabled, include debug data (files, variables) in runtime
    const runtimeOptions: RuntimeGenerationOptions | false =
      options.runtime === false
        ? false
        : {
            variants: true,
            selectors: true,
            files: options.debug as boolean, // Include when debug mode is on
            variables: options.debug as boolean, // Include when debug mode is on
          };

    // Determine report options from CLI flags
    const reportOptions = determineReportOptions(options);

    // Determine includeDefaults value
    const includeDefaults = determineIncludeTailwindDefaults(options);

    // Determine nesting options from CLI flags
    const nestingOptions = determineNestingOptions(options);

    const result = await generateThemeFiles(
      absoluteInputPath,
      absoluteOutputDir,
      true, // resolveImports
      runtimeOptions,
      includeDefaults,
      options.debug as boolean,
      basePath,
      reportOptions,
      undefined, // overrides (not exposed in CLI yet)
      nestingOptions,
    );

    logSuccess(
      outputDir,
      options.runtime as boolean,
      result.conflictCount,
      result.conflictReportPath,
      result.unresolvedCount,
      result.unresolvedReportPath,
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unknown error occurred');
    }
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
