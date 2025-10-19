/**
 * Unit tests for shared type generator module
 * Tests TypeScript type generation and runtime file generation
 */

import { describe, expect, it } from 'bun:test';

import {
  generateRuntimeFile,
  generateTypeDeclarations,
} from '../../../../src/v4/shared/type-generator';

describe('generateTypeDeclarations', () => {
  it('should generate type declarations for simple theme', () => {
    const result = {
      theme: {
        colors: { primary: 'blue', secondary: 'red' },
        spacing: {},
        fonts: {},
        fontSize: {},
        fontWeight: {},
        tracking: {},
        leading: {},
        breakpoints: {},
        containers: {},
        radius: {},
        shadows: {},
        insetShadows: {},
        dropShadows: {},
        textShadows: {},
        blur: {},
        perspective: {},
        aspect: {},
        ease: {},
        animations: {},
        defaults: {},
        keyframes: {},
      },
      variants: {},
      selectors: {},
      variables: [],
      files: [],
      deprecationWarnings: [],
      cssConflicts: [],
    };

    const types = generateTypeDeclarations(result, 'TestTheme', 'input.css');

    expect(types).toContain('export interface TestTheme');
    expect(types).toContain('colors');
    expect(types).toContain('primary');
    expect(types).toContain('secondary');
  });

  it('should generate type declarations with variants', () => {
    const result = {
      theme: {
        colors: { primary: 'blue' },
        spacing: {},
        fonts: {},
        fontSize: {},
        fontWeight: {},
        tracking: {},
        leading: {},
        breakpoints: {},
        containers: {},
        radius: {},
        shadows: {},
        insetShadows: {},
        dropShadows: {},
        textShadows: {},
        blur: {},
        perspective: {},
        aspect: {},
        ease: {},
        animations: {},
        defaults: {},
        keyframes: {},
      },
      variants: {
        dark: {
          selector: '.dark',
          theme: {
            colors: { primary: 'white' },
            spacing: {},
            fonts: {},
            fontSize: {},
            fontWeight: {},
            tracking: {},
            leading: {},
            breakpoints: {},
            containers: {},
            radius: {},
            shadows: {},
            insetShadows: {},
            dropShadows: {},
            textShadows: {},
            blur: {},
            perspective: {},
            aspect: {},
            ease: {},
            animations: {},
            defaults: {},
            keyframes: {},
          },
        },
      },
      selectors: { dark: '.dark' },
      variables: [],
      files: [],
      deprecationWarnings: [],
      cssConflicts: [],
    };

    const types = generateTypeDeclarations(result, 'TestTheme', 'input.css');

    expect(types).toContain('export interface TestTheme');
    expect(types).toContain('dark');
  });

  it('should include source file comment', () => {
    const result = {
      theme: {
        colors: {},
        spacing: {},
        fonts: {},
        fontSize: {},
        fontWeight: {},
        tracking: {},
        leading: {},
        breakpoints: {},
        containers: {},
        radius: {},
        shadows: {},
        insetShadows: {},
        dropShadows: {},
        textShadows: {},
        blur: {},
        perspective: {},
        aspect: {},
        ease: {},
        animations: {},
        defaults: {},
        keyframes: {},
      },
      variants: {},
      selectors: {},
      variables: [],
      files: [],
      deprecationWarnings: [],
      cssConflicts: [],
    };

    const types = generateTypeDeclarations(result, 'TestTheme', 'test.css');

    expect(types).toContain('test.css');
  });
});

describe('generateRuntimeFile', () => {
  it('should generate runtime file with variants', () => {
    const result = {
      theme: {
        colors: { primary: 'blue' },
        spacing: {},
        fonts: {},
        fontSize: {},
        fontWeight: {},
        tracking: {},
        leading: {},
        breakpoints: {},
        containers: {},
        radius: {},
        shadows: {},
        insetShadows: {},
        dropShadows: {},
        textShadows: {},
        blur: {},
        perspective: {},
        aspect: {},
        ease: {},
        animations: {},
        defaults: {},
        keyframes: {},
      },
      variants: {
        dark: {
          selector: '.dark',
          theme: {
            colors: { primary: 'white' },
            spacing: {},
            fonts: {},
            fontSize: {},
            fontWeight: {},
            tracking: {},
            leading: {},
            breakpoints: {},
            containers: {},
            radius: {},
            shadows: {},
            insetShadows: {},
            dropShadows: {},
            textShadows: {},
            blur: {},
            perspective: {},
            aspect: {},
            ease: {},
            animations: {},
            defaults: {},
            keyframes: {},
          },
        },
      },
      selectors: { dark: '.dark' },
      variables: [],
      files: [],
      deprecationWarnings: [],
      cssConflicts: [],
    };

    const runtime = generateRuntimeFile(result, 'TestTheme', {
      variants: true,
      selectors: true,
      files: false,
      variables: false,
    });

    expect(runtime).toContain('export const variants');
    expect(runtime).toContain('export const selectors');
    expect(runtime).toContain('dark');
  });

  it('should include files when option is enabled', () => {
    const result = {
      theme: {
        colors: {},
        spacing: {},
        fonts: {},
        fontSize: {},
        fontWeight: {},
        tracking: {},
        leading: {},
        breakpoints: {},
        containers: {},
        radius: {},
        shadows: {},
        insetShadows: {},
        dropShadows: {},
        textShadows: {},
        blur: {},
        perspective: {},
        aspect: {},
        ease: {},
        animations: {},
        defaults: {},
        keyframes: {},
      },
      variants: {},
      selectors: {},
      variables: [],
      files: ['test.css'],
      deprecationWarnings: [],
      cssConflicts: [],
    };

    const runtime = generateRuntimeFile(result, 'TestTheme', {
      variants: true,
      selectors: true,
      files: true,
      variables: false,
    });

    expect(runtime).toContain('export const files');
    expect(runtime).toContain('test.css');
  });

  it('should exclude files when option is false', () => {
    const result = {
      theme: {
        colors: {},
        spacing: {},
        fonts: {},
        fontSize: {},
        fontWeight: {},
        tracking: {},
        leading: {},
        breakpoints: {},
        containers: {},
        radius: {},
        shadows: {},
        insetShadows: {},
        dropShadows: {},
        textShadows: {},
        blur: {},
        perspective: {},
        aspect: {},
        ease: {},
        animations: {},
        defaults: {},
        keyframes: {},
      },
      variants: {},
      selectors: {},
      variables: [],
      files: ['test.css'],
      deprecationWarnings: [],
      cssConflicts: [],
    };

    const runtime = generateRuntimeFile(result, 'TestTheme', {
      variants: true,
      selectors: true,
      files: false,
      variables: false,
    });

    expect(runtime).not.toContain('export const files');
  });
});
