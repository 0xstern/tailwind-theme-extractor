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

  let finalTheme: Theme;

  // If user doesn't want defaults, use user theme as-is
  if (includeTailwindDefaults === false) {
    finalTheme = userResult.theme;
  } else {
    // Try to load Tailwind's default theme
    const defaultTheme = await loadTailwindDefaults(basePath ?? process.cwd());

    // If no defaults found (Tailwind not installed), use user theme
    if (defaultTheme === null) {
      finalTheme = userResult.theme;
    } else {
      // Merge: user theme overrides defaults
      finalTheme = mergeThemes(defaultTheme, userResult.theme);
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
} from './types';
