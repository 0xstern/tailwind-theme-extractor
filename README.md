# Tailwind Theme Resolver

Resolve Tailwind CSS v4 theme variables into TypeScript types and runtime objects.

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

**1. Configure the plugin in `vite.config.ts`:**

```typescript
import tailwindcss from '@tailwindcss/vite';
import { tailwindResolver } from 'tailwind-resolver/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    tailwindResolver({
      // Required: Path to your CSS input file (relative to Vite project root)
      input: 'src/styles.css',

      // Optional: Output directory for generated files (relative to Vite project root)
      // Default: 'src/generated/tailwindcss' if src/ exists, otherwise 'generated/tailwindcss'
      outputDir: 'src/generated/tailwindcss',

      // Optional: Resolve @import statements recursively
      // Default: true
      resolveImports: true,

      // Optional: Control what gets generated in the runtime file
      // - false: No runtime file (types only)
      // - true: Generate all (variants, selectors, excluding debug data)
      // - object: Granular control
      // Default: true
      generateRuntime: {
        variants: true, // Theme variants (default, dark, etc.)
        selectors: true, // CSS selectors for variants
        files: false, // Processed file list (debug only)
        variables: false, // Raw CSS variables (debug only)
      },

      // Optional: Include Tailwind CSS defaults from node_modules
      // Default: true
      includeTailwindDefaults: true,

      // Optional: Enable debug logging for troubleshooting
      // Default: false
      debug: false,
    }),
  ],
});
```

This generates files in `src/generated/tailwindcss/`:

- `types.ts` - TypeScript interfaces
- `theme.ts` - Runtime theme objects (if `generateRuntime: true`)
- `index.ts` - Re-exports (if `generateRuntime: true`)

**2. Use the generated theme in your code:**

```typescript
import { dark, defaultTheme, tailwind } from './generated/tailwindcss';

// Use the master tailwind object
new Chart(ctx, {
  data: {
    datasets: [
      {
        backgroundColor: [
          tailwind.variants.default.colors.primary[500],
          tailwind.variants.dark.colors.background,
        ],
      },
    ],
  },
});

// Or use individual variant exports for convenience
const primary = defaultTheme.colors.primary[500];
const darkBg = dark.colors.background;
```

### Runtime API (Dynamic Resolution)

**1. Configure resolveTheme options:**

```typescript
import { resolveTheme } from 'tailwind-resolver';

const result = await resolveTheme({
  // Option 1: CSS file path (relative to cwd or absolute)
  input: './src/styles.css',

  // Option 2: Raw CSS content (alternative to input)
  css: '@theme { --color-primary: blue; }',

  // Optional: Base path for @import resolution (required when using css option)
  basePath: process.cwd(),

  // Optional: Resolve @import statements recursively
  // Default: true
  resolveImports: true,

  // Optional: Include Tailwind CSS defaults from node_modules
  // Default: true
  includeTailwindDefaults: true,

  // Optional: Enable debug logging
  // Default: false
  debug: false,
});
```

**2. Use the resolved theme:**

```typescript
// With generated types for full type safety

import type { Tailwind } from './generated/tailwindcss';

const { variants, selectors, files, variables } = await resolveTheme<Tailwind>({
  input: './styles.css',
});

// Fully typed with autocomplete - same structure as generated constant
console.log(variants.default.colors.primary[500]);
console.log(variants.dark.colors.background);
console.log(selectors.dark); // '[data-theme="dark"]'
console.log(files); // Array<string>
console.log(variables); // Array<CSSVariable>
```

### CLI

Generate types without a build tool:

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

**Options:**

- `-i, --input <path>` - CSS input file (required)
- `-o, --output <path>` - Output directory (default: auto-detected)
- `-r, --runtime` - Generate runtime objects (default: true)
- `--no-runtime` - Types only
- `-d, --debug` - Enable debug logging
- `-h, --help` - Show help

## Theme Structure

```typescript
{
  colors: {},           // --color-*
  spacing: {},          // --spacing-*
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

## Theme Variants

```css
@theme {
  --color-background: #ffffff;
}

[data-theme='dark'] {
  --color-background: #1f2937;
}
```

**Usage:**

```typescript
import {
  dark,
  defaultTheme,
  selectors,
  tailwind,
} from './generated/tailwindcss';

// All values are fully typed
console.log(tailwind.variants.default.colors.background); // '#ffffff'
console.log(tailwind.variants.dark.colors.background); // '#1f2937'
console.log(tailwind.selectors.dark); // "[data-theme='dark']"

// Or use individual exports
console.log(defaultTheme.colors.background); // '#ffffff'
console.log(dark.colors.background); // '#1f2937'
console.log(selectors.dark); // "[data-theme='dark']"
```

## Type Safety

The generated `types.ts` exports a `Tailwind` interface that provides full type safety for both the generated constant and the runtime API:

```typescript
import type { Tailwind } from './generated/tailwindcss';

import { resolveTheme, tailwind } from './generated/tailwindcss';

// Generated constant - fully typed
tailwind.variants.default.colors.primary[500]; // ✓ Type-safe
tailwind.variants.dark.colors.background; // ✓ Type-safe
tailwind.selectors.dark; // ✓ Type-safe

// Runtime API - same structure, same types
const result = await resolveTheme<Tailwind>({
  input: './theme.css',
});

result.variants.default.colors.primary[500]; // ✓ Type-safe
result.variants.dark.colors.background; // ✓ Type-safe
result.selectors.dark; // ✓ Type-safe
```

Autocomplete works automatically when the output directory is in `tsconfig.json` includes.

## Debugging

Enable debug mode to see warnings for failed imports:

**Vite:**

```typescript
tailwindResolver({ input: 'src/styles.css', debug: true });
```

**CLI:**

```bash
bunx tailwind-resolver -i src/styles.css --debug
# or: pnpm exec / yarn / npx
```

**Runtime:**

```typescript
resolveTheme({ input: './theme.css', debug: true });
```

**Output:**

```
[Tailwind Theme Resolver] Failed to resolve import: ./components/theme.css
  Resolved path: /Users/you/project/src/components/theme.css
  Error: ENOENT: no such file or directory
```

Failed imports are silently skipped by design. Enable debug mode only when troubleshooting.

## Examples

### Chart.js

```typescript
import { tailwind } from './generated/tailwindcss';

new Chart(ctx, {
  data: {
    datasets: [
      {
        // Fully typed colors with autocomplete
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

// All properties are type-safe
ctx.fillStyle = defaultTheme.colors.background;
ctx.font = `${defaultTheme.fontSize.xl.size} ${defaultTheme.fonts.display}`;
```

### Dynamic Themes

```typescript
import { tailwind } from './generated/tailwindcss';

// Theme switching with full type safety
const currentTheme = isDark
  ? tailwind.variants.dark
  : tailwind.variants.default;
chartInstance.data.datasets[0].backgroundColor =
  currentTheme.colors.primary[500];
chartInstance.update();
```

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

## Requirements

- Node.js >= 18 or Bun >= 1.0
- TypeScript >= 5.0 (for type generation)
- Vite >= 5.0 (for Vite plugin)

## License

MIT

## Contributing

Issues and pull requests welcome on [GitHub](https://github.com/0xstern/tailwind-resolver).

## Support

If you find this helpful, follow me on X [@mrstern\_](https://x.com/mrstern_)
