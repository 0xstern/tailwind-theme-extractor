# Architecture Documentation

This document provides a visual representation and detailed explanation of the Tailwind Theme Resolver parsing pipeline.

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

## Public API

### Type System (`src/v4/types.ts`)

The library exposes two main result types:

**1. TailwindResult<TTailwind> - Public API**

This is the type returned by `resolveTheme()` and matches the structure of generated code:

```typescript
export interface TailwindResult<TTailwind = UnknownTailwind> {
  variants: TTailwind extends { variants: infer V } ? V : Record<string, Theme>;
  selectors: TTailwind extends { selectors: infer S }
    ? S
    : Record<string, string>;
  files: Array<string>;
  variables: Array<CSSVariable>;
  deprecationWarnings: Array<DeprecationWarning>;
  cssConflicts?: Array<unknown>; // CSS rule conflicts (optional)
  unresolvedVariables?: Array<unknown>; // Unresolved var() references (optional)
}
```

**2. ParseResult<TTheme> - Internal Format**

Used internally by the parser and type generator:

```typescript
export interface ParseResult<TTheme extends Theme = Theme> {
  theme: TTheme; // Base theme from @theme and :root
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
  cssConflicts?: Array<unknown>; // CSS rule conflicts (optional)
  unresolvedVariables?: Array<unknown>; // Unresolved var() references (optional)
}
```

**Usage Patterns:**

```typescript
// Theme (loosely typed)

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

**Conversion Layer:**

The `resolveTheme()` function converts from internal `ParseResult` to public `TailwindResult`:

```typescript
export async function resolveTheme<TTailwind = UnknownTailwind>(
  options: ParseOptions,
): Promise<TailwindResult<TTailwind>> {
  const parseResult = await parseCSS(options); // Returns ParseResult

  // Convert to TailwindResult format
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

The type generator also accepts both formats via wrapper functions that detect and convert as needed.

## Core Modules

### 1. CSS Parser (`src/v4/parser/css-parser.ts`)

**Entry Point** - Main orchestrator of the parsing pipeline.

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
  '[Tailwind Theme Resolver] Failed to resolve import: ./missing.css',
);
console.warn('  Resolved path: /absolute/path/to/missing.css');
console.warn('  Error: ENOENT: no such file or directory');
```

### 3. Variable Extractor (`src/v4/parser/variable-extractor.ts`)

**Purpose** - Extract CSS variables and CSS rules from @theme, :root, and variant selectors.

**Extraction Sources:**

1. **@theme blocks** - Tailwind v4 namespace declarations
2. **:root blocks** - Global CSS variables
3. **Variant selectors** - Dark mode, custom themes, nested combinations
4. **CSS rules** - Direct style rules that override variables (NEW)

**Output:**

```typescript
{
  variables: Array<CSSVariable>,     // CSS custom properties
  keyframes: Map<string, string>,    // @keyframes definitions
  cssRules: Array<CSSRuleOverride>   // Direct CSS rules (NEW)
}
```

**Optimization:**

- Single-pass AST traversal (no double walking)
- Module-level constants for namespace mappings
- Efficient variant detection via selector parsing
- Parallel extraction of variables and CSS rules

**Special Handling:**

- Multi-word namespaces: `text-shadow`, `drop-shadow`, `inset-shadow`
- Singular variable mappings: `--spacing` → `spacing.base`
- Keyframes resolution: `@keyframes` rules captured separately
- Nested variant combinations: `[data-theme='compact'].dark` → `'compact.dark'`
- Descendant selectors: `.theme-default .theme-container` → `'theme-default'` (first part only)

**Variant Name Extraction:**

The `extractVariantName()` function intelligently handles different selector patterns:

- **Compound selectors** (same element): Joins all variant parts with `.`
  - Example: `[data-theme='compact'].dark` → `'compact.dark'`
  - Example: `.theme.dark.high-contrast` → `'theme.dark.high-contrast'`
- **Descendant selectors** (different elements): Extracts only first part
  - Example: `.theme-default .theme-container` → `'theme-default'`
  - Example: `.dark > .content` → `'dark'`

This ensures proper CSS cascade behavior where nested selectors can reference variables from their parent selectors.

### 3a. CSS Rule Extractor (`src/v4/parser/css-rule-extractor.ts`)

**Purpose** - Extract and classify CSS rules within variant selectors that may conflict with CSS variables.

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

Without detection, the runtime theme object would incorrectly report `radius.lg: "0.45em"` when the actual rendered value is `"0"`.

**Complexity Classification:**

Rules are classified as **simple** (safe to apply) or **complex** (requires manual review):

**Simple Rules:**

- Static values (no `var()`, `calc()`, etc.)
- No pseudo-classes (`:hover`, `:focus`)
- No pseudo-elements (`::before`, `::after`)
- Not nested in media queries
- ≤3 property declarations
- No complex combinators (descendant, child, sibling)

**Complex Rules:**

- Dynamic CSS functions (`var()`, `calc()`, `min()`, `max()`, `clamp()`)
- Pseudo-classes or pseudo-elements
- Media query nesting
- `@apply` directives
- Multiple declarations (>3)
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

### 3b. Conflict Resolver (`src/v4/parser/conflict-resolver.ts`)

**Purpose** - Detect and resolve conflicts between CSS rules and theme variables.

**Conflict Detection:**

Compares extracted CSS rules against resolved theme variables:

```typescript
interface CSSRuleConflict {
  variantName: string; // e.g., "themeMono"
  themeProperty: keyof Theme; // e.g., "radius"
  themeKey: string; // e.g., "lg"
  variableValue: string; // e.g., "0.45em" (from CSS variable)
  ruleValue: string; // e.g., "0" (from CSS rule)
  ruleSelector: string; // e.g., ".rounded-lg"
  canResolve: boolean; // true if simple rule
  confidence: 'high' | 'medium' | 'low';
  cssRule: CSSRuleOverride; // Original rule details
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

Only high-confidence, simple conflicts are automatically applied to variant themes:

```typescript
if (conflict.canResolve && conflict.confidence === 'high') {
  theme[conflict.themeProperty][conflict.themeKey] = conflict.ruleValue;
}
```

This ensures the runtime theme object matches actual rendered styles.

### Report Configuration

The library supports granular control over which diagnostic reports are generated, with all reports enabled by default for comprehensive theme analysis.

**Configuration Options:**

Both the Vite plugin and CLI support report configuration:

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

The configuration flows through the file generation pipeline:

1. `RuntimeGenerationOptions` includes optional `reports` property (boolean or object)
2. `normalizeRuntimeOptions()` converts to consistent `ReportGenerationOptions` format
3. `generateThemeFiles()` accepts `reportOptions` parameter
4. `processConflictReports()` and `processUnresolvedReports()` check `enabled` flag before generating

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
  reports?: boolean | ReportGenerationOptions; // NEW
}
```

**Normalization Logic:**

The `normalizeReportOptions()` function provides consistent defaults:

- `undefined` → `{ conflicts: true, unresolved: true }` (all enabled)
- `true` → `{ conflicts: true, unresolved: true }` (all enabled)
- `false` → `{ conflicts: false, unresolved: false }` (all disabled)
- `{ conflicts: false }` → `{ conflicts: false, unresolved: true }` (granular control)

This ensures backward compatibility (reports enabled by default) while providing flexibility to disable specific reports or all reports.

### 3c. Unresolved Variable Detector (`src/v4/parser/unresolved-detector.ts`)

**Purpose** - Detect CSS variables with `var()` references that couldn't be resolved during theme building.

**Problem Context:**

Real-world CSS often references variables that are injected at runtime or provided by external sources:

```css
@theme {
  --font-sans: var(--font-inter); /* Injected by Next.js */
  --color-accent: var(--tw-primary); /* Tailwind plugin variable */
  --spacing-base: var(--spacing-base); /* Self-referential (intentional) */
}
```

Without detection, users wouldn't know which variables require external injection.

**Detection Process:**

Compares original variables with resolved variables to identify unresolved `var()` references:

```typescript
interface UnresolvedVariable {
  variableName: string; // e.g., '--font-sans'
  originalValue: string; // e.g., 'var(--font-inter)'
  referencedVariable: string; // e.g., '--font-inter'
  fallbackValue?: string; // Fallback if provided in var()
  source: 'theme' | 'root' | 'variant';
  variantName?: string;
  selector?: string;
  likelyCause: UnresolvedCause;
}
```

**Cause Classification:**

Variables are categorized by their likely cause:

- **External** (`--tw-*` prefix): Tailwind plugins, runtime injection, external stylesheets
- **Self-referential**: Variables that reference themselves (intentionally skipped to use defaults)
- **Unknown**: All other unresolved references (requires user review)

**Regex Pattern Handling:**

Uses separate regex patterns to avoid global state issues:

```typescript
const VAR_REFERENCE_REGEX_GLOBAL = /var\((--[\w-]+)(?:,\s*([^)]+))?\)/g;
const VAR_REFERENCE_REGEX_TEST = /var\((--[\w-]+)(?:,\s*([^)]+))?\)/;
```

The non-global pattern is used for testing, global pattern for extraction, preventing `lastIndex` state bugs.

### 3d. Unresolved Variable Reporter (`src/v4/parser/unresolved-reporter.ts`)

**Purpose** - Generate human-readable and machine-readable reports for unresolved variables.

**Output Files:**

Generated in the same output directory as theme files:

1. **`unresolved.md`** - Human-readable Markdown report
2. **`unresolved.json`** - Machine-readable JSON for tooling integration

**Markdown Report Structure:**

```markdown
# Unresolved CSS Variables

**Generated:** 2025-10-19T23:15:42.930Z
**Source:** src/theme.css
**Version:** 0.2.1

## Summary

- **Total unresolved:** 8
- **External references:** 2 (plugins, runtime injection, external stylesheets)
- **Self-referential (skipped):** 1
- **Unknown:** 5

## Unresolved Variables

### ⚠️ Unknown

[Variables that need review]

### ℹ️ External Reference

[Variables from plugins/external sources]

### ✅ Self-referential (Intentional)

[Variables intentionally left unresolved]

## Recommendations

[Context-specific recommendations based on detection results]
```

**JSON Report Structure:**

```json
{
  "generatedAt": "2025-10-19T23:15:42.930Z",
  "source": "src/theme.css",
  "version": "0.2.1",
  "summary": {
    "total": 8,
    "external": 2,
    "selfReferential": 1,
    "unknown": 5
  },
  "unresolved": [
    {
      "variableName": "--font-sans",
      "originalValue": "var(--font-inter)",
      "referencedVariable": "--font-inter",
      "source": "variant",
      "variantName": "theme-inter",
      "likelyCause": "unknown"
    }
  ]
}
```

**Terminal Output:**

Non-intrusive single-line notification:

```
ℹ  8 unresolved variables detected (see src/generated/tailwindcss/unresolved.md)
```

### 3e. Conflict Reporter (`src/v4/parser/conflict-reporter.ts`)

**Purpose** - Generate human-readable and machine-readable conflict reports.

**Output Files:**

Generated in the same output directory as theme files:

1. **`conflicts.md`** - Human-readable Markdown report
2. **`conflicts.json`** - Machine-readable JSON for tooling integration

**Markdown Report Structure:**

```markdown
# CSS Rule Conflicts

**Generated:** 2025-10-19T02:55:12.930Z
**Source:** src/theme.css
**Version:** 0.1.7

## Summary

- **Total conflicts:** 12
- **Auto-resolved:** 8 (high confidence)
- **Manual review needed:** 4 (medium/low confidence)

## Auto-Resolved Conflicts

[List of conflicts automatically applied to themes]

## Manual Review Required

[List of conflicts requiring user attention with suggested actions]

## Recommendations

[Context-specific recommendations based on conflict types]
```

**JSON Report Structure:**

```json
{
  "generatedAt": "2025-10-19T02:55:12.930Z",
  "source": "src/theme.css",
  "version": "0.1.7",
  "summary": {
    "total": 12,
    "autoResolved": 8,
    "manualReview": 4
  },
  "conflicts": [
    {
      "variantName": "themeMono",
      "themeProperty": "radius",
      "themeKey": "lg",
      "selector": ".rounded-lg",
      "variableValue": "0.45em",
      "ruleValue": "0",
      "confidence": "high",
      "canResolve": true,
      "applied": true
    }
  ]
}
```

**Terminal Output:**

Non-intrusive single-line notification:

```
⚠  12 CSS conflicts detected (see src/generated/tailwindcss/conflicts.md)
```

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
    processor: processFontSizeVariable, // Resolves size + line-height
  },
  spacing: { property: 'spacing' }, // Simple 1:1 mapping
  // ... 22 total namespaces
};
```

**Complexity Metrics:**

- Main function (`buildThemes`): Cyclomatic complexity < 10 (after extracting helpers)
- Helper function (`buildTheme`): Cyclomatic complexity < 10 (after extracting processors)
- Modular design with 4 resolved helper functions:
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
6. Detect CSS rule conflicts and apply high-confidence overrides (NEW)
7. Generate deprecation warnings for legacy patterns

**Nested Variant Resolution:**

For nested/compound variants (e.g., `compact.dark`), the theme builder includes variables from parent variants:

1. **Detect Nested Variants**: Check if variant name contains `.` separator
2. **Gather Parent Variables**: For `compact.dark`, include variables from both `compact` and `dark` variants
3. **Build Resolution Context**: Create variant-specific variable map with proper cascade order:
   - Tailwind defaults (lowest priority)
   - Base theme variables (`@theme`, `:root`)
   - Parent variant variables (e.g., `compact`, `dark`)
   - Current variant variables (e.g., `compact.dark`) (highest priority)
4. **Resolve with Context**: Variable references like `var(--spacing-md)` resolve using the full cascade

This mirrors CSS's natural cascade behavior, ensuring that `[data-theme='compact'].dark` can reference variables defined in both `[data-theme='compact']` and `.dark` selectors.

### 4a. Theme Override System (`src/v4/parser/theme-overrides.ts`)

**Purpose** - Apply custom theme value overrides to fix unresolved variables or conflicts programmatically.

**Problem Context:**

Users may encounter CSS variables that reference external sources or have conflicts that need correction:

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

**Architecture - Hybrid Approach:**

The override system uses a two-phase approach for maximum flexibility:

1. **Pre-resolution** (Variable Injection)
   - Injects synthetic CSS variables before the variable resolution pipeline
   - Allows overrides to participate in `var()` resolution
   - Applied to selectors: `'default'`, `'base'`, `'*'` (wildcard)

2. **Post-resolution** (Theme Mutation)
   - Directly mutates resolved theme objects after building
   - Overrides final computed values
   - Applied to any selector (variant names, CSS selectors, wildcards)

**Syntax Support:**

Both flat notation and nested object notation are supported:

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
    },
    radius: {
      lg: '0.5rem'
    }
  }
}

// Mix and match
overrides: {
  'default': {
    'colors.primary.500': '#custom-blue',
    radius: { lg: '0.5rem' }
  }
}
```

**Selector Matching:**

The override system supports multiple selector patterns:

- **Direct variant names**: `'dark'`, `'compact'`, `'themeMono'`
- **CSS selectors**: `'[data-theme="dark"]'`, `'.dark'`
- **Special keys**:
  - `'default'` or `'base'` - Base/default theme only
  - `'*'` - All variants including default (wildcard)

**Detailed Override Values:**

Override values can be simple strings or objects with control flags:

```typescript
overrides: {
  'dark': {
    // Simple string value
    'colors.background': '#000000',

    // Detailed control
    'radius.lg': {
      value: '0',
      force: true,        // Apply even for low-confidence conflicts
      resolveVars: false  // Skip variable resolution (post-resolution only)
    }
  }
}
```

**Key Functions:**

```typescript
// Resolve variant/selector names to actual variant names
export function resolveVariantName(
  selectorOrVariant: string,
  variants: Record<string, ThemeVariant>,
): Array<string>;

// Post-resolution theme mutation
export function applyThemeOverrides(
  baseTheme: Theme,
  variants: Record<string, ThemeVariant>,
  overrides: OverrideOptions,
  debug = false,
): Array<string>; // Returns debug logs

// Pre-resolution variable injection
export function injectVariableOverrides(
  variables: Array<CSSVariable>,
  overrides: OverrideOptions,
  debug = false,
): Array<string>; // Returns debug logs
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

**Example Use Cases:**

1. **Injecting external variables:**

   ```typescript
   overrides: {
     'default': {
       'fonts.sans': 'var(--font-inter)' // Resolves in pipeline
     }
   }
   ```

2. **Fixing variant-specific values:**

   ```typescript
   overrides: {
     'dark': {
       'colors.background': '#000000'
     },
     '[data-theme="compact"]': {
       'radius.lg': '0'
     }
   }
   ```

3. **Global overrides:**
   ```typescript
   overrides: {
     '*': {
       'fonts.sans': 'Inter, sans-serif' // Applied to all variants
     }
   }
   ```

**Debug Mode:**

When `debug: true`, the override system logs detailed information:

```
[Overrides] Injected variable: --fonts-sans = Inter, sans-serif
[Overrides] Injected 1 variables for 'default'
[Overrides] Applied to 'dark': colors.background = #000000
[Overrides] Skipped (path not found) in 'default': nonexistent.property
[Overrides] Summary for 'dark': 1 applied, 0 skipped
```

**Complexity Management:**

All functions maintain cyclomatic complexity < 10 through helper extraction:

- `parseOverrideConfig()` - Parses flat/nested notation
- `applySingleOverride()` - Applies single override with path validation
- `applyOverridesToVariant()` - Handles single variant application
- `processSelectorOverrides()` - Processes single selector entry
- `processVariableInjection()` - Handles variable injection for one config

**Type Definitions:**

```typescript
export type OverrideValue =
  | string
  | {
      value: string;
      force?: boolean;
      resolveVars?: boolean;
    };

export type OverrideConfig =
  | Record<string, OverrideValue>
  | Record<
      string,
      Record<string, OverrideValue | Record<string, OverrideValue>>
    >;

export interface OverrideOptions {
  [selectorOrVariant: string]: OverrideConfig;
}
```

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
- `includeTailwindDefaults` parameter accepts:
  - `true` → All defaults included (equivalent to empty options object)
  - `false` → No defaults included
  - `TailwindDefaultsOptions` → Granular control per category

**Usage:**

```typescript
// Runtime API
const result = await resolveTheme({
  input: './styles.css',
  includeTailwindDefaults: {
    colors: true,
    spacing: true,
    shadows: false, // Exclude shadows
  },
});

// CLI
// bunx tailwind-resolver -i styles.css --include-defaults colors,spacing
// bunx tailwind-resolver -i styles.css --exclude-defaults shadows,animations

// Vite Plugin
tailwindResolver({
  input: 'src/styles.css',
  includeTailwindDefaults: {
    colors: true,
    spacing: true,
    shadows: false,
  },
});
```

**Variable Resolution Integration:**

- Default theme is converted back to CSS variables via `themeToVariables()`
- Combined with user variables for comprehensive `var()` resolution
- Enables references like `var(--color-blue-300)` to resolve to actual oklch values
- Self-referential variables (`--font-sans: var(--font-sans)`) are skipped to prefer defaults
- Selective merging allows excluding unused defaults to reduce bundle size

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

### CLI Tool (`src/v4/cli/index.ts`)

**One-shot generation:**

```bash
tailwind-resolver -i src/styles.css --debug
```

**Granular Defaults Control:**

The CLI supports granular control over which Tailwind default categories to include:

```bash
# Include only specific categories
tailwind-resolver -i styles.css --include-defaults colors,spacing,fonts

# Include all except specific categories
tailwind-resolver -i styles.css --exclude-defaults shadows,animations

# Mutual exclusivity enforced - cannot use both flags together
```

**Report Control:**

The CLI provides unified flags for controlling diagnostic report generation:

```bash
# Generate only specific reports
tailwind-resolver -i styles.css --reports conflicts

# Generate all except specific reports
tailwind-resolver -i styles.css --exclude-reports unresolved
```

**Implementation:**

- Generic `parseCategories<T>()` function for reusable category parsing
- Validates category names against known categories
- Enforces mutual exclusivity (cannot use both include and exclude)
- Converts comma-separated lists to options objects
- Applied consistently for both defaults and reports

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

### Type Generator (`src/v4/shared/type-generator.ts`)

**Output:**

1. **types.ts** - TypeScript type declarations (includes `DefaultTheme` and `Tailwind` interfaces)
2. **theme.ts** - Runtime objects (if `generateRuntime: true`)
3. **index.ts** - Clean re-exports (if `generateRuntime: true`)

**Generic Type Pattern:**
Uses TypeScript generics for type-safe theme access instead of module augmentation:

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
- Full IntelliSense for all variants (default, dark, custom themes)
- Type-safe access to selectors, files, and variables
- Works in any TypeScript project without tsconfig modifications
- Consistent structure between generated code and runtime API

**Configuration:**

- Centralized `THEME_PROPERTY_CONFIGS` for all 22 namespaces
- Shared escaping logic via `escapeStringLiteral()`
- Reduced from 516 to 460 lines (11% improvement)

### Dynamic Spacing Helper (`src/v4/shared/spacing-helper.ts`)

**Purpose** - Provide a callable helper function that replicates Tailwind's `calc(var(--spacing) * N)` behavior for runtime dynamic spacing calculations.

**Architecture:**

The spacing helper is implemented using `Object.assign` to create a hybrid callable object:

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
// Generated type for spacing helper
{
  base: '0.25rem';
  sm: '0.5rem';
  md: '1rem';
  // ... other named spacing values
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

The type generator only generates the spacing helper when spacing is defined in the theme:

```typescript
// In generateRuntimeFileInternal()
const hasDefaultSpacing =
  defaultTheme.spacing !== undefined &&
  Object.keys(defaultTheme.spacing).length > 0;

if (hasDefaultSpacing) {
  // Import spacing helper
  imports.push(
    "import { createSpacingHelper } from '@0xstern/tailwind-resolver/v4/shared/spacing-helper';",
  );

  // Apply to default theme and all variants
  defaultSpacingCode = `spacing: createSpacingHelper(${spacingObj}, ${fallback}),`;
}
```

**Fallback Behavior:**

- Variant themes use their local `--spacing` base if defined
- Falls back to default theme's `spacing.base` if variant doesn't define it
- If no spacing is defined in theme at all, helper is not generated

**Design Philosophy:**

- **Explicit over implicit**: No silent defaults - if no spacing exists, no helper is generated
- **Natural semantics**: Properties for static values, function calls for dynamic calculations
- **Performance-aware**: Uses `Object.assign` instead of Proxy for better performance
- **Type-safe**: Full TypeScript support with intersection types

**Use Cases:**

Supports Tailwind v4 utilities that use spacing calculations:

- Spacing: `m-<number>`, `p-<number>`, `gap-<number>`
- Sizing: `w-<number>`, `h-<number>`, `min-w-<number>`, `max-w-<number>`, `min-h-<number>`, `max-h-<number>`
- Layout: `inset-<number>`, `-inset-<number>`
- Typography: `indent-<number>`, `-indent-<number>`
- Tables: `border-spacing-<number>`
- Scrolling: `scroll-m-<number>`, `-scroll-m-<number>`, `scroll-p-<number>`

## Data Flow Example

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
    dark: {
      colors: { background: "#1f2937" },
      radius: { lg: "0" }  // Overridden by CSS rule
      // ... only properties that differ from default
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

The parser internally uses `ParseResult` format with separate `theme` and `variants` properties:

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

This is converted to `TailwindResult` format by `resolveTheme()` for the public API, where:

- `theme` becomes `variants.default`
- `variants[name].theme` becomes `variants[name]`
- `variants[name].selector` becomes `selectors[name]`

The type generator functions accept both formats for backward compatibility.

## Performance Characteristics

### Time Complexity

| Operation           | Complexity | Notes                                  |
| ------------------- | ---------- | -------------------------------------- |
| CSS Parsing         | O(n)       | n = file size, PostCSS linear scan     |
| Import Resolution   | O(d × n)   | d = import depth, n = avg file size    |
| Variable Resolution | O(v)       | v = number of CSS variables            |
| Theme Building      | O(v)       | Single pass with constant-time lookups |
| Type Generation     | O(p)       | p = number of theme properties         |

### Optimizations Applied

1. **Single-pass traversal** - Variable resolver walks AST once
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
const result = await resolveTheme({
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

That's it! The pipeline will automatically handle resolution, building, and type generation.

## Testing Strategy

### Unit Tests

- Each module tested in isolation
- Mock file system for import tests
- Snapshot tests for type generation

### Integration Tests

- 9-file deep import chain test
- Real Tailwind theme parsing
- Circular import detection
- Variant resolution and selector mapping
- CSS variable resolution with var() references

### Test Coverage

- 703 passing tests (100% pass rate)
- 1968 expect() calls
- All core paths covered
- Updated to use new `TailwindResult` API structure
- Tests verify both runtime API and generated code consistency
- Comprehensive coverage of nested variant combinations and variable resolution
- CSS rule extraction and conflict detection test coverage
- Unresolved variable detection test coverage:
  - 21 unit tests for detection logic (unresolved-detector.test.ts)
  - 7 unit tests for report generation (unresolved-reporter.test.ts)
  - 4 integration tests for full pipeline (unresolved-detection-pipeline.test.ts)
- Theme override system test coverage:
  - 43 unit tests for override logic (theme-overrides.test.ts)
  - 11 integration tests for full override pipeline (override-system.test.ts)
- Initial keyword filtering test coverage:
  - 37 unit tests for filtering logic (initial-filter.test.ts)
  - 30 integration tests for end-to-end functionality (initial-keyword.test.ts)
    - Includes 6 CSS cascade order tests ensuring proper sequential processing
    - Verifies both Case 1 (value before initial → removed) and Case 2 (initial before value → preserved)
    - Tests complex cascade scenarios with multiple values and wildcard patterns
    - Validates integration with Tailwind defaults and namespace-wide exclusions

## Related Documentation

- [README.md](./README.md) - User-facing documentation and API reference
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development setup and guidelines
- [CLAUDE.md](./CLAUDE.md) - Code standards and conventions
- [CHANGELOG.md](./CHANGELOG.md) - Version history and breaking changes
