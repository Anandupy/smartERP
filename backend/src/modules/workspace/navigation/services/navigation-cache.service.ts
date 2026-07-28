import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  INavigationCache,
  INAVIGATION_CACHE,
} from '../cache/navigation-cache.interface';

@Injectable()
export class NavigationCacheService {
  private readonly logger = new Logger(NavigationCacheService.name);

  constructor(
    @Inject(INAVIGATION_CACHE)
    private readonly cache: INavigationCache,
  ) {}

  private getUserNavKey(userId: string, role: string): string {
    return `workspace:nav:user:${userId}:${role}`;
  }

  async getUserNavigation<T = any>(
    userId: string,
    role: string,
  ): Promise<T | null> {
    const key = this.getUserNavKey(userId, role);
    return this.cache.get(key);
  }

  async setUserNavigation(
    userId: string,
    role: string,
    tree: any,
    ttlSeconds = 300,
  ): Promise<void> {
    const key = this.getUserNavKey(userId, role);
    await this.cache.set(key, tree, ttlSeconds);
  }

  async invalidateUserNavigation(userId: string, role: string): Promise<void> {
    const key = this.getUserNavKey(userId, role);
    await this.cache.del(key);
  }

  async invalidateAllNavigation(): Promise<void> {
    this.logger.log('Invalidating all user navigation caches');
    await this.cache.invalidatePattern('workspace:nav:*');
  }
}
