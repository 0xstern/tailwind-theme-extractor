/**
 * String manipulation utilities for the parser
 * Common string operations used across multiple modules
 */

/**
 * Capitalizes the first letter of a string
 *
 * Used for formatting user-facing strings in reports and messages.
 * Does not modify the rest of the string (unlike toLowerCase/toUpperCase).
 *
 * @param str - Input string to capitalize
 * @returns String with first letter capitalized
 *
 * @example
 * ```typescript
 * capitalizeFirst('hello'); // 'Hello'
 * capitalizeFirst('WORLD'); // 'WORLD'
 * capitalizeFirst(''); // ''
 * capitalizeFirst('a'); // 'A'
 * ```
 */
export function capitalizeFirst(str: string): string {
  if (str.length === 0) {
    return str;
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
}
