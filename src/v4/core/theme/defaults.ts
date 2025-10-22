/**
 * Resolves and parses Tailwind's default theme from node_modules
 */

import type { TailwindDefaultsOptions, Theme } from '../../types';

import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';

import postcss from 'postcss';

import { extractVariables } from '../parser/extractor';
import { buildThemes } from './builder';

/**
 * Cache entry for Tailwind's default theme
 */
interface ThemeCache {
  theme: Theme | null;
  timestamp: number;
  path: string;
}

/**
 * Cache for Tailwind's default theme
 * Keyed by base path to support multiple projects in the same process
 */
const defaultThemeCache = new Map<string, ThemeCache>();

/**
 * Clears the default theme cache
 * Exported for testing purposes only
 * @internal
 */
export function clearDefaultThemeCache(): void {
  defaultThemeCache.clear();
}

/**
 * Attempts to load Tailwind's default theme from node_modules
 *
 * Results are cached per base path with timestamp validation to detect package updates.
 * This significantly improves performance for repeated calls while ensuring updates are detected.
 *
 * @param basePath - Base path to start resolution from (usually process.cwd())
 * @returns The default theme, or null if Tailwind is not installed
 */
export async function loadTailwindDefaults(
  basePath: string = process.cwd(),
): Promise<Theme | null> {
  try {
    // Try to resolve tailwindcss/theme.css from node_modules
    const require = createRequire(`${basePath}/package.json`);
    const themePath = require.resolve('tailwindcss/theme.css');

    // Check if we have a valid cache for this base path
    const cached = defaultThemeCache.get(basePath);
    if (cached?.path === themePath) {
      // Validate cache by checking file modification time
      const stats = await stat(themePath);
      if (stats.mtimeMs === cached.timestamp) {
        // Cache is still valid
        return cached.theme;
      }

      // Cache is stale - read file and reuse stats we just got
      const themeCSS = await readFile(themePath, 'utf-8');

      // Parse it
      const root = postcss.parse(themeCSS);

      // Extract variables, keyframes, and CSS rules
      const { variables, keyframes, cssRules } = extractVariables(root);

      // Build theme (only use base theme, ignore variants and deprecation warnings)
      // Note: No defaultTheme parameter here - we ARE the defaults
      const { theme } = buildThemes(variables, keyframes, cssRules, null);

      // Cache the result with timestamp we already have
      defaultThemeCache.set(basePath, {
        theme,
        timestamp: stats.mtimeMs,
        path: themePath,
      });

      return theme;
    }

    // No cache - read file and get stats in parallel
    const [themeCSS, stats] = await Promise.all([
      readFile(themePath, 'utf-8'),
      stat(themePath),
    ]);

    // Parse it
    const root = postcss.parse(themeCSS);

    // Extract variables, keyframes, and CSS rules
    const { variables, keyframes, cssRules } = extractVariables(root);

    // Build theme (only use base theme, ignore variants and deprecation warnings)
    // Note: No defaultTheme parameter here - we ARE the defaults
    const { theme } = buildThemes(variables, keyframes, cssRules, null);

    // Cache the result with timestamp
    defaultThemeCache.set(basePath, {
      theme,
      timestamp: stats.mtimeMs,
      path: themePath,
    });

    return theme;
  } catch {
    // Tailwind not installed or theme.css not found
    // This is fine - user might not have Tailwind installed
    // Cache the null result to avoid repeated resolution attempts
    defaultThemeCache.set(basePath, {
      theme: null,
      timestamp: 0,
      path: '',
    });
    return null;
  }
}

/**
 * Deep merges two themes, with userTheme taking precedence
 *
 * @param defaultTheme - The base theme (Tailwind defaults)
 * @param userTheme - The user's theme (overrides)
 * @param options - Controls which properties to merge from defaults (default: all enabled)
 * @returns Merged theme with user values overriding defaults (only for enabled properties)
 */
// eslint-disable-next-line complexity
export function mergeThemes(
  defaultTheme: Theme,
  userTheme: Theme,
  options: TailwindDefaultsOptions = {},
): Theme {
  // Normalize options - default all to true
  const {
    colors = true,
    fontSize = true,
    fonts = true,
    fontWeight = true,
    spacing = true,
    breakpoints = true,
    containers = true,
    radius = true,
    shadows = true,
    insetShadows = true,
    dropShadows = true,
    textShadows = true,
    blur = true,
    perspective = true,
    aspect = true,
    ease = true,
    animations = true,
    tracking = true,
    leading = true,
    defaults = true,
    keyframes = true,
  } = options;

  return {
    colors: colors
      ? mergeColorScales(defaultTheme.colors, userTheme.colors)
      : userTheme.colors,
    fontSize: fontSize
      ? { ...defaultTheme.fontSize, ...userTheme.fontSize }
      : userTheme.fontSize,
    fonts: fonts
      ? { ...defaultTheme.fonts, ...userTheme.fonts }
      : userTheme.fonts,
    fontWeight: fontWeight
      ? { ...defaultTheme.fontWeight, ...userTheme.fontWeight }
      : userTheme.fontWeight,
    spacing: spacing
      ? { ...defaultTheme.spacing, ...userTheme.spacing }
      : userTheme.spacing,
    breakpoints: breakpoints
      ? { ...defaultTheme.breakpoints, ...userTheme.breakpoints }
      : userTheme.breakpoints,
    containers: containers
      ? { ...defaultTheme.containers, ...userTheme.containers }
      : userTheme.containers,
    radius: radius
      ? { ...defaultTheme.radius, ...userTheme.radius }
      : userTheme.radius,
    shadows: shadows
      ? { ...defaultTheme.shadows, ...userTheme.shadows }
      : userTheme.shadows,
    insetShadows: insetShadows
      ? { ...defaultTheme.insetShadows, ...userTheme.insetShadows }
      : userTheme.insetShadows,
    dropShadows: dropShadows
      ? { ...defaultTheme.dropShadows, ...userTheme.dropShadows }
      : userTheme.dropShadows,
    textShadows: textShadows
      ? { ...defaultTheme.textShadows, ...userTheme.textShadows }
      : userTheme.textShadows,
    blur: blur ? { ...defaultTheme.blur, ...userTheme.blur } : userTheme.blur,
    perspective: perspective
      ? { ...defaultTheme.perspective, ...userTheme.perspective }
      : userTheme.perspective,
    aspect: aspect
      ? { ...defaultTheme.aspect, ...userTheme.aspect }
      : userTheme.aspect,
    ease: ease ? { ...defaultTheme.ease, ...userTheme.ease } : userTheme.ease,
    animations: animations
      ? { ...defaultTheme.animations, ...userTheme.animations }
      : userTheme.animations,
    tracking: tracking
      ? { ...defaultTheme.tracking, ...userTheme.tracking }
      : userTheme.tracking,
    leading: leading
      ? { ...defaultTheme.leading, ...userTheme.leading }
      : userTheme.leading,
    defaults: defaults
      ? { ...defaultTheme.defaults, ...userTheme.defaults }
      : userTheme.defaults,
    keyframes: keyframes
      ? { ...defaultTheme.keyframes, ...userTheme.keyframes }
      : userTheme.keyframes,
  };
}

/**
 * Merges color scales, handling both flat colors and color scale objects
 *
 * @param defaultColors - Default color definitions
 * @param userColors - User color definitions (overrides)
 * @returns Merged colors with deep merge for color scales
 */
function mergeColorScales(
  defaultColors: Theme['colors'],
  userColors: Theme['colors'],
): Theme['colors'] {
  const merged: Theme['colors'] = { ...defaultColors };

  for (const [colorName, userValue] of Object.entries(userColors)) {
    const defaultValue = defaultColors[colorName];

    if (typeof userValue === 'string') {
      // Flat color: override completely
      merged[colorName] = userValue;
    } else if (
      typeof defaultValue === 'object' &&
      typeof userValue === 'object'
    ) {
      // Both are color scales: merge variants
      merged[colorName] = { ...defaultValue, ...userValue };
    } else {
      // User has scale, default doesn't (or vice versa): use user value
      merged[colorName] = userValue;
    }
  }

  return merged;
}
