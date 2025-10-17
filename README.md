# Tailwind Theme Extractor

Extract Tailwind CSS v4 theme variables into TypeScript types and runtime objects.

## Installation

```bash
# Bun
bun add -D tailwind-theme-extractor

# pnpm
pnpm add -D tailwind-theme-extractor

# Yarn
yarn add -D tailwind-theme-extractor

# npm
npm install -D tailwind-theme-extractor
```

## Usage

### Vite Plugin

```typescript
// vite.config.ts

import { tailwindThemeExtractor } from 'tailwind-theme-extractor/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindThemeExtractor({
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
bunx tailwind-theme-extractor -i src/styles.css

# pnpm
pnpm exec tailwind-theme-extractor -i src/styles.css

# Yarn
yarn tailwind-theme-extractor -i src/styles.css

# npm
npx tailwind-theme-extractor -i src/styles.css
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
import { extractTheme } from 'tailwind-theme-extractor';

const { theme, variants } = await extractTheme({
  filePath: './src/styles.css',
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
  filePath?: string; // CSS file path
  css?: string; // Raw CSS content
  basePath?: string; // Base path for @import resolution
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

The generated `themes.d.ts` uses module augmentation to provide autocomplete for `extractTheme()`:

```typescript
declare module 'tailwind-theme-extractor' {
  interface Theme extends GeneratedTheme {}
}
```

Autocomplete works automatically when the output directory is in `tsconfig.json` includes.

## Debugging

Enable debug mode to see warnings for failed imports:

**Vite:**

```typescript
tailwindThemeExtractor({ input: 'src/styles.css', debug: true });
```

**CLI:**

```bash
bunx tailwind-theme-extractor -i src/styles.css --debug
# or: pnpm exec / yarn / npx
```

**Runtime:**

```typescript
extractTheme({ filePath: './theme.css', debug: true });
```

**Output:**

```
[Tailwind Theme Extractor] Failed to resolve import: ./components/theme.css
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

Issues and pull requests welcome on [GitHub](https://github.com/0xstern/tailwind-theme-extractor).

## Support

If you find this helpful, follow me on X [@mrstern\_](https://x.com/mrstern_)
