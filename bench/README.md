# Benchmark Suite

Performance benchmarks for the tailwind-resolver library using [Mitata](https://github.com/evanwashere/mitata).

## Table of Contents

- [Overview](#overview)
- [Benchmark Files](#benchmark-files)
  - [Core Modules](#core-modules)
  - [Analysis and Reporting](#analysis-and-reporting)
  - [Features](#features)
  - [End-to-End](#end-to-end)
- [Running Benchmarks](#running-benchmarks)
- [Benchmark Structure](#benchmark-structure)
  - [File Naming](#file-naming)
  - [File Template](#file-template)
  - [Organization Patterns](#organization-patterns)
- [Best Practices](#best-practices)
- [Interpreting Results](#interpreting-results)
  - [Time Metrics](#time-metrics)
  - [Performance Goals](#performance-goals)
  - [Regression Detection](#regression-detection)
- [Adding New Benchmarks](#adding-new-benchmarks)
- [Benchmark Data Sources](#benchmark-data-sources)
  - [Test Fixtures](#test-fixtures)
  - [Synthetic Data](#synthetic-data)
- [Performance Optimization Tips](#performance-optimization-tips)
- [References](#references)

---

## Overview

Benchmarks are organized by module and measure performance characteristics of the parsing and theme resolution pipeline. Each benchmark file focuses on a specific aspect of the system.

---

## Benchmark Files

### Core Modules

**`builder_bench.ts`** - Theme building performance

- Scale: minimal (10 vars) → large (300+ vars)
- Variant resolution with caching
- `var()` reference resolution (1-3 levels deep)
- Realistic shadcn UI workloads

**`parser_bench.ts`** - CSS parser (parseCSS) entry point

- Scale: simple (8 vars) → large (150 vars)
- Import resolution enabled/disabled
- Debug mode overhead
- Realistic production workloads

**`extractor_bench.ts`** - Variable extraction from CSS AST

- Single-pass AST traversal
- Theme vs root vs variant extraction
- Namespace mapping performance

**`imports_bench.ts`** - @import resolution

- Recursive import resolution
- Circular dependency detection
- Import depth (1-3 levels)

**`defaults_bench.ts`** - Tailwind defaults loading

- Cache effectiveness
- Merge operations
- Granular defaults filtering

### Analysis and Reporting

**`conflicts_bench.ts`** - CSS rule conflict detection

- Conflict detection algorithms
- Confidence scoring
- Report generation (Markdown + JSON)

**`unresolved_bench.ts`** - Unresolved variable detection

- Pattern matching performance
- Categorization (external/self-referential/unknown)
- Report generation

**`rules_bench.ts`** - CSS rule extraction

- Complexity classification
- Property-to-namespace mapping
- Selector parsing

### Features

**`overrides_bench.ts`** - Theme override system

- Pre-resolution variable injection
- Post-resolution theme mutation
- Flat vs nested notation parsing

### End-to-End

**`end_to_end_bench.ts`** - Complete theme resolution pipeline

- Uses real fixtures from `test/v4/fixtures/`
- Fixture scale: minimal → large (17-402 lines)
- Feature complexity benchmarks
- Realistic production scenarios
- Cache effectiveness (cold vs warm runs)

---

## Running Benchmarks

### Run All Benchmarks

```bash
# Run all benchmark files
bun bench/v4/builder_bench.ts
bun bench/v4/parser_bench.ts
bun bench/v4/conflicts_bench.ts
# ... etc
```

### Run Specific Benchmark

```bash
# Run a single benchmark file
bun bench/v4/end_to_end_bench.ts

# Run with filtering (if supported by the benchmark)
bun bench/v4/builder_bench.ts --filter="var()"
```

### Benchmark Output

Mitata provides detailed statistics:

```
benchmark                                   time (avg)             (min & max)
-----------------------------------------------------------------------
buildThemes - scale
  minimal theme (10 variables)           42.11 µs/iter  (37.75 µs & 125 µs)
  medium theme (100 variables)           421.5 µs/iter    (389 µs & 1.2 ms)
  large theme (300+ variables)           1.25 ms/iter   (1.15 ms & 2.1 ms)
```

---

## Benchmark Structure

### File Naming

All benchmark files follow snake_case convention with `_bench` suffix:

```
{module}_bench.ts
```

Examples: `builder_bench.ts`, `conflicts_bench.ts`, `end_to_end_bench.ts`

### File Template

```typescript
/**
 * Benchmarks for {module name}
 * Tests {specific performance characteristics}
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */

import { bench, group, run } from 'mitata';

import { functionToTest } from '../../src/v4/core/{module}';

// Setup (if needed)
// ...

// Benchmark groups
group('{category name}', () => {
  bench('{test case description}', () => {
    functionToTest(/* ... */);
  });

  bench('{another test case}', async () => {
    await asyncFunctionToTest(/* ... */);
  });
});

// Execute benchmarks
await run();

// Cleanup (if needed)
// await cleanupTempFiles();
```

### Organization Patterns

Benchmarks are typically organized into groups by:

**1. Scale** - Test with increasing data sizes

```typescript
group('module - scale', () => {
  bench('minimal (10 items)', () => {
    /* ... */
  });
  bench('medium (100 items)', () => {
    /* ... */
  });
  bench('large (1000 items)', () => {
    /* ... */
  });
});
```

**2. Options** - Test different configuration options

```typescript
group('module - options', () => {
  bench('with option enabled', () => {
    /* ... */
  });
  bench('with option disabled', () => {
    /* ... */
  });
});
```

**3. Features** - Test specific feature complexity

```typescript
group('module - feature complexity', () => {
  bench('simple case', () => {
    /* ... */
  });
  bench('complex case (nested)', () => {
    /* ... */
  });
});
```

**4. Realistic Workloads** - Test production scenarios

```typescript
group('realistic workload', () => {
  bench('typical SaaS app', () => {
    /* ... */
  });
  bench('design system', () => {
    /* ... */
  });
});
```

---

## Best Practices

### 1. Disable Magic Number Linting

Add at the top of each benchmark file:

```typescript
/* eslint-disable @typescript-eslint/no-magic-numbers */
```

### 2. Use Helper Functions

Create helper functions for generating test data:

```typescript
function createColorScale(name: string): Array<CSSVariable> {
  const stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  return stops.map((stop) => ({
    name: `--color-${name}-${stop}`,
    value: `oklch(${50 + stop / 20} 0.1 ${stop})`,
    source: 'theme',
  }));
}
```

### 3. Exclude I/O from Timing

Pre-load data before benchmarks to exclude file I/O:

```typescript
// Load fixtures once before benchmarking
const cssContent = readFileSync(fixturePath, 'utf-8');

bench('parse CSS', () => {
  parseCSS({ css: cssContent }); // No I/O in benchmark
});
```

### 4. Clean Up Resources

For benchmarks that create temporary files:

```typescript
const tempDir = join(tmpdir(), `bench-${Date.now()}`);

async function setupTempFiles() {
  /* ... */
}
async function cleanupTempFiles() {
  await rm(tempDir, { recursive: true });
}

await setupTempFiles();
// ... benchmarks ...
await run();
await cleanupTempFiles();
```

### 5. Use Realistic Test Data

Mirror production data characteristics:

- Typical variable counts (10-300)
- Common naming patterns
- Realistic nesting levels (1-3 deep)
- Production-like CSS complexity

### 6. Document Scale and Context

Include context in benchmark names:

```typescript
bench('shadcn UI theme (300+ variables, 5 variants)', () => {
  // Benchmark reflects real-world shadcn usage
});

bench('minimal theme (10 variables)', () => {
  // Baseline comparison
});
```

---

## Interpreting Results

### Time Metrics

- **µs (microseconds)**: 1,000 µs = 1 millisecond
- **ms (milliseconds)**: 1,000 ms = 1 second
- **Acceptable ranges**:
  - Minimal themes: &lt; 100 µs
  - Medium themes: 100 µs - 1 ms
  - Large themes: 1-5 ms

### Performance Goals

Based on real-world usage patterns:

| Theme Size | Variables | Target Time | Use Case       |
| ---------- | --------- | ----------- | -------------- |
| Minimal    | &lt; 50   | &lt; 100 µs | Simple sites   |
| Medium     | 50-200    | &lt; 1 ms   | Typical apps   |
| Large      | 200-500   | &lt; 5 ms   | Design systems |
| Enterprise | 500+      | &lt; 10 ms  | Multi-tenant   |

### Regression Detection

Compare results across commits to detect performance regressions:

```bash
# Before changes
bun bench/v4/builder_bench.ts > baseline.txt

# After changes
bun bench/v4/builder_bench.ts > current.txt

# Compare (manual diff or tooling)
diff baseline.txt current.txt
```

---

## Adding New Benchmarks

When adding a new benchmark:

1. **Create file**: `bench/v4/{module}_bench.ts`
2. **Add header comment** describing what's being tested
3. **Import mitata**: `import { bench, group, run } from 'mitata'`
4. **Disable magic numbers**: Add ESLint disable comment
5. **Organize into groups**: Use `group()` for related tests
6. **Document context**: Include scale/complexity in names
7. **Call `await run()`**: Execute at end of file
8. **Update this README**: Document the new benchmark file

---

## Benchmark Data Sources

### Test Fixtures

End-to-end benchmarks use fixtures from `test/v4/fixtures/`:

- `base_theme.css` - Minimal theme (17 lines)
- `custom_themes.css` - Medium theme (85 lines)
- `shadcn_global.css` - Large theme (341 lines)
- `default_theme.css` - Tailwind defaults (402 lines)
- `shadcn_themes.css` - Multiple variants (396 lines, 15+ variants)
- `complex_css_functions.css` - CSS functions (355 lines)
- `nested_variant.css` - Compound selectors (35 lines)
- `main.css` - Import resolution test (with nested imports)

### Synthetic Data

Module-specific benchmarks generate synthetic data:

- **Color scales**: 11 stops per scale (50-950)
- **Font sizes**: 9 sizes with line heights
- **Spacing**: 15 values (0-96)
- **Variants**: 1-15 variants with realistic names

---

## Performance Optimization Tips

Based on benchmark results:

1. **LRU Caching**: Implemented for repeated resolutions
2. **Single-pass AST**: Variable extractor walks once
3. **Configuration Maps**: O(1) namespace lookups
4. **Module Constants**: Avoid recreating config objects
5. **Parallel Builds**: Promise.all() for independent ops

---

## References

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Performance characteristics section
- [test/README.md](../test/README.md) - Test organization
- [Mitata Documentation](https://github.com/evanwashere/mitata)
