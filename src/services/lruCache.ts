import { logger } from "./loggerService";

interface CacheEntry<T> {
  value: T;
  expiry: number;
  lastUsed: number;
}

/**
 * LRUCache - Least Recently Used cache with TTL support.
 */
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly capacity: number;

  constructor(capacity: number = 50) {
    this.capacity = capacity;
  }

  /**
   * Gets an item from the cache.
   */
  public get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      logger.debug(`[LRU] Key expired: ${key}`);
      return null;
    }

    // Refresh LRU position
    this.cache.delete(key);
    entry.lastUsed = Date.now();
    this.cache.set(key, entry);
    
    return entry.value;
  }

  /**
   * Sets an item in the cache with dynamic TTL.
   */
  public set(key: string, value: T, ttlMs: number): void {
    if (this.cache.size >= this.capacity) {
      // Evict least recently used (the first key in the Map iterator)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
          this.cache.delete(firstKey);
          logger.debug(`[LRU] Evicted key: ${firstKey} (Capacity: ${this.capacity})`);
      }
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
      lastUsed: Date.now()
    });
    
    logger.debug(`[LRU] Cached key: ${key} (TTL: ${ttlMs}ms)`);
  }

  /**
   * Clears the cache.
   */
  public clear(): void {
    this.cache.clear();
  }
}

export const lruCache = new LRUCache<any>(100);
