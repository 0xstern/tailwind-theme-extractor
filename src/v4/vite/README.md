# Vite Plugin - Tailwind Theme Resolver

**Automatic TypeScript type generation and runtime theme objects for Tailwind CSS v4**

Auto-generates TypeScript types and runtime theme objects from your Tailwind CSS v4 files during development and build. Types regenerate automatically on file changes with HMR support.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Plugin Options](#plugin-options)
  - [Tailwind Defaults](#tailwind-defaults)
  - [Nesting Configuration](#nesting-configuration)
  - [Theme Overrides](#theme-overrides)
  - [Report Generation](#report-generation)
- [Features](#features)
  - [Automatic Regeneration](#automatic-regeneration)
  - [Multi-File Support](#multi-file-support)
  - [Theme Variants](#theme-variants)
  - [CSS Conflict Detection](#css-conflict-detection)
- [Usage Examples](#usage-examples)
- [Generated Files](#generated-files)
- [TypeScript Configuration](#typescript-configuration)
- [Git Configuration](#git-configuration)
- [Troubleshooting](#troubleshooting)
- [Performance](#performance)
- [Best Practices](#best-practices)
- [Requirements](#requirements)

## Quick Start

**1. Install:**

```bash
npm install -D tailwind-resolver
```

**2. Add plugin to vite.config.ts:**

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

**3. Use the generated theme:**

```typescript
import { dark, defaultTheme } from './generated/tailwindcss';

const primary = defaultTheme.colors.primary[500];
const darkBg = dark.colors.background;
```

That's it! The plugin automatically generates types and runtime objects with HMR support.

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

**Version-specific import** (lock to v4):

```typescript
import { tailwindResolver } from 'tailwind-resolver/v4/vite';
```

## Configuration

### Plugin Options

```typescript
interface VitePluginOptions {
  /**
   * Path to your CSS input file (relative to Vite project root)
   * @required
   */
  input: string;

  /**
   * Output directory for generated files (relative to Vite project root)
   * @default 'src/generated/tailwindcss' if src/ exists, otherwise 'generated/tailwindcss'
   */
  outputDir?: string;

  /**
   * Resolve @import statements recursively
   * @default true
   */
  resolveImports?: boolean;

  /**
   * Control what gets generated in the runtime file
   * - false: No runtime file (types only)
   * - true: Generate variants and selectors (production-optimized)
   * - object: Granular control
   * @default true
   */
  generateRuntime?:
    | boolean
    | {
        variants?: boolean; // Theme variants (default: true)
        selectors?: boolean; // CSS selectors (default: true)
        files?: boolean; // Processed files (default: false)
        variables?: boolean; // Raw variables (default: false)
        reports?:
          | boolean // Enable/disable all reports (default: true)
          | {
              conflicts?: boolean; // CSS conflict reports (default: true)
              unresolved?: boolean; // Unresolved variable reports (default: true)
            };
      };

  /**
   * Include Tailwind CSS defaults
   * @default true
   */
  includeDefaults?: boolean | TailwindDefaultsOptions;

  /**
   * Configure nesting behavior for CSS variable keys
   * @default undefined (unlimited nesting)
   */
  nesting?: NestingOptions;

  /**
   * Theme value overrides
   * @default undefined
   */
  overrides?: OverrideOptions;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}
```

**Full Configuration Example:**

```typescript
tailwindResolver({
  // Required: CSS input file
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
  shadows: false,     // Exclude shadows
  animations: false,  // Exclude animations
  // ... 21 categories total
}
```

**Available categories:**

- `colors`, `spacing`, `fonts`, `fontSize`, `fontWeight`, `tracking`, `leading`
- `breakpoints`, `containers`, `radius`, `shadows`, `insetShadows`, `dropShadows`, `textShadows`
- `blur`, `perspective`, `aspect`, `ease`, `animations`, `defaults`, `keyframes`

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
}
```

**Note:** CSS `initial` declarations take precedence over `includeDefaults` configuration.

### Nesting Configuration

Control how CSS variable names are parsed into nested theme structures. By default, all namespaces use unlimited nesting (every dash creates a nesting level), and variables with consecutive dashes (`--`) are excluded (matching Tailwind v4 behavior).

**Default Behavior:**

```css
--color-tooltip-outline-50: #fff;
/* → colors.tooltip.outline[50] */

--shadow-elevation-high-focus: 0 0 0;
/* → shadows.elevation.high.focus */

--color-button--primary: #fff;
/* → Excluded (consecutive dashes) */
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

**Common Use Cases:**

```typescript
// Flat structure (no nesting)
nesting: { default: { maxDepth: 0 } }

// BEM-style naming
nesting: {
  default: {
    maxDepth: 1,
    consecutiveDashes: 'camelcase'
  }
}

// Controlled depth by category
nesting: {
  colors: { maxDepth: 3 },      // Deep color scales
  shadows: { maxDepth: 2 },     // Moderate shadow variants
  radius: { maxDepth: 1 },      // Flat radius values
}
```

See [main README - Nesting Configuration Details](../../../README.md#nesting-configuration-details) for comprehensive documentation.

### Theme Overrides

Apply programmatic overrides to theme values without modifying CSS files.

**Use Cases:**

- Inject external variables (Next.js fonts, plugin variables)
- Fix variant-specific values
- Global customization across all variants
- Quick prototyping

**Configuration:**

```typescript
tailwindResolver({
  input: 'src/styles.css',
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
```

**Syntax Options:**

```typescript
// Flat notation
overrides: {
  default: {
    'colors.primary.500': '#custom-blue',
    'radius.lg': '0.5rem',
  }
}

// Nested notation
overrides: {
  default: {
    colors: {
      primary: {
        500: '#custom-blue'
      }
    }
  }
}

// Mix both styles
overrides: {
  default: {
    'colors.primary.500': '#custom-blue',
    radius: { lg: '0.5rem' }
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

See [main README - Theme Overrides Details](../../../README.md#theme-overrides-details) for comprehensive documentation.

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

## Features

### Automatic Regeneration

The plugin watches your CSS files and regenerates types on every change:

```css
/* src/styles.css */
@theme {
  --color-brand: #3b82f6;
}
```

**Save the file** → Types regenerate automatically → Autocomplete updates immediately

### Multi-File Support

Automatically tracks all imported CSS files:

```css
/* src/styles.css */
@import './colors.css';
@import './typography.css';

@theme {
  /* Additional variables */
}
```

Changes to any imported file trigger regeneration.

### Theme Variants

Resolves dark mode and custom theme variants:

```css
@theme {
  --color-background: #ffffff;
}

[data-theme='dark'] {
  --color-background: #1f2937;
}

.midnight {
  --color-background: #0f172a;
}
```

**Generated exports:**

```typescript
export const defaultTheme = { colors: { background: '#ffffff' } };
export const dark = { colors: { background: '#1f2937' } };
export const midnight = { colors: { background: '#0f172a' } };

export const selectors = {
  dark: "[data-theme='dark']",
  midnight: '.midnight',
};
```

### CSS Conflict Detection

Automatically detects when CSS rules override CSS variables to ensure your runtime theme object matches actual rendered styles.

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

The plugin:

1. Detects all conflicts between CSS rules and variables
2. Applies high-confidence overrides automatically
3. Reports complex cases for manual review

**Generated Reports:**

```
src/generated/tailwindcss/
├── conflicts.md    # Human-readable report with recommendations
└── conflicts.json  # Machine-readable for CI/CD
```

**Terminal Output:**

```
  ℹ  Tailwind theme updated from styles.css
⚠  3 CSS conflicts detected (see src/generated/tailwindcss/conflicts.md)
```

**Confidence Levels:**

- **High** (auto-applied): Static values, simple selectors
- **Medium/Low** (manual review): Dynamic values, pseudo-classes, media queries, complex selectors

## Usage Examples

### Chart.js Integration

```typescript
import { Chart } from 'chart.js';

import { defaultTheme } from './generated/tailwindcss';

new Chart(ctx, {
  type: 'bar',
  data: {
    datasets: [
      {
        backgroundColor: [
          defaultTheme.colors.primary[500],
          defaultTheme.colors.secondary[500],
        ],
      },
    ],
  },
});
```

### Dynamic Theme Switching

```typescript
import { dark, defaultTheme, selectors } from './generated/tailwindcss';

function applyTheme(mode: 'light' | 'dark') {
  const theme = mode === 'light' ? defaultTheme : dark;

  // Apply CSS selector
  document.documentElement.setAttribute('data-theme', mode);

  // Update chart colors
  chartInstance.data.datasets[0].backgroundColor = theme.colors.primary[500];
  chartInstance.update();
}
```

### Canvas Rendering

```typescript
import { defaultTheme } from './generated/tailwindcss';

function drawText(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = defaultTheme.colors.foreground;
  ctx.font = `${defaultTheme.fontSize.xl.size} ${defaultTheme.fonts.display}`;
  ctx.fillText('Hello World', 10, 50);
}
```

### React Component

```typescript
import { useState } from 'react';
import { defaultTheme, dark } from './generated/tailwindcss';

function ThemedComponent() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const theme = mode === 'light' ? defaultTheme : dark;

  return (
    <div style={{ backgroundColor: theme.colors.background }}>
      <canvas ref={(el) => el && drawChart(el, theme)} />
    </div>
  );
}
```

## Generated Files

The plugin generates files in your specified `outputDir`.

**Default output directory:**

- `src/generated/tailwindcss/` if your project has a `src/` folder
- `generated/tailwindcss/` otherwise

**Generated files:**

```
src/generated/tailwindcss/
├── types.ts           # TypeScript interfaces (always)
├── theme.ts           # Runtime theme objects (if generateRuntime enabled)
├── index.ts           # Convenient re-exports (if generateRuntime enabled)
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
 */

export interface DefaultTheme {
  colors: {
    primary: { 500: 'oklch(0.65 0.20 250)' };
    background: '#ffffff';
  };
  fontSize: {
    xl: { size: '1.25rem'; lineHeight: '1.75rem' };
  };
  // ... all other namespaces
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

// Augments the runtime API types
declare module 'tailwind-resolver' {
  interface Theme extends DefaultTheme {}
}

// Export declarations for runtime objects (if generateRuntime: true)
export declare const defaultTheme: DefaultTheme;
export declare const dark: Partial<DefaultTheme>;
export declare const selectors: Tailwind['selectors'];
```

### theme.ts (Generated by Default)

Runtime theme objects for immediate use (opt-out with `generateRuntime: false`):

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
    // ... only overridden values for dark variant
  },
} as const;

export const selectors = {
  default: ':root',
  dark: "[data-theme='dark']",
} as const;

// Convenience exports for individual variants
export const defaultTheme = variants.default;
export const dark = variants.dark;

// Master export with full structure
export const tailwind = {
  variants,
  selectors,
} as const;

export default defaultTheme;
```

## TypeScript Configuration

Ensure generated files are included in `tsconfig.json`:

```json
{
  "include": ["src/**/*"],
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

## Git Configuration

You can choose to commit or ignore the generated files:

```gitignore
# Option 1: Ignore generated files (regenerates on each machine)
src/generated/

# Option 2: Commit generated files (available immediately after clone)
# (Recommended for teams - similar to Prisma Client)
```

## Troubleshooting

### Types Not Updating

1. Save the CSS file to trigger regeneration
2. Verify `input` points to the correct file
3. Check Vite console for error messages
4. Restart TypeScript server (VS Code: `Cmd+Shift+P` → "Restart TS Server")

### Import Errors

```
Cannot find module './generated/tailwindcss'
```

**Solutions:**

1. Runtime generation is enabled by default - check the plugin logs
2. Start the dev server at least once to generate files
3. Check that `outputDir` exists in your `tsconfig.json` include paths
4. Verify the generated files exist in the file system
5. Set `generateRuntime: false` if you only need type declarations

### HMR Not Working

The plugin logs theme updates to the console:

```
  ℹ  Tailwind theme updated from styles.css
```

If you don't see this message:

1. Verify the CSS file is being watched by Vite
2. Check that the file is inside your project root
3. Ensure `resolveImports: true` if using `@import` statements

## Performance

- Type regeneration: ~5-10ms for typical themes
- No impact on HMR performance
- Efficient file watching via Vite's native watcher
- Incremental updates (only regenerates on CSS changes)

## Best Practices

1. **Enable `generateRuntime: true`** for production builds to avoid async calls
2. **Commit generated files** for team projects (like Prisma Client)
3. **Use exact output directory** in your `tsconfig.json` includes
4. **Organize theme CSS** by namespace for easier maintenance

## Requirements

- **Vite** >= 5.0
- **TypeScript** >= 5.0 (for type generation)
- **Node.js** >= 18 or **Bun** >= 1.0

---

See the [main README](../../../README.md) for more detailed examples and API documentation.
