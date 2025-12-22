import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService, TriageRequest } from './ai.service';

describe('AiService', () => {
  let service: AiService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        ANTHROPIC_API_KEY: null, // Not configured by default
        ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isAvailable', () => {
    it('should return false when API key not configured', async () => {
      const result = await service.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('triageFinding', () => {
    it('should return null when AI not available', async () => {
      const request: TriageRequest = {
        finding: {
          id: 'finding-1',
          title: 'SQL Injection',
          description: 'Potential SQL injection vulnerability',
          severity: 'high',
          ruleId: 'sql-injection-001',
          filePath: 'src/db.ts',
          startLine: 42,
          snippet: 'db.query(`SELECT * FROM users WHERE id = ${userId}`)',
        },
      };

      const result = await service.triageFinding(request);
      expect(result).toBeNull();
    });
  });

  describe('batchTriageFindings', () => {
    it('should process batch requests and return map of results', async () => {
      const requests: TriageRequest[] = [
        {
          finding: {
            id: 'finding-1',
            title: 'XSS',
            description: 'Cross-site scripting',
            severity: 'medium',
            ruleId: 'xss-001',
            filePath: 'src/render.ts',
            startLine: 10,
          },
        },
        {
          finding: {
            id: 'finding-2',
            title: 'SQL Injection',
            description: 'SQL injection',
            severity: 'high',
            ruleId: 'sqli-001',
            filePath: 'src/db.ts',
            startLine: 20,
          },
        },
      ];

      const results = await service.batchTriageFindings(requests);

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(2);
      expect(results.get('finding-1')).toBeNull(); // AI not available
      expect(results.get('finding-2')).toBeNull();
    });
  });
});

describe('AiService with API key', () => {
  let service: AiService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        ANTHROPIC_API_KEY: 'test-api-key',
        ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be available when API key is configured', async () => {
    const result = await service.isAvailable();
    expect(result).toBe(true);
  });
});
