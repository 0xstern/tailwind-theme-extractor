#!/usr/bin/env node
/**
 * CLI tool for generating Tailwind theme types and runtime objects
 */
import type {
  ReportGenerationOptions,
  RuntimeGenerationOptions,
} from '../types';

import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { OUTPUT_FILES } from '../shared/constants';
import { generateThemeFiles } from '../shared/file-generator';
import { autoDetectOutputDir } from '../shared/utils';

interface CliOptions {
  input?: string;
  output?: string;
  runtime?: boolean;
  debug?: boolean;
  help?: boolean;
  reports?: boolean;
  'no-conflict-reports'?: boolean;
  'no-unresolved-reports'?: boolean;
}

const HELP_TEXT = `
Tailwind Theme Resolver CLI

Usage:
  tailwind-resolver [options]

Options:
  --input, -i <path>         Path to CSS input file (required)
  --output, -o <path>        Output directory (default: auto-detect)
  --runtime, -r              Generate runtime theme object (default: true)
  --no-runtime               Skip runtime generation (types only)
  --reports                  Generate diagnostic reports (default: true)
  --no-reports               Skip all diagnostic reports
  --no-conflict-reports      Skip CSS conflict reports only
  --no-unresolved-reports    Skip unresolved variable reports only
  --debug, -d                Enable debug mode (logging + include debug data in runtime)
  --help, -h                 Show this help message

Examples:
  # Generate types and runtime (production optimized)
  tailwind-resolver -i src/styles.css

  # Debug mode: enable logging and include debug data
  tailwind-resolver -i src/styles.css --debug

  # Generate types only
  tailwind-resolver -i src/styles.css --no-runtime

  # Disable all diagnostic reports
  tailwind-resolver -i src/styles.css --no-reports

  # Disable only conflict reports
  tailwind-resolver -i src/styles.css --no-conflict-reports

  # Custom output directory
  tailwind-resolver -i src/styles.css -o src/theme

Generated Files:
  - ${OUTPUT_FILES.TYPES} (TypeScript interface definition)
  - ${OUTPUT_FILES.THEME} (Runtime theme objects, if --runtime enabled)
  - ${OUTPUT_FILES.INDEX} (Re-exports, if --runtime enabled)
  - conflicts.md/json (CSS conflict reports, if conflicts detected and reports enabled)
  - unresolved.md/json (Unresolved variable reports, if unresolved vars detected and reports enabled)

Debug Mode (--debug):
  ✓ Show import resolution warnings
  ✓ Include 'files' array in runtime (processed file list)
  ✓ Include 'variables' array in runtime (raw CSS variables)
`;

/**
 * Parses CLI arguments and returns validated options
 *
 * @returns Validated CLI options
 */
function parseCliOptions(): CliOptions {
  const { values } = parseArgs({
    options: {
      input: { type: 'string', short: 'i' },
      output: { type: 'string', short: 'o' },
      runtime: { type: 'boolean', short: 'r', default: true },
      reports: { type: 'boolean', default: true },
      'no-conflict-reports': { type: 'boolean', default: false },
      'no-unresolved-reports': { type: 'boolean', default: false },
      debug: { type: 'boolean', short: 'd', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });

  return values as CliOptions;
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
}

/**
 * Logs the configuration before generation
 *
 * @param options - CLI options
 * @param outputDir - Resolved output directory
 */
function logConfiguration(options: CliOptions, outputDir: string): void {
  console.log('Tailwind Theme Resolver\n');
  console.log(`  Input:   ${options.input}`);
  console.log(`  Output:  ${outputDir}`);
  console.log(`  Runtime: ${options.runtime ? 'enabled' : 'disabled'}`);
  console.log(`  Debug:   ${options.debug ? 'enabled' : 'disabled'}\n`);
}

/**
 * Logs success message with generated files
 *
 * @param outputDir - Output directory path
 * @param generateRuntime - Whether runtime files were generated
 * @param conflictCount - Number of CSS conflicts detected (optional)
 * @param conflictReportPath - Path to conflict report (optional)
 */
function logSuccess(
  outputDir: string,
  generateRuntime: boolean,
  conflictCount?: number,
  conflictReportPath?: string,
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
    // Priority: specific flags > --no-reports > default (all enabled)
    const reportOptions: ReportGenerationOptions = {
      conflicts:
        options['no-conflict-reports'] === true
          ? false
          : options.reports === false
            ? false
            : true,
      unresolved:
        options['no-unresolved-reports'] === true
          ? false
          : options.reports === false
            ? false
            : true,
    };

    const result = await generateThemeFiles(
      absoluteInputPath,
      absoluteOutputDir,
      true, // resolveImports
      runtimeOptions,
      true, // includeTailwindDefaults
      options.debug as boolean,
      basePath,
      reportOptions,
    );

    logSuccess(
      outputDir,
      options.runtime as boolean,
      result.conflictCount,
      result.conflictReportPath,
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
