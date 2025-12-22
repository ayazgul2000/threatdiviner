import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SemgrepScanner } from './semgrep.scanner';
import { LocalExecutorService } from '../../execution';
import { SarifParser } from '../../parsers/sarif.parser';
import { ScanContext, ScanOutput } from '../../interfaces';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

describe('SemgrepScanner', () => {
  let scanner: SemgrepScanner;

  const mockExecutor = {
    isCommandAvailable: jest.fn(),
    getCommandVersion: jest.fn(),
    execute: jest.fn(),
  };

  const mockSarifParser = {
    parse: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        SEMGREP_PATH: 'semgrep',
        SEMGREP_USE_LOCAL_RULES: 'false',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SemgrepScanner,
        { provide: LocalExecutorService, useValue: mockExecutor },
        { provide: SarifParser, useValue: mockSarifParser },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    scanner = module.get<SemgrepScanner>(SemgrepScanner);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(scanner).toBeDefined();
  });

  it('should have correct metadata', () => {
    expect(scanner.name).toBe('semgrep');
    expect(scanner.outputFormat).toBe('sarif');
    expect(scanner.supportedLanguages).toContain('typescript');
    expect(scanner.supportedLanguages).toContain('python');
    expect(scanner.supportedLanguages).toContain('go');
  });

  describe('isAvailable', () => {
    it('should check if semgrep is available', async () => {
      mockExecutor.isCommandAvailable.mockResolvedValue(true);

      const result = await scanner.isAvailable();

      expect(result).toBe(true);
      expect(mockExecutor.isCommandAvailable).toHaveBeenCalledWith('semgrep');
    });

    it('should return false when not available', async () => {
      mockExecutor.isCommandAvailable.mockResolvedValue(false);

      const result = await scanner.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('getVersion', () => {
    it('should get semgrep version', async () => {
      mockExecutor.getCommandVersion.mockResolvedValue('1.52.0');

      const result = await scanner.getVersion();

      expect(result).toBe('1.52.0');
      expect(mockExecutor.getCommandVersion).toHaveBeenCalledWith('semgrep', '--version');
    });
  });

  describe('scan', () => {
    const mockContext: ScanContext = {
      scanId: 'scan-123',
      workDir: '/tmp/scan-123',
      timeout: 300000,
      excludePaths: ['node_modules', 'vendor'],
      languages: ['typescript', 'javascript'],
      targetPaths: [],
    };

    it('should execute scan with correct arguments', async () => {
      mockExecutor.execute.mockResolvedValue({
        scanner: 'semgrep',
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 5000,
        timedOut: false,
      });
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await scanner.scan(mockContext);

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'semgrep',
          cwd: mockContext.workDir,
          timeout: mockContext.timeout,
        }),
      );

      expect(result.outputFile).toBeDefined();
    });

    it('should handle missing output file', async () => {
      mockExecutor.execute.mockResolvedValue({
        scanner: 'semgrep',
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 5000,
        timedOut: false,
      });
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await scanner.scan(mockContext);

      expect(result.outputFile).toBeUndefined();
    });
  });

  describe('parseOutput', () => {
    it('should parse SARIF output', async () => {
      const mockFindings = [
        { id: 'f1', title: 'SQL Injection', severity: 'high' },
      ];

      const mockOutput: ScanOutput = {
        scanner: 'semgrep',
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 5000,
        timedOut: false,
        outputFile: '/tmp/semgrep-results.sarif',
      };

      (fs.readFile as jest.Mock).mockResolvedValue('{"runs":[]}');
      mockSarifParser.parse.mockReturnValue(mockFindings);

      const result = await scanner.parseOutput(mockOutput);

      expect(result).toEqual(mockFindings);
      expect(mockSarifParser.parse).toHaveBeenCalledWith('{"runs":[]}', 'semgrep');
    });

    it('should return empty array when no output file', async () => {
      const mockOutput: ScanOutput = {
        scanner: 'semgrep',
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 5000,
        timedOut: false,
      };

      const result = await scanner.parseOutput(mockOutput);

      expect(result).toEqual([]);
    });

    it('should handle parse errors', async () => {
      const mockOutput: ScanOutput = {
        scanner: 'semgrep',
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 5000,
        timedOut: false,
        outputFile: '/tmp/semgrep-results.sarif',
      };

      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Read error'));

      const result = await scanner.parseOutput(mockOutput);

      expect(result).toEqual([]);
    });
  });
});
