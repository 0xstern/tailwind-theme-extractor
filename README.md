# Tailwind Theme Resolver

**TypeScript type generation and runtime resolution for Tailwind CSS v4 theme variables.**

Transform your Tailwind v4 CSS variables into fully-typed TypeScript interfaces and runtime objects with automatic conflict detection, intelligent nesting, and comprehensive diagnostics.

<p>
    <a href="https://github.com/0xstern/tailwind-resolver/actions"><img src="https://img.shields.io/github/actions/workflow/status/0xstern/tailwind-resolver/ci.yml?branch=main" alt="Build Status"></a>
    <a href="https://github.com/0xstern/tailwind-resolver/releases"><img src="https://img.shields.io/npm/v/tailwind-resolver.svg" alt="Latest Release"></a>
    <a href="https://github.com/0xstern/tailwind-resolver/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/tailwind-resolver.svg" alt="License"></a>
    <a href="https://twitter.com/mrstern_"><img alt="X (formerly Twitter) Follow" src="https://img.shields.io/twitter/follow/mrstern_.svg?style=social"></a>
</p>

## Table of Contents

- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Installation](#installation)
- [Usage](#usage)
  - [Vite Plugin](#vite-plugin-%28build-time-generation%29)
  - [Runtime API](#runtime-api-%28dynamic-resolution%29)
  - [CLI](#cli)
- [Configuration](#configuration)
  - [Tailwind Defaults](#tailwind-defaults)
  - [Nesting Configuration](#nesting-configuration)
  - [Theme Overrides](#theme-overrides)
  - [Report Generation](#report-generation)
- [Advanced Features](#advanced-features)
  - [CSS Conflict Detection](#css-conflict-detection)
  - [Unresolved Variable Detection](#unresolved-variable-detection)
  - [Dynamic Spacing Helper](#dynamic-spacing-helper)
  - [Type Safety](#type-safety)
- [Examples](#examples)
- [Debugging](#debugging)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

**1. Install:**

```bash
npm install -D tailwind-resolver
```

**2. Configure Vite plugin:**

```typescript
// vite.config.ts

import tailwindcss from '@tailwindcss/vite';
import { tailwindResolver } from 'tailwind-resolver/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    tailwindResolver({
      input: 'src/styles.css', // Your Tailwind CSS file
    }),
  ],
});
```

**3. Use the generated theme:**

```typescript
import { tailwind } from './generated/tailwindcss';

// Fully typed with autocomplete
const primaryColor = tailwind.variants.default.colors.primary[500];
const darkBackground = tailwind.variants.dark.colors.background;
```

That's it! The plugin automatically generates TypeScript types and runtime objects from your Tailwind CSS variables.

## Core Concepts

### What It Does

Tailwind Theme Resolver parses your Tailwind CSS v4 files and generates:

- **TypeScript Types** - Full type safety with autocomplete for all theme properties
- **Runtime Objects** - JavaScript objects mirroring your CSS variables for use in Canvas, Chart.js, etc.
- **Diagnostic Reports** - Automatic detection of CSS conflicts and unresolved variables
- **Theme Variants** - Support for dark mode, custom themes, and CSS selector-based variants

### Theme Structure

All Tailwind CSS v4 namespaces are supported:

```typescript
{
  colors: {},           // --color-*
  spacing: {},          // --spacing-* (with dynamic calc helper)
  fonts: {},            // --font-*
  fontSize: {},         // --text-*
  fontWeight: {},       // --font-weight-*
  tracking: {},         // --tracking-*
  leading: {},          // --leading-*
  breakpoints: {},      // --breakpoint-*
  containers: {},       // --container-*
  radius: {},           // --radius-*
  shadows: {},          // --shadow-*
  insetShadows: {},     // --inset-shadow-*
  dropShadows: {},      // --drop-shadow-*
  textShadows: {},      // --text-shadow-*
  blur: {},             // --blur-*
  perspective: {},      // --perspective-*
  aspect: {},           // --aspect-*
  ease: {},             // --ease-*
  animations: {},       // --animate-*
  defaults: {},         // --default-*
  keyframes: {}         // @keyframes
}
```

### Generated Files

With default configuration, the plugin generates:

```
src/generated/tailwindcss/
├── types.ts           # TypeScript interfaces
├── theme.ts           # Runtime theme objects
├── index.ts           # Convenient re-exports
├── conflicts.md       # CSS conflict report (if conflicts detected)
├── conflicts.json     # Machine-readable conflict data
├── unresolved.md      # Unresolved variable report (if any detected)
└── unresolved.json    # Machine-readable unresolved data
```

## Installation

```bash
# Bun
bun add -D tailwind-resolver

# pnpm
pnpm add -D tailwind-resolver

# Yarn
yarn add -D tailwind-resolver

# npm
npm install -D tailwind-resolver
```

## Usage

### Vite Plugin (Build-Time Generation)

Recommended for most projects. Generates types once during build, with hot-reload during development.

**Basic Configuration:**

```typescript
import tailwindcss from '@tailwindcss/vite';
import { tailwindResolver } from 'tailwind-resolver/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    tailwindResolver({
      input: 'src/styles.css',
    }),
  ],
});
```

**Full Configuration:**

```typescript
tailwindResolver({
  // Required: Path to CSS file (relative to Vite project root)
  input: 'src/styles.css',

  // Optional: Output directory (default: auto-detected)
  outputDir: 'src/generated/tailwindcss',

  // Optional: Resolve @import statements (default: true)
  resolveImports: true,

  // Optional: Runtime generation control (default: true)
  generateRuntime: {
    variants: true, // Include theme variants
    selectors: true, // Include CSS selectors
    files: false, // Exclude file list (production)
    variables: false, // Exclude raw variables (production)
    reports: {
      conflicts: true, // Generate conflict reports
      unresolved: true, // Generate unresolved variable reports
    },
  },

  // Optional: Control Tailwind defaults (default: true)
  includeDefaults: true,

  // Optional: Nesting configuration
  nesting: {
    colors: { maxDepth: 2 },
    default: { maxDepth: 3 },
  },

  // Optional: Theme overrides
  overrides: {
    '*': { 'fonts.sans': 'Inter, sans-serif' },
    dark: { 'colors.background': '#000000' },
  },

  // Optional: Debug logging (default: false)
  debug: false,
});
```

**Usage in Code:**

```typescript
import { dark, defaultTheme, tailwind } from './generated/tailwindcss';

// Use the master tailwind object
const primary = tailwind.variants.default.colors.primary[500];
const darkBg = tailwind.variants.dark.colors.background;

// Or use individual variant exports
const primary2 = defaultTheme.colors.primary[500];
const darkBg2 = dark.colors.background;
```

### Runtime API (Dynamic Resolution)

For dynamic scenarios like CLI tools, server-side rendering, or runtime theme switching.

**Type-Safe Usage (Recommended):**

```typescript
import type { Tailwind } from './generated/tailwindcss';

import { resolveTheme } from 'tailwind-resolver';

const result = await resolveTheme<Tailwind>({
  input: './src/styles.css',
});

// Fully typed with autocomplete
result.variants.default.colors.primary[500];
result.variants.dark.colors.background;
result.selectors.dark; // '[data-theme="dark"]'
```

**Note:** Generate types using the [Vite plugin](#vite-plugin-build-time-generation) or [CLI](#cli) before using the runtime API for type safety.

**Basic Usage:**

```typescript
import { resolveTheme } from 'tailwind-resolver';

const result = await resolveTheme({
  input: './src/styles.css',
});

console.log(result.variants.default.colors.primary[500]);
console.log(result.variants.dark.colors.background);
```

**Full Configuration:**

```typescript
const result = await resolveTheme({
  // Option 1: CSS file path
  input: './src/styles.css',

  // Option 2: Raw CSS content
  // css: '@theme { --color-primary: blue; }',

  // Optional: Base path for @import resolution
  basePath: process.cwd(),

  // Optional: Resolve @import statements (default: true)
  resolveImports: true,

  // Optional: Control Tailwind defaults (default: true)
  includeDefaults: true,

  // Optional: Nesting configuration
  nesting: {
    colors: { maxDepth: 2 },
    default: { maxDepth: 3 },
  },

  // Optional: Theme overrides
  overrides: {
    default: { 'fonts.sans': 'Inter' },
  },

  // Optional: Debug logging (default: false)
  debug: false,
});
```

### CLI

Generate types without a build tool:

**Basic Usage:**

```bash
bunx tailwind-resolver -i src/styles.css
```

**Common Options:**

```bash
# Specify output directory
bunx tailwind-resolver -i src/styles.css -o src/generated

# Types only (no runtime objects)
bunx tailwind-resolver -i src/styles.css --no-runtime

# Include only specific Tailwind defaults
bunx tailwind-resolver -i src/styles.css --include-defaults colors,spacing

# Exclude specific Tailwind defaults
bunx tailwind-resolver -i src/styles.css --exclude-defaults shadows,animations

# Generate only conflict reports
bunx tailwind-resolver -i src/styles.css --reports conflicts

# Debug mode
bunx tailwind-resolver -i src/styles.css --debug
```

**All Options:**

```
  -i, --input <path>              CSS input file (required)
  -o, --output <path>             Output directory (default: auto-detected)
  -r, --runtime                   Generate runtime objects (default: true)
  --no-runtime                    Types only
  --include-defaults [categories] Include only specified Tailwind defaults (comma-separated)
  --exclude-defaults [categories] Exclude specified Tailwind defaults (comma-separated)
  --reports [categories]          Generate only specified reports (conflicts, unresolved)
  --exclude-reports [categories]  Exclude specified reports (comma-separated)
  -d, --debug                     Enable debug mode
  -h, --help                      Show help
```

## Configuration

### Tailwind Defaults

Control which Tailwind CSS default theme values are included.

**Include All Defaults (Default):**

```typescript
includeDefaults: true;
```

**Exclude All Defaults:**

```typescript
includeDefaults: false;
```

**Selective Inclusion:**

```typescript
includeDefaults: {
  colors: true,       // Include default colors
  spacing: true,      // Include default spacing
  fonts: true,        // Include default fonts
  fontSize: true,     // Include default font sizes
  fontWeight: true,   // Include default font weights
  tracking: false,    // Exclude tracking
  leading: false,     // Exclude leading
  shadows: false,     // Exclude shadows
  animations: false,  // Exclude animations
  // ... 21 categories total
}
```

**Disable Specific Defaults via CSS:**

Use `initial` keyword in `@theme` blocks ([Tailwind v4 docs](https://tailwindcss.com/docs/colors#disabling-default-colors)):

```css
@theme {
  /* Remove specific values */
  --color-lime-*: initial;
  --spacing-4: initial;

  /* Remove entire categories */
  --color-*: initial;
  --spacing-*: initial;

  /* Custom values are preserved */
  --color-primary-500: #3b82f6;
}
```

**Combining Approaches:**

```typescript
// Configuration: Include colors and spacing
includeDefaults: {
  colors: true,
  spacing: true,
  shadows: false,
}

// CSS: Remove specific colors
@theme {
  --color-lime-*: initial;    // Excludes lime from included colors
  --color-fuchsia-*: initial; // Excludes fuchsia from included colors
}

// Result: All default colors EXCEPT lime and fuchsia
```

**Priority:** CSS `initial` declarations take precedence over `includeDefaults` configuration.

### Nesting Configuration

Control how CSS variable names are parsed into nested theme structures.

**Default Behavior:**

Without configuration, all dashes create nesting levels:

```css
--color-tooltip-outline-50: #fff;
/* → colors.tooltip.outline[50] */
```

**Limit Nesting Depth:**

```typescript
nesting: {
  colors: { maxDepth: 2 },
  // --color-brand-primary-hover-500
  // → colors.brand.primaryHover500 (2 levels, rest flattened to camelCase)
}
```

**Flatten Mode:**

Control how parts beyond `maxDepth` are flattened:

```typescript
nesting: {
  colors: {
    maxDepth: 2,
    flattenMode: 'camelcase', // Default: blueSkyLight50
    // flattenMode: 'literal',  // Alternative: 'blue-sky-light-50'
  }
}
```

**Consecutive Dashes Handling:**

```typescript
nesting: {
  colors: {
    consecutiveDashes: 'exclude',   // Default: skip variables with --
    // consecutiveDashes: 'nest',     // Treat -- as single -
    // consecutiveDashes: 'camelcase',// Convert to camelCase
    // consecutiveDashes: 'literal',  // Preserve dash
  }
}
```

**Per-Namespace Configuration:**

```typescript
nesting: {
  default: { maxDepth: 1 },         // Apply to all namespaces
  colors: { maxDepth: 3 },          // Override for colors
  shadows: { maxDepth: 2 },         // Override for shadows
  radius: { maxDepth: 0 },          // Completely flat
}
```

**Complete Example:**

```typescript
nesting: {
  colors: {
    maxDepth: 2,
    flattenMode: 'literal',
    consecutiveDashes: 'camelcase',
  }
}

// CSS: --color-tooltip--outline-hover-50
// Step 1: tooltipOutline (consecutive dashes → camelCase)
// Step 2: maxDepth: 2 → colors.tooltipOutline.hover['50']
```

See [Nesting Configuration Details](#nesting-configuration-details) for comprehensive documentation.

### Theme Overrides

Apply programmatic overrides to theme values without modifying CSS files.

**Use Cases:**

- Inject external variables (Next.js fonts, plugin variables)
- Fix variant-specific values
- Global customization across all variants
- Quick prototyping

**Flat Notation:**

```typescript
overrides: {
  default: {
    'colors.primary.500': '#custom-blue',
    'radius.lg': '0.5rem',
  },
  dark: {
    'colors.background': '#000000',
  },
  '*': { // Wildcard - applies to all variants
    'fonts.sans': 'Inter, sans-serif',
  }
}
```

**Nested Notation:**

```typescript
overrides: {
  default: {
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
```

**Detailed Control:**

```typescript
overrides: {
  dark: {
    'radius.lg': {
      value: '0',
      force: true,        // Apply even for low-confidence conflicts
      resolveVars: false  // Skip variable resolution
    }
  }
}
```

**Selector Matching:**

```typescript
overrides: {
  'dark': {},                        // Variant name (preferred)
  '[data-theme="dark"]': {},         // CSS selector (verbose)
  'default': {},                     // Default theme
  'base': {},                        // Alias for 'default'
  '*': {},                           // All variants
  'themeInter': {},                  // .theme-inter → themeInter (camelCase)
}
```

**Note:** Multi-word variant names are automatically converted to camelCase:

- CSS: `.theme-noto-sans` → Override key: `'themeNotoSans'`

See [Theme Overrides Details](#theme-overrides-details) for comprehensive documentation.

### Report Generation

Control diagnostic report generation.

**Enable All Reports (Default):**

```typescript
generateRuntime: {
  reports: true,
}
```

**Disable All Reports:**

```typescript
generateRuntime: {
  reports: false,
}
```

**Granular Control:**

```typescript
generateRuntime: {
  reports: {
    conflicts: true,    // CSS conflict reports
    unresolved: false,  // Unresolved variable reports
  }
}
```

**CLI:**

```bash
# Disable all reports
bunx tailwind-resolver -i src/styles.css --no-reports

# Generate only conflict reports
bunx tailwind-resolver -i src/styles.css --reports conflicts

# Exclude unresolved variable reports
bunx tailwind-resolver -i src/styles.css --exclude-reports unresolved
```

## Advanced Features

### CSS Conflict Detection

Automatically detects when CSS rules override CSS variables and ensures runtime theme matches actual rendered styles.

**Problem:**

```css
.theme-mono {
  --radius-lg: 0.45em; /* CSS variable */

  .rounded-lg {
    border-radius: 0; /* CSS rule - overrides the variable! */
  }
}
```

**Solution:**

The resolver:

1. Detects all conflicts between CSS rules and variables
2. Applies high-confidence overrides automatically
3. Reports complex cases for manual review

**Confidence Levels:**

- **High** (auto-applied): Static values, simple selectors
- **Medium/Low** (manual review): Dynamic values, pseudo-classes, media queries, complex selectors

**Generated Reports:**

```
src/generated/tailwindcss/
├── conflicts.md    # Human-readable report with recommendations
└── conflicts.json  # Machine-readable for CI/CD
```

**Terminal Output:**

```
✓ Theme types generated successfully

Generated files:
  - src/generated/tailwindcss/types.ts
  - src/generated/tailwindcss/theme.ts
  - src/generated/tailwindcss/index.ts

⚠  12 CSS conflicts detected (see src/generated/tailwindcss/conflicts.md)
```

### Unresolved Variable Detection

Detects CSS variables with `var()` references that couldn't be resolved.

**Problem:**

```css
@theme {
  --font-sans: var(--font-inter); /* Injected by Next.js */
  --color-accent: var(--tw-primary); /* Tailwind plugin variable */
}
```

**Solution:**

The resolver categorizes unresolved variables:

- **Unknown** - May need definition or verification
- **External** - From plugins, frameworks, or external stylesheets
- **Self-referential** - Intentionally left unresolved

**Generated Reports:**

```
src/generated/tailwindcss/
├── unresolved.md    # Human-readable with actionable recommendations
└── unresolved.json  # Machine-readable for CI/CD
```

**Terminal Output:**

```
ℹ  8 unresolved variables detected (see src/generated/tailwindcss/unresolved.md)
```

### Dynamic Spacing Helper

The `spacing` property is both an object AND a callable function for dynamic calculations.

**Static Values:**

```typescript
defaultTheme.spacing.xs; // '0.75rem'
defaultTheme.spacing.base; // '0.25rem'
```

**Dynamic Calculations:**

```typescript
defaultTheme.spacing(4); // 'calc(0.25rem * 4)' → 1rem
defaultTheme.spacing(16); // 'calc(0.25rem * 16)' → 4rem
defaultTheme.spacing(-2); // 'calc(0.25rem * -2)' → -0.5rem
```

**Usage:**

```typescript
<div style={{
  padding: defaultTheme.spacing(4),   // Same as Tailwind's p-4
  margin: defaultTheme.spacing(-2),   // Same as Tailwind's -m-2
  width: defaultTheme.spacing(64),    // Same as Tailwind's w-64
}} />
```

**Why:** Tailwind generates utilities like `p-4`, `m-8`, `w-16` using `calc(var(--spacing) * N)`. This helper replicates that behavior for runtime use.

**Tailwind Utilities Using Spacing:**

- Layout: `inset-<n>`, `m-<n>`, `p-<n>`, `gap-<n>`
- Sizing: `w-<n>`, `h-<n>`, `min-w-<n>`, `max-w-<n>`
- Typography: `indent-<n>`, `border-spacing-<n>`, `scroll-m-<n>`

**Note:** Requires `--spacing-base` in your CSS theme.

### Type Safety

Full TypeScript type safety with the generated `Tailwind` interface.

**Generated Constant:**

```typescript
import { tailwind } from './generated/tailwindcss';

// Fully typed with autocomplete
tailwind.variants.default.colors.primary[500]; // ✓
tailwind.variants.dark.colors.background; // ✓
tailwind.selectors.dark; // ✓
```

**Runtime API:**

```typescript
import type { Tailwind } from './generated/tailwindcss';

import { resolveTheme } from 'tailwind-resolver';

const result = await resolveTheme<Tailwind>({
  input: './theme.css',
});

// Same structure, same types
result.variants.default.colors.primary[500]; // ✓
result.variants.dark.colors.background; // ✓
result.selectors.dark; // ✓
```

**Autocomplete:** Works automatically when output directory is in `tsconfig.json` includes.

## Examples

### Chart.js

```typescript
import { tailwind } from './generated/tailwindcss';

new Chart(ctx, {
  data: {
    datasets: [
      {
        backgroundColor: [
          tailwind.variants.default.colors.primary[500],
          tailwind.variants.dark.colors.secondary[500],
        ],
      },
    ],
  },
});
```

### Canvas

```typescript
import { defaultTheme } from './generated/tailwindcss';

ctx.fillStyle = defaultTheme.colors.background;
ctx.font = `${defaultTheme.fontSize.xl.size} ${defaultTheme.fonts.display}`;
```

### Dynamic Theme Switching

```typescript
import { tailwind } from './generated/tailwindcss';

const currentTheme = isDark
  ? tailwind.variants.dark
  : tailwind.variants.default;

chartInstance.data.datasets[0].backgroundColor =
  currentTheme.colors.primary[500];
chartInstance.update();
```

### Theme Variants

```css
@theme {
  --color-background: #ffffff;
}

[data-theme='dark'] {
  --color-background: #1f2937;
}
```

```typescript
import { dark, defaultTheme, selectors } from './generated/tailwindcss';

console.log(defaultTheme.colors.background); // '#ffffff'
console.log(dark.colors.background); // '#1f2937'
console.log(selectors.dark); // "[data-theme='dark']"
```

## Debugging

Enable debug mode to see detailed logging.

**Vite:**

```typescript
tailwindResolver({ input: 'src/styles.css', debug: true });
```

**CLI:**

```bash
bunx tailwind-resolver -i src/styles.css --debug
```

**Runtime API:**

```typescript
resolveTheme({ input: './theme.css', debug: true });
```

**Output:**

```
[Tailwind Theme Resolver] Failed to resolve import: ./components/theme.css
  Resolved path: /Users/you/project/src/components/theme.css
  Error: ENOENT: no such file or directory

[Overrides] Injected variable: --radius-lg = 0.5rem
[Overrides] Applied to 'default': radius.lg = 0.5rem
```

## Requirements

- **Node.js** >= 18 or **Bun** >= 1.0
- **TypeScript** >= 5.0 (for type generation)
- **Vite** >= 5.0 (for Vite plugin only)

## Contributing

Issues and pull requests welcome on [GitHub](https://github.com/0xstern/tailwind-resolver).

## License

MIT

---

## Appendix

### Nesting Configuration Details

Complete documentation for nesting configuration options.

#### Default Behavior

Without configuration, every dash creates a nesting level:

```css
@theme {
  --color-tooltip-outline-50: #fff;
  /* → colors.tooltip.outline[50] */

  --shadow-elevation-high-focus: 0 0 0;
  /* → shadows.elevation.high.focus */
}
```

#### maxDepth

Limit nesting levels. After the limit, remaining parts are flattened.

**Configuration:**

```typescript
nesting: {
  colors: {
    maxDepth: 2;
  }
}
```

**Results:**

```css
--color-tooltip-outline-50: #fff;
/* Before: colors.tooltip.outline[50] */
/* After:  colors.tooltip.outline['50'] (no change - only 3 parts) */

--color-brand-primary-hover-500: #3b82f6;
/* Before: colors.brand.primary.hover[500] */
/* After:  colors.brand.primaryHover500 (2 levels, rest flattened) */
```

**Special Case - maxDepth: 0:**

```typescript
nesting: { default: { maxDepth: 0 } }

// --color-brand-primary-dark: #000
// → colors.brandPrimaryDark (completely flat)
```

#### consecutiveDashes

Control how consecutive dashes (`--`) are processed:

**Options:**

- `'exclude'` (default, matches Tailwind v4) - Skip variables with `--`
- `'nest'` - Treat `--` as single `-`
- `'camelcase'` - Convert `--` to camelCase boundary
- `'literal'` - Preserve `--` in keys

**Configuration:**

```typescript
nesting: {
  colors: {
    consecutiveDashes: 'camelcase';
  }
}
```

**Results:**

```css
--color-button--primary: #fff;

/* 'exclude' (default): Not included */
/* 'nest': colors.button.primary */
/* 'camelcase': colors.buttonPrimary */
/* 'literal': colors['button-'].primary */
```

#### flattenMode

Control how parts beyond `maxDepth` are flattened:

**Options:**

- `'camelcase'` (default) - Flatten to camelCase
- `'literal'` - Flatten to kebab-case string key

**Configuration:**

```typescript
nesting: {
  colors: {
    maxDepth: 2,
    flattenMode: 'literal'
  }
}
```

**Results:**

```css
--color-blue-sky-light-50: #e0f2fe;

/* flattenMode: 'camelcase' (default) */
/* → colors.blue.skyLight50 */

/* flattenMode: 'literal' */
/* → colors.blue['sky-light-50'] */
```

**Note:** Only applies when `maxDepth` is reached.

#### Combining Options

```typescript
nesting: {
  colors: {
    maxDepth: 2,
    consecutiveDashes: 'camelcase',
    flattenMode: 'literal',
  }
}
```

```css
--color-tooltip--outline-hover-50: #fff;
/* Step 1: tooltipOutline (consecutive dashes → camelCase) */
/* Step 2: maxDepth: 2 → colors.tooltipOutline.hover['50'] */
```

#### Per-Namespace Configuration

```typescript
nesting: {
  colors: { maxDepth: 3 },      // Deep nesting
  shadows: { maxDepth: 2 },     // Moderate nesting
  spacing: { maxDepth: 1 },     // Flat structure
  radius: { consecutiveDashes: 'camelcase' },
}
```

#### Global Default

```typescript
nesting: {
  default: { maxDepth: 1 },     // Apply to all namespaces
  colors: { maxDepth: 3 },      // Override for colors
}
```

#### DEFAULT Key for Conflicts

When both scalar and nested variables exist at the same path, the scalar moves to `DEFAULT`:

```css
@theme {
  --color-card: blue;
  --color-card-foreground: white;
}
```

```typescript
// Result:
{
  colors: {
    card: {
      DEFAULT: 'blue',
      foreground: 'white'
    }
  }
}
```

**Works in Any Order:**

```css
/* Nested first, then scalar */
--color-card-foreground: white;
--color-card: blue;
/* Same result: { card: { DEFAULT: 'blue', foreground: 'white' } } */
```

**With Color Scales:**

```css
--color-blue-500: #3b82f6;
--color-blue-600: #2563eb;
--color-blue: #1d4ed8;
```

```typescript
// Result:
{
  blue: {
    DEFAULT: '#1d4ed8',
    500: '#3b82f6',
    600: '#2563eb'
  }
}
```

#### Use Cases

**1. Consistent Flat Structure:**

```typescript
nesting: { default: { maxDepth: 0 } }

// All variables flattened:
// --color-brand-primary-500 → colors.brandPrimary500
```

**2. BEM-Style Naming:**

```typescript
nesting: {
  default: {
    maxDepth: 1,
    consecutiveDashes: 'camelcase'
  }
}

// --color-button--primary → colors.buttonPrimary
// --color-input--error → colors.inputError
```

**3. Controlled Depth by Category:**

```typescript
nesting: {
  colors: { maxDepth: 3 },      // Deep color scales
  shadows: { maxDepth: 2 },     // Moderate shadow variants
  radius: { maxDepth: 1 },      // Flat radius values
}
```

#### CLI Flags

```bash
# Limit nesting depth globally
bunx tailwind-resolver -i src/styles.css --nesting-max-depth 2

# Control consecutive dashes
bunx tailwind-resolver -i src/styles.css --nesting-consecutive-dashes camelcase

# Control flatten mode
bunx tailwind-resolver -i src/styles.css --nesting-flatten-mode literal

# Combine options
bunx tailwind-resolver -i src/styles.css \
  --nesting-max-depth 2 \
  --nesting-consecutive-dashes nest \
  --nesting-flatten-mode literal
```

**Note:** CLI flags apply globally to all namespaces. For per-namespace control, use Vite plugin or Runtime API.

### Theme Overrides Details

Complete documentation for theme overrides.

#### When to Use Overrides

- **Inject external variables** - Provide values for Next.js fonts, Tailwind plugins, or external sources
- **Fix variant-specific values** - Override dark mode or custom theme properties
- **Global customization** - Apply consistent values across all variants
- **Quick prototyping** - Test theme changes without editing CSS

#### Syntax Options

**Flat Notation (Dot-Separated Paths):**

```typescript
overrides: {
  default: {
    'colors.primary.500': '#custom-blue',
    'radius.lg': '0.5rem',
    'fonts.sans': 'Inter, sans-serif'
  }
}
```

**Nested Notation:**

```typescript
overrides: {
  default: {
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
```

**Mix and Match:**

```typescript
overrides: {
  default: {
    'colors.primary.500': '#custom-blue',
    radius: { lg: '0.5rem' }
  }
}
```

#### Selector Matching

**Variant Names (Recommended):**

```typescript
overrides: {
  'dark': { 'colors.background': '#000' },
  'themeInter': { 'fonts.sans': 'Inter' },  // .theme-inter → themeInter
}
```

**CSS Selectors (Verbose):**

```typescript
overrides: {
  '[data-theme="dark"]': { 'colors.background': '#000' },
}
```

**Special Keys:**

```typescript
overrides: {
  'default': {},  // Default theme
  'base': {},     // Alias for 'default'
  '*': {},        // All variants (wildcard)
}
```

**Important:** Variant names are automatically converted from kebab-case to camelCase:

- CSS: `.theme-inter` → Override key: `'themeInter'`
- CSS: `.theme-noto-sans` → Override key: `'themeNotoSans'`

#### Detailed Control

```typescript
overrides: {
  dark: {
    'radius.lg': {
      value: '0',
      force: true,        // Apply even for low-confidence conflicts
      resolveVars: false  // Skip variable resolution (post-resolution only)
    }
  }
}
```

#### Common Use Cases

**1. Injecting External Variables:**

```typescript
overrides: {
  default: {
    'fonts.sans': 'var(--font-inter)',      // Next.js font
    'colors.primary': 'var(--tw-primary)'   // Tailwind plugin
  }
}
```

**2. Variant-Specific Overrides:**

```typescript
overrides: {
  dark: {
    'colors.background': '#000000',
    'colors.foreground': '#ffffff'
  },
  compact: {
    'radius.lg': '0',
    'spacing.base': '0.125rem'
  }
}
```

**3. Global Overrides:**

```typescript
overrides: {
  '*': {
    'fonts.sans': 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    'fonts.mono': 'JetBrains Mono, Consolas, monospace'
  }
}
```

**4. Prototyping:**

```typescript
overrides: {
  default: {
    'colors.primary.500': '#ff6b6b',
    'radius.lg': '1rem'
  }
}
```

#### How It Works

Two-phase approach:

1. **Pre-resolution** (Variable Injection)
   - Injects synthetic CSS variables before resolution
   - Allows overrides to participate in `var()` resolution
   - Applied to: `'default'`, `'base'`, `'*'` selectors

2. **Post-resolution** (Theme Mutation)
   - Directly mutates resolved theme objects
   - Overrides final computed values
   - Applied to: all selector types

#### Debug Mode

```typescript
tailwindResolver({
  input: 'src/styles.css',
  debug: true,
  overrides: {
    default: { 'radius.lg': '0.5rem' },
  },
});
```

**Output:**

```
[Overrides] Injected variable: --radius-lg = 0.5rem
[Overrides] Injected 1 variables for 'default'
[Overrides] Applied to 'default': radius.lg = 0.5rem
[Overrides] Summary for 'default': 1 applied, 0 skipped
```

---

## TypeScript Configuration

Ensure the output directory is included in `tsconfig.json`:

```json
{
  "include": ["src/**/*"],
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

---

If you find this helpful, follow me on X [@mrstern\_](https://x.com/mrstern_)
