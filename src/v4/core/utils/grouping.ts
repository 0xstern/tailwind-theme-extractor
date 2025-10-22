/**
 * Generic grouping utility for arrays
 * Provides efficient grouping operations used across the parser
 */

/**
 * Groups an array of items by a key selector function
 *
 * This utility provides O(n) grouping with a single pass through the array.
 * Used extensively throughout the parser for organizing variables, conflicts,
 * and other data structures by common attributes.
 *
 * @template T - Type of items being grouped
 * @template TKey - Type of the grouping key (must be string or number for Map keys)
 * @param items - Array of items to group
 * @param keySelector - Function that extracts the grouping key from each item
 * @returns Map where keys are group identifiers and values are arrays of grouped items
 *
 * @example
 * ```typescript
 * interface Person {
 *   name: string;
 *   age: number;
 * }
 *
 * const people: Array<Person> = [
 *   { name: 'Alice', age: 25 },
 *   { name: 'Bob', age: 30 },
 *   { name: 'Charlie', age: 25 },
 * ];
 *
 * const byAge = groupBy(people, (person) => person.age);
 * // Map {
 * //   25 => [{ name: 'Alice', age: 25 }, { name: 'Charlie', age: 25 }],
 * //   30 => [{ name: 'Bob', age: 30 }]
 * // }
 * ```
 */
export function groupBy<T, TKey extends string | number>(
  items: Array<T>,
  keySelector: (item: T) => TKey,
): Map<TKey, Array<T>> {
  const grouped = new Map<TKey, Array<T>>();

  for (const item of items) {
    const key = keySelector(item);
    const existing = grouped.get(key);

    if (existing !== undefined) {
      existing.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }

  return grouped;
}
