/**
 * Runtime type guards for safe type checking
 * Provides type-safe alternatives to unsafe type assertions
 */

/**
 * Type guard to check if a value is a record object
 * Ensures the value is an object and not null or an array
 *
 * @param value - Value to check
 * @returns True if value is a record object
 *
 * @example
 * ```typescript
 * const data: unknown = { foo: 'bar' };
 * if (isRecord(data)) {
 *   // TypeScript now knows data is Record<string, unknown>
 *   console.log(data.foo);
 * }
 * ```
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a string
 *
 * @param value - Value to check
 * @returns True if value is a string
 *
 * @example
 * ```typescript
 * const data: unknown = 'hello';
 * if (isString(data)) {
 *   // TypeScript now knows data is string
 *   console.log(data.toUpperCase());
 * }
 * ```
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if a value is a number
 * Excludes NaN values as they are typically invalid
 *
 * @param value - Value to check
 * @returns True if value is a valid number (not NaN)
 *
 * @example
 * ```typescript
 * const data: unknown = 42;
 * if (isNumber(data)) {
 *   // TypeScript now knows data is number
 *   console.log(data * 2);
 * }
 * ```
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}
