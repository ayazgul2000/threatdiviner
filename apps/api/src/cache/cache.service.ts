import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null = null;
  private readonly defaultTtl: number;
  private readonly keyPrefix: string;
  private readonly inMemoryCache = new Map<string, { value: any; expiry: number }>();

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get('REDIS_URL');
    this.defaultTtl = parseInt(this.configService.get('CACHE_TTL_SECONDS', '300'), 10);
    this.keyPrefix = this.configService.get('CACHE_KEY_PREFIX', 'td:');

    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 100, 3000);
          },
        });

        this.redis.on('connect', () => {
          this.logger.log('Redis connected');
        });

        this.redis.on('error', (err) => {
          this.logger.error(`Redis error: ${err.message}`);
        });
      } catch (error) {
        this.logger.warn(`Failed to connect to Redis: ${error}`);
      }
    } else {
      this.logger.warn('Redis not configured - using in-memory cache');
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.keyPrefix + key;

    if (this.redis) {
      try {
        const value = await this.redis.get(prefixedKey);
        if (value) {
          return JSON.parse(value) as T;
        }
      } catch (error) {
        this.logger.error(`Cache get error: ${error}`);
      }
    } else {
      // In-memory fallback
      const cached = this.inMemoryCache.get(prefixedKey);
      if (cached && cached.expiry > Date.now()) {
        return cached.value as T;
      } else if (cached) {
        this.inMemoryCache.delete(prefixedKey);
      }
    }

    return null;
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const prefixedKey = (options?.prefix || this.keyPrefix) + key;
    const ttl = options?.ttl || this.defaultTtl;

    if (this.redis) {
      try {
        await this.redis.setex(prefixedKey, ttl, JSON.stringify(value));
      } catch (error) {
        this.logger.error(`Cache set error: ${error}`);
      }
    } else {
      // In-memory fallback
      this.inMemoryCache.set(prefixedKey, {
        value,
        expiry: Date.now() + ttl * 1000,
      });
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<void> {
    const prefixedKey = this.keyPrefix + key;

    if (this.redis) {
      try {
        await this.redis.del(prefixedKey);
      } catch (error) {
        this.logger.error(`Cache del error: ${error}`);
      }
    } else {
      this.inMemoryCache.delete(prefixedKey);
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    const prefixedPattern = this.keyPrefix + pattern;

    if (this.redis) {
      try {
        const keys = await this.redis.keys(prefixedPattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        this.logger.error(`Cache delPattern error: ${error}`);
      }
    } else {
      // In-memory fallback
      const regex = new RegExp(prefixedPattern.replace(/\*/g, '.*'));
      for (const key of this.inMemoryCache.keys()) {
        if (regex.test(key)) {
          this.inMemoryCache.delete(key);
        }
      }
    }
  }

  /**
   * Get or set - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fn();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Invalidate cache for a tenant
   */
  async invalidateTenant(tenantId: string): Promise<void> {
    await this.delPattern(`tenant:${tenantId}:*`);
  }

  /**
   * Invalidate cache for a repository
   */
  async invalidateRepository(repositoryId: string): Promise<void> {
    await this.delPattern(`repo:${repositoryId}:*`);
  }

  /**
   * Invalidate cache for a scan
   */
  async invalidateScan(scanId: string): Promise<void> {
    await this.delPattern(`scan:${scanId}:*`);
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.redis !== null && this.redis.status === 'ready';
  }
}
