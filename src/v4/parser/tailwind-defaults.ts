/**
 * Resolves and parses Tailwind's default theme from node_modules
 */

import type { Theme } from '../types';

import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';

import postcss from 'postcss';

import { buildThemes } from './theme-builder';
import { extractVariables } from './variable-extractor';

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
    }

    // Cache miss or invalidated - read and parse the theme file
    const themeCSS = await readFile(themePath, 'utf-8');
    const stats = await stat(themePath);

    // Parse it
    const root = postcss.parse(themeCSS);

    // Extract variables and keyframes
    const { variables, keyframes } = extractVariables(root);

    // Build theme (only use base theme, ignore variants and deprecation warnings)
    const { theme } = buildThemes(variables, keyframes);

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
 * @returns Merged theme with user values overriding defaults
 */
export function mergeThemes(defaultTheme: Theme, userTheme: Theme): Theme {
  return {
    colors: mergeColorScales(defaultTheme.colors, userTheme.colors),
    fontSize: { ...defaultTheme.fontSize, ...userTheme.fontSize },
    fonts: { ...defaultTheme.fonts, ...userTheme.fonts },
    fontWeight: { ...defaultTheme.fontWeight, ...userTheme.fontWeight },
    spacing: { ...defaultTheme.spacing, ...userTheme.spacing },
    breakpoints: { ...defaultTheme.breakpoints, ...userTheme.breakpoints },
    containers: { ...defaultTheme.containers, ...userTheme.containers },
    radius: { ...defaultTheme.radius, ...userTheme.radius },
    shadows: { ...defaultTheme.shadows, ...userTheme.shadows },
    insetShadows: { ...defaultTheme.insetShadows, ...userTheme.insetShadows },
    dropShadows: { ...defaultTheme.dropShadows, ...userTheme.dropShadows },
    textShadows: { ...defaultTheme.textShadows, ...userTheme.textShadows },
    blur: { ...defaultTheme.blur, ...userTheme.blur },
    perspective: { ...defaultTheme.perspective, ...userTheme.perspective },
    aspect: { ...defaultTheme.aspect, ...userTheme.aspect },
    ease: { ...defaultTheme.ease, ...userTheme.ease },
    animations: { ...defaultTheme.animations, ...userTheme.animations },
    tracking: { ...defaultTheme.tracking, ...userTheme.tracking },
    leading: { ...defaultTheme.leading, ...userTheme.leading },
    defaults: { ...defaultTheme.defaults, ...userTheme.defaults },
    keyframes: { ...defaultTheme.keyframes, ...userTheme.keyframes },
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
