/**
 * Core types for the Tailwind v4 theme resolver
 */

/**
 * Represents a color scale with variants (can be numeric or string keys)
 * Examples:
 * - { 50: '...', 100: '...', 500: '...' }
 * - { '500-hover': '...', '600-active': '...' }
 */
export type ColorScale = Record<string | number, string>;

/**
 * Represents all color definitions in the theme
 */
export interface ThemeColors {
  [key: string]: string | ColorScale;
}

/**
 * Represents spacing values in the theme
 */
export interface ThemeSpacing {
  [key: string]: string;
}

/**
 * Represents font family definitions
 */
export interface ThemeFonts {
  [key: string]: string;
}

/**
 * Represents font size definitions with optional line heights
 */
export interface ThemeFontSizes {
  [key: string]: {
    size: string;
    lineHeight?: string;
  };
}

/**
 * Represents font weight definitions
 */
export interface ThemeFontWeights {
  [key: string]: string | number;
}

/**
 * Represents letter spacing (tracking) definitions
 */
export interface ThemeTracking {
  [key: string]: string;
}

/**
 * Represents line height (leading) definitions
 */
export interface ThemeLeading {
  [key: string]: string | number;
}

/**
 * Represents breakpoint definitions
 */
export interface ThemeBreakpoints {
  [key: string]: string;
}

/**
 * Represents container size definitions
 */
export interface ThemeContainers {
  [key: string]: string;
}

/**
 * Represents border radius definitions
 */
export interface ThemeRadius {
  [key: string]: string;
}

/**
 * Represents box shadow definitions
 */
export interface ThemeShadows {
  [key: string]: string;
}

/**
 * Represents inset shadow definitions
 */
export interface ThemeInsetShadows {
  [key: string]: string;
}

/**
 * Represents drop shadow definitions
 */
export interface ThemeDropShadows {
  [key: string]: string;
}

/**
 * Represents text shadow definitions
 */
export interface ThemeTextShadows {
  [key: string]: string;
}

/**
 * Represents blur definitions
 */
export interface ThemeBlur {
  [key: string]: string;
}

/**
 * Represents perspective definitions
 */
export interface ThemePerspective {
  [key: string]: string;
}

/**
 * Represents aspect ratio definitions
 */
export interface ThemeAspect {
  [key: string]: string;
}

/**
 * Represents easing function definitions
 */
export interface ThemeEase {
  [key: string]: string;
}

/**
 * Represents animation definitions
 */
export interface ThemeAnimations {
  [key: string]: string;
}

/**
 * Represents meta/default variables (--default-*)
 */
export interface ThemeDefaults {
  [key: string]: string;
}

/**
 * Represents resolved `@keyframes` rules
 */
export interface ThemeKeyframes {
  [key: string]: string;
}

/**
 * Complete theme structure matching Tailwind v4 namespaces
 */
export interface Theme {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  fonts: ThemeFonts;
  fontSize: ThemeFontSizes;
  fontWeight: ThemeFontWeights;
  tracking: ThemeTracking;
  leading: ThemeLeading;
  breakpoints: ThemeBreakpoints;
  containers: ThemeContainers;
  radius: ThemeRadius;
  shadows: ThemeShadows;
  insetShadows: ThemeInsetShadows;
  dropShadows: ThemeDropShadows;
  textShadows: ThemeTextShadows;
  blur: ThemeBlur;
  perspective: ThemePerspective;
  aspect: ThemeAspect;
  ease: ThemeEase;
  animations: ThemeAnimations;
  defaults: ThemeDefaults;
  keyframes: ThemeKeyframes;
}

/**
 * Raw CSS variable resolved from parsing
 */
export interface CSSVariable {
  name: string;
  value: string;
  source: 'theme' | 'root' | 'variant';
  /**
   * For variant source: the CSS selector that activates this variant
   * Examples: '[data-theme="dark"]', '.midnight', '`@media` (prefers-color-scheme: dark)'
   */
  selector?: string;
  /**
   * For variant source: the resolved variant name
   * Examples: 'dark', 'blue', 'midnight'
   */
  variantName?: string;
}

/**
 * Options for controlling which Tailwind defaults to include
 *
 * When includeDefaults is an object, you can selectively include
 * specific categories from Tailwind's default theme. This is useful when
 * you want to use only certain Tailwind defaults while completely replacing others.
 *
 * @example
 * ```typescript
 * // Include only colors and spacing from Tailwind defaults
 * {
 *   colors: true,      // Include default Tailwind colors
 *   spacing: true,     // Include default Tailwind spacing
 *   shadows: false,    // Don't include default shadows
 *   fonts: false       // Don't include default font families
 * }
 *
 * // Include only typography-related defaults
 * {
 *   fontSize: true,
 *   fontWeight: true,
 *   fonts: true,
 *   leading: true,
 *   tracking: true,
 *   colors: false,
 *   spacing: false
 * }
 *
 * // Include everything except animations and keyframes
 * {
 *   colors: true,
 *   spacing: true,
 *   fonts: true,
 *   fontSize: true,
 *   fontWeight: true,
 *   tracking: true,
 *   leading: true,
 *   breakpoints: true,
 *   containers: true,
 *   radius: true,
 *   shadows: true,
 *   insetShadows: true,
 *   dropShadows: true,
 *   textShadows: true,
 *   blur: true,
 *   perspective: true,
 *   aspect: true,
 *   ease: true,
 *   animations: false,  // Exclude animations
 *   keyframes: false,   // Exclude keyframes
 *   defaults: true
 * }
 *
 * // Minimal: only include colors
 * {
 *   colors: true
 * }
 * ```
 */
export interface TailwindDefaultsOptions {
  /**
   * Include default color definitions
   * @default true
   */
  colors?: boolean;

  /**
   * Include default spacing scale
   * @default true
   */
  spacing?: boolean;

  /**
   * Include default font families
   * @default true
   */
  fonts?: boolean;

  /**
   * Include default font sizes
   * @default true
   */
  fontSize?: boolean;

  /**
   * Include default font weights
   * @default true
   */
  fontWeight?: boolean;

  /**
   * Include default letter spacing (tracking)
   * @default true
   */
  tracking?: boolean;

  /**
   * Include default line heights (leading)
   * @default true
   */
  leading?: boolean;

  /**
   * Include default breakpoints
   * @default true
   */
  breakpoints?: boolean;

  /**
   * Include default container sizes
   * @default true
   */
  containers?: boolean;

  /**
   * Include default border radius values
   * @default true
   */
  radius?: boolean;

  /**
   * Include default box shadows
   * @default true
   */
  shadows?: boolean;

  /**
   * Include default inset shadows
   * @default true
   */
  insetShadows?: boolean;

  /**
   * Include default drop shadows
   * @default true
   */
  dropShadows?: boolean;

  /**
   * Include default text shadows
   * @default true
   */
  textShadows?: boolean;

  /**
   * Include default blur values
   * @default true
   */
  blur?: boolean;

  /**
   * Include default perspective values
   * @default true
   */
  perspective?: boolean;

  /**
   * Include default aspect ratios
   * @default true
   */
  aspect?: boolean;

  /**
   * Include default easing functions
   * @default true
   */
  ease?: boolean;

  /**
   * Include default animations
   * @default true
   */
  animations?: boolean;

  /**
   * Include default meta/default variables (--default-*)
   * @default true
   */
  defaults?: boolean;

  /**
   * Include default keyframes
   * @default true
   */
  keyframes?: boolean;
}

/**
 * Configuration for controlling nesting behavior when parsing CSS variable keys
 *
 * Controls how CSS variable keys with dashes are parsed into nested structures.
 *
 * @example
 * ```typescript
 * // Unlimited nesting (default)
 * { maxDepth: Infinity }
 * // --color-tooltip-outline-50 → colors.tooltip.outline[50]
 *
 * // Limit to 2 levels with camelCase flattening (default)
 * { maxDepth: 2 }
 * // --color-tooltip-outline-50 → colors.tooltip.outline50
 *
 * // Limit to 2 levels with literal flattening
 * { maxDepth: 2, flattenMode: 'literal' }
 * // --color-tooltip-outline-50 → colors.tooltip['outline-50']
 *
 * // Handle consecutive dashes
 * { consecutiveDashes: 'camelcase' }
 * // --color-button--primary → colors.buttonPrimary
 *
 * { consecutiveDashes: 'exclude' }
 * // --color-button--primary → Not included in theme at all
 * ```
 */
export interface NestingConfig {
  /**
   * Maximum nesting depth in the result structure
   * @default Infinity (unlimited nesting)
   *
   * Controls how many levels of nesting to create in the result object.
   * After reaching maxDepth, remaining parts are flattened according to flattenMode.
   *
   * @example
   * ```typescript
   * // maxDepth: 0 → 0 nesting levels (completely flat)
   * // --color-blue-sky-50 → colors.blueSky50
   *
   * // maxDepth: 1 → 1 nesting level (one object with final key)
   * // --color-blue-50 → colors.blue['50']
   * // --color-blue-sky-50 → colors.blue.sky50 (with flattenMode: 'camelcase')
   *
   * // maxDepth: 2 → 2 nesting levels (two nested objects with final key)
   * // --color-blue-sky-50 → colors.blue.sky['50']
   * // --color-blue-sky-light-50 → colors.blue.sky.light50 (with flattenMode: 'camelcase')
   *
   * // maxDepth: Infinity → unlimited nesting (default)
   * // --color-blue-sky-light-50 → colors.blue.sky.light['50']
   * ```
   */
  maxDepth?: number;

  /**
   * How to handle variables with consecutive dashes (e.g., button--primary)
   * @default 'exclude' (matches Tailwind v4 behavior)
   *
   * @example
   * ```typescript
   * // consecutiveDashes: 'exclude' (DEFAULT - matches Tailwind)
   * // --color-button--primary → Not parsed, excluded from theme
   *
   * // consecutiveDashes: 'nest'
   * // --color-button--primary → colors.button.primary (-- treated as single -)
   *
   * // consecutiveDashes: 'camelcase'
   * // --color-button--primary → colors.buttonPrimary (-- as camelCase boundary)
   *
   * // consecutiveDashes: 'literal'
   * // --color-button--primary → colors['button-'].primary (dash preserved)
   * ```
   */
  consecutiveDashes?: 'exclude' | 'nest' | 'camelcase' | 'literal';

  /**
   * How to flatten remaining parts after maxDepth is reached
   * @default 'camelcase' (maintains backward compatibility)
   *
   * This option only applies when maxDepth is set and reached.
   *
   * @example
   * ```typescript
   * // flattenMode: 'camelcase' (DEFAULT - maintains backward compatibility)
   * // --color-blue-sky-light-50 with maxDepth: 2 → colors.blue.skyLight50
   *
   * // flattenMode: 'literal'
   * // --color-blue-sky-light-50 with maxDepth: 2 → colors.blue['sky-light-50']
   * ```
   */
  flattenMode?: 'camelcase' | 'literal';

  /**
   * Custom regex pattern for advanced parsing (future extension)
   * @experimental Not yet implemented
   */
  pattern?: RegExp;
}

/**
 * Per-namespace nesting configuration options
 *
 * Allows different nesting behavior for different CSS variable namespaces.
 * The 'default' configuration applies to all namespaces unless overridden.
 *
 * @example
 * ```typescript
 * // Basic: Set max depth for all namespaces
 * {
 *   default: { maxDepth: 1 }
 * }
 *
 * // Per-namespace configuration
 * {
 *   default: { maxDepth: 1 },           // All namespaces: flatten after 1 level
 *   colors: { maxDepth: 3 },            // Colors: allow 3 levels of nesting
 *   shadows: { maxDepth: Infinity },    // Shadows: unlimited nesting
 *   spacing: { maxDepth: 1 }            // Spacing: flat structure
 * }
 *
 * // Complete configuration with all options
 * {
 *   default: {
 *     maxDepth: 0,                      // Completely flat
 *     flattenMode: 'camelcase',         // Use camelCase for flattened keys
 *     consecutiveDashes: 'exclude'      // Skip variables with -- (matches Tailwind v4)
 *   },
 *   colors: {
 *     maxDepth: 2,                      // 2 levels: colors.blue.sky['50']
 *     flattenMode: 'literal',           // Use kebab-case for remaining parts
 *     consecutiveDashes: 'nest'         // Treat -- as single -
 *   }
 * }
 *
 * // Flatten mode comparison
 * {
 *   // With flattenMode: 'camelcase' (default)
 *   // --color-blue-sky-light-50 → colors.blue.skyLight50
 *   colors: { maxDepth: 2, flattenMode: 'camelcase' }
 *
 *   // With flattenMode: 'literal'
 *   // --color-blue-sky-light-50 → colors.blue['sky-light-50']
 *   // colors: { maxDepth: 2, flattenMode: 'literal' }
 * }
 *
 * // Consecutive dashes handling
 * {
 *   colors: {
 *     consecutiveDashes: 'exclude',     // --color-button--primary → excluded
 *     // consecutiveDashes: 'nest',     // --color-button--primary → colors.button.primary
 *     // consecutiveDashes: 'camelcase',// --color-button--primary → colors.buttonPrimary
 *     // consecutiveDashes: 'literal',  // --color-button--primary → colors['button-'].primary
 *   }
 * }
 * ```
 */
export interface NestingOptions {
  /**
   * Default nesting config applied to all namespaces unless overridden
   */
  default?: NestingConfig;

  /**
   * Nesting config for color variables (--color-*)
   */
  colors?: NestingConfig;

  /**
   * Nesting config for shadow variables (--shadow-*)
   */
  shadows?: NestingConfig;

  /**
   * Nesting config for inset shadow variables (--inset-shadow-*)
   */
  insetShadows?: NestingConfig;

  /**
   * Nesting config for drop shadow variables (--drop-shadow-*)
   */
  dropShadows?: NestingConfig;

  /**
   * Nesting config for text shadow variables (--text-shadow-*)
   */
  textShadows?: NestingConfig;

  /**
   * Nesting config for spacing variables (--spacing-*)
   */
  spacing?: NestingConfig;

  /**
   * Nesting config for radius variables (--radius-*)
   */
  radius?: NestingConfig;

  /**
   * Nesting config for blur variables (--blur-*)
   */
  blur?: NestingConfig;

  /**
   * Nesting config for perspective variables (--perspective-*)
   */
  perspective?: NestingConfig;

  /**
   * Nesting config for aspect ratio variables (--aspect-*)
   */
  aspect?: NestingConfig;

  /**
   * Nesting config for easing variables (--ease-*)
   */
  ease?: NestingConfig;

  /**
   * Nesting config for animation variables (--animate-*)
   */
  animations?: NestingConfig;

  /**
   * Nesting config for font variables (--font-*)
   */
  fonts?: NestingConfig;

  /**
   * Nesting config for font size variables (--text-*)
   */
  fontSize?: NestingConfig;

  /**
   * Nesting config for font weight variables (--font-weight-*)
   */
  fontWeight?: NestingConfig;

  /**
   * Nesting config for tracking variables (--tracking-*)
   */
  tracking?: NestingConfig;

  /**
   * Nesting config for leading variables (--leading-*)
   */
  leading?: NestingConfig;

  /**
   * Nesting config for breakpoint variables (--breakpoint-*)
   */
  breakpoints?: NestingConfig;

  /**
   * Nesting config for container variables (--container-*)
   */
  containers?: NestingConfig;

  /**
   * Nesting config for default variables (--default-*)
   */
  defaults?: NestingConfig;
}

/**
 * Options for controlling report generation
 *
 * @example
 * ```typescript
 * // Generate all reports (default)
 * {
 *   conflicts: true,
 *   unresolved: true
 * }
 *
 * // Only generate conflict reports
 * {
 *   conflicts: true,
 *   unresolved: false
 * }
 *
 * // Only generate unresolved variable reports
 * {
 *   conflicts: false,
 *   unresolved: true
 * }
 *
 * // Skip all reports
 * {
 *   conflicts: false,
 *   unresolved: false
 * }
 * ```
 */
export interface ReportGenerationOptions {
  /**
   * Generate CSS conflict reports (conflicts.md and conflicts.json)
   * Reports CSS rules that override CSS variables
   * @default true
   */
  conflicts?: boolean;

  /**
   * Generate unresolved variable reports (unresolved.md and unresolved.json)
   * Reports var() references that could not be resolved
   * @default true
   */
  unresolved?: boolean;
}

/**
 * Options for controlling what gets generated in runtime files
 *
 * @example
 * ```typescript
 * // Production build (minimal bundle, no debug data)
 * {
 *   variants: true,    // Include theme variants
 *   selectors: true,   // Include CSS selectors
 *   files: false,      // Exclude file list (reduces bundle size)
 *   variables: false,  // Exclude raw variables (reduces bundle size)
 *   reports: true      // Generate diagnostic reports
 * }
 *
 * // Development build (include everything for debugging)
 * {
 *   variants: true,
 *   selectors: true,
 *   files: true,       // Include for debugging
 *   variables: true,   // Include for debugging
 *   reports: true
 * }
 *
 * // Minimal build (only theme data, no extras)
 * {
 *   variants: true,
 *   selectors: false,
 *   files: false,
 *   variables: false,
 *   reports: false
 * }
 *
 * // Granular report control
 * {
 *   variants: true,
 *   selectors: true,
 *   reports: {
 *     conflicts: true,    // Generate CSS conflict reports
 *     unresolved: false   // Skip unresolved variable reports
 *   }
 * }
 *
 * // Disable all reports
 * {
 *   variants: true,
 *   selectors: true,
 *   reports: false        // No diagnostic reports generated
 * }
 * ```
 */
export interface RuntimeGenerationOptions {
  /**
   * Generate theme variants (default, dark, custom themes)
   * This is typically the main data you need for runtime theme access
   * @default true
   */
  variants?: boolean;

  /**
   * Generate CSS selectors for each variant
   * Useful for dynamic theme switching
   * @default true
   */
  selectors?: boolean;

  /**
   * Generate list of processed CSS files
   * Useful for debugging, rarely needed in production
   * @default false
   */
  files?: boolean;

  /**
   * Generate raw CSS variables with metadata
   * Useful for debugging, rarely needed in production
   * @default false
   */
  variables?: boolean;

  /**
   * Control generation of diagnostic reports
   * - `true`: Generate all reports (conflicts.md, unresolved.md, and JSON versions)
   * - `false`: Skip all report generation
   * - Object: Granular control over which reports to generate
   * @default { conflicts: true, unresolved: true }
   */
  reports?: boolean | ReportGenerationOptions;
}

/**
 * Represents the value for an override entry
 * Can be a simple string value or a detailed override with options
 */
export type OverrideValue =
  | string
  | {
      /**
       * The value to override with
       */
      value: string;
      /**
       * Apply this override even for low-confidence conflicts
       * Only applicable for conflict overrides
       * @default false
       */
      force?: boolean;
      /**
       * Whether to resolve var() references in this value
       * @default true
       */
      resolveVars?: boolean;
    };

/**
 * Override configuration for a single variant/selector
 *
 * @example
 * ```typescript
 * // Flat notation
 * { 'colors.primary.500': '#ff0000' }
 *
 * // Nested notation
 * { colors: { primary: { 500: '#ff0000' } } }
 *
 * // Detailed control
 * { 'radius.lg': { value: '0', force: true } }
 * ```
 */
export type OverrideConfig =
  | Record<string, OverrideValue>
  | Record<
      string,
      Record<string, OverrideValue | Record<string, OverrideValue>>
    >;

/**
 * Override options for theme values
 *
 * Supports variant names ('dark', 'compact'), CSS selectors ('[data-theme="dark"]'),
 * and special keys ('*' for all, 'default' for base theme)
 *
 * @example
 * ```typescript
 * {
 *   // Apply to all variants
 *   '*': { 'fonts.sans': 'Inter, sans-serif' },
 *
 *   // Apply to specific variant (by name)
 *   'dark': { 'colors.background': '#000' },
 *
 *   // Apply to specific variant (by selector)
 *   '[data-theme="compact"]': { 'radius.lg': '0' },
 *
 *   // Apply to default/base theme
 *   'default': { 'colors.primary.500': '#custom' }
 * }
 * ```
 */
export interface OverrideOptions {
  [selectorOrVariant: string]: OverrideConfig;
}

/**
 * Shared configuration options for theme parsing and resolution
 *
 * These options are common to both runtime parsing (ParseOptions) and
 * build-time generation (VitePluginOptions).
 */
export interface SharedThemeOptions {
  /**
   * Whether to resolve `@import` statements recursively
   * @default true
   */
  resolveImports?: boolean;
  /**
   * Control inclusion of Tailwind's default theme
   *
   * - `true`: Include all Tailwind defaults (default behavior)
   * - `false`: Don't include any Tailwind defaults
   * - Object: Selectively include specific categories
   *
   * When enabled, resolves tailwindcss/theme.css from node_modules and merges with user theme.
   * Use an object to granularly control which theme categories to include from Tailwind defaults.
   *
   * @default true
   *
   * @example
   * ```typescript
   * // Include all defaults (default)
   * { includeDefaults: true }
   *
   * // Don't include any defaults
   * { includeDefaults: false }
   *
   * // Include only colors and spacing from Tailwind defaults
   * {
   *   includeDefaults: {
   *     colors: true,
   *     spacing: true,
   *     shadows: false,
   *     fonts: false
   *   }
   * }
   * ```
   */
  includeDefaults?: boolean | TailwindDefaultsOptions;
  /**
   * Enable debug logging for troubleshooting
   * When true, logs warnings for failed import resolution and other parsing issues
   * @default false
   */
  debug?: boolean;
  /**
   * Theme value overrides
   * Apply custom overrides to theme values for specific variants or globally
   * Supports flat notation, nested notation, and detailed control with force/resolveVars flags
   * @default undefined
   *
   * @example
   * ```typescript
   * // Basic: Apply to all variants
   * {
   *   overrides: {
   *     '*': { 'fonts.sans': 'Inter, sans-serif' }
   *   }
   * }
   *
   * // Per-variant overrides
   * {
   *   overrides: {
   *     'dark': { 'colors.background': '#000' },
   *     'default': { 'colors.primary.500': '#custom' }
   *   }
   * }
   *
   * // Nested notation
   * {
   *   overrides: {
   *     '*': {
   *       fonts: { sans: 'Inter' },
   *       colors: { primary: { 500: '#ff0000' } }
   *     }
   *   }
   * }
   *
   * // Detailed control with force and resolveVars
   * {
   *   overrides: {
   *     'dark': {
   *       'radius.lg': { value: '0', force: true },
   *       'colors.card': { value: 'var(--custom)', resolveVars: true }
   *     }
   *   }
   * }
   *
   * // Complete example
   * {
   *   overrides: {
   *     '*': { 'fonts.sans': 'Inter' },
   *     'dark': {
   *       'colors.background': '#000',
   *       'colors.foreground': { value: '#fff', force: true }
   *     },
   *     '[data-theme="compact"]': { 'radius.lg': '0' }
   *   }
   * }
   * ```
   */
  overrides?: OverrideOptions;
  /**
   * Nesting configuration for CSS variable key parsing
   * Controls how CSS variables with dashes are parsed into nested structures
   * @default undefined (unlimited nesting, consecutiveDashes: 'exclude')
   *
   * @example
   * ```typescript
   * // Basic: Limit nesting depth
   * {
   *   nesting: {
   *     colors: { maxDepth: 2 }
   *   }
   * }
   *
   * // Per-namespace with all options
   * {
   *   nesting: {
   *     default: { maxDepth: 1 },
   *     colors: {
   *       maxDepth: 2,
   *       flattenMode: 'literal',
   *       consecutiveDashes: 'exclude'
   *     }
   *   }
   * }
   *
   * // Flatten mode: camelCase vs literal
   * {
   *   nesting: {
   *     colors: {
   *       maxDepth: 2,
   *       flattenMode: 'camelcase'  // blue-sky-light → blueSkyLight
   *       // flattenMode: 'literal'  // blue-sky-light → 'blue-sky-light'
   *     }
   *   }
   * }
   *
   * // Consecutive dashes handling
   * {
   *   nesting: {
   *     colors: {
   *       consecutiveDashes: 'exclude'    // button--primary → excluded (default)
   *       // consecutiveDashes: 'nest'    // button--primary → button.primary
   *       // consecutiveDashes: 'camelcase' // button--primary → buttonPrimary
   *       // consecutiveDashes: 'literal' // button--primary → 'button-'.primary
   *     }
   *   }
   * }
   *
   * // Complete example
   * {
   *   nesting: {
   *     default: { maxDepth: 0, flattenMode: 'camelcase' },
   *     colors: { maxDepth: 2, flattenMode: 'literal', consecutiveDashes: 'exclude' },
   *     shadows: { maxDepth: 1, flattenMode: 'camelcase', consecutiveDashes: 'nest' }
   *   }
   * }
   * ```
   */
  nesting?: NestingOptions;
}

/**
 * Options for parsing CSS files
 *
 * Extends SharedThemeOptions with parse-specific configuration.
 *
 * @example
 * ```typescript
 * // Basic usage: parse from file
 * {
 *   input: './src/theme.css'
 * }
 *
 * // Parse from string with base path for imports
 * {
 *   css: '@import "./colors.css"; @theme { --color-primary: blue; }',
 *   basePath: './src'
 * }
 *
 * // Disable Tailwind defaults
 * {
 *   input: './theme.css',
 *   includeDefaults: false
 * }
 *
 * // Selective Tailwind defaults (only colors and spacing)
 * {
 *   input: './theme.css',
 *   includeDefaults: {
 *     colors: true,
 *     spacing: true,
 *     shadows: false,
 *     fonts: false
 *   }
 * }
 *
 * // With nesting configuration
 * {
 *   input: './theme.css',
 *   nesting: {
 *     default: { maxDepth: 0, flattenMode: 'camelcase' },
 *     colors: { maxDepth: 2, flattenMode: 'literal' }
 *   }
 * }
 *
 * // With theme overrides
 * {
 *   input: './theme.css',
 *   overrides: {
 *     '*': {
 *       'fonts.sans': 'Inter, sans-serif'
 *     },
 *     'dark': {
 *       'colors.background': '#000'
 *     }
 *   }
 * }
 *
 * // Complete configuration
 * {
 *   input: './theme.css',
 *   basePath: './src',
 *   resolveImports: true,
 *   includeDefaults: true,
 *   debug: true,
 *   nesting: {
 *     default: { maxDepth: 1, flattenMode: 'camelcase' }
 *   },
 *   overrides: {
 *     '*': { 'fonts.sans': 'Inter' }
 *   }
 * }
 *
 * // Disable imports resolution
 * {
 *   input: './theme.css',
 *   resolveImports: false
 * }
 *
 * // Debug mode
 * {
 *   input: './theme.css',
 *   debug: true  // Logs import resolution warnings
 * }
 * ```
 */
export interface ParseOptions extends SharedThemeOptions {
  /**
   * Path to the CSS file to parse (relative to current working directory, or absolute)
   * Use this for file-based parsing (most common)
   */
  input?: string;

  /**
   * Raw CSS content to parse
   * Use this for string-based parsing (when you already have CSS in memory)
   * Requires basePath if you need `@import` resolution
   */
  css?: string;

  /**
   * Base path for resolving `@import` statements
   * Only needed when using css parameter with `@import` statements
   * @default process.cwd()
   */
  basePath?: string;
}

/**
 * Theme variant with its CSS selector
 *
 * @template TTheme - The concrete theme type (e.g., GeneratedTheme from generated types)
 */
export interface ThemeVariant<TTheme extends Theme = Theme> {
  /**
   * The CSS selector that activates this variant
   * Examples: '[data-theme="dark"]', '.midnight', '@media (prefers-color-scheme: dark)'
   */
  selector: string;
  /**
   * The theme for this variant
   */
  theme: TTheme;
}

/**
 * Deprecation warning for legacy CSS variables
 */
export interface DeprecationWarning {
  /**
   * The deprecated variable name
   */
  variable: string;
  /**
   * Warning message
   */
  message: string;
  /**
   * Suggested replacement
   */
  replacement: string;
}

/**
 * Result from CSS parsing (internal use)
 *
 * @template TTheme - The concrete theme type (e.g., DefaultTheme from generated types)
 *
 * @internal This is the internal parser result structure. Users should use the Tailwind interface.
 */
export interface ParseResult<TTheme extends Theme = Theme> {
  /**
   * Base theme from @theme and :root blocks
   * Typed as the concrete theme type when using generics
   */
  theme: TTheme;
  /**
   * Theme variants from selector-based rules (e.g., [data-theme='dark'], .midnight)
   * Keys are the variant names resolved from selectors
   * Each variant theme is typed as the same concrete type as the base theme
   */
  variants: Record<string, ThemeVariant<TTheme>>;
  /**
   * Raw CSS variables resolved from all sources
   */
  variables: Array<CSSVariable>;
  /**
   * List of files that were processed (including imports)
   */
  files: Array<string>;
  /**
   * Deprecation warnings for legacy CSS variables
   */
  deprecationWarnings: Array<DeprecationWarning>;
  /**
   * CSS rule conflicts detected (optional for backward compatibility)
   */
  cssConflicts?: Array<unknown>;
  /**
   * Unresolved CSS variable references (optional for backward compatibility)
   */
  unresolvedVariables?: Array<unknown>;
}

/**
 * Tailwind theme resolver result structure
 *
 * This is the structure returned by resolveTheme() and matches the generated Tailwind interface.
 * Pass your generated Tailwind type as the generic parameter for full type safety.
 *
 * @template TTailwind - The generated Tailwind interface from your project
 *
 * @example
 * ```typescript
 * import type { Tailwind } from './generated/tailwindcss';
 * import { resolveTheme } from 'tailwind-resolver';
 *
 * const result = await resolveTheme<Tailwind>({
 *   input: './theme.css'
 * });
 *
 * // Fully typed with autocomplete
 * result.variants.default.colors.primary[500];
 * result.variants.dark.colors.background;
 * result.selectors.dark;
 * result.files;
 * result.variables;
 * ```
 */
export interface TailwindResult<TTailwind = UnknownTailwind> {
  /**
   * Theme variants (default, dark, custom themes, etc.)
   */
  variants: TTailwind extends { variants: infer V } ? V : Record<string, Theme>;
  /**
   * CSS selectors for each variant
   */
  selectors: TTailwind extends { selectors: infer S }
    ? S
    : Record<string, string>;
  /**
   * List of CSS files that were processed
   */
  files: Array<string>;
  /**
   * Raw CSS variables
   */
  variables: Array<CSSVariable>;
  /**
   * Deprecation warnings for legacy CSS variables
   */
  deprecationWarnings: Array<DeprecationWarning>;
  /**
   * CSS rule conflicts detected (optional for backward compatibility)
   */
  cssConflicts?: Array<unknown>;
  /**
   * Unresolved CSS variable references (optional for backward compatibility)
   */
  unresolvedVariables?: Array<unknown>;
}

/**
 * Default Tailwind structure when no type parameter is provided
 */
export interface UnknownTailwind {
  variants: {
    default: Theme;
    [key: string]: Theme;
  };
  selectors: {
    default: string;
    [key: string]: string;
  };
  files: Array<string>;
  variables: Array<CSSVariable>;
}

/**
 * Type-safe narrowing function for parse results
 *
 * This function provides a type-safe way to narrow a ParseResult<Theme> to ParseResult<TTheme>
 * without using type assertions. The runtime structure is identical; this only affects
 * compile-time type checking.
 *
 * @template TTheme - The concrete theme type to narrow to
 * @param result - The parse result with base Theme typing
 * @returns The same result, but typed as ParseResult<TTheme>
 *
 * @internal This is used internally by the parser to maintain type safety without assertions
 */
export function narrowParseResult<TTheme extends Theme>(
  result: ParseResult<Theme>,
): ParseResult<TTheme> {
  // Type-safe narrowing: Since TTheme extends Theme, and the runtime structure
  // is guaranteed to match TTheme (from CSS parsing), this narrowing is safe.
  // The function exists purely for type-level safety without direct type assertions.
  return result as unknown as ParseResult<TTheme>;
}
