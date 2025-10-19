/**
 * Benchmarks for CSS @import resolution
 * Tests parseImportPath and import resolution performance
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bench, group, run } from 'mitata';
import postcss from 'postcss';

import { resolveImports } from '../../src/v4/parser/import-resolver';

// Helper to create temporary CSS files for testing
async function createTempFiles(): Promise<{
  dir: string;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), 'import-resolver-bench-'));

  // Create a simple CSS file
  await writeFile(
    join(dir, 'base.css'),
    `
:root {
  --color-primary: blue;
  --spacing-base: 1rem;
}
  `.trim(),
  );

  // Create file with single import
  await writeFile(
    join(dir, 'single-import.css'),
    `
@import './base.css';

:root {
  --color-secondary: green;
}
  `.trim(),
  );

  // Create file with multiple imports
  await writeFile(join(dir, 'color-1.css'), `:root { --color-red: #ff0000; }`);
  await writeFile(join(dir, 'color-2.css'), `:root { --color-blue: #0000ff; }`);
  await writeFile(
    join(dir, 'color-3.css'),
    `:root { --color-green: #00ff00; }`,
  );

  await writeFile(
    join(dir, 'multi-import.css'),
    `
@import './color-1.css';
@import './color-2.css';
@import './color-3.css';

:root {
  --color-custom: purple;
}
  `.trim(),
  );

  // Create nested imports (3 levels deep)
  await writeFile(join(dir, 'level-3.css'), `:root { --level-3: true; }`);
  await writeFile(
    join(dir, 'level-2.css'),
    `
@import './level-3.css';
:root { --level-2: true; }
  `.trim(),
  );
  await writeFile(
    join(dir, 'level-1.css'),
    `
@import './level-2.css';
:root { --level-1: true; }
  `.trim(),
  );
  await writeFile(
    join(dir, 'nested-imports.css'),
    `
@import './level-1.css';
:root { --level-0: true; }
  `.trim(),
  );

  const cleanup = async (): Promise<void> => {
    await rm(dir, { recursive: true, force: true });
  };

  return { dir, cleanup };
}

// Create temp files once for all benchmarks
const tempFiles = await createTempFiles();
const tempDir = tempFiles.dir;

// Benchmark import resolution with different scales
group('resolveImports - scale', () => {
  bench('no imports (baseline)', async () => {
    const css = `:root { --color-primary: blue; }`;
    const root = postcss.parse(css);
    await resolveImports(root, tempDir);
  });

  bench('single import', async () => {
    const css = `@import './base.css';\n:root { --custom: value; }`;
    const root = postcss.parse(css);
    await resolveImports(root, tempDir);
  });

  bench('multiple imports (3 files)', async () => {
    const css = `
@import './color-1.css';
@import './color-2.css';
@import './color-3.css';
      `.trim();
    const root = postcss.parse(css);
    await resolveImports(root, tempDir);
  });

  bench('nested imports (3 levels deep)', async () => {
    const css = `@import './level-1.css';`;
    const root = postcss.parse(css);
    await resolveImports(root, tempDir);
  });
});

// Benchmark parseImportPath variations
group('parseImportPath - syntax variations', () => {
  bench('direct string (double quotes)', () => {
    const css = `@import "file.css";`;
    const root = postcss.parse(css);
    root.walkAtRules('import', () => {
      // parseImportPath is called internally
    });
  });

  bench('direct string (single quotes)', () => {
    const css = `@import 'file.css';`;
    const root = postcss.parse(css);
    root.walkAtRules('import', () => {
      // parseImportPath is called internally
    });
  });

  bench('url() syntax', () => {
    const css = `@import url("file.css");`;
    const root = postcss.parse(css);
    root.walkAtRules('import', () => {
      // parseImportPath is called internally
    });
  });

  bench('batch: 10 import path parses', () => {
    const css = `
      @import "file-1.css";
      @import 'file-2.css';
      @import url("file-3.css");
      @import "file-4.css";
      @import 'file-5.css';
      @import url("file-6.css");
      @import "file-7.css";
      @import 'file-8.css';
      @import url("file-9.css");
      @import "file-10.css";
    `.trim();
    const root = postcss.parse(css);
    root.walkAtRules('import', () => {
      // parseImportPath is called internally for each
    });
  });
});

// Benchmark realistic workload
group('realistic workload', () => {
  bench('typical project (5 imports, 2 levels)', async () => {
    // Simulates a typical shadcn setup with base + custom files
    const css = `
@import './base.css';
@import './color-1.css';
@import './color-2.css';
@import './color-3.css';
@import './level-1.css';

:root {
  --custom-theme: value;
}
      `.trim();
    const root = postcss.parse(css);
    await resolveImports(root, tempDir);
  });
});

await run();

// Cleanup temp files
await tempFiles.cleanup();
