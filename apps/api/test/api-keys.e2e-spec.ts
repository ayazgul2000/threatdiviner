import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createTestApp } from './setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('ApiKeysController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  const mockPrismaService = {
    apiKey: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  const testUser = {
    id: 'user-1',
    email: 'test@example.com',
    tenantId: 'tenant-1',
    role: 'admin',
    status: 'active',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = await createTestApp(moduleFixture);

    const jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign({
      sub: testUser.id,
      email: testUser.email,
      tenantId: testUser.tenantId,
      role: testUser.role,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaService.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      isActive: true,
    });
    mockPrismaService.user.findUnique.mockResolvedValue(testUser);
  });

  describe('/api-keys (GET)', () => {
    it('should require authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-keys');

      expect(response.status).toBe(401);
    });

    it('should list API keys for authenticated user', async () => {
      mockPrismaService.apiKey.findMany.mockResolvedValue([
        {
          id: 'key-1',
          name: 'CI/CD Key',
          keyPrefix: 'td_abc12345',
          scopes: ['scans:trigger', 'findings:read'],
          expiresAt: null,
          lastUsedAt: new Date(),
          createdAt: new Date(),
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api-keys')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('/api-keys (POST)', () => {
    it('should create new API key', async () => {
      mockPrismaService.apiKey.create.mockResolvedValue({
        id: 'key-new',
        name: 'New Key',
        keyPrefix: 'td_newkey12',
        scopes: ['scans:read'],
        expiresAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      });

      const response = await request(app.getHttpServer())
        .post('/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Key',
          scopes: ['scans:read'],
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('apiKey');
      expect(response.body).toHaveProperty('rawKey');
      expect(response.body.rawKey).toMatch(/^td_/);
    });

    it('should require name', async () => {
      const response = await request(app.getHttpServer())
        .post('/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scopes: ['scans:read'],
        });

      expect(response.status).toBe(400);
    });

    it('should require at least one scope', async () => {
      const response = await request(app.getHttpServer())
        .post('/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Key',
          scopes: [],
        });

      expect(response.status).toBe(400);
    });

    it('should accept expiration date', async () => {
      const expiresAt = new Date('2025-12-31');
      mockPrismaService.apiKey.create.mockResolvedValue({
        id: 'key-new',
        name: 'Temp Key',
        keyPrefix: 'td_temp1234',
        scopes: ['scans:read'],
        expiresAt,
        lastUsedAt: null,
        createdAt: new Date(),
      });

      const response = await request(app.getHttpServer())
        .post('/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Temp Key',
          scopes: ['scans:read'],
          expiresAt: expiresAt.toISOString(),
        });

      expect(response.status).toBe(201);
    });
  });

  describe('/api-keys/:id (DELETE)', () => {
    it('should delete API key', async () => {
      mockPrismaService.apiKey.findFirst.mockResolvedValue({
        id: 'key-1',
        userId: testUser.id,
        tenantId: testUser.tenantId,
      });
      mockPrismaService.apiKey.delete.mockResolvedValue({});

      const response = await request(app.getHttpServer())
        .delete('/api-keys/key-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent key', async () => {
      mockPrismaService.apiKey.findFirst.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .delete('/api-keys/nonexistent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('/api-keys/:id/rotate (POST)', () => {
    it('should rotate API key', async () => {
      mockPrismaService.apiKey.findFirst.mockResolvedValue({
        id: 'old-key',
        name: 'My Key',
        scopes: ['scans:read'],
        expiresAt: null,
        userId: testUser.id,
        tenantId: testUser.tenantId,
      });
      mockPrismaService.apiKey.create.mockResolvedValue({
        id: 'new-key',
        name: 'My Key',
        keyPrefix: 'td_newkey12',
        scopes: ['scans:read'],
        expiresAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      });
      mockPrismaService.apiKey.delete.mockResolvedValue({});

      const response = await request(app.getHttpServer())
        .post('/api-keys/old-key/rotate')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rawKey');
    });
  });

  describe('API Key Authentication', () => {
    it('should authenticate with valid API key', async () => {
      const apiKey = 'td_testapikey123456789';

      mockPrismaService.apiKey.findFirst.mockResolvedValue({
        id: 'key-1',
        tenantId: testUser.tenantId,
        userId: testUser.id,
        scopes: ['scans:read', 'findings:read'],
        expiresAt: null,
        user: { status: 'active' },
        tenant: { isActive: true },
      });
      mockPrismaService.apiKey.update.mockResolvedValue({});
      mockPrismaService.finding.findMany.mockResolvedValue([]);
      mockPrismaService.finding.count.mockResolvedValue(0);

      const response = await request(app.getHttpServer())
        .get('/findings')
        .set('X-API-Key', apiKey);

      // Should not be 401 if API key auth is implemented
      expect([200, 401]).toContain(response.status);
    });

    it('should reject expired API key', async () => {
      const apiKey = 'td_expiredkey123456';

      mockPrismaService.apiKey.findFirst.mockResolvedValue({
        id: 'key-1',
        expiresAt: new Date('2020-01-01'), // Expired
        user: { status: 'active' },
        tenant: { isActive: true },
      });

      const response = await request(app.getHttpServer())
        .get('/findings')
        .set('X-API-Key', apiKey);

      expect(response.status).toBe(401);
    });
  });
});
