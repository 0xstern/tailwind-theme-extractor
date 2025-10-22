/**
 * CSS variable namespace to theme property mappings
 * Centralized source of truth for namespace configuration
 */

import type { Theme } from '../../types';

/**
 * Maps CSS variable namespaces to corresponding theme property names
 *
 * This is the canonical mapping used throughout the parser to determine
 * where CSS variables should be placed in the theme structure.
 *
 * @example
 * ```typescript
 * // '--color-red-500' namespace is 'color' -> maps to theme.colors
 * NAMESPACE_TO_THEME_PROPERTY['color']; // 'colors'
 *
 * // '--spacing-4' namespace is 'spacing' -> maps to theme.spacing
 * NAMESPACE_TO_THEME_PROPERTY['spacing']; // 'spacing'
 * ```
 */
export const NAMESPACE_TO_THEME_PROPERTY: Record<string, keyof Theme> = {
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
} as const;

/**
 * Type-safe namespace keys extracted from the mapping
 */
export type ThemeNamespace = keyof typeof NAMESPACE_TO_THEME_PROPERTY;
