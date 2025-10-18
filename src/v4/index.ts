/**
 * Tailwind v4 Theme Resolver
 *
 * A library for parsing Tailwind v4 CSS files and resolving theme variables
 * into a structured JavaScript object for use in contexts where CSS variables
 * are not available (e.g., charts, iframes, canvas).
 *
 * @example
 * ```typescript
 * import { resolveTheme } from 'tailwind-theme-resolver/v4';
 *
 * // Parse from file
 * const result = await resolveTheme({
 *   input: './src/theme.css'
 * });
 *
 * // Use the theme
 * console.log(result.theme.colors.primary[500]);
 * ```
 */

import type { ParseOptions, ParseResult } from './types';

import { parseCSS } from './parser/css-parser';
import { loadTailwindDefaults, mergeThemes } from './parser/tailwind-defaults';

/**
 * Resolves theme variables from Tailwind v4 CSS files
 *
 * Automatically includes Tailwind's default theme and merges with user overrides
 * unless `includeTailwindDefaults: false` is specified.
 *
 * Error Handling:
 * - File not found: Throws error if the specified filePath doesn't exist
 * - Missing `@import` files: Silently skipped, continues processing remaining CSS
 * - Invalid CSS: PostCSS parsing errors will throw
 * - Tailwind not installed: Falls back to user theme only (no error thrown)
 * - Enable `debug: true` in options to log warnings for import resolution failures
 *
 * @param options - Options for theme resolution
 * @returns Promise resolving to the parse result with theme, variables, and processed files
 * @throws Error if neither input nor css is provided in options
 * @throws Error if input is provided but file cannot be read
 * @throws Error if CSS syntax is invalid
 *
 * @example
 * ```typescript
 * // Standard usage
 * const result = await resolveTheme({
 *   input: './src/theme.css'
 * });
 *
 * // With debug mode for troubleshooting
 * const result = await resolveTheme({
 *   input: './src/theme.css',
 *   debug: true
 * });
 *
 * // Without Tailwind defaults
 * const result = await resolveTheme({
 *   input: './src/theme.css',
 *   includeTailwindDefaults: false
 * });
 * ```
 */
export async function resolveTheme(
  options: ParseOptions,
): Promise<ParseResult> {
  const { includeTailwindDefaults = true, basePath } = options;

  // Parse user's theme
  const userResult = await parseCSS(options);

  // If user doesn't want defaults, return as-is
  if (includeTailwindDefaults == false) {
    return userResult;
  }

  // Try to load Tailwind's default theme
  const defaultTheme = await loadTailwindDefaults(basePath ?? process.cwd());

  // If no defaults found (Tailwind not installed), return user theme as-is
  if (defaultTheme === null) {
    return userResult;
  }

  // Merge: user theme overrides defaults
  const mergedTheme = mergeThemes(defaultTheme, userResult.theme);

  return {
    ...userResult,
    theme: mergedTheme,
  };
}

// Re-export types for consumers
export type {
  Theme,
  ThemeColors,
  ThemeSpacing,
  ThemeFonts,
  ThemeFontSizes,
  ThemeFontWeights,
  ThemeTracking,
  ThemeLeading,
  ThemeBreakpoints,
  ThemeContainers,
  ThemeRadius,
  ThemeShadows,
  ThemeInsetShadows,
  ThemeDropShadows,
  ThemeTextShadows,
  ThemeBlur,
  ThemePerspective,
  ThemeAspect,
  ThemeEase,
  ThemeAnimations,
  ThemeDefaults,
  ThemeKeyframes,
  ColorScale,
  CSSVariable,
  ParseOptions,
  ParseResult,
  ThemeVariant,
  DeprecationWarning,
} from './types';
