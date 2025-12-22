import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../scm/services/crypto.service';
import { SlackService } from './slack/slack.service';
import { EmailService } from './email/email.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrismaService = {
    notificationConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    finding: {
      findMany: jest.fn(),
    },
  };

  const mockCryptoService = {
    encrypt: jest.fn((value: string) => `encrypted:${value}`),
    decrypt: jest.fn((value: string) => value.replace('encrypted:', '')),
  };

  const mockSlackService = {
    sendTestMessage: jest.fn(),
    sendScanStarted: jest.fn(),
    sendScanCompleted: jest.fn(),
    sendCriticalFinding: jest.fn(),
  };

  const mockEmailService = {
    sendScanComplete: jest.fn(),
    sendCriticalFinding: jest.fn(),
    sendTestEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CryptoService, useValue: mockCryptoService },
        { provide: SlackService, useValue: mockSlackService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfig', () => {
    it('should return notification config for tenant', async () => {
      const mockConfig = {
        id: 'config-1',
        tenantId: 'tenant-1',
        slackEnabled: true,
        slackWebhookUrl: 'encrypted:https://hooks.slack.com/test',
        emailEnabled: false,
        emailRecipients: [],
      };

      mockPrismaService.notificationConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.getConfig('tenant-1');

      expect(result).toBeDefined();
      expect(result?.slackEnabled).toBe(true);
    });

    it('should return null if config not found', async () => {
      mockPrismaService.notificationConfig.findUnique.mockResolvedValue(null);

      const result = await service.getConfig('tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('should update notification config', async () => {
      const dto = {
        slackEnabled: true,
        emailEnabled: true,
        emailRecipients: ['test@example.com'],
      };

      const updatedConfig = {
        id: 'config-1',
        tenantId: 'tenant-1',
        ...dto,
        slackWebhookUrl: null,
      };

      mockPrismaService.notificationConfig.upsert.mockResolvedValue(updatedConfig);

      const result = await service.updateConfig('tenant-1', dto);

      expect(result.slackEnabled).toBe(true);
      expect(result.emailEnabled).toBe(true);
    });
  });

  describe('testSlack', () => {
    it('should return error if webhook not configured', async () => {
      mockPrismaService.notificationConfig.findUnique.mockResolvedValue({
        slackWebhookUrl: null,
      });

      const result = await service.testSlack('tenant-1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });

    it('should send test message if configured', async () => {
      mockPrismaService.notificationConfig.findUnique.mockResolvedValue({
        slackWebhookUrl: 'encrypted:https://hooks.slack.com/test',
        tenant: { name: 'Test Tenant' },
      });
      mockSlackService.sendTestMessage.mockResolvedValue(true);

      const result = await service.testSlack('tenant-1');

      expect(result.success).toBe(true);
      expect(mockSlackService.sendTestMessage).toHaveBeenCalled();
    });
  });

  describe('testEmail', () => {
    it('should send test email', async () => {
      mockEmailService.sendTestEmail.mockResolvedValue(true);

      const result = await service.testEmail('tenant-1', 'test@example.com');

      expect(result.success).toBe(true);
      expect(mockEmailService.sendTestEmail).toHaveBeenCalledWith('test@example.com');
    });
  });
});
