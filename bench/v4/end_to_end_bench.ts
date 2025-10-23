/**
 * End-to-end benchmarks using real CSS fixtures
 * Tests complete theme resolution pipeline with realistic workloads
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { bench, group, run } from 'mitata';

import { resolveTheme } from '../../src/v4';

// Paths to test fixtures
const fixturesPath = join(import.meta.dir, '../../test/v4/fixtures');

const fixtures = {
  minimal: join(fixturesPath, 'base_theme.css'),
  medium: join(fixturesPath, 'custom_themes.css'),
  large: join(fixturesPath, 'shadcn_global.css'),
  tailwindDefaults: join(fixturesPath, 'default_theme.css'),
  shadcnThemes: join(fixturesPath, 'shadcn_themes.css'),
  complexFunctions: join(fixturesPath, 'complex_css_functions.css'),
  nestedVariants: join(fixturesPath, 'nested_variant.css'),
  withImports: join(fixturesPath, 'main.css'),
};

// Pre-load CSS content for benchmarks (exclude I/O from timing)
const cssContent = {
  minimal: readFileSync(fixtures.minimal, 'utf-8'),
  medium: readFileSync(fixtures.medium, 'utf-8'),
  large: readFileSync(fixtures.large, 'utf-8'),
  tailwindDefaults: readFileSync(fixtures.tailwindDefaults, 'utf-8'),
  shadcnThemes: readFileSync(fixtures.shadcnThemes, 'utf-8'),
  complexFunctions: readFileSync(fixtures.complexFunctions, 'utf-8'),
  nestedVariants: readFileSync(fixtures.nestedVariants, 'utf-8'),
};

// Benchmark different fixture scales
group('resolveTheme - fixture scale', () => {
  bench('minimal theme (17 lines, basic setup)', async () => {
    await resolveTheme({
      css: cssContent.minimal,
    });
  });

  bench('medium theme (85 lines, custom themes)', async () => {
    await resolveTheme({
      css: cssContent.medium,
    });
  });

  bench('large theme (341 lines, shadcn global)', async () => {
    await resolveTheme({
      css: cssContent.large,
    });
  });

  bench('Tailwind defaults (402 lines, 22 color scales)', async () => {
    await resolveTheme({
      css: cssContent.tailwindDefaults,
    });
  });

  bench('shadcn themes (396 lines, 15+ variants)', async () => {
    await resolveTheme({
      css: cssContent.shadcnThemes,
    });
  });
});

// Benchmark complex features
group('resolveTheme - feature complexity', () => {
  bench('complex CSS functions (355 lines, calc/color-mix)', async () => {
    await resolveTheme({
      css: cssContent.complexFunctions,
    });
  });

  bench('nested variants (35 lines, compound selectors)', async () => {
    await resolveTheme({
      css: cssContent.nestedVariants,
    });
  });

  bench('with @import resolution (file I/O)', async () => {
    await resolveTheme({
      input: fixtures.withImports,
    });
  });
});

// Benchmark with Tailwind defaults loading
group('resolveTheme - with Tailwind defaults', () => {
  bench('minimal + defaults', async () => {
    await resolveTheme({
      css: cssContent.minimal,
      includeDefaults: true,
    });
  });

  bench('shadcn + defaults', async () => {
    await resolveTheme({
      css: cssContent.large,
      includeDefaults: true,
    });
  });

  bench('shadcn themes + defaults', async () => {
    await resolveTheme({
      css: cssContent.shadcnThemes,
      includeDefaults: true,
    });
  });
});

// Benchmark realistic production scenarios
group('realistic production workload', () => {
  bench('typical SaaS app (shadcn + dark mode + 2 themes)', async () => {
    const combined = `
      ${cssContent.large}
      ${cssContent.medium}
    `;
    await resolveTheme({
      css: combined,
      includeDefaults: true,
    });
  });

  bench('multi-tenant app (shadcn + 15 theme variants)', async () => {
    await resolveTheme({
      css: cssContent.shadcnThemes,
      includeDefaults: true,
    });
  });

  bench('design system (full Tailwind + custom tokens)', async () => {
    const combined = `
      ${cssContent.tailwindDefaults}
      ${cssContent.large}
      ${cssContent.complexFunctions}
    `;
    await resolveTheme({
      css: combined,
    });
  });
});

// Benchmark cold vs warm runs (cache effectiveness)
group('cache effectiveness', () => {
  bench('cold run (first resolution)', async () => {
    await resolveTheme({
      css: cssContent.shadcnThemes,
      includeDefaults: true,
    });
  });

  bench('warm run (repeated resolution, same content)', async () => {
    // Run it once to warm up
    await resolveTheme({
      css: cssContent.shadcnThemes,
      includeDefaults: true,
    });

    // Benchmark the warm run
    await resolveTheme({
      css: cssContent.shadcnThemes,
      includeDefaults: true,
    });
  });

  bench('batch: 10 theme resolutions', async () => {
    for (let i = 0; i < 10; i++) {
      await resolveTheme({
        css: cssContent.large,
      });
    }
  });
});

await run();
