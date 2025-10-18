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
 * Options for parsing CSS files
 */
export interface ParseOptions {
  /**
   * Path to the CSS file to parse
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
  /**
   * Whether to resolve `@import` statements recursively
   * @default true
   */
  resolveImports?: boolean;
  /**
   * Whether to include Tailwind's default theme
   * When true, resolves tailwindcss/theme.css from node_modules and merges with user theme
   * @default true
   */
  includeTailwindDefaults?: boolean;
  /**
   * Enable debug logging for troubleshooting
   * When true, logs warnings for failed import resolution and other parsing issues
   * @default false
   */
  debug?: boolean;
}

/**
 * Theme variant with its CSS selector
 */
export interface ThemeVariant {
  /**
   * The CSS selector that activates this variant
   * Examples: '[data-theme="dark"]', '.midnight', '`@media` (prefers-color-scheme: dark)'
   */
  selector: string;
  /**
   * The theme for this variant
   */
  theme: Theme;
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
 * Result from CSS parsing
 */
export interface ParseResult {
  /**
   * Base theme from `@theme` and :root blocks
   */
  theme: Theme;
  /**
   * Theme variants from selector-based rules (e.g., [data-theme='dark'], .midnight)
   * Keys are the variant names resolved from selectors
   */
  variants: Record<string, ThemeVariant>;
  /**
   * Raw CSS variables resolved
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
}
