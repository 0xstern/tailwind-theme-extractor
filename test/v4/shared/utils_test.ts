/**
 * Unit tests for shared utility functions
 * Tests runtime option normalization and output directory auto-detection
 */

import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import {
  autoDetectOutputDir,
  normalizeReportOptions,
  normalizeRuntimeOptions,
} from '../../../src/v4/shared/utils';

describe('normalizeRuntimeOptions', () => {
  it('should return false when input is false', () => {
    const result = normalizeRuntimeOptions(false);

    expect(result).toBe(false);
  });

  it('should return production defaults when input is true', () => {
    const result = normalizeRuntimeOptions(true);

    expect(result).toEqual({
      variants: true,
      selectors: true,
      files: false,
      variables: false,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });
  });

  it('should return production defaults when input is undefined', () => {
    const result = normalizeRuntimeOptions(undefined);

    expect(result).toEqual({
      variants: true,
      selectors: true,
      files: false,
      variables: false,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });
  });

  it('should merge object input with defaults', () => {
    const result = normalizeRuntimeOptions({
      variants: true,
      selectors: false,
    });

    expect(result).toEqual({
      variants: true,
      selectors: false,
      files: false,
      variables: false,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });
  });

  it('should handle all properties explicitly set to true', () => {
    const result = normalizeRuntimeOptions({
      variants: true,
      selectors: true,
      files: true,
      variables: true,
    });

    expect(result).toEqual({
      variants: true,
      selectors: true,
      files: true,
      variables: true,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });
  });

  it('should handle all properties explicitly set to false', () => {
    const result = normalizeRuntimeOptions({
      variants: false,
      selectors: false,
      files: false,
      variables: false,
    });

    expect(result).toEqual({
      variants: false,
      selectors: false,
      files: false,
      variables: false,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });
  });

  it('should use default true for omitted variants property', () => {
    const result = normalizeRuntimeOptions({
      selectors: true,
      files: true,
      variables: true,
    });

    expect(result).toEqual({
      variants: true,
      selectors: true,
      files: true,
      variables: true,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });
  });

  it('should use default true for omitted selectors property', () => {
    const result = normalizeRuntimeOptions({
      variants: false,
      files: true,
      variables: true,
    });

    expect(result).toEqual({
      variants: false,
      selectors: true,
      files: true,
      variables: true,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });
  });

  it('should use default false for omitted files property', () => {
    const result = normalizeRuntimeOptions({
      variants: true,
      selectors: true,
      variables: true,
    });

    expect(result).toEqual({
      variants: true,
      selectors: true,
      files: false,
      variables: true,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });
  });

  it('should use default false for omitted variables property', () => {
    const result = normalizeRuntimeOptions({
      variants: true,
      selectors: true,
      files: true,
    });

    expect(result).toEqual({
      variants: true,
      selectors: true,
      files: true,
      variables: false,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });
  });

  it('should handle empty object as input', () => {
    const result = normalizeRuntimeOptions({});

    expect(result).toEqual({
      variants: true,
      selectors: true,
      files: false,
      variables: false,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });
  });

  it('should handle reports as boolean true', () => {
    const result = normalizeRuntimeOptions({
      reports: true,
    });

    expect(result).toEqual({
      variants: true,
      selectors: true,
      files: false,
      variables: false,
      reports: {
        conflicts: true,
        unresolved: true,
      },
    });
  });

  it('should handle reports as boolean false', () => {
    const result = normalizeRuntimeOptions({
      reports: false,
    });

    expect(result).toEqual({
      variants: true,
      selectors: true,
      files: false,
      variables: false,
      reports: {
        conflicts: false,
        unresolved: false,
      },
    });
  });

  it('should handle reports as object with conflicts disabled', () => {
    const result = normalizeRuntimeOptions({
      reports: {
        conflicts: false,
        unresolved: true,
      },
    });

    expect(result).toEqual({
      variants: true,
      selectors: true,
      files: false,
      variables: false,
      reports: {
        conflicts: false,
        unresolved: true,
      },
    });
  });

  it('should handle reports as object with unresolved disabled', () => {
    const result = normalizeRuntimeOptions({
      reports: {
        conflicts: true,
        unresolved: false,
      },
    });

    expect(result).toEqual({
      variants: true,
      selectors: true,
      files: false,
      variables: false,
      reports: {
        conflicts: true,
        unresolved: false,
      },
    });
  });

  it('should handle partial reports object with defaults', () => {
    const result = normalizeRuntimeOptions({
      reports: {
        conflicts: false,
      },
    });

    expect(result).toEqual({
      variants: true,
      selectors: true,
      files: false,
      variables: false,
      reports: {
        conflicts: false,
        unresolved: true,
      },
    });
  });
});

describe('normalizeReportOptions', () => {
  it('should return all enabled when input is true', () => {
    const result = normalizeReportOptions(true);

    expect(result).toEqual({
      conflicts: true,
      unresolved: true,
    });
  });

  it('should return all enabled when input is undefined', () => {
    const result = normalizeReportOptions(undefined);

    expect(result).toEqual({
      conflicts: true,
      unresolved: true,
    });
  });

  it('should return all disabled when input is false', () => {
    const result = normalizeReportOptions(false);

    expect(result).toEqual({
      conflicts: false,
      unresolved: false,
    });
  });

  it('should merge object input with defaults', () => {
    const result = normalizeReportOptions({
      conflicts: false,
    });

    expect(result).toEqual({
      conflicts: false,
      unresolved: true,
    });
  });

  it('should handle both properties explicitly set', () => {
    const result = normalizeReportOptions({
      conflicts: false,
      unresolved: false,
    });

    expect(result).toEqual({
      conflicts: false,
      unresolved: false,
    });
  });

  it('should handle empty object as input', () => {
    const result = normalizeReportOptions({});

    expect(result).toEqual({
      conflicts: true,
      unresolved: true,
    });
  });
});

describe('autoDetectOutputDir', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'utils-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return WITH_SRC path when src directory exists', async () => {
    const srcPath = join(tempDir, 'src');
    await mkdir(srcPath);

    const result = autoDetectOutputDir(tempDir);

    expect(result).toBe('src/generated/tailwindcss');
    expect(existsSync(srcPath)).toBe(true);
  });

  it('should return WITHOUT_SRC path when src directory does not exist', () => {
    const result = autoDetectOutputDir(tempDir);

    expect(result).toBe('generated/tailwindcss');
    expect(existsSync(join(tempDir, 'src'))).toBe(false);
  });

  it('should return WITHOUT_SRC path for empty directory', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'empty-'));

    const result = autoDetectOutputDir(emptyDir);

    expect(result).toBe('generated/tailwindcss');

    await rm(emptyDir, { recursive: true, force: true });
  });

  it('should return WITH_SRC even when src is a file (edge case)', async () => {
    const srcFile = join(tempDir, 'src');
    // Create a file named 'src' instead of a directory
    const { writeFileSync } = await import('node:fs');
    writeFileSync(srcFile, 'test', 'utf-8');

    const result = autoDetectOutputDir(tempDir);

    // Should still detect 'src' exists (even though it's a file)
    expect(result).toBe('src/generated/tailwindcss');
    expect(existsSync(srcFile)).toBe(true);
  });

  it('should handle non-existent directory gracefully', () => {
    const nonExistentDir = join(tempDir, 'does-not-exist');

    const result = autoDetectOutputDir(nonExistentDir);

    expect(result).toBe('generated/tailwindcss');
  });

  it('should work with absolute paths', async () => {
    const absolutePath = await mkdtemp(join(tmpdir(), 'absolute-'));
    const srcPath = join(absolutePath, 'src');
    await mkdir(srcPath);

    const result = autoDetectOutputDir(absolutePath);

    expect(result).toBe('src/generated/tailwindcss');

    await rm(absolutePath, { recursive: true, force: true });
  });

  it('should work with relative paths', () => {
    const relativePath = '.';

    const result = autoDetectOutputDir(relativePath);

    // Result should be deterministic based on whether ./src exists
    expect(result).toMatch(/^(src\/)?generated\/tailwindcss$/);
  });
});
