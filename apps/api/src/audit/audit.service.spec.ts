import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      const entry = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        userEmail: 'test@example.com',
        action: 'scan.trigger' as const,
        resource: 'scan' as const,
        resourceId: 'scan-1',
      };

      const expectedResult = {
        id: 'log-1',
        ...entry,
        details: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(expectedResult);

      const result = await service.log(entry);

      expect(result).toEqual(expectedResult);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: entry.tenantId,
          action: entry.action,
          resource: entry.resource,
        }),
      });
    });
  });

  describe('query', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [
        { id: 'log-1', action: 'scan.trigger', resource: 'scan' },
        { id: 'log-2', action: 'user.login', resource: 'user' },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(2);

      const result = await service.query({
        tenantId: 'tenant-1',
        limit: 10,
        offset: 0,
      });

      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should delete old audit logs', async () => {
      mockPrismaService.auditLog.deleteMany.mockResolvedValue({ count: 100 });

      const result = await service.cleanup(90);

      expect(result).toBe(100);
      expect(mockPrismaService.auditLog.deleteMany).toHaveBeenCalled();
    });
  });
});
