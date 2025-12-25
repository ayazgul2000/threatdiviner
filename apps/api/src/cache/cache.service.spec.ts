import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          CACHE_TTL_SECONDS: '300',
          CACHE_KEY_PREFIX: 'test:',
          // No REDIS_URL - forces in-memory mode
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('in-memory cache', () => {
    it('should set and get a value', async () => {
      await service.set('test-key', { foo: 'bar' });
      const result = await service.get<{ foo: string }>('test-key');

      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent key', async () => {
      const result = await service.get('non-existent');
      expect(result).toBeNull();
    });

    it('should delete a value', async () => {
      await service.set('to-delete', 'value');
      await service.del('to-delete');
      const result = await service.get('to-delete');

      expect(result).toBeNull();
    });

    it('should handle getOrSet correctly', async () => {
      const fn = jest.fn().mockResolvedValue({ computed: true });

      // First call should execute function
      const result1 = await service.getOrSet('computed-key', fn);
      expect(result1).toEqual({ computed: true });
      expect(fn).toHaveBeenCalledTimes(1);

      // Second call should return cached value
      const result2 = await service.getOrSet('computed-key', fn);
      expect(result2).toEqual({ computed: true });
      expect(fn).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should handle complex objects', async () => {
      const complexObject = {
        string: 'hello',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: { a: 'b' },
        date: new Date().toISOString(),
      };

      await service.set('complex', complexObject);
      const result = await service.get<typeof complexObject>('complex');

      expect(result).toEqual(complexObject);
    });

    it('should respect TTL (simulated)', async () => {
      // Set with 1 second TTL
      await service.set('expires', 'value', { ttl: 1 });

      // Should exist immediately
      const result1 = await service.get('expires');
      expect(result1).toBe('value');

      // Note: We can't easily test TTL expiration in unit tests
      // without mocking Date or waiting. This is typically tested in integration tests.
    });
  });

  describe('invalidation methods', () => {
    it('should invalidate tenant cache', async () => {
      await service.set('tenant:123:data', 'value1');
      await service.set('tenant:123:other', 'value2');
      await service.set('tenant:456:data', 'value3');

      await service.invalidateTenant('123');

      // These should be deleted
      expect(await service.get('tenant:123:data')).toBeNull();
      expect(await service.get('tenant:123:other')).toBeNull();

      // This should still exist
      expect(await service.get('tenant:456:data')).toBe('value3');
    });

    it('should invalidate repository cache', async () => {
      await service.set('repo:abc:findings', 'findings');
      await service.set('repo:abc:scans', 'scans');

      await service.invalidateRepository('abc');

      expect(await service.get('repo:abc:findings')).toBeNull();
      expect(await service.get('repo:abc:scans')).toBeNull();
    });

    it('should invalidate scan cache', async () => {
      await service.set('scan:xyz:results', 'results');

      await service.invalidateScan('xyz');

      expect(await service.get('scan:xyz:results')).toBeNull();
    });
  });

  describe('isRedisAvailable', () => {
    it('should return false when Redis is not configured', () => {
      expect(service.isRedisAvailable()).toBe(false);
    });
  });
});
