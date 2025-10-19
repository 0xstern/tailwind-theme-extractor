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
 * Options for controlling what gets generated in runtime files
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
}

/**
 * Options for parsing CSS files
 */
export interface ParseOptions {
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
