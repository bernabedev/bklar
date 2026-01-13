import type { CacheEntry, CacheStore } from "./index";

export class MemoryStore implements CacheStore {
  private cache = new Map<string, { entry: CacheEntry; expires: number }>();
  private interval: Timer;

  constructor(cleanupInterval = 60000) {
    // Periodically clean up expired entries to prevent memory leaks
    this.interval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (value.expires <= now) {
          this.cache.delete(key);
        }
      }
    }, cleanupInterval);

    // Allow process to exit even if interval is running
    if (this.interval.unref) this.interval.unref();
  }

  get(key: string): CacheEntry | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (item.expires <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return item.entry;
  }

  set(key: string, entry: CacheEntry, ttl: number): void {
    this.cache.set(key, {
      entry,
      expires: Date.now() + ttl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
