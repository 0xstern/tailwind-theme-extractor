/**
 * Handles CSS `initial` keyword for removing Tailwind default theme values
 *
 * In Tailwind CSS v4, setting theme variables to `initial` in `@theme` blocks
 * removes them from the generated theme object, just like Tailwind CSS does.
 *
 * Rules:
 * - `initial` only affects default/built-in Tailwind values, NOT user-created custom values
 * - `initial` declarations always take precedent over the `includeTailwindDefaults` option
 * - Supports wildcard patterns (e.g., `--color-*: initial`)
 */

import type { CSSVariable, Theme } from '../types';

import { parseVariableName } from './variable-extractor';

/**
 * Represents an exclusion pattern created from an `initial` declaration
 */
export interface InitialExclusion {
  /**
   * The original variable name (e.g., '--color-lime-*')
   */
  pattern: string;
  /**
   * The namespace (e.g., 'color')
   */
  namespace: string;
  /**
   * The key pattern (e.g., 'lime-*')
   */
  keyPattern: string;
  /**
   * Whether this is a wildcard pattern
   */
  isWildcard: boolean;
}

/**
 * Extracts initial exclusion patterns from theme variables
 *
 * Processes variables with value='initial' to create exclusion patterns
 * that will be used to filter default Tailwind theme values.
 *
 * @param themeVariables - Variables from @theme blocks
 * @returns Array of exclusion patterns
 *
 * @example
 * ```typescript
 * const variables = [
 *   { name: '--color-lime-*', value: 'initial', source: 'theme' },
 *   { name: '--color-fuchsia-500', value: 'initial', source: 'theme' },
 *   { name: '--spacing-*', value: 'initial', source: 'theme' },
 * ];
 *
 * const exclusions = extractInitialExclusions(variables);
 * // [
 * //   { pattern: '--color-lime-*', namespace: 'color', keyPattern: 'lime-*', isWildcard: true },
 * //   { pattern: '--color-fuchsia-500', namespace: 'color', keyPattern: 'fuchsia-500', isWildcard: false },
 * //   { pattern: '--spacing-*', namespace: 'spacing', keyPattern: '*', isWildcard: true },
 * // ]
 * ```
 */
export function extractInitialExclusions(
  themeVariables: Array<CSSVariable>,
): Array<InitialExclusion> {
  const exclusions: Array<InitialExclusion> = [];

  for (const variable of themeVariables) {
    // Only process variables with value='initial' from @theme blocks
    if (variable.value.trim() !== 'initial' || variable.source !== 'theme') {
      continue;
    }

    // Parse the variable name to extract namespace and key
    const parsed = parseVariableName(variable.name);
    if (parsed === null) {
      continue;
    }

    const { namespace, key } = parsed;

    // Check if this is a wildcard pattern (ends with -*)
    const isWildcard = key.endsWith('-*') || key === '*';

    exclusions.push({
      pattern: variable.name,
      namespace,
      keyPattern: key,
      isWildcard,
    });
  }

  return exclusions;
}

/**
 * Checks if a variable matches an exclusion pattern
 *
 * @param variableName - Variable name to check (e.g., '--color-lime-500')
 * @param exclusion - Exclusion pattern to match against
 * @returns true if the variable should be excluded
 *
 * @example
 * ```typescript
 * // Wildcard pattern matching
 * matchesExclusion('--color-lime-500', {
 *   namespace: 'color',
 *   keyPattern: 'lime-*',
 *   isWildcard: true
 * }); // true
 *
 * matchesExclusion('--color-red-500', {
 *   namespace: 'color',
 *   keyPattern: 'lime-*',
 *   isWildcard: true
 * }); // false
 *
 * // Exact pattern matching
 * matchesExclusion('--color-lime-500', {
 *   namespace: 'color',
 *   keyPattern: 'lime-500',
 *   isWildcard: false
 * }); // true
 *
 * // Namespace-wide wildcard
 * matchesExclusion('--color-red-500', {
 *   namespace: 'color',
 *   keyPattern: '*',
 *   isWildcard: true
 * }); // true
 * ```
 */
export function matchesExclusion(
  variableName: string,
  exclusion: InitialExclusion,
): boolean {
  const parsed = parseVariableName(variableName);
  if (parsed === null) {
    return false;
  }

  const { namespace, key } = parsed;

  // Must be in the same namespace
  if (namespace !== exclusion.namespace) {
    return false;
  }

  // Handle wildcard patterns
  if (exclusion.isWildcard) {
    // Namespace-wide wildcard (e.g., --color-*: initial)
    if (exclusion.keyPattern === '*') {
      return true;
    }

    // Prefix wildcard (e.g., --color-lime-*: initial)
    // Extract prefix by removing the '-*' suffix
    const WILDCARD_SUFFIX_LENGTH = 2;
    const prefix = exclusion.keyPattern.slice(0, -WILDCARD_SUFFIX_LENGTH);

    return key.startsWith(prefix);
  }

  // Exact match
  return key === exclusion.keyPattern;
}

/**
 * Filters default theme variables by removing those matching initial exclusions
 *
 * This function removes Tailwind default values that have been explicitly set to
 * `initial` in the user's @theme blocks, while preserving user-defined custom values.
 *
 * @param defaultVariables - Variables from Tailwind's default theme
 * @param exclusions - Exclusion patterns extracted from initial declarations
 * @returns Filtered array with excluded variables removed
 *
 * @example
 * ```typescript
 * const defaults = [
 *   { name: '--color-lime-50', value: '#f7fee7', source: 'theme' },
 *   { name: '--color-lime-500', value: '#84cc16', source: 'theme' },
 *   { name: '--color-red-500', value: '#ef4444', source: 'theme' },
 * ];
 *
 * const exclusions = [
 *   { namespace: 'color', keyPattern: 'lime-*', isWildcard: true },
 * ];
 *
 * const filtered = filterDefaultsByExclusions(defaults, exclusions);
 * // [
 * //   { name: '--color-red-500', value: '#ef4444', source: 'theme' },
 * // ]
 * ```
 */
export function filterDefaultsByExclusions(
  defaultVariables: Array<CSSVariable>,
  exclusions: Array<InitialExclusion>,
): Array<CSSVariable> {
  // If no exclusions, return original array (optimization)
  if (exclusions.length === 0) {
    return defaultVariables;
  }

  // Filter out variables matching any exclusion pattern
  return defaultVariables.filter((variable) => {
    for (const exclusion of exclusions) {
      if (matchesExclusion(variable.name, exclusion)) {
        return false; // Exclude this variable
      }
    }
    return true; // Keep this variable
  });
}

/**
 * Filters an already-built Theme object by removing properties matching exclusions
 *
 * This is used when the theme has already been built and we need to remove
 * properties that match initial exclusion patterns.
 *
 * @param theme - Theme object to filter
 * @param exclusions - Exclusion patterns extracted from initial declarations
 * @returns Filtered theme with excluded properties removed
 *
 * @example
 * ```typescript
 * const theme = {
 *   colors: {
 *     lime: { 50: '#f7fee7', 500: '#84cc16' },
 *     red: { 500: '#ef4444' },
 *   },
 *   // ... other properties
 * };
 *
 * const exclusions = [
 *   { namespace: 'color', keyPattern: 'lime-*', isWildcard: true },
 * ];
 *
 * const filtered = filterThemeByExclusions(theme, exclusions);
 * // {
 * //   colors: {
 * //     red: { 500: '#ef4444' },
 * //   },
 * //   // ... other properties
 * // }
 * ```
 */
export function filterThemeByExclusions(
  theme: Theme,
  exclusions: Array<InitialExclusion>,
): Theme {
  // If no exclusions, return original theme (optimization)
  if (exclusions.length === 0) {
    return theme;
  }

  // Create a map of exclusions by namespace for O(1) lookup
  const exclusionsByNamespace = new Map<string, Array<InitialExclusion>>();
  for (const exclusion of exclusions) {
    const existing = exclusionsByNamespace.get(exclusion.namespace);
    if (existing === undefined) {
      exclusionsByNamespace.set(exclusion.namespace, [exclusion]);
    } else {
      existing.push(exclusion);
    }
  }

  // Namespace to theme property mappings
  const namespaceToProperty: Record<string, keyof Theme> = {
    color: 'colors',
    spacing: 'spacing',
    font: 'fonts',
    'font-weight': 'fontWeight',
    text: 'fontSize',
    tracking: 'tracking',
    leading: 'leading',
    breakpoint: 'breakpoints',
    container: 'containers',
    radius: 'radius',
    shadow: 'shadows',
    'inset-shadow': 'insetShadows',
    'drop-shadow': 'dropShadows',
    'text-shadow': 'textShadows',
    blur: 'blur',
    perspective: 'perspective',
    aspect: 'aspect',
    ease: 'ease',
    animate: 'animations',
    default: 'defaults',
  };

  // Create a deep copy of the theme to avoid mutations
  const filteredTheme: Theme = {
    colors: { ...theme.colors },
    spacing: { ...theme.spacing },
    fonts: { ...theme.fonts },
    fontSize: { ...theme.fontSize },
    fontWeight: { ...theme.fontWeight },
    tracking: { ...theme.tracking },
    leading: { ...theme.leading },
    breakpoints: { ...theme.breakpoints },
    containers: { ...theme.containers },
    radius: { ...theme.radius },
    shadows: { ...theme.shadows },
    insetShadows: { ...theme.insetShadows },
    dropShadows: { ...theme.dropShadows },
    textShadows: { ...theme.textShadows },
    blur: { ...theme.blur },
    perspective: { ...theme.perspective },
    aspect: { ...theme.aspect },
    ease: { ...theme.ease },
    animations: { ...theme.animations },
    defaults: { ...theme.defaults },
    keyframes: { ...theme.keyframes },
  };

  // Process each exclusion
  for (const [namespace, namespaceExclusions] of exclusionsByNamespace) {
    const property = namespaceToProperty[namespace];
    if (property === undefined) {
      continue;
    }

    // Handle colors separately (can be flat or color scales)
    if (property === 'colors') {
      filteredTheme.colors = filterColors(
        filteredTheme.colors,
        namespaceExclusions,
      );
      continue;
    }

    // Handle fontSize separately (structured differently)
    if (property === 'fontSize') {
      filteredTheme.fontSize = filterFontSizes(
        filteredTheme.fontSize,
        namespaceExclusions,
      );
      continue;
    }

    // For simple key-value properties
    const themeProperty = filteredTheme[property] as Record<string, unknown>;
    filteredTheme[property] = filterSimpleProperty(
      themeProperty,
      namespaceExclusions,
    ) as never;
  }

  return filteredTheme;
}

/**
 * Filters color properties considering color scales
 *
 * @param colors - Theme colors to filter
 * @param exclusions - Exclusion patterns to apply
 * @returns Filtered colors object
 */
function filterColors(
  colors: Theme['colors'],
  exclusions: Array<InitialExclusion>,
): Theme['colors'] {
  const filtered: Theme['colors'] = {};

  for (const [colorName, colorValue] of Object.entries(colors)) {
    // Check if this is a color scale or flat color
    if (typeof colorValue === 'string') {
      // Flat color - check if it should be excluded
      const variableName = `--color-${colorName}`;
      const shouldExclude = exclusions.some((excl) =>
        matchesExclusion(variableName, excl),
      );
      if (!shouldExclude) {
        filtered[colorName] = colorValue;
      }
    } else {
      // Color scale - filter individual variants
      const filteredScale: Record<string | number, string> = {};
      for (const [variant, value] of Object.entries(colorValue)) {
        const variableName = `--color-${colorName}-${variant}`;
        const shouldExclude = exclusions.some((excl) =>
          matchesExclusion(variableName, excl),
        );
        if (!shouldExclude) {
          filteredScale[variant] = value as string;
        }
      }

      // Only keep the color if it has at least one variant remaining
      if (Object.keys(filteredScale).length > 0) {
        filtered[colorName] = filteredScale;
      }
    }
  }

  return filtered;
}

/**
 * Filters font size properties
 *
 * @param fontSize - Theme font sizes to filter
 * @param exclusions - Exclusion patterns to apply
 * @returns Filtered font sizes object
 */
function filterFontSizes(
  fontSize: Theme['fontSize'],
  exclusions: Array<InitialExclusion>,
): Theme['fontSize'] {
  const filtered: Theme['fontSize'] = {};

  for (const [key, value] of Object.entries(fontSize)) {
    const variableName = `--text-${key}`;
    const shouldExclude = exclusions.some((excl) =>
      matchesExclusion(variableName, excl),
    );
    if (!shouldExclude) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Filters simple key-value properties
 *
 * @param property - Theme property object to filter
 * @param exclusions - Exclusion patterns to apply
 * @returns Filtered property object
 */
function filterSimpleProperty(
  property: Record<string, unknown>,
  exclusions: Array<InitialExclusion>,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};

  // Infer namespace from exclusions (they should all have the same namespace)
  const namespace = exclusions[0]?.namespace;
  if (namespace === undefined) {
    return property;
  }

  for (const [key, value] of Object.entries(property)) {
    const variableName = `--${namespace}-${key}`;
    const shouldExclude = exclusions.some((excl) =>
      matchesExclusion(variableName, excl),
    );
    if (!shouldExclude) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Applies a single initial exclusion to a theme in-place during building
 *
 * This is used during theme construction to handle CSS cascade order where
 * `initial` declarations can override previous specific values.
 *
 * Mutates the theme object by removing matching keys.
 *
 * @param theme - Theme object being built (will be mutated)
 * @param exclusion - Single exclusion pattern to apply
 *
 * @example
 * ```typescript
 * const theme = { colors: { red: { 50: '#fff', 100: '#fee' } } };
 * const exclusion = { namespace: 'color', keyPattern: 'red-*', isWildcard: true };
 * applyInitialExclusionToTheme(theme, exclusion);
 * // theme.colors.red is now undefined (removed)
 * ```
 */
export function applyInitialExclusionToTheme(
  theme: Theme,
  exclusion: InitialExclusion,
): void {
  // Namespace to theme property mappings
  const namespaceToProperty: Record<string, keyof Theme> = {
    color: 'colors',
    spacing: 'spacing',
    font: 'fonts',
    'font-weight': 'fontWeight',
    text: 'fontSize',
    tracking: 'tracking',
    leading: 'leading',
    breakpoint: 'breakpoints',
    container: 'containers',
    radius: 'radius',
    shadow: 'shadows',
    'inset-shadow': 'insetShadows',
    'drop-shadow': 'dropShadows',
    'text-shadow': 'textShadows',
    blur: 'blur',
    perspective: 'perspective',
    aspect: 'aspect',
    ease: 'ease',
    animate: 'animations',
    default: 'defaults',
  };

  const property = namespaceToProperty[exclusion.namespace];
  if (property === undefined) {
    return;
  }

  // Handle colors separately (can be flat or color scales)
  if (property === 'colors') {
    applyExclusionToColors(theme.colors, exclusion);
    return;
  }

  // Handle fontSize separately (structured differently)
  if (property === 'fontSize') {
    applyExclusionToFontSizes(theme.fontSize, exclusion);
    return;
  }

  // For simple key-value properties
  applyExclusionToSimpleProperty(
    theme[property] as Record<string, unknown>,
    exclusion,
  );
}

/**
 * Applies exclusion to colors, removing matching entries in-place
 *
 * @param colors - Theme colors to mutate
 * @param exclusion - Exclusion pattern to apply
 */
function applyExclusionToColors(
  colors: Theme['colors'],
  exclusion: InitialExclusion,
): void {
  const keysToDelete: Array<string> = [];

  for (const [colorName, colorValue] of Object.entries(colors)) {
    if (typeof colorValue === 'string') {
      // Flat color
      const variableName = `--color-${colorName}`;
      if (matchesExclusion(variableName, exclusion)) {
        keysToDelete.push(colorName);
      }
    } else {
      // Color scale - check each variant
      const variantsToDelete: Array<string | number> = [];

      for (const [variant] of Object.entries(colorValue)) {
        const variableName = `--color-${colorName}-${variant}`;
        if (matchesExclusion(variableName, exclusion)) {
          variantsToDelete.push(variant);
        }
      }

      // Remove matching variants
      for (const variant of variantsToDelete) {
        delete colorValue[variant];
      }

      // If all variants removed, mark color for deletion
      if (Object.keys(colorValue).length === 0) {
        keysToDelete.push(colorName);
      }
    }
  }

  // Remove marked colors
  for (const key of keysToDelete) {
    delete colors[key];
  }
}

/**
 * Applies exclusion to font sizes, removing matching entries in-place
 *
 * @param fontSize - Theme font sizes to mutate
 * @param exclusion - Exclusion pattern to apply
 */
function applyExclusionToFontSizes(
  fontSize: Theme['fontSize'],
  exclusion: InitialExclusion,
): void {
  const keysToDelete: Array<string> = [];

  for (const [key] of Object.entries(fontSize)) {
    const variableName = `--text-${key}`;
    if (matchesExclusion(variableName, exclusion)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    delete fontSize[key];
  }
}

/**
 * Applies exclusion to simple properties, removing matching entries in-place
 *
 * @param property - Theme property object to mutate
 * @param exclusion - Exclusion pattern to apply
 */
function applyExclusionToSimpleProperty(
  property: Record<string, unknown>,
  exclusion: InitialExclusion,
): void {
  const keysToDelete: Array<string> = [];

  for (const [key] of Object.entries(property)) {
    const variableName = `--${exclusion.namespace}-${key}`;
    if (matchesExclusion(variableName, exclusion)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    delete property[key];
  }
}
