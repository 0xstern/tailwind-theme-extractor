# Architecture Documentation

This document provides a visual representation and detailed explanation of the Tailwind Theme Extractor parsing pipeline.

## High-Level Pipeline

```
CSS Input
    │
    ├─ File Path ────────┐
    │                    │
    └─ Raw CSS String ───┤
                         │
                         ▼
                  ┌──────────────┐
                  │  CSS Parser  │
                  │ (css-parser) │
                  └──────┬───────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
   ┌───────────┐                 ┌──────────────┐
   │  Import   │                 │   PostCSS    │
   │ Resolver  │                 │   Parsing    │
   │(recursive)│                 └──────┬───────┘
   └─────┬─────┘                        │
         │                              │
         └──────────────┬───────────────┘
                        │
                        ▼
                ┌───────────────┐
                │   Variable    │
                │  Extractor    │
                │(@theme,:root) │
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │     Theme     │
                │    Builder    │
                │  (structured) │
                └───────┬───────┘
                        │
           ┌────────────┴────────────┐
           │                         │
           ▼                         ▼
    ┌────────────┐           ┌──────────────┐
    │ Base Theme │           │   Variants   │
    │  (Theme)   │           │ (dark, etc.) │
    └──────┬─────┘           └──────┬───────┘
           │                        │
           └───────────┬────────────┘
                       │
                       ▼
                ┌──────────────┐
                │ ParseResult  │
                │   (output)   │
                └──────────────┘
```

## Core Modules

### 1. CSS Parser (`src/v4/parser/css-parser.ts`)

**Entry Point** - Main orchestrator of the parsing pipeline.

**Responsibilities:**

- Read CSS from file or raw string
- Initialize PostCSS parsing
- Coordinate import resolution
- Trigger variable extraction
- Return structured ParseResult

**Error Handling:**

- Throws if neither `filePath` nor `css` provided
- Throws if file cannot be read
- Throws if PostCSS parsing fails (invalid CSS syntax)
- Silently continues if @import files are missing (delegated to import resolver)

**Debug Mode:**

- Pass `debug: true` to enable warning logs for failed imports

### 2. Import Resolver (`src/v4/parser/import-resolver.ts`)

**Purpose** - Recursively resolves and inlines @import statements.

**Process Flow:**

```
1. Walk AST for @import rules
2. For each import:
   a. Parse import path (handles url(), quotes)
   b. Skip if circular (already processed)
   c. Read file → Parse CSS → Recurse
   d. Replace @import with actual content
3. Track all processed files for Vite watching
```

**Graceful Error Handling (by design):**

- Missing files → Remove @import, continue parsing
- Invalid CSS in import → Remove @import, continue parsing
- Permission errors → Remove @import, continue parsing
- Circular imports → Skip, prevent infinite loops

**Debug Mode:**
When `debug: true`:

```typescript
console.warn(
  '[Tailwind Theme Extractor] Failed to resolve import: ./missing.css',
);
console.warn('  Resolved path: /absolute/path/to/missing.css');
console.warn('  Error: ENOENT: no such file or directory');
```

### 3. Variable Extractor (`src/v4/parser/variable-extractor.ts`)

**Purpose** - Extract CSS variables from @theme, :root, and variant selectors.

**Three Sources:**

1. **@theme blocks** - Tailwind v4 namespace declarations
2. **:root blocks** - Global CSS variables
3. **Variant selectors** - Dark mode, custom themes

**Optimization:**

- Single-pass AST traversal (no double walking)
- Module-level constants for namespace mappings
- Efficient variant detection via selector parsing

**Special Handling:**

- Multi-word namespaces: `text-shadow`, `drop-shadow`, `inset-shadow`
- Singular variable mappings: `--spacing` → `spacing.base`
- Keyframes extraction: `@keyframes` rules captured separately

### 4. Theme Builder (`src/v4/parser/theme-builder.ts`)

**Purpose** - Transform flat CSS variables into structured Theme object with var() resolution.

**Architecture Pattern:**

```typescript
// Configuration-driven (not switch statements)
const NAMESPACE_MAP: Record<string, NamespaceMapping> = {
  color: {
    property: 'colors',
    processor: processColorVariable, // Handles nested color scales
  },
  text: {
    property: 'fontSize',
    processor: processFontSizeVariable, // Extracts size + line-height
  },
  spacing: { property: 'spacing' }, // Simple 1:1 mapping
  // ... 22 total namespaces
};
```

**Complexity Metrics:**

- Main function (`buildThemes`): Cyclomatic complexity < 10 (after extracting helpers)
- Helper function (`buildTheme`): Cyclomatic complexity < 10 (after extracting processors)
- Modular design with 4 extracted helper functions:
  - `buildReferenceMap()` - Builds var() reference mappings
  - `groupVariantVariables()` - Groups variant variables by name
  - `processReferencedVariable()` - Handles referenced variables
  - `processNamespacedVariable()` - Handles namespaced variables

**Variable Resolution System:**

The theme builder implements a two-phase resolution system for `var()` references:

1. **Phase 1: Build Reference Map**
   - Scans `@theme` variables for `var()` references
   - Maps raw CSS variables to their target theme properties
   - Example: `--color-background: var(--background)` → maps `--background` to `colors.background`

2. **Phase 2: Resolve Variables**
   - Recursively resolves `var()` references to actual values
   - Includes Tailwind default theme in resolution pool
   - Handles self-referential variables (skips them to use defaults)
   - Example: `var(--color-blue-300)` → `oklch(80.9% 0.105 251.813)`

**Processing Steps:**

1. Group variables by source (theme/root vs variants)
2. Convert Tailwind default theme to variables (if provided)
3. Build reference map from `@theme` variables with `var()` values
4. For each variable:
   - Resolve any `var()` references recursively
   - Check if referenced by `@theme` variable (use reference mapping)
   - Parse namespace from variable name
   - Look up mapping in NAMESPACE_MAP
   - Apply processor if defined (color scales, font sizes)
   - Build nested structure (e.g., `colors.primary.500`)
5. Separate base theme from variant overrides
6. Generate deprecation warnings for legacy patterns

### 5. Tailwind Defaults Loader (`src/v4/parser/tailwind-defaults.ts`)

**Purpose** - Load and merge Tailwind's default theme from node_modules for var() resolution.

**Caching Strategy:**

```typescript
interface ThemeCache {
  theme: Theme | null;
  timestamp: number; // File modification time
  path: string;
}
```

**Cache Validation:**

- On first load: Parse `tailwindcss/theme.css` and cache with mtime
- On subsequent loads: Check if mtime changed → Use cache if unchanged
- Detects package updates without invalidating unnecessarily

**Fallback Behavior:**

- If `tailwindcss` not installed → Return null, no error
- User theme still works independently

**basePath Resolution:**

- Accepts `basePath` parameter to locate node_modules
- CLI derives `basePath` from input file's directory
- Vite plugin uses project root automatically
- Critical for resolving Tailwind defaults when processing files in subdirectories

**Variable Resolution Integration:**

- Default theme is converted back to CSS variables via `themeToVariables()`
- Combined with user variables for comprehensive `var()` resolution
- Enables references like `var(--color-blue-300)` to resolve to actual oklch values
- Self-referential variables (`--font-sans: var(--font-sans)`) are skipped to prefer defaults

## Integration Points

### Vite Plugin (`src/v4/vite/plugin.ts`)

**Lifecycle:**

```
configResolved → Auto-detect output directory
      ↓
buildStart → Generate initial types + watch files
      ↓
handleHotUpdate → Regenerate on CSS changes
```

**File Watching:**

- Tracks all processed files (including @imports)
- Vite automatically re-runs when any tracked file changes
- HMR updates types without full rebuild

### CLI Tool (`src/v4/cli.ts`)

**One-shot generation:**

```bash
tailwind-theme-extractor -i src/styles.css --debug
```

**basePath Handling:**

The CLI automatically derives `basePath` from the input file's directory:

```typescript
const inputPath = options.input as string;
const absoluteInputPath = resolve(process.cwd(), inputPath);
const basePath = dirname(absoluteInputPath);
```

This ensures Tailwind defaults are resolved from the correct `node_modules` location, even when processing files in different projects.

Useful for:

- CI/CD pipelines
- Build scripts
- Non-Vite projects
- SSR environments
- Cross-project theme generation

### Type Generator (`src/v4/vite/type-generator.ts`)

**Output:**

1. **themes.d.ts** - TypeScript type declarations with module augmentation
2. **themes.ts** - Runtime objects (if `generateRuntime: true`)
3. **index.ts** - Clean re-exports (if `generateRuntime: true`)

**Module Augmentation Pattern:**
Uses modern TypeScript module augmentation instead of triple-slash directives:

```typescript
declare module 'tailwind-theme-extractor' {
  interface Theme extends GeneratedTheme {}
}
```

**Benefits:**

- Industry-standard TypeScript pattern
- Automatic type hints without manual imports
- Works when output directory is in `tsconfig.json` includes
- No ambient declarations or global type pollution

**Configuration:**

- Centralized `THEME_PROPERTY_CONFIGS` for all 22 namespaces
- Shared escaping logic via `escapeStringLiteral()`
- Reduced from 516 to 460 lines (11% improvement)

## Data Flow Example

**Input:**

```css
@theme {
  --color-primary-500: oklch(0.65 0.2 250);
  --color-chart-1: var(--color-blue-300);
  --spacing-4: 1rem;
}

:root {
  --background: oklch(1 0 0);
}

[data-theme='dark'] {
  --background: #1f2937;
}
```

**Pipeline:**

```
1. CSS Parser
   ├─ Reads file
   ├─ Loads Tailwind defaults from node_modules
   └─ Creates PostCSS AST

2. Variable Extractor
   ├─ Finds: --color-primary-500 (source: 'theme')
   ├─ Finds: --color-chart-1 (source: 'theme', value: 'var(--color-blue-300)')
   ├─ Finds: --spacing-4 (source: 'theme')
   ├─ Finds: --background (source: 'root')
   └─ Finds: --background (source: 'variant', selector: '[data-theme="dark"]')

3. Theme Builder
   ├─ Converts Tailwind defaults to variables
   ├─ Builds reference map: --background → colors.background
   ├─ Resolves var() references:
   │  └─ var(--color-blue-300) → oklch(80.9% 0.105 251.813)
   ├─ Base theme:
   │  ├─ colors.primary[500] = "oklch(0.65 0.20 250)"
   │  ├─ colors.chart[1] = "oklch(80.9% 0.105 251.813)" [RESOLVED]
   │  ├─ colors.background = "oklch(1 0 0)" [FROM :root via reference]
   │  └─ spacing[4] = "1rem"
   └─ Variants:
      └─ dark:
         ├─ selector: "[data-theme='dark']"
         └─ theme.colors.background = "#1f2937"
```

**Output (ParseResult):**

```typescript
{
  theme: {
    colors: {
      primary: { 500: "oklch(0.65 0.20 250)" },
      chart: { 1: "oklch(80.9% 0.105 251.813)" }, // Resolved from Tailwind defaults
      background: "oklch(1 0 0)", // Resolved from :root via reference map
      // ... all Tailwind default colors (red, blue, violet, etc.)
    },
    fonts: {
      sans: "ui-sans-serif, system-ui, sans-serif, ...", // From Tailwind defaults
      // ... other fonts
    },
    spacing: { 4: "1rem" },
    // ... other namespaces
  },
  variants: {
    dark: {
      selector: "[data-theme='dark']",
      theme: {
        colors: { background: "#1f2937" }
      }
    }
  },
  variables: [/* raw CSSVariable array */],
  files: ['/absolute/path/to/styles.css'],
  deprecationWarnings: []
}
```

## Performance Characteristics

### Time Complexity

| Operation           | Complexity | Notes                                  |
| ------------------- | ---------- | -------------------------------------- |
| CSS Parsing         | O(n)       | n = file size, PostCSS linear scan     |
| Import Resolution   | O(d × n)   | d = import depth, n = avg file size    |
| Variable Extraction | O(v)       | v = number of CSS variables            |
| Theme Building      | O(v)       | Single pass with constant-time lookups |
| Type Generation     | O(p)       | p = number of theme properties         |

### Optimizations Applied

1. **Single-pass traversal** - Variable extractor walks AST once
2. **Configuration maps** - O(1) namespace lookups vs O(n) switch statements
3. **Module-level constants** - Avoid re-creating config objects
4. **Timestamp caching** - Tailwind defaults cached with file mtime
5. **Parallel builds** - Build script uses Promise.all() for ESM + CJS

### Performance Benchmarks

Based on real-world usage:

| Theme Size | Variables | Parse Time | Type Gen Time |
| ---------- | --------- | ---------- | ------------- |
| Small      | < 100     | ~10ms      | ~5ms          |
| Medium     | 100-500   | ~30ms      | ~15ms         |
| Large      | > 500     | ~80ms      | ~30ms         |

_Note: Times exclude file I/O, measured on M1 Mac_

## Error Handling Philosophy

The library follows a **progressive enhancement** approach:

### What Throws Errors

- Missing main input file
- Invalid CSS syntax in main file
- Invalid TypeScript identifiers
- File system write failures

### What Fails Gracefully

- Missing @import files (removed, parsing continues)
- Invalid CSS in imported files (skipped)
- Tailwind not installed (user theme only)
- Circular imports (detected and skipped)

### Debug Mode

Enable via `debug: true` in ParseOptions to get:

- Import resolution warnings
- Failed file reads with full paths
- Detailed error messages

**Example:**

```typescript
const result = await extractTheme({
  filePath: './theme.css',
  debug: true, // Logs warnings for missing imports
});
```

## Adding New Namespaces

To add support for a new Tailwind namespace:

1. **Add to types** (`src/v4/types.ts`):

```typescript
export interface ThemeCustom {
  [key: string]: string;
}

export interface Theme {
  // ... existing properties
  custom: ThemeCustom;
}
```

2. **Add to namespace map** (`src/v4/parser/theme-builder.ts`):

```typescript
const NAMESPACE_MAP = {
  // ... existing mappings
  custom: { property: 'custom' },
};
```

3. **Add to type generator** (`src/v4/vite/type-generator.ts`):

```typescript
const THEME_PROPERTY_CONFIGS = [
  // ... existing configs
  {
    key: 'custom',
    generator: (v) => generateObjectType(v as Record<string, string>),
  },
];
```

That's it! The pipeline will automatically handle extraction, building, and type generation.

## Testing Strategy

### Unit Tests

- Each module tested in isolation
- Mock file system for import tests
- Snapshot tests for type generation

### Integration Tests

- 9-file deep import chain test
- Real Tailwind theme parsing
- Circular import detection

### Test Coverage

- 106 passing tests
- 276 expect() assertions
- All core paths covered

## Related Documentation

- [README.md](./README.md) - User-facing documentation and API reference
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development setup and guidelines
- [CLAUDE.md](./CLAUDE.md) - Code standards and conventions
- [CHANGELOG.md](./CHANGELOG.md) - Version history and breaking changes
