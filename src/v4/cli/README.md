# CLI - Tailwind Theme Resolver

**Command-line TypeScript type generation and runtime theme objects for Tailwind CSS v4**

Generate TypeScript types and runtime theme objects from Tailwind CSS v4 theme files using the command line. Perfect for build scripts, CI/CD pipelines, and non-Vite projects.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Command Line Options](#command-line-options)
- [Features](#features)
  - [Automatic Import Resolution](#automatic-import-resolution)
  - [Tailwind CSS Defaults](#tailwind-css-defaults)
  - [Nesting Configuration](#nesting-configuration)
  - [CSS Conflict Detection](#css-conflict-detection)
  - [Report Generation](#report-generation)
- [Theme Overrides](#theme-overrides)
- [Usage Examples](#usage-examples)
- [Generated Files](#generated-files)
- [TypeScript Configuration](#typescript-configuration)
- [Git Configuration](#git-configuration)
- [Package.json Scripts](#packagejson-scripts)
- [Troubleshooting](#troubleshooting)
- [Performance](#performance)
- [Requirements](#requirements)

## Quick Start

```bash
# Generate types and runtime objects
bunx tailwind-resolver -i src/styles.css

# Types only (no runtime objects)
bunx tailwind-resolver -i src/styles.css --no-runtime

# Debug mode
bunx tailwind-resolver -i src/styles.css --debug
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

## Command Line Options

### Required Options

- `-i, --input <path>` - Path to CSS input file (required)

### Optional Options

- `-o, --output <path>` - Output directory for generated files (default: auto-detected)
- `-r, --runtime` - Generate runtime objects (default: true)
- `--no-runtime` - Generate types only, no runtime file
- `--include-defaults [categories]` - Include only specified Tailwind default categories (comma-separated)
- `--exclude-defaults [categories]` - Include all except specified Tailwind default categories (comma-separated)
- `--reports [categories]` - Generate only specified diagnostic reports (comma-separated: conflicts, unresolved)
- `--exclude-reports [categories]` - Generate all except specified diagnostic reports (comma-separated)
- `--nesting-max-depth <number>` - Limit nesting depth for all namespaces
- `--nesting-consecutive-dashes <mode>` - Control consecutive dashes handling: 'exclude' (default), 'nest', 'camelcase', or 'literal'
- `--nesting-flatten-mode <mode>` - Control how parts after maxDepth are flattened: 'camelcase' (default) or 'literal'
- `-d, --debug` - Enable debug mode (logging + include debug data in runtime)
- `-h, --help` - Display help message

### Output Directory Auto-Detection

If no output directory is specified, the CLI automatically detects the best location:

- **With `src/` folder**: `src/generated/tailwindcss/`
- **Without `src/` folder**: `generated/tailwindcss/`

**Override with custom path:**

```bash
bunx tailwind-resolver -i styles.css -o custom/output/path
```

## Features

### Automatic Import Resolution

The CLI recursively resolves all `@import` statements by default:

```css
/* src/styles.css */
@import './colors.css';
@import './typography.css';

@theme {
  /* Additional theme variables */
}
```

All imported files are parsed and merged automatically.

**Disable import resolution:**

```bash
bunx tailwind-resolver -i src/styles.css --no-imports
```

### Tailwind CSS Defaults

The CLI automatically includes Tailwind CSS default colors, fonts, and other theme values from `node_modules/tailwindcss`. You can control which default categories to include or exclude.

**Include all defaults (default behavior):**

```bash
bunx tailwind-resolver -i src/styles.css
```

**Include only specific categories:**

```bash
# Include only colors and spacing
bunx tailwind-resolver -i src/styles.css --include-defaults colors,spacing

# Include only fonts and typography-related defaults
bunx tailwind-resolver -i src/styles.css --include-defaults fonts,fontSize,fontWeight,tracking,leading
```

**Exclude specific categories:**

```bash
# Include all except shadows and animations
bunx tailwind-resolver -i src/styles.css --exclude-defaults shadows,animations

# Include all except radius and blur
bunx tailwind-resolver -i src/styles.css --exclude-defaults radius,blur
```

**Available categories:**

- `colors`, `spacing`, `fonts`, `fontSize`, `fontWeight`, `tracking`, `leading`
- `breakpoints`, `containers`, `radius`, `shadows`, `insetShadows`, `dropShadows`, `textShadows`
- `blur`, `perspective`, `aspect`, `ease`, `animations`, `defaults`, `keyframes`

**How it works:**

This enables `var()` references like:

```css
@theme {
  /* Reference Tailwind's default blue color */
  --color-primary-500: var(--color-blue-500);
}
```

The CLI resolves `var(--color-blue-500)` to `oklch(0.6 0.2 250)` from Tailwind's defaults (if `colors` category is included).

### Nesting Configuration

The CLI provides flags to control how CSS variable names are parsed into nested theme structures. By default, all namespaces use unlimited nesting (every dash creates a nesting level), and variables with consecutive dashes (`--`) are excluded (matching Tailwind v4 behavior).

**Limit nesting depth:**

```bash
bunx tailwind-resolver -i src/styles.css --nesting-max-depth 2
```

This limits nesting to 2 levels for all namespaces. Remaining parts are flattened to camelCase:

```css
--color-tooltip-outline-50: #fff;
/* Without flag: colors.tooltip.outline[50] */
/* With flag:    colors.tooltip.outline50 */

--shadow-elevation-high-focus: 0 0 0;
/* Without flag: shadows.elevation.high.focus */
/* With flag:    shadows.elevation.highFocus */
```

**Control consecutive dashes handling:**

```bash
bunx tailwind-resolver -i src/styles.css --nesting-consecutive-dashes camelcase
```

This controls how consecutive dashes (`--`) in variable names are processed:

- **`'exclude'`** (default) - Skip variables with consecutive dashes entirely (matches Tailwind v4)
- **`'nest'`** - Treat consecutive dashes as single dash (nesting boundary)
- **`'camelcase'`** - Convert consecutive dashes to camelCase boundary
- **`'literal'`** - Preserve consecutive dashes in keys

```css
--color-button--primary: #fff;

/* 'exclude' (default): Not included in theme at all */
/* 'nest':              colors.button.primary */
/* 'camelcase':         colors.buttonPrimary */
/* 'literal':           colors['button-'].primary */
```

**Control flatten mode (how parts after maxDepth are flattened):**

```bash
bunx tailwind-resolver -i src/styles.css --nesting-max-depth 2 --nesting-flatten-mode literal
```

This controls how remaining parts are flattened after `maxDepth` is reached:

- **`'camelcase'`** (default) - Flatten remaining parts to camelCase
- **`'literal'`** - Flatten remaining parts to a single kebab-case string key

```css
--color-blue-sky-light-50: #e0f2fe;

/* flattenMode: 'camelcase' (default) */
colors.blue.skyLight50

/* flattenMode: 'literal' */
colors.blue['sky-light-50']
```

**Note:** `flattenMode` only applies when `maxDepth` is set and reached.

**Combine all options:**

```bash
bunx tailwind-resolver -i src/styles.css --nesting-max-depth 2 --nesting-consecutive-dashes camelcase --nesting-flatten-mode literal
```

```css
--color-tooltip--outline-hover-50: #fff;
/* Step 1: Consecutive dashes → tooltipOutline */
/* Step 2: Max depth 2 with flattenMode: 'literal' → colors.tooltipOutline['hover-50'] */

/* With flattenMode: 'camelcase' (default) → colors.tooltipOutline.hover50 */
```

**Common use cases:**

```bash
# Flat structure (no nesting)
bunx tailwind-resolver -i src/styles.css --nesting-max-depth 0

# BEM-style naming (single level + camelCase)
bunx tailwind-resolver -i src/styles.css --nesting-max-depth 1 --nesting-consecutive-dashes camelcase

# Include variables with consecutive dashes (legacy behavior)
bunx tailwind-resolver -i src/styles.css --nesting-consecutive-dashes literal

# Moderate nesting (2 levels)
bunx tailwind-resolver -i src/styles.css --nesting-max-depth 2
```

**Note:** CLI flags apply globally to all namespaces. For per-namespace control (e.g., different depth for colors vs shadows), use the Vite plugin or Runtime API with the `nesting` option.

### CSS Conflict Detection

The CLI automatically detects when CSS rules override CSS variables, ensuring your runtime theme object matches actual rendered styles. This feature generates reports by default unless disabled.

**Problem:**

```css
.theme-mono {
  --radius-lg: 0.45em; /* CSS variable */

  .rounded-lg {
    border-radius: 0; /* CSS rule - overrides variable! */
  }
}
```

**Solution:**

The CLI:

1. **Detects all conflicts** between CSS rules and variables
2. **Applies high-confidence overrides** automatically
3. **Reports complex cases** in `conflicts.md` for manual review

**Example Output:**

```bash
bunx tailwind-resolver -i src/styles.css

Tailwind Theme Resolver

  Input:   src/styles.css
  Output:  src/generated/tailwindcss
  Runtime: enabled
  Debug:   disabled

✓ Theme types generated successfully

Generated files:
  - src/generated/tailwindcss/types.ts
  - src/generated/tailwindcss/theme.ts
  - src/generated/tailwindcss/index.ts

⚠  3 CSS conflicts detected (see src/generated/tailwindcss/conflicts.md)
```

**Conflict Reports:**

- **`conflicts.md`** - Human-readable report with summary and recommendations
- **`conflicts.json`** - Machine-readable format for CI/CD integration

**Confidence Levels:**

- **High** (auto-applied): Static values, simple selectors
- **Medium/Low** (manual review): Dynamic values, pseudo-classes, media queries, complex selectors

### Report Generation

The CLI generates diagnostic reports to help you identify and resolve issues in your theme configuration. Reports are enabled by default but can be controlled via CLI flags.

**Generate only specific reports:**

```bash
# Generate only conflict reports
bunx tailwind-resolver -i src/styles.css --reports conflicts

# Generate only unresolved variable reports
bunx tailwind-resolver -i src/styles.css --reports unresolved

# Generate both (same as default)
bunx tailwind-resolver -i src/styles.css --reports conflicts,unresolved
```

**Exclude specific reports:**

```bash
# Generate all except conflict reports
bunx tailwind-resolver -i src/styles.css --exclude-reports conflicts

# Generate all except unresolved reports
bunx tailwind-resolver -i src/styles.css --exclude-reports unresolved
```

**Enable all reports (default behavior):**

```bash
bunx tailwind-resolver -i src/styles.css
# Reports are enabled by default, no flag needed
```

## Theme Overrides

The CLI generates type definitions that enable runtime theme overrides via the `resolveTheme()` API. While the CLI itself doesn't support override flags, you can apply overrides programmatically when using the generated types.

### When to Use Overrides

- **Inject external variables**: Provide values for variables from Next.js, plugins, or external sources
- **Fix variant-specific values**: Override theme properties for dark mode or custom themes
- **Global customization**: Apply consistent values across all variants
- **Runtime customization**: Apply theme changes dynamically based on user preferences

### Using Overrides with Generated Types

First, generate your types with the CLI:

```bash
bunx tailwind-resolver -i src/styles.css
```

Then use the generated `Tailwind` type with runtime overrides:

```typescript
import type { Tailwind } from './generated/tailwindcss';

import { resolveTheme } from 'tailwind-resolver';

const result = await resolveTheme<Tailwind>({
  input: './src/styles.css',
  overrides: {
    default: {
      'fonts.sans': 'Inter, sans-serif',
      'radius.lg': '0.5rem',
    },
    dark: {
      'colors.background': '#000000',
    },
    '*': {
      'fonts.mono': 'JetBrains Mono, monospace',
    },
  },
});

console.log(result.variants.default.fonts.sans); // 'Inter, sans-serif'
console.log(result.variants.dark.colors.background); // '#000000'
```

### Syntax Options

**Flat notation (dot-separated paths):**

```typescript
overrides: {
  'default': {
    'colors.primary.500': '#3b82f6',
    'radius.lg': '0.5rem'
  }
}
```

**Nested notation:**

```typescript
overrides: {
  'default': {
    colors: {
      primary: {
        500: '#3b82f6'
      }
    },
    radius: {
      lg: '0.5rem'
    }
  }
}
```

**Selector matching:**

```typescript
overrides: {
  'dark': { 'colors.background': '#000000' },
  'themeInter': { 'fonts.sans': 'Inter, sans-serif' },  // .theme-inter → themeInter
  'default': {},                                         // Default theme
  'base': {},                                            // Alias for 'default'
  '*': {},                                               // All variants
}
```

**Note:** Variant names are automatically converted from kebab-case to camelCase:

- CSS: `.theme-inter` → Override key: `'themeInter'`
- CSS: `.theme-noto-sans` → Override key: `'themeNotoSans'`

See [main README - Theme Overrides Details](../../../README.md#theme-overrides-details) for comprehensive documentation.

## Usage Examples

### Chart.js Library

```bash
bunx tailwind-resolver -i src/theme.css -o lib/generated
```

```typescript
import { defaultTheme } from './lib/generated/tailwindcss';

new Chart(ctx, {
  data: {
    datasets: [{ backgroundColor: defaultTheme.colors.primary[500] }],
  },
});
```

### Canvas Rendering

```bash
bunx tailwind-resolver -i styles.css
```

```typescript
import { defaultTheme } from './generated/tailwindcss';

ctx.fillStyle = defaultTheme.colors.background;
ctx.font = `${defaultTheme.fontSize.xl.size} ${defaultTheme.fonts.sans}`;
```

### SSR/SSG

```bash
# In your build process
bunx tailwind-resolver -i src/styles.css

# Use in SSR code
import { defaultTheme } from './generated/tailwindcss';

const inlineStyles = `background-color: ${defaultTheme.colors.background};`;
```

### Runtime API with Type Safety

```typescript
import type { Tailwind } from './generated/tailwindcss';

import { resolveTheme } from 'tailwind-resolver';

const result = await resolveTheme<Tailwind>({
  input: './styles.css',
});

console.log(result.variants.default.colors.primary[500]); // Fully typed
console.log(result.variants.dark.colors.background); // Fully typed
```

## Generated Files

The CLI generates the same files as the Vite plugin:

**Default output directory:**

- `src/generated/tailwindcss/` if your project has a `src/` folder
- `generated/tailwindcss/` otherwise

**Generated files:**

```
src/generated/tailwindcss/
├── types.ts           # TypeScript interfaces (always)
├── theme.ts           # Runtime theme objects (if --runtime enabled)
├── index.ts           # Convenient re-exports (if --runtime enabled)
├── conflicts.md       # CSS conflict report (if conflicts detected)
├── conflicts.json     # Machine-readable conflict data (if conflicts detected)
├── unresolved.md      # Unresolved variable report (if any detected)
└── unresolved.json    # Machine-readable unresolved data (if any detected)
```

### types.ts (Always Generated)

TypeScript type declarations for your theme:

```typescript
/**
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * Generated from: src/styles.css
 * Generated at: 2025-01-18T10:30:00.000Z
 */

export interface DefaultTheme {
  colors: {
    primary: { 500: 'oklch(0.65 0.20 250)' };
    background: '#ffffff';
  };
  fontSize: {
    xl: { size: '1.25rem'; lineHeight: '1.75rem' };
  };
  // ... all theme properties
}

export interface Tailwind {
  variants: {
    default: DefaultTheme;
    dark: Partial<DefaultTheme>;
  };
  selectors: {
    default: ':root';
    dark: string;
  };
}
```

### theme.ts (Generated by Default)

Runtime theme objects (when `--runtime` is enabled):

```typescript
/**
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 */

export const variants = {
  default: {
    colors: {
      primary: { 500: 'oklch(0.65 0.20 250)' },
      background: '#ffffff',
    },
    // ... complete base theme
  },
  dark: {
    colors: { background: '#1f2937' },
    // ... only dark theme overrides
  },
} as const;

export const selectors = {
  default: ':root',
  dark: '[data-theme="dark"]',
} as const;

// Convenience exports for individual variants
export const defaultTheme = variants.default;
export const dark = variants.dark;

// Master export
export const tailwind = { variants, selectors } as const;

export default defaultTheme;
```

## TypeScript Configuration

Ensure the output directory is included in your `tsconfig.json`:

```json
{
  "include": ["src/**/*"],
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

If using a custom output directory, add it explicitly:

```json
{
  "include": ["src/**/*", "custom/output/path/**/*"]
}
```

## Git Configuration

You can choose to commit or ignore generated files:

```gitignore
# Option 1: Ignore (regenerates on each machine)
src/generated/

# Option 2: Commit (available immediately after clone)
# Recommended for teams - similar to Prisma Client
```

## Package.json Scripts

```json
{
  "scripts": {
    "generate:theme": "tailwind-resolver -i src/styles.css",
    "generate:theme:debug": "tailwind-resolver -i src/styles.css --debug",
    "generate:theme:types": "tailwind-resolver -i src/styles.css --no-runtime",
    "prebuild": "npm run generate:theme"
  }
}
```

## Troubleshooting

### Command Not Found

```bash
bunx: command not found
```

**Solution:** Install Bun or use your package manager:

```bash
# Use pnpm instead
pnpm exec tailwind-resolver -i src/styles.css

# Or install globally
npm install -g tailwind-resolver
tailwind-resolver -i src/styles.css
```

### Input File Not Found

```bash
Error: ENOENT: no such file or directory
```

**Solutions:**

1. Verify the path is correct relative to current directory
2. Use absolute path: `bunx tailwind-resolver -i /absolute/path/to/styles.css`
3. Check file permissions

### Generated Files Not Found

If `import { defaultTheme } from './generated/tailwindcss'` fails:

1. Verify CLI completed successfully (check exit code)
2. Check the output directory exists
3. Ensure path matches your import statement
4. Add output directory to `tsconfig.json` includes

### Types Not Updating

The CLI does not watch files. To regenerate:

1. **Manual:** Run the command again
2. **Automatic:** Add to `package.json` scripts and run before build
3. **Watch mode:** Use the Vite plugin instead

## Performance

- **Small themes** (< 100 variables): ~10-20ms
- **Medium themes** (100-500 variables): ~30-50ms
- **Large themes** (> 500 variables): ~80-150ms

_Note: Times exclude file I/O, measured on M2 Mac_

## Requirements

- **Node.js** >= 18 or **Bun** >= 1.0
- **TypeScript** >= 5.0 (for type generation)

---

See the [main README](../../../README.md) for more detailed examples and API documentation.
