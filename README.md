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

### Vite Plugin

```typescript
// vite.config.ts

import { tailwindThemeResolver } from 'tailwind-resolver/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindThemeResolver({
      input: 'src/styles.css',
    }),
  ],
});
```

Generates in `src/generated/tailwindcss/`:

- `themes.d.ts` - TypeScript declarations
- `themes.ts` - Runtime theme objects
- `index.ts` - Re-exports

**Usage:**

```typescript
import { base, dark, selectors } from './generated/tailwindcss';

const chart = new Chart(ctx, {
  data: {
    datasets: [
      {
        backgroundColor: [base.colors.primary[500], base.colors.secondary[500]],
      },
    ],
  },
});
```

### CLI

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

### Runtime API

```typescript
import { resolveTheme } from 'tailwind-resolver';

const { theme, variants } = await resolveTheme({
  input: './src/styles.css',
});

console.log(theme.colors.primary[500]);
console.log(variants.dark.theme.colors.background);
```

## Configuration

### Vite Plugin Options

```typescript
interface VitePluginOptions {
  input: string; // CSS input file (required)
  outputDir?: string; // Output directory
  resolveImports?: boolean; // Resolve @import statements (default: true)
  generateRuntime?: boolean; // Generate runtime objects (default: true)
  interfaceName?: string; // Interface name (default: 'GeneratedTheme')
  debug?: boolean; // Debug logging (default: false)
}
```

### ParseOptions (Runtime API)

```typescript
interface ParseOptions {
  input?: string; // CSS file path
  css?: string; // Raw CSS content (alternative to input)
  basePath?: string; // Base path for @import resolution (when using css)
  resolveImports?: boolean; // Resolve @import statements (default: true)
  includeTailwindDefaults?: boolean; // Include Tailwind defaults (default: true)
  debug?: boolean; // Debug logging (default: false)
}
```

### ParseResult

```typescript
interface ParseResult {
  theme: Theme; // Base theme
  variants: Record<string, ThemeVariant>; // Theme variants (dark, etc.)
  variables: Array<CSSVariable>; // Raw CSS variables
  deprecationWarnings: Array<DeprecationWarning>; // Warnings
  files: Array<string>; // Processed files
}
```

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
import { base, dark, selectors } from './generated/tailwindcss';

console.log(base.colors.background); // '#ffffff'
console.log(dark.colors.background); // '#1f2937'
console.log(selectors.dark); // "[data-theme='dark']"
```

## Type Safety

The generated `themes.d.ts` uses module augmentation to provide autocomplete for `resolveTheme()`:

```typescript
declare module 'tailwind-resolver' {
  interface Theme extends GeneratedTheme {}
}
```

Autocomplete works automatically when the output directory is in `tsconfig.json` includes.

## Debugging

Enable debug mode to see warnings for failed imports:

**Vite:**

```typescript
tailwindThemeResolver({ input: 'src/styles.css', debug: true });
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
import { base } from './generated/tailwindcss';

new Chart(ctx, {
  data: {
    datasets: [
      {
        backgroundColor: [base.colors.primary[500], base.colors.secondary[500]],
      },
    ],
  },
});
```

### Canvas

```typescript
import { base } from './generated/tailwindcss';

ctx.fillStyle = base.colors.background;
ctx.font = `${base.fontSize.xl.size} ${base.fonts.display}`;
```

### Dynamic Themes

```typescript
import { base, dark } from './generated/tailwindcss';

const theme = isDark ? dark : base;
chartInstance.data.datasets[0].backgroundColor = theme.colors.primary[500];
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
