import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysService, API_KEY_SCOPES } from './apikeys.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  const mockPrismaService = {
    apiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createApiKey', () => {
    it('should create a new API key', async () => {
      const mockCreatedKey = {
        id: 'key-1',
        name: 'CI/CD Key',
        keyPrefix: 'td_abc12345',
        scopes: ['scans:trigger', 'findings:read'],
        expiresAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };

      mockPrismaService.apiKey.create.mockResolvedValue(mockCreatedKey);

      const result = await service.createApiKey('tenant-1', 'user-1', {
        name: 'CI/CD Key',
        scopes: ['scans:trigger', 'findings:read'],
      });

      expect(result.apiKey.name).toBe('CI/CD Key');
      expect(result.rawKey).toBeDefined();
      expect(result.rawKey.startsWith('td_')).toBe(true);
      expect(mockPrismaService.apiKey.create).toHaveBeenCalled();
    });

    it('should filter out invalid scopes', async () => {
      const mockCreatedKey = {
        id: 'key-1',
        name: 'Test Key',
        keyPrefix: 'td_abc12345',
        scopes: ['scans:read'],
        expiresAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };

      mockPrismaService.apiKey.create.mockResolvedValue(mockCreatedKey);

      await service.createApiKey('tenant-1', 'user-1', {
        name: 'Test Key',
        scopes: ['scans:read', 'invalid:scope', 'another:invalid'],
      });

      expect(mockPrismaService.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scopes: ['scans:read'],
          }),
        }),
      );
    });

    it('should throw error when no valid scopes provided', async () => {
      await expect(
        service.createApiKey('tenant-1', 'user-1', {
          name: 'Test Key',
          scopes: ['invalid:scope'],
        }),
      ).rejects.toThrow('At least one valid scope is required');
    });

    it('should set expiration date when provided', async () => {
      const expiresAt = new Date('2025-12-31');
      const mockCreatedKey = {
        id: 'key-1',
        name: 'Temp Key',
        keyPrefix: 'td_abc12345',
        scopes: ['scans:read'],
        expiresAt,
        lastUsedAt: null,
        createdAt: new Date(),
      };

      mockPrismaService.apiKey.create.mockResolvedValue(mockCreatedKey);

      const result = await service.createApiKey('tenant-1', 'user-1', {
        name: 'Temp Key',
        scopes: ['scans:read'],
        expiresAt,
      });

      expect(result.apiKey.expiresAt).toEqual(expiresAt);
    });
  });

  describe('listApiKeys', () => {
    it('should list API keys for user', async () => {
      const mockKeys = [
        { id: 'key-1', name: 'Key 1', keyPrefix: 'td_abc', scopes: ['scans:read'] },
        { id: 'key-2', name: 'Key 2', keyPrefix: 'td_def', scopes: ['findings:read'] },
      ];

      mockPrismaService.apiKey.findMany.mockResolvedValue(mockKeys);

      const result = await service.listApiKeys('tenant-1', 'user-1');

      expect(result).toHaveLength(2);
      expect(mockPrismaService.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', userId: 'user-1' },
        }),
      );
    });
  });

  describe('deleteApiKey', () => {
    it('should delete API key', async () => {
      mockPrismaService.apiKey.findFirst.mockResolvedValue({
        id: 'key-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      });
      mockPrismaService.apiKey.delete.mockResolvedValue({});

      await service.deleteApiKey('tenant-1', 'user-1', 'key-1');

      expect(mockPrismaService.apiKey.delete).toHaveBeenCalledWith({
        where: { id: 'key-1' },
      });
    });

    it('should throw NotFoundException when key not found', async () => {
      mockPrismaService.apiKey.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteApiKey('tenant-1', 'user-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateApiKey', () => {
    it('should validate a valid API key', async () => {
      const mockKey = {
        id: 'key-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        scopes: ['scans:read', 'findings:read'],
        expiresAt: null,
        user: { email: 'user@example.com', status: 'active' },
        tenant: { isActive: true },
      };

      mockPrismaService.apiKey.findFirst.mockResolvedValue(mockKey);
      mockPrismaService.apiKey.update.mockResolvedValue({});

      const result = await service.validateApiKey('td_testkey123456789');

      expect(result.valid).toBe(true);
      expect(result.tenantId).toBe('tenant-1');
      expect(result.userId).toBe('user-1');
      expect(result.scopes).toContain('scans:read');
    });

    it('should reject invalid key prefix', async () => {
      const result = await service.validateApiKey('invalid_key');

      expect(result.valid).toBe(false);
    });

    it('should reject expired key', async () => {
      const mockKey = {
        id: 'key-1',
        expiresAt: new Date('2020-01-01'), // Expired
        user: { status: 'active' },
        tenant: { isActive: true },
      };

      mockPrismaService.apiKey.findFirst.mockResolvedValue(mockKey);

      const result = await service.validateApiKey('td_testkey123456789');

      expect(result.valid).toBe(false);
    });

    it('should reject key from inactive user', async () => {
      const mockKey = {
        id: 'key-1',
        expiresAt: null,
        user: { status: 'disabled' },
        tenant: { isActive: true },
      };

      mockPrismaService.apiKey.findFirst.mockResolvedValue(mockKey);

      const result = await service.validateApiKey('td_testkey123456789');

      expect(result.valid).toBe(false);
    });

    it('should reject key from inactive tenant', async () => {
      const mockKey = {
        id: 'key-1',
        expiresAt: null,
        user: { status: 'active' },
        tenant: { isActive: false },
      };

      mockPrismaService.apiKey.findFirst.mockResolvedValue(mockKey);

      const result = await service.validateApiKey('td_testkey123456789');

      expect(result.valid).toBe(false);
    });

    it('should reject non-existent key', async () => {
      mockPrismaService.apiKey.findFirst.mockResolvedValue(null);

      const result = await service.validateApiKey('td_nonexistent123456');

      expect(result.valid).toBe(false);
    });
  });

  describe('hasScope', () => {
    it('should return true for exact scope match', () => {
      const result = service.hasScope(['scans:read', 'findings:read'], 'scans:read');
      expect(result).toBe(true);
    });

    it('should return false when scope not present', () => {
      const result = service.hasScope(['scans:read'], 'findings:read');
      expect(result).toBe(false);
    });

    it('should support wildcard scopes', () => {
      const result = service.hasScope(['scans:*'], 'scans:trigger');
      expect(result).toBe(true);
    });
  });

  describe('rotateApiKey', () => {
    it('should rotate API key', async () => {
      const existingKey = {
        id: 'old-key',
        name: 'My Key',
        scopes: ['scans:read', 'findings:read'],
        expiresAt: null,
      };

      const newKey = {
        id: 'new-key',
        name: 'My Key',
        keyPrefix: 'td_newkey',
        scopes: ['scans:read', 'findings:read'],
        expiresAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      };

      mockPrismaService.apiKey.findFirst.mockResolvedValue(existingKey);
      mockPrismaService.apiKey.create.mockResolvedValue(newKey);
      mockPrismaService.apiKey.delete.mockResolvedValue({});

      const result = await service.rotateApiKey('tenant-1', 'user-1', 'old-key');

      expect(result.apiKey.id).toBe('new-key');
      expect(result.rawKey).toBeDefined();
      expect(mockPrismaService.apiKey.delete).toHaveBeenCalledWith({
        where: { id: 'old-key' },
      });
    });

    it('should throw NotFoundException when key not found', async () => {
      mockPrismaService.apiKey.findFirst.mockResolvedValue(null);

      await expect(
        service.rotateApiKey('tenant-1', 'user-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('API_KEY_SCOPES', () => {
    it('should contain expected scopes', () => {
      expect(API_KEY_SCOPES).toContain('scans:read');
      expect(API_KEY_SCOPES).toContain('scans:trigger');
      expect(API_KEY_SCOPES).toContain('findings:read');
      expect(API_KEY_SCOPES).toContain('findings:update');
      expect(API_KEY_SCOPES).toContain('repositories:read');
      expect(API_KEY_SCOPES).toContain('baselines:read');
      expect(API_KEY_SCOPES).toContain('baselines:manage');
    });
  });
});
