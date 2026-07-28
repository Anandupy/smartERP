import { Injectable, Logger } from '@nestjs/common';
import { INavigationCache } from './navigation-cache.interface';

interface CacheEntry {
  value: any;
  expiresAt: number | null;
}

@Injectable()
export class MemoryNavigationCacheService implements INavigationCache {
  private readonly logger = new Logger(MemoryNavigationCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.cache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regexStr = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexStr}$`);
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.logger.debug(
      `Invalidated ${count} cache entries matching pattern "${pattern}"`,
    );
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}
