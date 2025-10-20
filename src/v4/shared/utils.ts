/**
 * Shared utility functions used across CLI and Vite plugin
 */

import type {
  ReportGenerationOptions,
  RuntimeGenerationOptions,
} from '../types';

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_OUTPUT_DIRS } from './constants';

/**
 * Normalizes report generation options
 *
 * @param reports - The report generation option (boolean, object, or undefined)
 * @returns Normalized report generation options
 */
export function normalizeReportOptions(
  reports: boolean | ReportGenerationOptions | undefined,
): ReportGenerationOptions {
  // If false, disable all reports
  if (reports === false) {
    return {
      conflicts: false,
      unresolved: false,
    };
  }

  // If true or undefined, enable all reports (default behavior)
  if (reports === true || reports === undefined) {
    return {
      conflicts: true,
      unresolved: true,
    };
  }

  // Object - merge with defaults (all enabled)
  return {
    conflicts: reports.conflicts ?? true,
    unresolved: reports.unresolved ?? true,
  };
}

/**
 * Normalizes generateRuntime option to RuntimeGenerationOptions
 *
 * @param generateRuntime - The runtime generation option (boolean or object)
 * @returns Normalized runtime generation options or false
 */
export function normalizeRuntimeOptions(
  generateRuntime: boolean | RuntimeGenerationOptions | undefined,
): RuntimeGenerationOptions | false {
  // If false, no runtime generation
  if (generateRuntime === false) {
    return false;
  }

  // If true or undefined, generate everything with production defaults
  if (generateRuntime === true || generateRuntime === undefined) {
    return {
      variants: true,
      selectors: true,
      files: false,
      variables: false,
      reports: normalizeReportOptions(undefined),
    };
  }

  // Object - merge with defaults
  return {
    variants: generateRuntime.variants ?? true,
    selectors: generateRuntime.selectors ?? true,
    files: generateRuntime.files ?? false,
    variables: generateRuntime.variables ?? false,
    reports: normalizeReportOptions(generateRuntime.reports),
  };
}

/**
 * Auto-detects the output directory based on project structure
 *
 * @param cwd - Current working directory
 * @returns The detected output directory path
 */
export function autoDetectOutputDir(cwd: string): string {
  const srcPath = join(cwd, 'src');
  if (existsSync(srcPath)) {
    return DEFAULT_OUTPUT_DIRS.WITH_SRC;
  }

  return DEFAULT_OUTPUT_DIRS.WITHOUT_SRC;
}
