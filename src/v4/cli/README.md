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
- `--no-imports` - Skip resolving @import statements
- `--no-defaults` - Exclude Tailwind CSS defaults from node_modules
- `-d, --debug` - Enable debug logging for troubleshooting
- `-h, --help` - Display help message
- `-v, --version` - Display version number

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

### Development Build (All Features)

Generate everything including debug data:

```bash
bunx tailwind-resolver -i src/styles.css --debug
```

### Production Build (Minimal Bundle)

Generate only types (no runtime):

```bash
bunx tailwind-resolver -i src/styles.css --no-runtime
```

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

The CLI automatically includes Tailwind CSS default colors, fonts, and other theme values from `node_modules/tailwindcss`:

```bash
# Include defaults (default behavior)
bunx tailwind-resolver -i src/styles.css

# Exclude defaults (user theme only)
bunx tailwind-resolver -i src/styles.css --no-defaults
```

This enables `var()` references like:

```css
@theme {
  /* Reference Tailwind's default blue color */
  --color-primary-500: var(--color-blue-500);
}
```

The CLI resolves `var(--color-blue-500)` to `oklch(0.6 0.2 250)` from Tailwind's defaults.

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

_Note: Times exclude file I/O, measured on M1 Mac_

## Requirements

- Node.js >= 18 or Bun >= 1.0
- TypeScript >= 5.0 (for type generation)

## Related Documentation

- [Main README](../../../README.md) - Overview and all usage methods
- [Vite Plugin README](../vite/README.md) - Vite-specific documentation
- [Runtime API Documentation](../../../README.md#runtime-api-dynamic-resolution) - Using `resolveTheme()` programmatically

## Support

If you find this helpful, follow me on X [@mrstern\_](https://x.com/mrstern_)
