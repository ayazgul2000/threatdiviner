import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createTestApp } from './setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('ScansController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  const mockPrismaService = {
    scan: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    repository: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    scanConfig: {
      findFirst: jest.fn(),
    },
    finding: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
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
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = await createTestApp(moduleFixture);

    // Generate test auth token
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
      name: 'Test Tenant',
      isActive: true,
    });
    mockPrismaService.user.findUnique.mockResolvedValue(testUser);
  });

  describe('/scans (GET)', () => {
    it('should require authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/scans');

      expect(response.status).toBe(401);
    });

    it('should list scans for authenticated user', async () => {
      mockPrismaService.scan.findMany.mockResolvedValue([
        {
          id: 'scan-1',
          tenantId: 'tenant-1',
          repositoryId: 'repo-1',
          status: 'completed',
          branch: 'main',
          commitSha: 'abc123',
          createdAt: new Date(),
        },
      ]);
      mockPrismaService.scan.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/scans')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('should support pagination', async () => {
      mockPrismaService.scan.findMany.mockResolvedValue([]);
      mockPrismaService.scan.count.mockResolvedValue(0);

      const response = await request(app.getHttpServer())
        .get('/scans?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    it('should filter by repository', async () => {
      mockPrismaService.scan.findMany.mockResolvedValue([]);
      mockPrismaService.scan.count.mockResolvedValue(0);

      const response = await request(app.getHttpServer())
        .get('/scans?repositoryId=repo-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(mockPrismaService.scan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            repositoryId: 'repo-1',
          }),
        }),
      );
    });
  });

  describe('/scans/:id (GET)', () => {
    it('should return scan details', async () => {
      const mockScan = {
        id: 'scan-1',
        tenantId: 'tenant-1',
        status: 'completed',
        branch: 'main',
        commitSha: 'abc123',
        repository: { fullName: 'owner/repo' },
        findings: [],
        createdAt: new Date(),
      };

      mockPrismaService.scan.findFirst.mockResolvedValue(mockScan);

      const response = await request(app.getHttpServer())
        .get('/scans/scan-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('scan-1');
    });

    it('should return 404 for non-existent scan', async () => {
      mockPrismaService.scan.findFirst.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/scans/nonexistent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('/scans (POST)', () => {
    it('should require repositoryId', async () => {
      const response = await request(app.getHttpServer())
        .post('/scans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should trigger scan for valid repository', async () => {
      mockPrismaService.repository.findFirst.mockResolvedValue({
        id: 'repo-1',
        tenantId: 'tenant-1',
        fullName: 'owner/repo',
        connection: {
          accessToken: 'encrypted-token',
        },
      });
      mockPrismaService.scan.create.mockResolvedValue({
        id: 'scan-new',
        status: 'queued',
      });

      const response = await request(app.getHttpServer())
        .post('/scans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          repositoryId: 'repo-1',
        });

      // Should not error (may be 201 or 202)
      expect(response.status).toBeLessThan(400);
    });
  });

  describe('/scans/:id/findings (GET)', () => {
    it('should return findings for scan', async () => {
      mockPrismaService.scan.findFirst.mockResolvedValue({
        id: 'scan-1',
        tenantId: 'tenant-1',
      });
      mockPrismaService.finding.findMany.mockResolvedValue([
        {
          id: 'finding-1',
          title: 'SQL Injection',
          severity: 'high',
          status: 'open',
        },
      ]);
      mockPrismaService.finding.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/scans/scan-1/findings')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    it('should support severity filter', async () => {
      mockPrismaService.scan.findFirst.mockResolvedValue({
        id: 'scan-1',
        tenantId: 'tenant-1',
      });
      mockPrismaService.finding.findMany.mockResolvedValue([]);
      mockPrismaService.finding.count.mockResolvedValue(0);

      const response = await request(app.getHttpServer())
        .get('/scans/scan-1/findings?severity=critical,high')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });
});
