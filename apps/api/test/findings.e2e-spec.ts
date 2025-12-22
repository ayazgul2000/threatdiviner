import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createTestApp } from './setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('FindingsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  const mockPrismaService = {
    finding: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    scan: {
      findFirst: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
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

  describe('/findings (GET)', () => {
    it('should require authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/findings');

      expect(response.status).toBe(401);
    });

    it('should list findings', async () => {
      mockPrismaService.finding.findMany.mockResolvedValue([
        {
          id: 'finding-1',
          title: 'SQL Injection',
          severity: 'high',
          status: 'open',
          scanner: 'semgrep',
          ruleId: 'sql-injection-001',
          filePath: 'src/db.ts',
          createdAt: new Date(),
        },
      ]);
      mockPrismaService.finding.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get('/findings')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('should filter by severity', async () => {
      mockPrismaService.finding.findMany.mockResolvedValue([]);
      mockPrismaService.finding.count.mockResolvedValue(0);

      const response = await request(app.getHttpServer())
        .get('/findings?severity=critical,high')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(mockPrismaService.finding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severity: { in: ['critical', 'high'] },
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrismaService.finding.findMany.mockResolvedValue([]);
      mockPrismaService.finding.count.mockResolvedValue(0);

      const response = await request(app.getHttpServer())
        .get('/findings?status=open,triaged')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('/findings/:id (GET)', () => {
    it('should return finding details', async () => {
      mockPrismaService.finding.findFirst.mockResolvedValue({
        id: 'finding-1',
        tenantId: 'tenant-1',
        title: 'SQL Injection',
        severity: 'high',
        status: 'open',
        description: 'SQL injection vulnerability found',
        filePath: 'src/db.ts',
        startLine: 42,
        snippet: 'db.query(`SELECT * FROM users WHERE id = ${userId}`)',
        scan: {
          repository: { fullName: 'owner/repo' },
        },
      });

      const response = await request(app.getHttpServer())
        .get('/findings/finding-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('finding-1');
      expect(response.body.title).toBe('SQL Injection');
    });

    it('should return 404 for non-existent finding', async () => {
      mockPrismaService.finding.findFirst.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/findings/nonexistent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('/findings/:id (PATCH)', () => {
    it('should update finding status', async () => {
      mockPrismaService.finding.findFirst.mockResolvedValue({
        id: 'finding-1',
        tenantId: 'tenant-1',
        status: 'open',
      });
      mockPrismaService.finding.update.mockResolvedValue({
        id: 'finding-1',
        status: 'triaged',
      });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const response = await request(app.getHttpServer())
        .patch('/findings/finding-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'triaged',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('triaged');
    });

    it('should validate status values', async () => {
      const response = await request(app.getHttpServer())
        .patch('/findings/finding-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid_status',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('/findings/stats (GET)', () => {
    it('should return finding statistics', async () => {
      mockPrismaService.finding.groupBy.mockResolvedValue([
        { severity: 'critical', _count: 5 },
        { severity: 'high', _count: 10 },
        { severity: 'medium', _count: 20 },
        { severity: 'low', _count: 30 },
      ]);
      mockPrismaService.finding.count.mockResolvedValue(65);

      const response = await request(app.getHttpServer())
        .get('/findings/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total');
    });
  });
});
