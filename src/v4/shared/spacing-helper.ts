/**
 * Spacing helper utilities for theme variants
 * Provides callable spacing functions that generate calc() expressions
 */

/**
 * Creates a callable spacing helper that can be used both as an object and as a function
 *
 * Usage:
 * - As object: spacing.xs → '0.75rem'
 * - As function: spacing(4) → 'calc(0.25rem * 4)'
 *
 * @param spacingValues - Record of spacing values from the theme (e.g., { base: '0.25rem', xs: '0.75rem' })
 * @param fallbackBase - Fallback base spacing unit if not defined in spacingValues
 * @returns Callable object that can be accessed as properties or called as function
 */
export function createSpacingHelper(
  spacingValues: Record<string, string>,
  fallbackBase: string,
): Record<string, string> & ((n: number) => string) {
  const baseUnit = spacingValues.base ?? fallbackBase;

  // Create the callable function
  const spacingFn = (n: number): string => {
    return `calc(${baseUnit} * ${n})`;
  };

  // Merge the spacing properties with the function
  // This creates a hybrid object that can be both accessed (.xs) and called (4)
  return Object.assign(spacingFn, spacingValues);
}
