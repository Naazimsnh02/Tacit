'use client';

const isClient = typeof window !== 'undefined';

// Client-side in-memory cache to handle fast client-side/SPA transitions
const memoryCache: Record<string, any> = {};

export const tabCache = {
  /**
   * Retrieves an item from the cache. Checks the in-memory cache first, then sessionStorage.
   */
  get<T>(key: string): T | null {
    if (!isClient) return null;

    // Check memory cache (fastest)
    if (key in memoryCache) {
      return memoryCache[key] as T;
    }

    // Fallback to sessionStorage
    try {
      const stored = window.sessionStorage.getItem(`tacit.cache.${key}`);
      if (stored) {
        const parsed = JSON.parse(stored) as T;
        memoryCache[key] = parsed; // Populate memory cache
        return parsed;
      }
    } catch {
      // Ignore storage read/parse errors
    }
    return null;
  },

  /**
   * Saves an item to the cache, storing it in both memory and sessionStorage.
   */
  set<T>(key: string, data: T): void {
    if (!isClient) return;

    // Store in memory
    memoryCache[key] = data;

    // Store in sessionStorage
    try {
      window.sessionStorage.setItem(`tacit.cache.${key}`, JSON.stringify(data));
    } catch {
      // Ignore quota or private browsing errors
    }
  },

  /**
   * Clears a specific key from the cache.
   */
  clear(key: string): void {
    if (!isClient) return;
    delete memoryCache[key];
    try {
      window.sessionStorage.removeItem(`tacit.cache.${key}`);
    } catch {
      // Ignore storage errors
    }
  },

  /**
   * Clears all cache entries associated with a specific project.
   */
  clearAllForProject(projectId: string): void {
    if (!isClient) return;

    // Clear from memory cache
    Object.keys(memoryCache).forEach((key) => {
      if (key.includes(projectId)) {
        delete memoryCache[key];
      }
    });

    // Clear from sessionStorage
    try {
      const prefix = 'tacit.cache.';
      // Safely scan and remove matching keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(prefix) && key.includes(projectId)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
    } catch {
      // Ignore
    }
  }
};
