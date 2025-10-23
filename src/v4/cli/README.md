# CLI - Tailwind Theme Resolver

Generate TypeScript types and runtime theme objects from Tailwind CSS v4 theme files using the command line.

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

## Basic Usage

```bash
# Bun
bunx tailwind-resolver -i src/styles.css

# pnpm
pnpm exec tailwind-resolver -i src/styles.css

# Yarn
yarn tailwind-resolver -i src/styles.css

# npm
npx tailwind-resolver -i src/styles.css
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

## Output Directory Auto-Detection

If no output directory is specified, the CLI automatically detects the best location:

- **With `src/` folder**: `src/generated/tailwindcss/`
- **Without `src/` folder**: `generated/tailwindcss/`

**Override with custom path:**

```bash
bunx tailwind-resolver -i styles.css -o custom/output/path
```

## Generated Files

The CLI generates the same files as the Vite plugin:

**Generated files:**

- `types.ts` - TypeScript type declarations (always)
- `theme.ts` - Runtime theme objects (if `--runtime` enabled)
- `index.ts` - Re-exports (if `--runtime` enabled)
- `conflicts.md` - Human-readable conflict report (if CSS conflicts detected and reports enabled)
- `conflicts.json` - Machine-readable conflict report (if CSS conflicts detected and reports enabled)
- `unresolved.md` - Human-readable unresolved variable report (if unresolved variables detected and reports enabled)
- `unresolved.json` - Machine-readable unresolved variable report (if unresolved variables detected and reports enabled)

### Always Generated

**`types.ts`** - TypeScript type declarations:

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
    dark: Dark;
    // ... other variants
  };
  selectors: {
    default: ':root';
    dark: string;
  };
  files: Array<string>;
  variables: Array<{
    name: string;
    value: string;
    source: string;
    selector?: string;
    variantName?: string;
  }>;
}
```

### Conditionally Generated (Default: Enabled)

**`theme.ts`** - Runtime theme objects (when `--runtime` is enabled):

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
} as Tailwind['variants'];

export const selectors = {
  default: ':root',
  dark: '[data-theme="dark"]',
} as Tailwind['selectors'];

// Convenience exports for individual variants
export const defaultTheme = variants.default;
export const dark = variants.dark;
```

**`index.ts`** - Clean re-exports:

```typescript
export type * from './types';
export * from './theme';
```

## Common Workflows

### Production Build (Optimized)

Default behavior generates optimized runtime (variants and selectors only):

```bash
bunx tailwind-resolver -i src/styles.css
```

### Debug Mode (Full Features)

Enable debug mode to get logging and include debug data in runtime:

```bash
bunx tailwind-resolver -i src/styles.css --debug
```

**Debug mode enables:**

- Import resolution warnings
- `files` array in runtime (processed file list)
- `variables` array in runtime (raw CSS variables)

### Types Only (No Runtime)

```bash
bunx tailwind-resolver -i src/styles.css --no-runtime
```

## Report Generation

The CLI generates diagnostic reports to help you identify and resolve issues in your theme configuration. Reports are enabled by default but can be controlled via CLI flags.

### Controlling Report Generation

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

## CSS Conflict Detection

The CLI automatically detects when CSS rules override CSS variables, ensuring your runtime theme object matches actual rendered styles. This feature generates reports by default unless disabled with `--no-reports` or `--no-conflict-reports`.

### Problem

CSS files often mix variables with direct style rules:

```css
.theme-mono {
  --radius-lg: 0.45em; /* CSS variable */

  .rounded-lg {
    border-radius: 0; /* CSS rule - overrides variable! */
  }
}
```

Without detection, the runtime theme would incorrectly show `radius.lg: "0.45em"` instead of `"0"`.

### Solution

The CLI:

1. **Detects all conflicts** between CSS rules and variables
2. **Applies high-confidence overrides** automatically
3. **Reports complex cases** in `conflicts.md` for manual review

### Example Output

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

### Conflict Reports

**`conflicts.md`** - Human-readable report:

- Summary of auto-resolved vs pending conflicts
- Detailed conflict information
- Suggested actions for complex cases
- Context-specific recommendations

**`conflicts.json`** - Machine-readable format for CI/CD integration

### Confidence Levels

**High Confidence** (auto-applied):

- Static values (e.g., `border-radius: 0`)
- Simple selectors
- No pseudo-classes or media queries

**Medium/Low Confidence** (manual review):

- Dynamic values (`calc()`, `var()`)
- Pseudo-classes (`:hover`, `:focus`)
- Media query nesting
- Complex selectors

High-confidence overrides ensure your Chart.js, Canvas, and other runtime uses get correct values.

### CI/CD Pipeline

```bash
#!/bin/bash
set -e

# Generate theme types
bunx tailwind-resolver -i src/styles.css -o src/generated/tailwindcss

# Verify generated files exist
if [ ! -f "src/generated/tailwindcss/types.ts" ]; then
  echo "Error: Failed to generate theme types"
  exit 1
fi

echo "Theme types generated successfully"
```

### Package.json Scripts

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

## Features

### Automatic @import Resolution

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

The CLI provides flags to control how CSS variable names are parsed into nested theme structures. By default, all namespaces use unlimited nesting (every dash creates a new nesting level), and variables with consecutive dashes (`--`) are excluded (matching Tailwind v4 behavior).

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

### Base Path Resolution

The CLI automatically derives the base path from your input file's directory, ensuring correct `node_modules` resolution:

```bash
# Input: src/styles.css
# Base path: /absolute/path/to/src/
# Resolves: node_modules from src/ or parent directories

bunx tailwind-resolver -i src/components/theme.css
# Base path: /absolute/path/to/src/components/
```

This is critical for monorepos or projects with nested CSS files.

## Debug Mode

Enable debug logging to troubleshoot import resolution failures:

```bash
bunx tailwind-resolver -i src/styles.css --debug
```

**Example output:**

```
[Tailwind Theme Resolver] Failed to resolve import: ./missing.css
  Resolved path: /absolute/path/to/missing.css
  Error: ENOENT: no such file or directory
```

**What gets logged:**

- Failed import resolution with full paths
- File system errors
- CSS parsing errors in imported files

**Important:** Failed imports are silently skipped by default (graceful degradation). Enable debug mode only when troubleshooting.

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

**Mix both styles:**

```typescript
overrides: {
  'default': {
    'colors.primary': {
      500: '#3b82f6',
      600: '#2563eb'
    }
  }
}
```

### Selector Matching

**Variant names (use camelCase for multi-word variants):**

```typescript
overrides: {
  'dark': { 'colors.background': '#000000' },
  'themeInter': { 'fonts.sans': 'Inter, sans-serif' }  // .theme-inter → themeInter
}
```

**CSS selectors (verbose, but works):**

```typescript
overrides: {
  '[data-theme="dark"]': { 'colors.background': '#000000' }
}
```

**Special keys:**

```typescript
overrides: {
  'default': { 'colors.primary': '#3b82f6' },  // Base theme
  'base': { 'colors.primary': '#3b82f6' },     // Same as 'default'
  '*': { 'fonts.mono': 'JetBrains Mono' }      // All variants
}
```

**Important:** Variant names are automatically converted from kebab-case to camelCase:

- CSS: `.theme-inter` → Override key: `'themeInter'`
- CSS: `.theme-noto-sans` → Override key: `'themeNotoSans'`
- CSS: `.dark` → Override key: `'dark'` (no conversion needed)

Use the exact camelCase variant names from your generated `Tailwind` type for reliable matching.

### Common Use Cases

**1. Injecting External Variables**

Fix unresolved variables from Next.js or external sources:

```typescript
const result = await resolveTheme<Tailwind>({
  input: './src/styles.css',
  overrides: {
    default: {
      'colors.primary': 'var(--next-primary)',
      'fonts.sans': 'var(--system-font)',
    },
  },
});
```

**2. Variant-Specific Overrides**

Apply overrides to dark mode or custom themes:

```typescript
const result = await resolveTheme<Tailwind>({
  input: './src/styles.css',
  overrides: {
    dark: {
      'colors.background': '#000000',
      'colors.foreground': '#ffffff',
    },
    compact: {
      'spacing.lg': '0.75rem',
    },
  },
});
```

**3. Global Overrides**

Apply the same value to all variants using `'*'`:

```typescript
const result = await resolveTheme<Tailwind>({
  input: './src/styles.css',
  overrides: {
    '*': {
      'fonts.sans': 'Inter, sans-serif',
      'fonts.mono': 'JetBrains Mono, monospace',
    },
  },
});
```

**4. Dynamic User Preferences**

Apply theme changes based on user settings:

```typescript
const userPreferences = {
  fontSize: 'large',
  highContrast: true,
};

const result = await resolveTheme<Tailwind>({
  input: './src/styles.css',
  overrides: {
    default: {
      'fontSize.base.size':
        userPreferences.fontSize === 'large' ? '1.125rem' : '1rem',
    },
    dark: {
      'colors.background': userPreferences.highContrast ? '#000000' : '#1a1a1a',
    },
  },
});
```

### How It Works

The override system uses a two-phase approach:

1. **Pre-resolution**: Synthetic CSS variables are injected before the resolution pipeline
2. **Post-resolution**: Direct mutations are applied to the resolved theme object

This ensures that both `var()` references and final theme values are correctly overridden.

### Debug Mode

Enable debug logging to see what overrides are being applied:

```typescript
const result = await resolveTheme<Tailwind>({
  input: './src/styles.css',
  debug: true,
  overrides: {
    dark: { 'colors.background': '#000000' },
  },
});
```

**Console output:**

```
[Override] Injected --color-background: #000000 (variant: dark, pre-resolution)
[Override] Applied colors.background = #000000 (variant: dark, post-resolution)
```

## Usage with Generated Types

After running the CLI, import and use the generated types:

```typescript
// Import the master Tailwind interface for type safety

import type { Tailwind } from './generated/tailwindcss';

// '[data-theme="dark"]'

// Option 2: Use with runtime API for dynamic resolution
import { resolveTheme } from 'tailwind-resolver';

// Option 1: Use generated runtime objects (if --runtime enabled)
import { dark, defaultTheme, selectors } from './generated/tailwindcss';

console.log(defaultTheme.colors.primary[500]); // Fully typed
console.log(dark.colors.background); // Fully typed
console.log(selectors.dark);

const result = await resolveTheme<Tailwind>({
  input: './styles.css',
});

console.log(result.variants.default.colors.primary[500]); // Same type safety
console.log(result.variants.dark.colors.background); // Same type safety
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

## Comparison: CLI vs. Vite Plugin

| Feature           | CLI                          | Vite Plugin                 |
| ----------------- | ---------------------------- | --------------------------- |
| **Use Case**      | Build scripts, CI/CD, SSR    | Development with HMR        |
| **Regeneration**  | Manual (run command)         | Automatic on file change    |
| **Watch Mode**    | No (run in package.json)     | Yes (Vite's native watcher) |
| **HMR**           | No                           | Yes                         |
| **Output**        | Same (types.ts, theme.ts)    | Same (types.ts, theme.ts)   |
| **Configuration** | Command line flags           | vite.config.ts              |
| **When to Use**   | Non-Vite projects, pipelines | Vite projects with live dev |

## Examples

### Generate for Chart.js Library

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

### Generate for Canvas Rendering

```bash
bunx tailwind-resolver -i styles.css
```

```typescript
import { defaultTheme } from './generated/tailwindcss';

ctx.fillStyle = defaultTheme.colors.background;
ctx.font = `${defaultTheme.fontSize.xl.size} ${defaultTheme.fonts.sans}`;
```

### Generate for SSR/SSG

```bash
# In your build process
bunx tailwind-resolver -i src/styles.css

# Use in SSR code
import { defaultTheme } from './generated/tailwindcss';

const inlineStyles = `background-color: ${defaultTheme.colors.background};`;
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

- Node.js >= 18 or Bun >= 1.0
- TypeScript >= 5.0 (for type generation)

## Related Documentation

- [Main README](../../../README.md) - Overview and all usage methods
- [Vite Plugin README](../vite/README.md) - Vite-specific documentation
- [Runtime API Documentation](../../../README.md#runtime-api-dynamic-resolution) - Using `resolveTheme()` programmatically

## Support

If you find this helpful, follow me on X [@mrstern\_](https://x.com/mrstern_)
