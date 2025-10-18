#!/usr/bin/env node
/**
 * CLI tool for generating Tailwind theme types and runtime objects
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  DEFAULT_INTERFACE_NAME,
  DEFAULT_OUTPUT_DIRS,
  generateThemeFiles,
  OUTPUT_FILES,
} from './vite/plugin';

interface CliOptions {
  input?: string;
  output?: string;
  runtime?: boolean;
  debug?: boolean;
  help?: boolean;
}

const HELP_TEXT = `
Tailwind Theme Resolver CLI

Usage:
  tailwind-theme-resolver [options]

Options:
  --input, -i <path>     Path to CSS input file (required)
  --output, -o <path>    Output directory (default: auto-detect)
  --runtime, -r          Generate runtime theme object (default: true)
  --no-runtime           Skip runtime generation (types only)
  --debug, -d            Enable debug logging for troubleshooting
  --help, -h             Show this help message

Examples:
  # Generate types and runtime
  tailwind-theme-resolver -i src/styles.css

  # Generate types only
  tailwind-theme-resolver -i src/styles.css --no-runtime

  # Custom output directory
  tailwind-theme-resolver -i src/styles.css -o src/theme

  # Enable debug logging
  tailwind-theme-resolver -i src/styles.css --debug

Generated Files:
  - ${OUTPUT_FILES.TYPES} (TypeScript declarations with module augmentation)
  - ${OUTPUT_FILES.RUNTIME} (Runtime theme objects, if --runtime enabled)
  - ${OUTPUT_FILES.INDEX_TS} (Re-exports, if --runtime enabled)
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
 */
function logSuccess(outputDir: string, generateRuntime: boolean): void {
  console.log('✓ Theme types generated successfully\n');
  console.log('Generated files:');
  console.log(`  - ${join(outputDir, OUTPUT_FILES.TYPES)}`);
  if (generateRuntime) {
    console.log(`  - ${join(outputDir, OUTPUT_FILES.RUNTIME)}`);
    console.log(`  - ${join(outputDir, OUTPUT_FILES.INDEX_TS)}`);
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

    await generateThemeFiles(
      absoluteInputPath,
      absoluteOutputDir,
      true, // resolveImports
      options.runtime as boolean,
      DEFAULT_INTERFACE_NAME,
      options.debug as boolean,
      basePath,
    );

    logSuccess(outputDir, options.runtime as boolean);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unknown error occurred');
    }
    process.exit(1);
  }
}

function autoDetectOutputDir(cwd: string): string {
  const srcPath = join(cwd, 'src');
  if (existsSync(srcPath)) {
    return DEFAULT_OUTPUT_DIRS.WITH_SRC;
  }

  return DEFAULT_OUTPUT_DIRS.WITHOUT_SRC;
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
