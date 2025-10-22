/**
 * LRU (Least Recently Used) cache implementation
 * Prevents unbounded memory growth in long-running processes
 */

/**
 * LRU cache with size limits to prevent unbounded memory growth
 *
 * This cache automatically evicts the least recently used entries when the
 * maximum size is reached. Essential for long-running processes that parse
 * multiple CSS files or work with large theme configurations.
 *
 * Time complexity:
 * - get: O(n) where n is cache size (linear scan for access order update)
 * - set: O(n) for eviction + access order update
 * - clear: O(1)
 *
 * @template TKey - Type of cache keys
 * @template TValue - Type of cached values
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string, number>(3);
 *
 * cache.set('a', 1);
 * cache.set('b', 2);
 * cache.set('c', 3);
 * cache.set('d', 4); // Evicts 'a' (least recently used)
 *
 * cache.get('a'); // undefined
 * cache.get('b'); // 2 (marks 'b' as recently used)
 * cache.size; // 3
 * ```
 */
export class LRUCache<TKey, TValue> {
  private readonly cache = new Map<TKey, TValue>();
  private accessOrder: Array<TKey> = [];

  /**
   * Creates a new LRU cache with the specified maximum size
   *
   * @param maxSize - Maximum number of entries to keep in cache
   */
  constructor(private readonly maxSize: number) {}

  /**
   * Retrieves a value from the cache and marks it as recently used
   *
   * @param key - Cache key to retrieve
   * @returns Cached value if exists, undefined otherwise
   */
  public get(key: TKey): TValue | undefined {
    const value = this.cache.get(key);

    if (value !== undefined) {
      // Update access order: remove and re-add to mark as most recent
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.accessOrder.push(key);
    }

    return value;
  }

  /**
   * Adds or updates a value in the cache
   *
   * If the cache is at maximum capacity and this is a new key,
   * the least recently used entry will be evicted.
   *
   * @param key - Cache key
   * @param value - Value to cache
   */
  public set(key: TKey, value: TValue): void {
    // If at capacity and this is a new key, evict LRU
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const lru = this.accessOrder.shift();
      if (lru !== undefined) {
        this.cache.delete(lru);
      }
    }

    this.cache.set(key, value);

    // Update access order
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
  }

  /**
   * Removes all entries from the cache
   */
  public clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Gets the current number of entries in the cache
   *
   * @returns Number of cached entries
   */
  public get size(): number {
    return this.cache.size;
  }
}
