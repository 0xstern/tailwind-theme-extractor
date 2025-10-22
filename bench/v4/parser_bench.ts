/**
 * Benchmarks for CSS parser (parseCSS) - main entry point
 * Tests end-to-end parsing performance with realistic CSS files
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bench, group, run } from 'mitata';

import { parseCSS } from '../../src/v4/core';

// Create temporary directory and test files
const tempDir = join(tmpdir(), `css-parser-bench-${Date.now()}`);

async function setupTempFiles(): Promise<void> {
  await mkdir(tempDir, { recursive: true });

  // Simple theme file (no imports)
  await writeFile(
    join(tempDir, 'simple-theme.css'),
    `
@theme {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --radius-sm: 0.125rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
}
`,
    'utf-8',
  );

  // Theme with variants
  await writeFile(
    join(tempDir, 'variant-theme.css'),
    `
@theme {
  --color-primary: #3b82f6;
  --spacing-md: 1rem;
  --radius-md: 0.375rem;
}

.dark {
  --color-primary: #60a5fa;
  --color-background: #1e293b;
}

.compact {
  --spacing-md: 0.75rem;
  --radius-md: 0.25rem;
}
`,
    'utf-8',
  );

  // Complex theme with imports
  await writeFile(
    join(tempDir, 'base-colors.css'),
    `
@theme {
  --color-blue-300: oklch(80.9% 0.105 251.813);
  --color-blue-500: oklch(69.54% 0.149 256.801);
  --color-blue-700: oklch(55.84% 0.156 260.162);
  --color-purple-300: oklch(80.47% 0.139 305.23);
  --color-purple-500: oklch(65.41% 0.209 308.067);
  --color-purple-700: oklch(51.22% 0.183 310.548);
}
`,
    'utf-8',
  );

  await writeFile(
    join(tempDir, 'base-spacing.css'),
    `
@theme {
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
}
`,
    'utf-8',
  );

  await writeFile(
    join(tempDir, 'complex-theme.css'),
    `
@import './base-colors.css';
@import './base-spacing.css';

@theme {
  --radius-sm: 0.125rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
}

.dark {
  --color-background: #1e293b;
  --color-text: #f1f5f9;
}

.theme-mono {
  .rounded-lg { border-radius: 0; }
  .rounded-md { border-radius: 0; }
  .shadow-sm { box-shadow: none; }
}
`,
    'utf-8',
  );

  // Large theme with many variables
  const largeThemeVars: Array<string> = [];
  for (let i = 0; i < 100; i++) {
    largeThemeVars.push(
      `  --color-custom-${i}: oklch(${50 + i / 2}% 0.1 ${i * 3.6});`,
    );
  }
  for (let i = 0; i < 50; i++) {
    largeThemeVars.push(`  --spacing-custom-${i}: ${0.25 + i * 0.25}rem;`);
  }

  await writeFile(
    join(tempDir, 'large-theme.css'),
    `
@theme {
${largeThemeVars.join('\n')}
}

.dark {
${largeThemeVars
  .slice(0, 50)
  .map((v) => v.replace(/oklch\([^)]+\)/, 'oklch(30% 0.05 250)'))
  .join('\n')}
}

.light {
${largeThemeVars
  .slice(0, 50)
  .map((v) => v.replace(/oklch\([^)]+\)/, 'oklch(90% 0.05 250)'))
  .join('\n')}
}
`,
    'utf-8',
  );

  // Theme with CSS rules and conflicts
  await writeFile(
    join(tempDir, 'conflicts-theme.css'),
    `
@theme {
  --radius-sm: 0.125rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
}

.theme-mono {
  .rounded-lg { border-radius: 0; }
  .rounded-md { border-radius: 0; }
  .rounded-sm { border-radius: 0; }
  .rounded-xl { border-radius: 0; }
  .shadow-sm { box-shadow: none; }
  .shadow-md { box-shadow: none; }
  .shadow-lg { box-shadow: none; }
}

.theme-rounded {
  .rounded-lg { border-radius: 1rem; }
  .rounded-xl { border-radius: 1.5rem; }
  .shadow-lg { box-shadow: 0 20px 25px rgba(0,0,0,0.15); }
}
`,
    'utf-8',
  );
}

async function cleanupTempFiles(): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}

// Setup before all benchmarks
await setupTempFiles();

// Benchmark parseCSS with different scales
group('parseCSS - scale', () => {
  bench('simple theme (8 variables, no imports)', async () => {
    await parseCSS({
      input: join(tempDir, 'simple-theme.css'),
      resolveImports: false,
    });
  });

  bench('theme with variants (3 variables + 2 variants)', async () => {
    await parseCSS({
      input: join(tempDir, 'variant-theme.css'),
      resolveImports: false,
    });
  });

  bench('complex theme (2 imports, 12 variables, 1 variant)', async () => {
    await parseCSS({
      input: join(tempDir, 'complex-theme.css'),
      resolveImports: true,
    });
  });

  bench('large theme (150 variables, 2 variants)', async () => {
    await parseCSS({
      input: join(tempDir, 'large-theme.css'),
      resolveImports: false,
    });
  });

  bench('theme with conflicts (7 variables, 14 CSS rules)', async () => {
    await parseCSS({
      input: join(tempDir, 'conflicts-theme.css'),
      resolveImports: false,
    });
  });
});

// Benchmark parseCSS with different options
group('parseCSS - options', () => {
  bench('with import resolution enabled', async () => {
    await parseCSS({
      input: join(tempDir, 'complex-theme.css'),
      resolveImports: true,
    });
  });

  bench('with import resolution disabled', async () => {
    await parseCSS({
      input: join(tempDir, 'complex-theme.css'),
      resolveImports: false,
    });
  });

  bench('parse from string (no file I/O)', async () => {
    await parseCSS({
      css: `
        @theme {
          --color-primary: #3b82f6;
          --spacing-md: 1rem;
          --radius-md: 0.375rem;
        }
      `,
    });
  });

  bench('with debug mode enabled', async () => {
    await parseCSS({
      input: join(tempDir, 'variant-theme.css'),
      resolveImports: false,
      debug: true,
    });
  });
});

// Benchmark realistic workloads
group('realistic workload', () => {
  bench('shadcn-style theme (imports + variants + conflicts)', async () => {
    await parseCSS({
      input: join(tempDir, 'complex-theme.css'),
      resolveImports: true,
    });
  });

  bench('design system (150 vars + 2 variants)', async () => {
    await parseCSS({
      input: join(tempDir, 'large-theme.css'),
      resolveImports: false,
    });
  });

  bench(
    'full pipeline: parse + resolve + build + detect conflicts',
    async () => {
      const result = await parseCSS({
        input: join(tempDir, 'conflicts-theme.css'),
        resolveImports: false,
      });
      return result;
    },
  );
});

await run();
await cleanupTempFiles();
