# Tailwind Theme Resolver

Resolve Tailwind CSS v4 theme variables into TypeScript types and runtime objects.

<p>
    <a href="https://github.com/0xstern/tailwind-resolver/actions"><img src="https://img.shields.io/github/actions/workflow/status/0xstern/tailwind-resolver/ci.yml?branch=main" alt="Build Status"></a>
    <a href="https://github.com/0xstern/tailwind-resolver/releases"><img src="https://img.shields.io/npm/v/tailwind-resolver.svg" alt="Latest Release"></a>
    <a href="https://github.com/0xstern/tailwind-resolver/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/tailwind-resolver.svg" alt="License"></a>
    <a href="https://twitter.com/mrstern_"><img alt="X (formerly Twitter) Follow" src="https://img.shields.io/twitter/follow/mrstern_.svg?style=social"></a>
</p>

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
      // - true: Generate variants and selectors (optimized for production, excludes debug data)
      // - object: Granular control - set files/variables to true for debugging
      // Default: true
      generateRuntime: {
        variants: true, // Theme variants (default, dark, etc.)
        selectors: true, // CSS selectors for variants
        files: false, // Processed file list (debug only)
        variables: false, // Raw CSS variables (debug only)
        reports: {
          conflicts: true, // Generate CSS conflict reports (default: true)
          unresolved: true, // Generate unresolved variable reports (default: true)
        },
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
- `conflicts.md` - Human-readable conflict report (if CSS conflicts detected)
- `conflicts.json` - Machine-readable conflict report (if CSS conflicts detected)

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
- `--reports` - Generate diagnostic reports (default: true)
- `--no-reports` - Skip all diagnostic reports
- `--no-conflict-reports` - Skip CSS conflict reports only
- `--no-unresolved-reports` - Skip unresolved variable reports only
- `-d, --debug` - Enable debug mode (logging + include debug data in runtime)
- `-h, --help` - Show help

## Theme Structure

```typescript
{
  colors: {},           // --color-*
  spacing: {},          // --spacing-* (callable: spacing(4) → 'calc(0.25rem * 4)')
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

### Dynamic Spacing Helper

The `spacing` property is special - it's both an object with static values AND a callable function for dynamic calculations:

```typescript
import { defaultTheme, dark } from './generated/tailwindcss';

// Static spacing values (defined in your CSS)
defaultTheme.spacing.xs;      // '0.75rem'
defaultTheme.spacing.base;    // '0.25rem'

// Dynamic spacing calculations (matches Tailwind's behavior)
defaultTheme.spacing(4);      // 'calc(0.25rem * 4)' → 1rem
defaultTheme.spacing(16);     // 'calc(0.25rem * 16)' → 4rem
defaultTheme.spacing(-2);     // 'calc(0.25rem * -2)' → -0.5rem

// Use in styles
<div style={{
  padding: defaultTheme.spacing(4),        // Same as Tailwind's p-4
  margin: defaultTheme.spacing(-2),        // Same as Tailwind's -m-2
  width: defaultTheme.spacing(64),         // Same as Tailwind's w-64
  gap: defaultTheme.spacing(2),            // Same as Tailwind's gap-2
}} />

// Works with all variants
dark.spacing(8);              // Uses dark theme's spacing base (or falls back to default)
```

**Why this exists:** Tailwind generates utilities like `p-4`, `m-8`, `w-16` using `calc(var(--spacing) * N)`. This helper replicates that behavior for runtime use.

**Tailwind utilities that use spacing calculations:**

- `inset-<n>`, `m-<n>`, `p-<n>`, `gap-<n>`
- `w-<n>`, `h-<n>`, `min-w-<n>`, `max-w-<n>`, `min-h-<n>`, `max-h-<n>`
- `indent-<n>`, `border-spacing-<n>`, `scroll-m-<n>`

**Note:** If your theme doesn't define `--spacing-base`, the spacing helper won't be generated. Define spacing in your CSS to enable this feature.

> **Other CSS variables:** Tailwind uses different CSS variables for different utilities:
>
> - Layout properties like `columns` and `flex-basis` use `--container-*` values
> - Transform properties like `translate-x` and `translate-y` use `--tw-translate-*` variables
> - Animation properties use `--default-*` meta variables
>
> For a complete list of which CSS variables Tailwind uses for each utility, refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs).

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

## Report Generation

The resolver can generate diagnostic reports to help you understand and troubleshoot your theme configuration.

### Controlling Report Generation

Reports are enabled by default but can be controlled via configuration:

**Vite Plugin:**

```typescript
tailwindResolver({
  input: 'src/styles.css',
  generateRuntime: {
    reports: false, // Disable all reports
  },
});

// Or granular control
tailwindResolver({
  input: 'src/styles.css',
  generateRuntime: {
    reports: {
      conflicts: true, // Enable conflict reports
      unresolved: false, // Disable unresolved variable reports
    },
  },
});
```

**CLI:**

```bash
# Disable all reports
bunx tailwind-resolver -i src/styles.css --no-reports

# Disable only conflict reports
bunx tailwind-resolver -i src/styles.css --no-conflict-reports

# Disable only unresolved variable reports
bunx tailwind-resolver -i src/styles.css --no-unresolved-reports
```

## CSS Conflict Detection

The resolver automatically detects when CSS rules override CSS variables and ensures the runtime theme object matches actual rendered styles.

### Problem

Real-world CSS files often contain both CSS variables AND direct CSS rules:

```css
.theme-mono {
  --radius-lg: 0.45em; /* CSS variable */

  .rounded-lg {
    border-radius: 0; /* CSS rule - overrides the variable! */
  }
}
```

Without detection, the runtime theme would incorrectly report `radius.lg: "0.45em"` when the actual rendered value is `"0"`.

### Solution

The resolver:

1. **Detects all conflicts** between CSS rules and variables
2. **Applies high-confidence overrides** automatically for simple cases
3. **Reports complex cases** in `conflicts.md` for manual review

### Conflict Reports

When conflicts are detected, two report files are generated:

**`conflicts.md`** - Human-readable report with:

- Summary of total/resolved/pending conflicts
- Auto-resolved conflicts (applied to theme)
- Conflicts requiring manual review
- Context-specific recommendations

**`conflicts.json`** - Machine-readable format for CI/CD integration

### Terminal Output

Non-intrusive single-line notification:

```
✓ Theme types generated successfully

Generated files:
  - src/generated/tailwindcss/types.ts
  - src/generated/tailwindcss/theme.ts
  - src/generated/tailwindcss/index.ts

⚠  12 CSS conflicts detected (see src/generated/tailwindcss/conflicts.md)
```

### Confidence Levels

**High Confidence** (auto-applied):

- Static values (e.g., `border-radius: 0`)
- No pseudo-classes or media queries
- Simple selectors

**Medium/Low Confidence** (manual review):

- Dynamic values (e.g., `calc()`, `var()`)
- Pseudo-classes (`:hover`, `:focus`)
- Media query nesting
- Complex selectors

High-confidence overrides ensure your runtime theme matches actual rendered styles.

## Unresolved Variable Detection

The resolver automatically detects CSS variables with `var()` references that couldn't be resolved, helping identify variables requiring external injection or definition.

### Problem

Real-world CSS often references variables injected at runtime or provided externally:

```css
@theme {
  --font-sans: var(--font-inter); /* Injected by Next.js */
  --color-accent: var(--tw-primary); /* Tailwind plugin variable */
}
```

### Solution

The resolver:

1. **Detects unresolved `var()` references** after variable resolution
2. **Categorizes by likely cause** (external, self-referential, unknown)
3. **Generates detailed reports** in `unresolved.md` and `unresolved.json`

### Unresolved Variable Reports

When unresolved variables are detected, two report files are generated:

**`unresolved.md`** - Human-readable report with:

- Summary of total unresolved variables by cause
- Detailed list grouped by cause with context (variable name, source, selector)
- Actionable recommendations for each category
- Fallback values if specified

**`unresolved.json`** - Machine-readable format for CI/CD integration

### Terminal Output

```
ℹ  8 unresolved variables detected (see src/generated/tailwindcss/unresolved.md)
```

### Variable Categories

**Unknown** - Variables requiring review:

- May need to be defined in your theme
- Or verified to be loaded externally

**External** - Variables from external sources:

- Tailwind plugins (detected by `--tw-*` prefix)
- Runtime injection (Next.js fonts, framework variables)
- External stylesheets

**Self-referential** - Variables intentionally left unresolved:

- Variables like `--font-sans: var(--font-sans)`
- Intentionally skipped to use Tailwind defaults

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
