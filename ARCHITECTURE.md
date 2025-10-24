# Architecture Documentation

Technical architecture and implementation details for the Tailwind Theme Resolver parsing pipeline.

## Table of Contents

- [Overview](#overview)
  - [High-Level Pipeline](#high-level-pipeline)
  - [Public API](#public-api)
- [Core Modules](#core-modules)
  - [CSS Parser](#css-parser)
  - [Import Resolver](#import-resolver)
  - [Variable Extractor](#variable-extractor)
  - [Theme Builder](#theme-builder)
  - [Tailwind Defaults Loader](#tailwind-defaults-loader)
- [Advanced Features](#advanced-features)
  - [CSS Rule Extraction](#css-rule-extraction)
  - [Conflict Detection and Resolution](#conflict-detection-and-resolution)
  - [Unresolved Variable Detection](#unresolved-variable-detection)
  - [Theme Override System](#theme-override-system)
  - [Nesting Configuration](#nesting-configuration)
  - [Report Configuration](#report-configuration)
- [Integration Points](#integration-points)
  - [Vite Plugin](#vite-plugin)
  - [CLI Tool](#cli-tool)
  - [Type Generator](#type-generator)
  - [Dynamic Spacing Helper](#dynamic-spacing-helper)
- [Data Flow](#data-flow)
- [Performance](#performance)
  - [Time Complexity](#time-complexity)
  - [Optimizations](#optimizations)
  - [Benchmarks](#benchmarks)
- [Error Handling](#error-handling)
- [Extension](#extension)
  - [Adding New Namespaces](#adding-new-namespaces)
- [Testing](#testing)
- [References](#references)

---

## Overview

### High-Level Pipeline

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
                │   Extractor   │
                │ (@theme,:root │
                │  + CSS rules) │
                └───────┬───────┘
                        │
           ┌────────────┴────────────┐
           │                         │
           ▼                         ▼
    ┌────────────┐           ┌──────────────┐
    │ Variables  │           │  CSS Rules   │
    │            │           │  (overrides) │
    └──────┬─────┘           └──────┬───────┘
           │                        │
           └───────────┬────────────┘
                       │
                       ▼
                ┌──────────────┐
                │    Theme     │
                │   Builder    │
                │ (structured) │
                └──────┬───────┘
                       │
          ┌────────────┼────────────────┐
          │            │                │
          ▼            ▼                ▼
    ┌─────────┐  ┌─────────┐  ┌──────────────┐
    │  Base   │  │Variants │  │   Conflict   │
    │  Theme  │  │ (dark,  │  │   Detector   │
    │         │  │  etc.)  │  │& Unresolved  │
    └────┬────┘  └────┬────┘  └──────┬───────┘
         │            │              │
         └────────────┼──────────────┘
                      │
                      ▼
              ┌───────────────────┐
              │   ParseResult     │
              │    (internal)     │
              │ + cssConflicts    │
              │ + unresolvedVars  │
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │  TailwindResult   │
              │     (public)      │
              │ + cssConflicts    │
              │ + unresolvedVars  │
              └─────────┬─────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
  ┌─────────┐   ┌────────────┐ ┌──────────────┐
  │Generated│   │ Conflict   │ │  Unresolved  │
  │  Types  │   │  Reports   │ │   Reports    │
  │& Runtime│   │(conflicts  │ │(unresolved   │
  │         │   │ .md/.json) │ │  .md/.json)  │
  └─────────┘   └────────────┘ └──────────────┘
```

### Public API

#### Type System

The library exposes two main result types defined in `src/v4/types.ts`:

**TailwindResult&lt;TTailwind&gt; - Public API**

Returned by `resolveTheme()` and matches the structure of generated code:

```typescript
export interface TailwindResult<TTailwind = UnknownTailwind> {
  variants: TTailwind extends { variants: infer V } ? V : Record<string, Theme>;
  selectors: TTailwind extends { selectors: infer S }
    ? S
    : Record<string, string>;
  files: Array<string>;
  variables: Array<CSSVariable>;
  deprecationWarnings: Array<DeprecationWarning>;
  cssConflicts?: Array<unknown>;
  unresolvedVariables?: Array<unknown>;
}
```

**ParseResult&lt;TTheme&gt; - Internal Format**

Used internally by the parser and type generator:

```typescript
export interface ParseResult<TTheme extends Theme = Theme> {
  theme: TTheme;
  variants: Record<
    string,
    {
      selector: string;
      theme: Theme;
    }
  >;
  files: Array<string>;
  variables: Array<CSSVariable>;
  deprecationWarnings: Array<DeprecationWarning>;
  cssConflicts?: Array<unknown>;
  unresolvedVariables?: Array<unknown>;
}
```

**Usage Patterns**

```typescript
// With generated types (full type safety)

import type { Tailwind } from './generated/tailwindcss';

// Without generated types (fallback to unknown structure)
const result = await resolveTheme({ input: './styles.css' });
result.variants.default;

const result = await resolveTheme<Tailwind>({ input: './styles.css' });
result.variants.default.colors.primary[500]; // Fully typed!
result.variants.dark?.colors.background; // Fully typed!
result.selectors.dark; // string
```

**Conversion Layer**

The `resolveTheme()` function converts from internal `ParseResult` to public `TailwindResult`:

```typescript
export async function resolveTheme<TTailwind = UnknownTailwind>(
  options: ParseOptions,
): Promise<TailwindResult<TTailwind>> {
  const parseResult = await parseCSS(options);

  return {
    variants: {
      default: parseResult.theme,
      ...Object.fromEntries(
        Object.entries(parseResult.variants).map(([name, { theme }]) => [
          name,
          theme,
        ]),
      ),
    },
    selectors: {
      default: ':root',
      ...Object.fromEntries(
        Object.entries(parseResult.variants).map(([name, { selector }]) => [
          name,
          selector,
        ]),
      ),
    },
    files: parseResult.files,
    variables: parseResult.variables,
    deprecationWarnings: parseResult.deprecationWarnings,
  };
}
```

---

## Core Modules

### CSS Parser

**Location**: `src/v4/core/parser/css.ts`

Main orchestrator of the parsing pipeline.

**Responsibilities:**

- Read CSS from file or raw string
- Initialize PostCSS parsing
- Coordinate import resolution
- Trigger variable resolution
- Return structured ParseResult

**Error Handling:**

- Throws if neither `filePath` nor `css` provided
- Throws if file cannot be read
- Throws if PostCSS parsing fails (invalid CSS syntax)
- Silently continues if @import files are missing (delegated to import resolver)

**Debug Mode:**

Pass `debug: true` to enable warning logs for failed imports.

### Import Resolver

**Location**: `src/v4/core/parser/imports.ts`

Recursively resolves and inlines @import statements.

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

**Graceful Error Handling:**

By design, the import resolver handles errors gracefully:

- Missing files → Remove @import, continue parsing
- Invalid CSS in import → Remove @import, continue parsing
- Permission errors → Remove @import, continue parsing
- Circular imports → Skip, prevent infinite loops

**Debug Mode:**

When `debug: true`:

```typescript
console.warn(
  '[Tailwind Theme Resolver] Failed to resolve import: ./missing.css',
);
console.warn('  Resolved path: /absolute/path/to/missing.css');
console.warn('  Error: ENOENT: no such file or directory');
```

### Variable Extractor

**Location**: `src/v4/core/parser/extractor.ts`

Extracts CSS variables and CSS rules from @theme, :root, and variant selectors.

**Extraction Sources:**

1. **@theme blocks** - Tailwind v4 namespace declarations
2. **:root blocks** - Global CSS variables
3. **Variant selectors** - Dark mode, custom themes, nested combinations
4. **CSS rules** - Direct style rules that override variables

**Output:**

```typescript
{
  variables: Array<CSSVariable>,
  keyframes: Map<string, string>,
  cssRules: Array<CSSRuleOverride>
}
```

**Optimization:**

- Single-pass AST traversal
- Module-level constants for namespace mappings
- Efficient variant detection via selector parsing
- Parallel extraction of variables and CSS rules

**Special Handling:**

- Multi-word namespaces: `text-shadow`, `drop-shadow`, `inset-shadow`
- Singular variable mappings: `--spacing` → `spacing.base`
- Keyframes resolution: `@keyframes` rules captured separately
- Nested variant combinations: `[data-theme='compact'].dark` → `'compact.dark'`
- Descendant selectors: `.theme-default .theme-container` → `'theme-default'` (first part only)

**Variable Parsing:**

The extractor uses configurable parsing functions:

- **`parseNestedKey()`** - Configurable nesting parser
  - Supports `maxDepth` to limit nesting levels
  - Supports `consecutiveDashes` to control consecutive dash handling
  - Used for all namespaces when nesting config is provided
- **`parseColorScale()`** - Backward-compatible wrapper
  - Delegates to `parseNestedKey()` with unlimited depth
  - Maintained for compatibility

**Variant Name Extraction:**

The `extractVariantName()` function handles different selector patterns:

- **Compound selectors** (same element): Joins all variant parts with `.`
  - Example: `[data-theme='compact'].dark` → `'compact.dark'`
  - Example: `.theme.dark.high-contrast` → `'theme.dark.high-contrast'`
- **Descendant selectors** (different elements): Extracts only first part
  - Example: `.theme-default .theme-container` → `'theme-default'`
  - Example: `.dark > .content` → `'dark'`

### Theme Builder

**Location**: `src/v4/core/theme/builder.ts`

Transforms flat CSS variables into structured Theme object with var() resolution.

**Architecture Pattern:**

Configuration-driven design using namespace mappings:

```typescript
const NAMESPACE_MAP: Record<string, NamespaceMapping> = {
  color: {
    property: 'colors',
    processor: processColorVariable,
  },
  text: {
    property: 'fontSize',
    processor: processFontSizeVariable,
  },
  spacing: { property: 'spacing' },
  // ... 22 total namespaces
};
```

**Variable Resolution System:**

Two-phase resolution for `var()` references:

1. **Phase 1: Build Reference Map**
   - Scans `@theme` variables for `var()` references
   - Maps raw CSS variables to theme properties
   - Example: `--color-background: var(--background)` → maps `--background` to `colors.background`

2. **Phase 2: Resolve Variables**
   - Recursively resolves `var()` references to actual values
   - Includes Tailwind default theme in resolution pool
   - Handles self-referential variables (skips to use defaults)
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
   - Apply processor if defined
   - Build nested structure
5. Separate base theme from variant overrides
6. Detect CSS rule conflicts and apply high-confidence overrides
7. Generate deprecation warnings

**Nested Variant Resolution:**

For nested/compound variants (e.g., `compact.dark`), the theme builder includes variables from parent variants:

1. **Detect Nested Variants**: Check if variant name contains `.` separator
2. **Gather Parent Variables**: For `compact.dark`, include variables from `compact` and `dark`
3. **Build Resolution Context**: Create variant-specific variable map with cascade order:
   - Tailwind defaults (lowest priority)
   - Base theme variables (`@theme`, `:root`)
   - Parent variant variables
   - Current variant variables (highest priority)
4. **Resolve with Context**: Variable references resolve using the full cascade

This mirrors CSS's natural cascade behavior.

**Complexity Metrics:**

- Main function (`buildThemes`): Cyclomatic complexity &lt; 10
- Helper function (`buildTheme`): Cyclomatic complexity &lt; 10
- Modular design with extracted helpers:
  - `buildReferenceMap()` - Builds var() reference mappings
  - `groupVariantVariables()` - Groups variant variables by name
  - `processReferencedVariable()` - Handles referenced variables
  - `processNamespacedVariable()` - Handles namespaced variables

### Tailwind Defaults Loader

**Location**: `src/v4/core/theme/defaults.ts`

Loads and merges Tailwind's default theme from node_modules for var() resolution.

**Caching Strategy:**

```typescript
interface ThemeCache {
  theme: Theme | null;
  timestamp: number; // File modification time
  path: string;
}
```

**Cache Validation:**

- First load: Parse `tailwindcss/theme.css` and cache with mtime
- Subsequent loads: Check if mtime changed → Use cache if unchanged
- Detects package updates without invalidating unnecessarily

**Fallback Behavior:**

- If `tailwindcss` not installed → Return null, no error
- User theme works independently

**basePath Resolution:**

- Accepts `basePath` parameter to locate node_modules
- CLI derives `basePath` from input file's directory
- Vite plugin uses project root automatically
- Critical for resolving defaults when processing files in subdirectories

**Granular Defaults Control:**

The `mergeThemes()` function supports selective merging of Tailwind defaults:

```typescript
export function mergeThemes(
  defaultTheme: Theme,
  userTheme: Theme,
  options: TailwindDefaultsOptions = {},
): Theme;
```

**TailwindDefaultsOptions Interface:**

```typescript
export interface TailwindDefaultsOptions {
  colors?: boolean;
  spacing?: boolean;
  fonts?: boolean;
  fontSize?: boolean;
  fontWeight?: boolean;
  tracking?: boolean;
  leading?: boolean;
  breakpoints?: boolean;
  containers?: boolean;
  radius?: boolean;
  shadows?: boolean;
  insetShadows?: boolean;
  dropShadows?: boolean;
  textShadows?: boolean;
  blur?: boolean;
  perspective?: boolean;
  aspect?: boolean;
  ease?: boolean;
  animations?: boolean;
  defaults?: boolean;
  keyframes?: boolean;
}
```

**Merge Behavior:**

- Each option defaults to `true` (include by default)
- When `true`: Merges default values with user values (user values override)
- When `false`: Uses only user values for that category
- `includeDefaults` parameter accepts:
  - `true` → All defaults included
  - `false` → No defaults included
  - `TailwindDefaultsOptions` → Granular control per category

**Variable Resolution Integration:**

- Default theme is converted back to CSS variables via `themeToVariables()`
- Combined with user variables for comprehensive `var()` resolution
- Enables references like `var(--color-blue-300)` to resolve to actual oklch values
- Self-referential variables are skipped to prefer defaults
- Selective merging allows excluding unused defaults to reduce bundle size

---

## Advanced Features

### CSS Rule Extraction

**Location**: `src/v4/core/extraction/rules.ts`

Extracts and classifies CSS rules within variant selectors that may conflict with CSS variables.

**Problem Context:**

Real-world CSS files often contain both CSS variables AND direct CSS rules:

```css
.theme-mono {
  --radius-lg: 0.45em; /* CSS variable */

  .rounded-lg {
    border-radius: 0; /* Direct CSS rule - overrides the variable! */
  }
}
```

Without detection, the runtime theme would incorrectly report `radius.lg: "0.45em"` when the actual rendered value is `"0"`.

**Complexity Classification:**

Rules are classified as **simple** (safe to apply) or **complex** (requires manual review):

**Simple Rules:**

- Static values (no `var()`, `calc()`, etc.)
- No pseudo-classes (`:hover`, `:focus`)
- No pseudo-elements (`::before`, `::after`)
- Not nested in media queries
- ≤3 property declarations
- No complex combinators

**Complex Rules:**

- Dynamic CSS functions (`var()`, `calc()`, `min()`, `max()`, `clamp()`)
- Pseudo-classes or pseudo-elements
- Media query nesting
- `@apply` directives
- Multiple declarations (&gt;3)
- Complex selectors

**Property Mappings:**

Maps CSS properties to theme namespaces:

```typescript
{
  'border-radius': {
    themeProperty: 'radius',
    keyExtractor: extractRoundedUtilityKey  // .rounded-lg → "lg"
  },
  'box-shadow': {
    themeProperty: 'shadows',
    keyExtractor: extractShadowUtilityKey   // .shadow-lg → "lg"
  },
  // ... other mappings
}
```

### Conflict Detection and Resolution

**Location**: `src/v4/core/analysis/conflicts.ts`

Detects and resolves conflicts between CSS rules and theme variables.

**Conflict Detection:**

Compares extracted CSS rules against resolved theme variables:

```typescript
interface CSSRuleConflict {
  variantName: string;
  themeProperty: keyof Theme;
  themeKey: string;
  variableValue: string;
  ruleValue: string;
  ruleSelector: string;
  canResolve: boolean;
  confidence: 'high' | 'medium' | 'low';
  cssRule: CSSRuleOverride;
}
```

**Confidence Calculation:**

- **High**: Simple static value, no unit mismatches
- **Medium**: Simple but different unit types (e.g., `px` vs `rem`)
- **Low**: Complex rule requiring manual review

**Resolution Strategy:**

1. **Detect all conflicts** - Complete awareness of discrepancies
2. **Apply high-confidence overrides** - Safe automation for simple cases
3. **Report complex cases** - Inform user for manual review

**Override Application:**

Only high-confidence, simple conflicts are automatically applied:

```typescript
if (conflict.canResolve && conflict.confidence === 'high') {
  theme[conflict.themeProperty][conflict.themeKey] = conflict.ruleValue;
}
```

**Reporting:**

Generates both Markdown and JSON reports:

1. **`conflicts.md`** - Human-readable report
2. **`conflicts.json`** - Machine-readable for tooling

**Terminal Output:**

```
⚠  12 CSS conflicts detected (see src/generated/tailwindcss/conflicts.md)
```

### Unresolved Variable Detection

**Location**: `src/v4/core/analysis/unresolved.ts`

Detects CSS variables with `var()` references that couldn't be resolved during theme building.

**Problem Context:**

Real-world CSS often references variables injected at runtime or provided by external sources:

```css
@theme {
  --font-sans: var(--font-inter); /* Injected by Next.js */
  --color-accent: var(--tw-primary); /* Tailwind plugin variable */
  --spacing-base: var(--spacing-base); /* Self-referential (intentional) */
}
```

**Detection Process:**

Compares original variables with resolved variables:

```typescript
interface UnresolvedVariable {
  variableName: string;
  originalValue: string;
  referencedVariable: string;
  fallbackValue?: string;
  source: 'theme' | 'root' | 'variant';
  variantName?: string;
  selector?: string;
  likelyCause: UnresolvedCause;
}
```

**Cause Classification:**

- **External** (`--tw-*` prefix): Tailwind plugins, runtime injection, external stylesheets
- **Self-referential**: Variables that reference themselves (intentionally skipped to use defaults)
- **Unknown**: All other unresolved references (requires user review)

**Regex Pattern Handling:**

Uses separate regex patterns to avoid global state issues:

```typescript
const VAR_REFERENCE_REGEX_GLOBAL = /var\((--[\w-]+)(?:,\s*([^)]+))?\)/g;
const VAR_REFERENCE_REGEX_TEST = /var\((--[\w-]+)(?:,\s*([^)]+))?\)/;
```

**Reporting:**

Generates both Markdown and JSON reports:

1. **`unresolved.md`** - Human-readable report with recommendations
2. **`unresolved.json`** - Machine-readable for tooling

**Terminal Output:**

```
ℹ  8 unresolved variables detected (see src/generated/tailwindcss/unresolved.md)
```

### Theme Override System

**Location**: `src/v4/core/theme/overrides.ts`

Applies custom theme value overrides to fix unresolved variables or conflicts programmatically.

**Problem Context:**

Users may encounter CSS variables that reference external sources or have conflicts needing correction:

```css
@theme {
  --font-sans: var(--font-inter); /* Injected by Next.js - unresolved */
  --radius-lg: 1rem;
}

[data-theme='dark'] {
  --color-background: #1a1a1a; /* Maybe needs adjustment */
}
```

The override system provides a programmatic way to inject or override these values without modifying CSS files.

**Architecture:**

Two-phase approach for maximum flexibility:

1. **Pre-resolution** (Variable Injection)
   - Injects synthetic CSS variables before resolution pipeline
   - Allows overrides to participate in `var()` resolution
   - Applied to selectors: `'default'`, `'base'`, `'*'` (wildcard)

2. **Post-resolution** (Theme Mutation)
   - Directly mutates resolved theme objects after building
   - Overrides final computed values
   - Applied to any selector (variant names, CSS selectors, wildcards)

**Syntax Support:**

Both flat notation and nested object notation:

```typescript
// Flat notation (dot-separated paths)
overrides: {
  'default': {
    'colors.primary.500': '#custom-blue',
    'radius.lg': '0.5rem'
  }
}

// Nested notation
overrides: {
  'default': {
    colors: {
      primary: {
        500: '#custom-blue'
      }
    }
  }
}
```

**Selector Matching:**

- **Direct variant names**: `'dark'`, `'compact'`, `'themeMono'`
- **CSS selectors**: `'[data-theme="dark"]'`, `'.dark'`
- **Special keys**:
  - `'default'` or `'base'` - Base/default theme only
  - `'*'` - All variants including default (wildcard)

**Detailed Override Values:**

```typescript
overrides: {
  'dark': {
    // Simple string value
    'colors.background': '#000000',

    // Detailed control
    'radius.lg': {
      value: '0',
      force: true,        // Apply even for low-confidence conflicts
      resolveVars: false  // Skip variable resolution
    }
  }
}
```

**Integration Flow:**

```
CSS Parser
    ↓
buildThemes() {
    ↓
    Step 1: Inject variable overrides (pre-resolution)
    ├─ Only for 'default', 'base', '*' selectors
    ├─ Creates synthetic CSSVariable objects
    └─ Adds to variables array before resolution

    ↓
    Variable separation & resolution pipeline
    ↓
    Theme building & conflict detection
    ↓

    Step 2: Apply theme overrides (post-resolution)
    ├─ Applies to all selector types
    ├─ Navigates theme paths and mutates values
    └─ Skips non-existent paths gracefully
}
```

### Nesting Configuration

**Location**: `src/v4/core/parser/extractor.ts` (parseNestedKey function)

Controls how CSS variable names are parsed into nested theme structures.

**Configuration Interface:**

```typescript
interface NestingConfig {
  maxDepth?: number; // Limit nesting depth (default: Infinity)
  consecutiveDashes?: 'exclude' | 'nest' | 'camelcase' | 'literal';
}

interface NestingOptions {
  default?: NestingConfig; // Global default
  colors?: NestingConfig; // Per-namespace overrides
  shadows?: NestingConfig;
  spacing?: NestingConfig;
  // ... all other namespaces
}
```

**Default Behavior:**

Without config: Unlimited nesting, consecutive dashes excluded (matches Tailwind v4)

- `--color-tooltip-outline-50` → `colors.tooltip.outline[50]`
- `--color-button--primary` → Excluded (not included in theme)

**maxDepth Examples:**

- **`maxDepth: 2`**: Nesting limited to 2 levels
  - `--color-tooltip-outline-50` → `colors.tooltip.outline50`
- **`maxDepth: 0`**: Complete flattening
  - `flattenMode: 'camelcase'` (default): `--color-brand-primary-dark` → `colors.brandPrimaryDark`
  - `flattenMode: 'literal'`: `--color-brand-primary-dark` → `colors['brand-primary-dark']`

**consecutiveDashes Examples:**

- **`'exclude'`** (default): Consecutive dashes cause exclusion
  - `--color-button--primary` → Excluded
- **`'camelcase'`**: Consecutive dashes become camelCase
  - `--color-button--primary` → `colors.buttonPrimary`
- **`'nest'`**: Consecutive dashes treated as single dash
  - `--color-button--primary` → `colors.button.primary`
- **`'literal'`**: Consecutive dashes preserved in keys
  - `--color-button--primary` → `colors['button-'].primary`

**Conflict Resolution:**

When a scalar value and nested properties exist at the same path, the scalar value is moved to a `DEFAULT` key:

- `--color-card: blue` + `--color-card-foreground: white` → `{ card: { DEFAULT: 'blue', foreground: 'white' } }`

### Report Configuration

Controls which diagnostic reports are generated.

**Configuration Options:**

Both Vite plugin and CLI support report configuration:

```typescript
// Vite Plugin
tailwindResolver({
  input: 'src/styles.css',
  generateRuntime: {
    reports: false, // Disable all reports
    // Or granular control:
    reports: {
      conflicts: true,
      unresolved: false,
    },
  },
});

// CLI
// --no-reports (disable all)
// --no-conflict-reports (disable conflicts only)
// --no-unresolved-reports (disable unresolved only)
```

**Implementation:**

Configuration flows through the file generation pipeline:

1. `RuntimeGenerationOptions` includes optional `reports` property
2. `normalizeRuntimeOptions()` converts to consistent `ReportGenerationOptions` format
3. `generateThemeFiles()` accepts `reportOptions` parameter
4. Report processors check `enabled` flag before generating

**Type Definitions:**

```typescript
export interface ReportGenerationOptions {
  conflicts?: boolean; // Generate CSS conflict reports (default: true)
  unresolved?: boolean; // Generate unresolved variable reports (default: true)
}

export interface RuntimeGenerationOptions {
  variants?: boolean;
  selectors?: boolean;
  files?: boolean;
  variables?: boolean;
  reports?: boolean | ReportGenerationOptions;
}
```

**Normalization Logic:**

- `undefined` → `{ conflicts: true, unresolved: true }`
- `true` → `{ conflicts: true, unresolved: true }`
- `false` → `{ conflicts: false, unresolved: false }`
- `{ conflicts: false }` → `{ conflicts: false, unresolved: true }`

---

## Integration Points

### Vite Plugin

**Location**: `src/v4/vite/plugin.ts`

Automatic theme type generation with hot module reloading.

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

**Configuration:**

See [Vite Plugin README](./src/v4/vite/README.md) for detailed configuration options.

### CLI Tool

**Location**: `src/v4/cli/index.ts`

One-shot generation for CI/CD, build scripts, non-Vite projects, and SSR environments.

**Basic Usage:**

```bash
tailwind-resolver -i src/styles.css --debug
```

**Granular Defaults Control:**

```bash
# Include only specific categories
tailwind-resolver -i styles.css --include-defaults colors,spacing,fonts

# Include all except specific categories
tailwind-resolver -i styles.css --exclude-defaults shadows,animations
```

**Report Control:**

```bash
# Generate only specific reports
tailwind-resolver -i styles.css --reports conflicts

# Generate all except specific reports
tailwind-resolver -i styles.css --exclude-reports unresolved
```

**basePath Handling:**

The CLI automatically derives `basePath` from the input file's directory:

```typescript
const inputPath = options.input as string;
const absoluteInputPath = resolve(process.cwd(), inputPath);
const basePath = dirname(absoluteInputPath);
```

This ensures Tailwind defaults are resolved from the correct `node_modules` location.

See [CLI README](./src/v4/cli/README.md) for complete documentation.

### Type Generator

**Location**: `src/v4/shared/type_generator.ts`

Generates TypeScript type declarations and runtime objects.

**Output:**

1. **types.ts** - TypeScript type declarations (includes `DefaultTheme` and `Tailwind` interfaces)
2. **theme.ts** - Runtime objects (if `generateRuntime: true`)
3. **index.ts** - Clean re-exports (if `generateRuntime: true`)

**Generic Type Pattern:**

Uses TypeScript generics for type-safe theme access:

```typescript
// Usage

import type { Tailwind } from './generated/tailwindcss';

// Generated types.ts
export interface DefaultTheme {
  colors: { primary: { 500: 'oklch(...)' } };
  // ... all theme properties
}

export interface Tailwind {
  variants: {
    default: DefaultTheme;
    dark: Dark;
    // ... other variants
  };
  selectors: {
    default: string;
    dark: string;
    // ... other selectors
  };
  files: Array<string>;
  variables: Array<{ name: string; value: string; source: string }>;
}

const result = await resolveTheme<Tailwind>({ input: './styles.css' });
result.variants.default.colors.primary[500]; // Fully typed!
```

**Benefits:**

- Explicit type imports - no ambient declarations
- Full IntelliSense for all variants
- Type-safe access to selectors, files, and variables
- Works in any TypeScript project without tsconfig modifications
- Consistent structure between generated code and runtime API

**Configuration:**

- Centralized `THEME_PROPERTY_CONFIGS` for all 22 namespaces
- Shared escaping logic via `escapeStringLiteral()`

### Dynamic Spacing Helper

**Location**: `src/v4/shared/spacing_helper.ts`

Provides a callable helper function that replicates Tailwind's `calc(var(--spacing) * N)` behavior.

**Architecture:**

Hybrid callable object using `Object.assign`:

```typescript
export function createSpacingHelper(
  spacingValues: Record<string, string>,
  fallbackBase: string,
): Record<string, string> & ((n: number) => string) {
  const baseUnit = spacingValues.base ?? fallbackBase;
  const spacingFn = (n: number): string => {
    return `calc(${baseUnit} * ${n})`;
  };
  return Object.assign(spacingFn, spacingValues);
}
```

**Type System:**

Uses TypeScript intersection types for dual behavior:

```typescript
{
  base: '0.25rem';
  sm: '0.5rem';
  md: '1rem';
} & ((n: number) => string)
```

**Usage Patterns:**

```typescript
// Static named values (autocomplete)
theme.spacing.md; // "1rem"
theme.spacing.lg; // "1.5rem"

// Dynamic calculations
theme.spacing(4); // "calc(0.25rem * 4)" → "1rem" at runtime
theme.spacing(10); // "calc(0.25rem * 10)" → "2.5rem" at runtime
theme.spacing(-2); // "calc(0.25rem * -2)" → "-0.5rem" at runtime
```

**Conditional Generation:**

Only generated when spacing is defined in the theme.

**Fallback Behavior:**

- Variant themes use their local `--spacing` base if defined
- Falls back to default theme's `spacing.base` if variant doesn't define it
- If no spacing exists, helper is not generated

**Use Cases:**

Supports Tailwind v4 utilities that use spacing calculations:

- Spacing: `m-<number>`, `p-<number>`, `gap-<number>`
- Sizing: `w-<number>`, `h-<number>`, `min-w-<number>`, `max-w-<number>`
- Layout: `inset-<number>`, `-inset-<number>`
- Typography: `indent-<number>`, `-indent-<number>`
- Tables: `border-spacing-<number>`
- Scrolling: `scroll-m-<number>`, `scroll-p-<number>`

---

## Data Flow

### Complete Example

**Input:**

```css
@theme {
  --color-primary-500: oklch(0.65 0.2 250);
  --color-chart-1: var(--color-blue-300);
  --spacing-4: 1rem;
  --radius-lg: 0.5rem;
}

:root {
  --background: oklch(1 0 0);
}

[data-theme='dark'] {
  --background: #1f2937;

  .rounded-lg {
    border-radius: 0; /* CSS rule override */
  }
}
```

**Pipeline:**

```
1. CSS Parser
   ├─ Reads file
   ├─ Loads Tailwind defaults from node_modules
   └─ Creates PostCSS AST

2. Variable Extractor
   ├─ Variables:
   │  ├─ Finds: --color-primary-500 (source: 'theme')
   │  ├─ Finds: --color-chart-1 (source: 'theme', value: 'var(--color-blue-300)')
   │  ├─ Finds: --spacing-4 (source: 'theme')
   │  ├─ Finds: --radius-lg (source: 'theme')
   │  ├─ Finds: --background (source: 'root')
   │  └─ Finds: --background (source: 'variant', selector: '[data-theme="dark"]')
   └─ CSS Rules:
      └─ Finds: .rounded-lg { border-radius: 0; } (variant: 'dark')

3. Theme Builder
   ├─ Converts Tailwind defaults to variables
   ├─ Builds reference map: --background → colors.background
   ├─ Resolves var() references:
   │  └─ var(--color-blue-300) → oklch(80.9% 0.105 251.813)
   ├─ Base theme:
   │  ├─ colors.primary[500] = "oklch(0.65 0.20 250)"
   │  ├─ colors.chart[1] = "oklch(80.9% 0.105 251.813)" [RESOLVED]
   │  ├─ colors.background = "oklch(1 0 0)" [FROM :root via reference]
   │  ├─ spacing[4] = "1rem"
   │  └─ radius.lg = "0.5rem"
   ├─ Variants (before conflict resolution):
   │  └─ dark:
   │     ├─ selector: "[data-theme='dark']"
   │     ├─ theme.colors.background = "#1f2937"
   │     └─ theme.radius.lg = "0.5rem" [inherited from base]
   └─ Conflict Resolution:
      ├─ Detects: .rounded-lg overrides radius.lg in dark variant
      ├─ Confidence: High (simple static value)
      └─ Applies: dark.theme.radius.lg = "0" [OVERRIDDEN]
```

**Output (TailwindResult):**

```typescript
{
  variants: {
    default: {
      colors: {
        primary: { 500: "oklch(0.65 0.20 250)" },
        chart: { 1: "oklch(80.9% 0.105 251.813)" },
        background: "oklch(1 0 0)",
        // ... all Tailwind default colors
      },
      fonts: {
        sans: "ui-sans-serif, system-ui, sans-serif, ...",
        // ... other fonts from Tailwind defaults
      },
      spacing: { 4: "1rem" },
      radius: { lg: "0.5rem" },
      // ... other namespaces
    },
    dark: {
      colors: { background: "#1f2937" },
      radius: { lg: "0" }  // Overridden by CSS rule
    }
  },
  selectors: {
    default: ":root",
    dark: "[data-theme='dark']"
  },
  variables: [/* raw CSSVariable array */],
  files: ['/absolute/path/to/styles.css'],
  deprecationWarnings: [],
  cssConflicts: [
    {
      variantName: "dark",
      themeProperty: "radius",
      themeKey: "lg",
      variableValue: "0.5rem",
      ruleValue: "0",
      ruleSelector: ".rounded-lg",
      canResolve: true,
      confidence: "high",
      applied: true
    }
  ]
}
```

**Internal ParseResult Format:**

The parser internally uses `ParseResult` format:

```typescript
{
  theme: { /* base theme */ },
  variants: {
    dark: {
      selector: "[data-theme='dark']",
      theme: { /* variant theme */ }
    }
  },
  // ... other properties
}
```

This is converted to `TailwindResult` format by `resolveTheme()` where:

- `theme` becomes `variants.default`
- `variants[name].theme` becomes `variants[name]`
- `variants[name].selector` becomes `selectors[name]`

---

## Performance

### Time Complexity

| Operation           | Complexity | Notes                                  |
| ------------------- | ---------- | -------------------------------------- |
| CSS Parsing         | O(n)       | n = file size, PostCSS linear scan     |
| Import Resolution   | O(d × n)   | d = import depth, n = avg file size    |
| Variable Resolution | O(v)       | v = number of CSS variables            |
| Theme Building      | O(v)       | Single pass with constant-time lookups |
| Type Generation     | O(p)       | p = number of theme properties         |

### Optimizations

1. **Single-pass traversal** - Variable resolver walks AST once
2. **Configuration maps** - O(1) namespace lookups vs O(n) switch statements
3. **Module-level constants** - Avoid re-creating config objects
4. **Timestamp caching** - Tailwind defaults cached with file mtime
5. **Parallel builds** - Build script uses Promise.all() for ESM + CJS

### Benchmarks

Based on real-world usage:

| Theme Size | Variables | Parse Time | Type Gen Time |
| ---------- | --------- | ---------- | ------------- |
| Small      | < 100     | ~10ms      | ~5ms          |
| Medium     | 100-500   | ~30ms      | ~15ms         |
| Large      | > 500     | ~80ms      | ~30ms         |

_Note: Times exclude file I/O, measured on M1 Mac_

---

## Error Handling

The library follows a **progressive enhancement** approach.

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

Enable via `debug: true` in ParseOptions:

```typescript
const result = await resolveTheme({
  filePath: './theme.css',
  debug: true, // Logs warnings for missing imports
});
```

**Output:**

- Import resolution warnings
- Failed file reads with full paths
- Detailed error messages

---

## Extension

### Adding New Namespaces

To add support for a new Tailwind namespace:

**1. Add to types** (`src/v4/types.ts`):

```typescript
export interface ThemeCustom {
  [key: string]: string;
}

export interface Theme {
  // ... existing properties
  custom: ThemeCustom;
}
```

**2. Add to namespace map** (`src/v4/core/theme/builder.ts`):

```typescript
const NAMESPACE_MAP = {
  // ... existing mappings
  custom: { property: 'custom' },
};
```

**3. Add to type generator** (`src/v4/shared/type_generator.ts`):

```typescript
const THEME_PROPERTY_CONFIGS = [
  // ... existing configs
  {
    key: 'custom',
    generator: (v) => generateObjectType(v as Record<string, string>),
  },
];
```

The pipeline will automatically handle resolution, building, and type generation.

---

## Testing

### Test Coverage

- **734 passing tests** (100% pass rate)
- **2034 expect() calls**
- All core paths covered

### Test Categories

**Unit Tests:**

- Each module tested in isolation
- Mock file system for import tests
- Snapshot tests for type generation

**Integration Tests:**

- 9-file deep import chain test
- Real Tailwind theme parsing
- Circular import detection
- Variant resolution and selector mapping
- CSS variable resolution with var() references

**Feature Coverage:**

- **CSS Rule Extraction & Conflict Detection**: Comprehensive test coverage
- **Unresolved Variable Detection**:
  - 21 unit tests for detection logic (unresolved-detector.test.ts)
  - 7 unit tests for report generation (unresolved-reporter.test.ts)
  - 4 integration tests for full pipeline (unresolved-detection-pipeline.test.ts)
- **Theme Override System**:
  - 43 unit tests for override logic (theme-overrides.test.ts)
  - 11 integration tests for full override pipeline (override-system.test.ts)
- **Initial Keyword Filtering**:
  - 37 unit tests for filtering logic (initial-filter.test.ts)
  - 30 integration tests for end-to-end functionality (initial-keyword.test.ts)
    - 6 CSS cascade order tests ensuring proper sequential processing
    - Validates both Case 1 (value before initial → removed) and Case 2 (initial before value → preserved)
- **Nesting Configuration**:
  - 17 integration tests for nesting config functionality (nesting_config_test.ts)
    - Tests `maxDepth` configurations (0, 1, 2, 3, unlimited)
    - Tests `consecutiveDashes` behavior (all 4 modes)
    - Tests per-namespace configuration and default fallback
    - Tests numeric key handling with different nesting depths

**API Structure:**

- Tests verify both runtime API and generated code consistency
- Updated to use new `TailwindResult` API structure

---

## References

- [README.md](./README.md) - User-facing documentation and API reference
- [Vite Plugin README](./src/v4/vite/README.md) - Vite plugin configuration
- [CLI README](./src/v4/cli/README.md) - CLI usage and options
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development setup and guidelines
- [CLAUDE.md](./CLAUDE.md) - Code standards and conventions
- [CHANGELOG.md](./CHANGELOG.md) - Version history and breaking changes
