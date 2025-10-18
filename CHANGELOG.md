# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Refactored

- **CLI Organization**: Restructured CLI into dedicated directory with comprehensive documentation
  - Moved `src/v4/cli.ts` → `src/v4/cli/index.ts` for better organization
  - Created `src/v4/cli/README.md` with complete CLI usage guide, examples, and troubleshooting
  - CLI and Vite plugin now have separate, focused READMEs in their respective directories
  - Documentation included in published package for better discoverability
- **Type Organization**: Moved shared types to appropriate locations
  - Moved `RuntimeGenerationOptions` from `src/v4/vite/plugin.ts` → `src/v4/types.ts`
  - Re-exported `RuntimeGenerationOptions` from Vite plugin for backward compatibility
  - Both CLI and Vite plugin now import from shared type definitions
  - Cleaner separation of concerns between implementation-specific and shared code

## [0.1.6] - 2025-01-18

### Changed

- **Breaking**: Removed `interfaceName` option - generated interface is always named `DefaultTheme` and `Tailwind`
  - Use TypeScript import aliasing if you need custom names: `import type { Tailwind as AppTheme } from './generated'`
  - Simplifies configuration and ensures consistency across projects
- **Breaking**: `generateRuntime` option now supports granular control
  - `true`: Generates variants and selectors (files and variables excluded by default for smaller bundles)
  - `false`: No runtime file (types only)
  - `object`: Full control over what gets generated (`variants`, `selectors`, `files`, `variables`)
  - **Migration**: `generateRuntime: true` now excludes `files` and `variables` by default (were previously included)
  - Production builds will have smaller bundles automatically
- **Breaking**: Renamed Vite plugin function from `tailwindThemeResolver` to `tailwindResolver` for consistency
- **Breaking**: API structure changed - `resolveTheme()` now returns `TailwindResult` with consistent structure:
  - `result.theme` → `result.variants.default` (base theme is now a variant)
  - `result.variants[name].theme` → `result.variants[name]` (direct access to variant themes)
  - `result.variants[name].selector` → `result.selectors[name]` (selectors in separate object)
- **Breaking**: Replaced module augmentation with explicit generic types
  - Before: Types augmented automatically, no generic needed
  - After: Pass `Tailwind` type explicitly: `resolveTheme<Tailwind>({ ... })`
- Generated `index.ts` now uses `export type *` instead of listing individual types
- Generated files structure changed:
  - `themes.d.ts` → `types.ts` (concrete TypeScript interfaces)
  - `themes.ts` → `theme.ts` (runtime objects)
  - Added `index.ts` for clean re-exports

### Added

- New `Tailwind` master interface that includes all result properties (variants, selectors, files, variables)
- Individual variant interfaces generated for each theme (e.g., `Dark`, `Midnight`)
- Full type consistency between generated code and runtime API
- Comprehensive type safety for all variants with autocomplete support
- Added `includeTailwindDefaults` option to Vite plugin for consistency with runtime API
  - Default: `true` (matches runtime behavior)
  - Set to `false` to exclude Tailwind CSS defaults from generated types
- Granular runtime generation control via `RuntimeGenerationOptions`
  - Control bundle size by selectively generating only what you need
  - Production-friendly defaults (exclude debug data like `files` and `variables`)
  - Full flexibility for development builds (include everything for debugging)

### Fixed

- Type generator now accepts both `TailwindResult` and `ParseResult` formats for backward compatibility
- All 198 tests passing (100% pass rate)
- Build process successfully generates both ESM and CJS formats
- Documentation restructured for clarity: Vite Plugin vs Runtime API sections clearly separated
- Nested variant combinations now properly supported (e.g., `[data-theme='compact'].dark`)
  - Variant name extraction now handles compound selectors on same element (joins with `.`)
  - Variable resolution includes parent variant variables for proper CSS cascade behavior
  - Descendant selectors (e.g., `.theme-default .theme-container`) only extract first part

## [0.1.5] - 2025-01-17

### Changed

- **Breaking**: Package renamed from `tailwind-theme-resolver` to `tailwind-resolver` (shorter, more general)
- **Breaking**: Repository URLs updated to match new package name
- **Breaking**: CLI command renamed from `tailwind-theme-resolver` to `tailwind-resolver`

### Migration Guide

For existing users of `tailwind-theme-resolver`:

```bash
# Uninstall old package
npm uninstall tailwind-theme-resolver

# Install new package
npm install tailwind-resolver

# Update imports (API is the same, just package name changed)
- import { resolveTheme } from 'tailwind-theme-resolver';
+ import { resolveTheme } from 'tailwind-resolver';

# CLI command name changed
- npx tailwind-theme-resolver --input theme.css
+ npx tailwind-resolver --input theme.css
```

## [0.1.4] - 2025-01-17

### Changed

- **Breaking**: Package renamed from `tailwind-theme-extractor` to `tailwind-theme-resolver`
- **Breaking**: Repository URLs updated to match new package name
- **Breaking**: CLI command renamed from `tailwind-theme-extractor` to `tailwind-theme-resolver`

### Migration Guide

For existing users of `tailwind-theme-extractor`:

```bash
# Uninstall old package
npm uninstall tailwind-theme-extractor

# Install new package
npm install tailwind-theme-resolver

# Update imports (API is the same, just package name changed)
- import { resolveTheme } from 'tailwind-theme-extractor';
+ import { resolveTheme } from 'tailwind-theme-resolver';

# CLI command name changed
- npx tailwind-theme-extractor --input theme.css
+ npx tailwind-theme-resolver --input theme.css
```

## [0.1.4-legacy] - 2025-01-17

### Fixed

- **Critical**: All CSS variables in the `variables` array are now fully resolved to their final values, fulfilling the library's core purpose of providing JavaScript-usable values where CSS `var()` references don't work
- CLI now correctly resolves Tailwind default theme colors and fonts by passing `basePath` from input file's directory
- Variable resolution now includes Tailwind defaults for `var()` references (e.g., `var(--color-blue-300)` resolves to `oklch(80.9% 0.105 251.813)`)
- Self-referential variables like `--font-sans: var(--font-sans)` are now skipped to allow Tailwind defaults to be used
- Reduced cyclomatic complexity in `theme-builder.ts` by extracting helper functions (`buildReferenceMap`, `groupVariantVariables`, `processReferencedVariable`, `processNamespacedVariable`)
- Variant variables now correctly resolve with their own variant context (e.g., `.dark` variant's `--spacing-lg: 1.5rem` correctly resolves in dark-specific calculations)
- Variant variables can now reference each other (e.g., `--level-2: var(--level-1)` within the same variant)

### Changed

- Added `basePath` parameter to `generateThemeFiles()` function for proper node_modules resolution
- CLI now derives `basePath` from input file's directory instead of `process.cwd()`
- Variable resolution now uses context-aware maps: base variables use base context, variant variables use variant-specific context (base + variant overrides)

### Added

- Comprehensive test suite for complex CSS functions with 37 new tests covering:
  - Ultra-complex nested functions: `calc(clamp(min(...), calc(...), max(...)))`
  - Multi-level nesting with all CSS functions at various depths
  - Deeply nested `var()` reference chains (4+ levels deep)
  - Negative values, mixed units (%, rem, vw, vh, px), and chained arithmetic operations
  - Multiple theme variants with proper variable resolution in each context

## [0.1.3] - 2025-10-17

### Fixed

- CLI execution error with "require is not defined in ES module scope" by using `.cjs` extension for CommonJS compatibility
- JSDoc comments now properly escape `@` symbols with backticks for correct LSP/IDE hints

### Changed

- **Breaking**: Renamed `filePath` parameter to `input` across all APIs for consistency
  - Runtime API: `resolveTheme({ input: './theme.css' })`
  - Vite plugin: Already used `input`, no change needed
  - CLI: Already used `--input`, no change needed
- Updated all documentation and examples to reflect consistent `input` naming

## [0.1.2] - 2025-10-17

### Fixed

- Reduced NPM package size from 659 kB to 137 kB (79% reduction) by excluding source maps from published package

## [0.1.1] - 2025-10-17

### Changed

- Updated `package.json` files array to explicitly exclude `*.map` files

## [0.1.0] - 2025-10-16

### Added

- GitHub Actions workflows for CI, automated linting/formatting (autofix.ci), and NPM publishing
- Comprehensive issue templates (bug reports, feature requests)
- Pull request template with quality checklist
- Security policy (SECURITY.md)
- Funding configuration with GitHub sponsors
- Installation commands for all package managers (Bun, pnpm, Yarn, npm)

### Changed

- Regenerated lockfile for consistency

## [0.1.0-beta.1] - 2025-10-16

### Added

#### Package Refactoring

- Renamed package from `tailwind-v4-theme-extractor` to `tailwind-theme-extractor`
- Implemented version-specific directory structure (`src/v4/`, `__tests__/v4/`, `examples/v4/`)
- Added versioned exports in package.json (`.`, `./v4`, `./v4/vite`, `./vite`)
- Future-proof architecture ready for Tailwind v5 support

#### Meta Variables Support

- Extract `--default-*` meta variables (e.g., `--default-transition-duration`)
- Store meta variables in `theme.defaults` namespace
- Full support for all Tailwind v4 default meta variables

#### Keyframes Extraction

- Extract `@keyframes` animations from CSS files
- Store keyframes in `theme.keyframes` namespace
- Preserve complete keyframe definitions for runtime use

#### Deprecation Warnings

- Detect deprecated singular variables (`--spacing`, `--blur`, etc.)
- Provide helpful migration suggestions in `deprecationWarnings` array
- Still extract deprecated variables with sensible default keys (`base`, `default`)

#### Vite Plugin Enhancements

- Auto-generated files now include strong "DO NOT EDIT" warnings
- Added source file tracking and timestamp in generated files
- Added ESLint and TypeScript disable directives (`@generated`, `@ts-nocheck`)
- Improved generated file headers following industry best practices

#### Code Quality

- Added test constants for magic numbers in compliance with ESLint rules
- Removed unnecessary type conditionals
- Zero ESLint warnings across entire codebase
- 106 passing tests with 100% feature coverage

### Changed

- **Breaking**: Package name changed to `tailwind-theme-extractor`
- **Breaking**: Repository URLs updated to match new package name
- Default import now points to v4 (will point to latest version when v5 releases)
- Examples moved to `examples/v4/` directory
- Tests moved to `__tests__/v4/` directory
- All documentation updated to reflect new structure

### Migration Guide

For existing users of `tailwind-v4-theme-extractor`:

```bash
# Update package name
npm uninstall tailwind-v4-theme-extractor
npm install tailwind-theme-extractor

# Update imports (default import remains the same)
import { resolveTheme } from 'tailwind-theme-extractor';

# Or use explicit v4 import to lock to v4
import { resolveTheme } from 'tailwind-theme-extractor/v4';

# Vite plugin imports
import tailwindTheme from 'tailwind-theme-extractor/vite';
// or
import tailwindTheme from 'tailwind-theme-extractor/v4/vite';
```

### Features

#### Core Functionality

- Parse theme variables from `@theme` blocks
- Parse theme variables from `:root` selectors
- Extract theme variants from selector-based rules
- Extract `@keyframes` animations
- Extract `--default-*` meta variables
- Resolve `@import` statements recursively
- Build structured theme objects matching Tailwind v4 namespaces
- Detect and warn about deprecated variable patterns
- Optional Tailwind default theme inclusion

#### Supported Namespaces

- Colors with scale support (50-900) and custom variants
- Spacing values
- Font families
- Font sizes with optional line heights
- Font weights
- Letter spacing (tracking)
- Line heights (leading)
- Breakpoints
- Container sizes
- Border radius
- Box shadows
- Inset shadows
- Drop shadows
- Text shadows
- Blur filters
- Perspective values
- Aspect ratios
- Easing functions
- Animations
- Default meta variables
- Keyframes animations

#### Variant Support

- Data attribute variants (`[data-theme='dark']`)
- Class-based variants (`.midnight`)
- Media query variants (`@media (prefers-color-scheme: dark)`)
- Multiple variant merging

#### Developer Experience

- Full TypeScript support with comprehensive type definitions
- Zero runtime dependencies (only PostCSS required for parsing)
- Smart color naming with camelCase conversion
- Vite plugin for automatic type generation
- Auto-generated files with clear warnings
- CommonJS and ES Module bundle formats
- Comprehensive test suite with 106 tests
- Complete API documentation and usage examples

[0.1.0-beta.1]: https://github.com/0xstern/tailwind-theme-extractor/releases/tag/v0.1.0-beta.1
