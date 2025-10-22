/**
 * @file Tests for unresolved variable reporter
 */

import type { UnresolvedVariable } from '../../../src/v4/core/analysis/unresolved';

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import {
  isUnresolvedReportJSON,
  writeUnresolvedReports,
} from '../../../src/v4/core/reporting/unresolved';

/**
 * Safely parse and validate JSON with type guard
 *
 * @param jsonString - The JSON string to parse
 * @param guard - Type guard function to validate the parsed data
 * @returns The validated, type-safe parsed data
 */
function parseJSON<T>(
  jsonString: string,
  guard: (data: unknown) => data is T,
): T {
  const parsed: unknown = JSON.parse(jsonString);
  if (!guard(parsed)) {
    throw new Error('JSON data failed type validation');
  }
  return parsed;
}

const EXPECTED_TWO_UNRESOLVED = 2;
const EXPECTED_THREE_UNRESOLVED = 3;

describe('writeUnresolvedReports', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'unresolved-reporter-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('generates markdown and JSON reports for unresolved variables', async () => {
    const unresolved: Array<UnresolvedVariable> = [
      {
        variableName: '--font-sans',
        originalValue: 'var(--font-inter)',
        referencedVariable: '--font-inter',
        source: 'variant',
        variantName: 'theme-inter',
        selector: '.theme-inter .theme-container',
        likelyCause: 'unknown',
      },
      {
        variableName: '--font-sans',
        originalValue: 'var(--font-noto-sans)',
        referencedVariable: '--font-noto-sans',
        source: 'variant',
        variantName: 'theme-noto-sans',
        selector: '.theme-noto-sans .theme-container',
        likelyCause: 'unknown',
      },
    ];

    const metadata = {
      generatedAt: '2024-01-01T00:00:00.000Z',
      source: '../src/theme.css',
      version: '1.0.0',
    };

    const paths = await writeUnresolvedReports(tempDir, unresolved, metadata);

    // Verify paths are returned
    expect(paths.markdown).toBe(join(tempDir, 'unresolved.md'));
    expect(paths.json).toBe(join(tempDir, 'unresolved.json'));

    // Verify markdown file content
    const markdownContent = await readFile(paths.markdown, 'utf-8');
    expect(markdownContent).toContain('# Unresolved CSS Variables');
    expect(markdownContent).toContain('Total unresolved:** 2');
    expect(markdownContent).toContain('--font-inter');
    expect(markdownContent).toContain('--font-noto-sans');
    expect(markdownContent).toContain('theme-inter');
    expect(markdownContent).toContain('Unknown');

    // Verify JSON file content
    const jsonContent = await readFile(paths.json, 'utf-8');
    const parsedData = parseJSON(jsonContent, isUnresolvedReportJSON);

    expect(parsedData.generatedAt).toBe(metadata.generatedAt);
    expect(parsedData.source).toBe(metadata.source);
    expect(parsedData.version).toBe(metadata.version);
    expect(parsedData.summary.total).toBe(EXPECTED_TWO_UNRESOLVED);
    expect(parsedData.summary.external).toBe(0);
    expect(parsedData.summary.selfReferential).toBe(0);
    expect(parsedData.summary.unknown).toBe(EXPECTED_TWO_UNRESOLVED);
    expect(parsedData.unresolved).toHaveLength(EXPECTED_TWO_UNRESOLVED);
    expect(parsedData.unresolved[0]).toMatchObject({
      variableName: '--font-sans',
      referencedVariable: '--font-inter',
      variantName: 'theme-inter',
    });
  });

  test('handles external (Tailwind-specific) variables', async () => {
    const unresolved: Array<UnresolvedVariable> = [
      {
        variableName: '--color-primary',
        originalValue: 'var(--tw-color-blue-500)',
        referencedVariable: '--tw-color-blue-500',
        source: 'theme',
        likelyCause: 'external',
      },
    ];

    const metadata = {
      generatedAt: '2024-01-01T00:00:00.000Z',
      source: '../src/theme.css',
    };

    const paths = await writeUnresolvedReports(tempDir, unresolved, metadata);

    const markdownContent = await readFile(paths.markdown, 'utf-8');
    expect(markdownContent).toContain('External Reference');
    expect(markdownContent).toContain('--tw-color-blue-500');

    const jsonContent = await readFile(paths.json, 'utf-8');
    const parsedData = parseJSON(jsonContent, isUnresolvedReportJSON);
    expect(parsedData.summary.external).toBe(1);
  });

  test('handles self-referential variables', async () => {
    const unresolved: Array<UnresolvedVariable> = [
      {
        variableName: '--font-sans',
        originalValue: 'var(--font-sans)',
        referencedVariable: '--font-sans',
        source: 'theme',
        likelyCause: 'self-referential',
      },
    ];

    const metadata = {
      generatedAt: '2024-01-01T00:00:00.000Z',
      source: '../src/theme.css',
    };

    const paths = await writeUnresolvedReports(tempDir, unresolved, metadata);

    const markdownContent = await readFile(paths.markdown, 'utf-8');
    expect(markdownContent).toContain('Self-referential (Intentional)');

    const jsonContent = await readFile(paths.json, 'utf-8');
    const parsedData = parseJSON(jsonContent, isUnresolvedReportJSON);
    expect(parsedData.summary.selfReferential).toBe(1);
  });

  test('includes fallback values when present', async () => {
    const unresolved: Array<UnresolvedVariable> = [
      {
        variableName: '--color-primary',
        originalValue: 'var(--custom-color, #3b82f6)',
        referencedVariable: '--custom-color',
        fallbackValue: '#3b82f6',
        source: 'theme',
        likelyCause: 'unknown',
      },
    ];

    const metadata = {
      generatedAt: '2024-01-01T00:00:00.000Z',
      source: '../src/theme.css',
    };

    const paths = await writeUnresolvedReports(tempDir, unresolved, metadata);

    const markdownContent = await readFile(paths.markdown, 'utf-8');
    expect(markdownContent).toContain('#3b82f6');

    const jsonContent = await readFile(paths.json, 'utf-8');
    const parsedData = parseJSON(jsonContent, isUnresolvedReportJSON);
    const firstUnresolved = parsedData.unresolved[0];
    if (firstUnresolved === undefined) {
      throw new Error('Expected first unresolved variable to exist');
    }
    expect(firstUnresolved.fallbackValue).toBe('#3b82f6');
  });

  test('groups variables by source in markdown', async () => {
    const unresolved: Array<UnresolvedVariable> = [
      {
        variableName: '--theme-var',
        originalValue: 'var(--missing-1)',
        referencedVariable: '--missing-1',
        source: 'theme',
        likelyCause: 'unknown',
      },
      {
        variableName: '--root-var',
        originalValue: 'var(--missing-2)',
        referencedVariable: '--missing-2',
        source: 'root',
        likelyCause: 'unknown',
      },
      {
        variableName: '--variant-var',
        originalValue: 'var(--missing-3)',
        referencedVariable: '--missing-3',
        source: 'variant',
        variantName: 'dark',
        likelyCause: 'unknown',
      },
    ];

    const metadata = {
      generatedAt: '2024-01-01T00:00:00.000Z',
      source: '../src/theme.css',
    };

    const paths = await writeUnresolvedReports(tempDir, unresolved, metadata);

    const markdownContent = await readFile(paths.markdown, 'utf-8');
    // Check that all sources are represented (grouped by cause, not source in markdown)
    expect(markdownContent).toContain('Theme');
    expect(markdownContent).toContain('Root');
    expect(markdownContent).toContain('Variant');
  });

  test('includes summary statistics', async () => {
    const unresolved: Array<UnresolvedVariable> = [
      {
        variableName: '--var-1',
        originalValue: 'var(--missing-1)',
        referencedVariable: '--missing-1',
        source: 'theme',
        likelyCause: 'unknown',
      },
      {
        variableName: '--var-2',
        originalValue: 'var(--tw-missing)',
        referencedVariable: '--tw-missing',
        source: 'theme',
        likelyCause: 'external',
      },
      {
        variableName: '--var-3',
        originalValue: 'var(--var-3)',
        referencedVariable: '--var-3',
        source: 'root',
        likelyCause: 'self-referential',
      },
    ];

    const metadata = {
      generatedAt: '2024-01-01T00:00:00.000Z',
      source: '../src/theme.css',
    };

    const paths = await writeUnresolvedReports(tempDir, unresolved, metadata);

    const jsonContent = await readFile(paths.json, 'utf-8');
    const parsedData = parseJSON(jsonContent, isUnresolvedReportJSON);

    expect(parsedData.summary.total).toBe(EXPECTED_THREE_UNRESOLVED);
    expect(parsedData.summary.unknown).toBe(1);
    expect(parsedData.summary.external).toBe(1);
    expect(parsedData.summary.selfReferential).toBe(1);
  });

  test('handles metadata without version', async () => {
    const unresolved: Array<UnresolvedVariable> = [
      {
        variableName: '--font-sans',
        originalValue: 'var(--font-inter)',
        referencedVariable: '--font-inter',
        source: 'theme',
        likelyCause: 'unknown',
      },
    ];

    const metadata = {
      generatedAt: '2024-01-01T00:00:00.000Z',
      source: '../src/theme.css',
    };

    const paths = await writeUnresolvedReports(tempDir, unresolved, metadata);

    const markdownContent = await readFile(paths.markdown, 'utf-8');
    expect(markdownContent).toContain('Generated');
    expect(markdownContent).not.toContain('v1.0.0');
  });
});
