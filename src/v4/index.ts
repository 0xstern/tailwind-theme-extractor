/**
 * Tailwind v4 Theme Resolver
 *
 * A library for parsing Tailwind v4 CSS files and resolving theme variables
 * into a structured JavaScript object for use in contexts where CSS variables
 * are not available (e.g., charts, iframes, canvas).
 *
 * @example
 * ```typescript
 * import { resolveTheme } from 'tailwind-resolver/v4';
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

import type {
  ParseOptions,
  TailwindResult,
  Theme,
  UnknownTailwind,
} from './types';

import { parseCSS } from './parser/css-parser';
import {
  extractInitialExclusions,
  filterThemeByExclusions,
} from './parser/initial-filter';
import { loadTailwindDefaults, mergeThemes } from './parser/tailwind-defaults';

/**
 * Resolves theme variables from Tailwind v4 CSS files with full type safety
 *
 * When used with a generated Tailwind type, provides complete TypeScript autocomplete
 * for all theme properties, variants, selectors, files, and variables.
 *
 * Automatically includes Tailwind's default theme and merges with user overrides
 * unless `includeTailwindDefaults: false` is specified.
 *
 * Error Handling:
 * - File not found: Throws error if the specified filePath doesn't exist
 * - Missing @import files: Silently skipped, continues processing remaining CSS
 * - Invalid CSS: PostCSS parsing errors will throw
 * - Tailwind not installed: Falls back to user theme only (no error thrown)
 * - Enable `debug: true` in options to log warnings for import resolution failures
 *
 * @template TTailwind - The generated Tailwind interface from your project
 * @param options - Options for theme resolution
 * @returns Promise resolving to the Tailwind structure with full type safety
 * @throws Error if neither input nor css is provided in options
 * @throws Error if input is provided but file cannot be read
 * @throws Error if CSS syntax is invalid
 *
 * @example
 * ```typescript
 * import type { Tailwind } from './generated/tailwindcss';
 * import { resolveTheme } from 'tailwind-resolver';
 *
 * // With generated type for full type safety
 * const tailwind = await resolveTheme<Tailwind>({
 *   input: './src/theme.css'
 * });
 *
 * // Now fully typed - autocomplete works!
 * tailwind.variants.default.colors.primary[500];
 * tailwind.variants.dark.colors.background;
 * tailwind.selectors.dark;
 * tailwind.files;
 * tailwind.variables;
 *
 * // With theme overrides
 * const customTailwind = await resolveTheme<Tailwind>({
 *   input: './src/theme.css',
 *   overrides: {
 *     'dark': { 'colors.background': '#000000' },
 *     '*': { 'fonts.sans': 'Inter, sans-serif' }
 *   }
 * });
 *
 * // Without type parameter (fallback typing)
 * const result = await resolveTheme({
 *   input: './src/theme.css'
 * });
 * ```
 */
export async function resolveTheme<TTailwind = UnknownTailwind>(
  options: ParseOptions,
): Promise<TailwindResult<TTailwind>> {
  const { includeTailwindDefaults = true, basePath } = options;

  // Parse user's theme (returns ParseResult<Theme> from internal parser)
  const userResult = await parseCSS(options);

  // Extract initial exclusions from user's theme variables
  // These will be used to filter out Tailwind defaults
  const themeVariables = userResult.variables.filter(
    (v) => v.source === 'theme',
  );
  const initialExclusions = extractInitialExclusions(themeVariables);

  let finalTheme: Theme;

  // If user doesn't want defaults, use user theme as-is
  // But still apply initial filtering to remove any initial declarations
  if (includeTailwindDefaults === false) {
    finalTheme = filterThemeByExclusions(userResult.theme, initialExclusions);
  } else {
    // Try to load Tailwind's default theme
    const defaultTheme = await loadTailwindDefaults(basePath ?? process.cwd());

    // If no defaults found (Tailwind not installed), use user theme
    if (defaultTheme === null) {
      finalTheme = filterThemeByExclusions(userResult.theme, initialExclusions);
    } else {
      // Filter the default theme based on initial exclusions
      // This takes priority over includeTailwindDefaults options
      const filteredDefaultTheme = filterThemeByExclusions(
        defaultTheme,
        initialExclusions,
      );

      // Normalize options: true becomes {}, object stays as-is
      const mergeOptions =
        includeTailwindDefaults === true ? {} : includeTailwindDefaults;

      // Merge: user theme overrides filtered defaults
      const mergedTheme = mergeThemes(
        filteredDefaultTheme,
        userResult.theme,
        mergeOptions,
      );

      // Apply final filtering to remove any initial declarations from merged theme
      finalTheme = filterThemeByExclusions(mergedTheme, initialExclusions);
    }
  }

  // Build variants object with default variant
  const variants: Record<string, unknown> = {
    default: finalTheme,
  };

  const selectors: Record<string, string> = {
    default: ':root',
  };

  // Add other variants
  for (const [variantName, variantData] of Object.entries(
    userResult.variants,
  )) {
    variants[variantName] = variantData.theme;
    selectors[variantName] = variantData.selector;
  }

  // Return TailwindResult structure
  return {
    variants,
    selectors,
    files: userResult.files,
    variables: userResult.variables,
    deprecationWarnings: userResult.deprecationWarnings,
    cssConflicts: userResult.cssConflicts,
    unresolvedVariables: userResult.unresolvedVariables,
  } as TailwindResult<TTailwind>;
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
  TailwindResult,
  UnknownTailwind,
  OverrideValue,
  OverrideConfig,
  OverrideOptions,
  TailwindDefaultsOptions,
} from './types';

// Re-export initial filter utilities for advanced use cases
export type { InitialExclusion } from './parser/initial-filter';
export {
  extractInitialExclusions,
  filterDefaultsByExclusions,
  filterThemeByExclusions,
  matchesExclusion,
} from './parser/initial-filter';
