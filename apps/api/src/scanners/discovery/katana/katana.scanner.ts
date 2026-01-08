import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  IScanner,
  ScanContext,
  ScanOutput,
  NormalizedFinding,
  ScanOutputWithDiscovery,
  DiscoveredParam,
  DiscoveredForm,
} from '../../interfaces';
import { LocalExecutorService } from '../../execution';

interface KatanaDiscoveryOutput extends ScanOutputWithDiscovery {
  discoveredUrls: string[];
  discoveredParams: DiscoveredParam[];
  discoveredForms: DiscoveredForm[];
  jsFiles: string[];
  totalRequests: number;
}

type ScanMode = 'quick' | 'standard' | 'comprehensive';

@Injectable()
export class KatanaScanner implements IScanner {
  readonly name = 'katana';
  readonly version = '1.x';
  readonly supportedLanguages = ['web', 'api'];
  readonly outputFormat = 'json' as const;

  private readonly logger = new Logger(KatanaScanner.name);
  private readonly katanaPath: string;
  private chromeAvailable = false;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly configService: ConfigService,
  ) {
    this.katanaPath = this.configService.get('KATANA_PATH', 'katana');
    this.checkChromeAvailability();
  }

  /**
   * Check if Chrome is available for headless mode (sync check using fs)
   */
  private checkChromeAvailability(): void {
    const fsSync = require('fs');

    // On Windows, check standard Chrome installation paths
    if (process.platform === 'win32') {
      const localAppData = (process.env.LOCALAPPDATA || '').replace(/\\/g, '/');
      const chromePaths = [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        `${localAppData}/Google/Chrome/Application/chrome.exe`,
      ];
      for (const chromePath of chromePaths) {
        if (fsSync.existsSync(chromePath)) {
          this.chromeAvailable = true;
          this.logger.log(`Chrome found at ${chromePath} - headless mode enabled`);
          return;
        }
      }
    } else {
      // On Linux/Mac, check common paths
      const chromePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ];
      for (const chromePath of chromePaths) {
        if (fsSync.existsSync(chromePath)) {
          this.chromeAvailable = true;
          this.logger.log(`Chrome found at ${chromePath} - headless mode enabled`);
          return;
        }
      }
    }
    this.logger.warn('Chrome not found - headless crawling will be disabled');
    this.chromeAvailable = false;
  }

  async isAvailable(): Promise<boolean> {
    return this.executor.isCommandAvailable(this.katanaPath);
  }

  async getVersion(): Promise<string> {
    try {
      const result = await this.executor.execute({
        command: this.katanaPath,
        args: ['-version'],
        cwd: process.cwd(),
        timeout: 10000,
      });
      // Katana outputs version in format: "katana version vX.X.X"
      const versionMatch = result.stdout.match(/v?([\d.]+)/);
      return versionMatch ? versionMatch[1] : '1.x';
    } catch {
      return '1.x';
    }
  }

  async scan(context: ScanContext): Promise<KatanaDiscoveryOutput> {
    const startTime = Date.now();
    const outputFile = path.join(context.workDir, 'katana-output.jsonl');

    // Get target URL
    const targetUrls = context.config?.targetUrls as string[] || [];
    if (targetUrls.length === 0) {
      this.logger.warn('No target URL configured for Katana scan');
      return this.emptyOutput(startTime);
    }

    const targetUrl = targetUrls[0]; // Katana crawls from a single starting point
    const scanMode = (context.config?.scanMode as ScanMode) || 'standard';

    this.logger.log(`Katana crawling ${targetUrl} in ${scanMode} mode`);

    // Progress callback
    const onProgress = context.config?.onProgress as ((progress: { scanner: string; percent: number; phase?: string }) => void) | undefined;

    // Build args based on scan mode
    const args = this.buildArgs(targetUrl, outputFile, scanMode, context);

    // Emit start progress
    if (onProgress) {
      onProgress({ scanner: this.name, percent: 5, phase: 'URL Discovery' });
    }

    try {
      let result = await this.executor.execute({
        command: this.katanaPath,
        args,
        cwd: context.workDir,
        timeout: this.getTimeout(scanMode, context.timeout),
        scanId: context.scanId,
      });

      // Fallback: if headless mode failed, retry without headless flags
      // But NOT if the scan was cancelled (exit code 1 with no output = killed)
      const usedHeadless = args.includes('-headless');
      const wasCancelled = result.exitCode === 1 && !result.stdout?.trim() && !result.timedOut;
      if (usedHeadless && (result.exitCode !== 0 || result.timedOut) && !wasCancelled) {
        this.logger.warn(`Katana headless mode failed (exit=${result.exitCode}, timeout=${result.timedOut}), retrying without headless...`);

        const fallbackArgs = args.filter(arg =>
          ![ '-headless', '-jc', '-js-crawl', '-automatic-form-fill', '-headless-no-sandbox', '-system-chrome' ].includes(arg)
        );

        result = await this.executor.execute({
          command: this.katanaPath,
          args: fallbackArgs,
          cwd: context.workDir,
          timeout: this.getTimeout('standard', context.timeout),
          scanId: context.scanId,
        });
      }

      if (onProgress) {
        onProgress({ scanner: this.name, percent: 90, phase: 'Parsing results' });
      }

      // On Windows, -o flag doesn't write to file properly, so parse stdout directly
      // Write stdout to file for debugging/reference
      if (result.stdout) {
        await fs.writeFile(outputFile, result.stdout, 'utf-8');
      }

      // Parse discovered URLs from stdout (plain URLs, one per line)
      const discovery = await this.parseStdoutUrls(result.stdout, targetUrl);

      if (onProgress) {
        onProgress({ scanner: this.name, percent: 100, phase: 'Complete' });
      }

      this.logger.log(`Katana discovered ${discovery.discoveredUrls.length} URLs, ${discovery.discoveredParams.length} params`);

      return {
        scanner: this.name,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        outputFile,
        duration: Date.now() - startTime,
        timedOut: result.timedOut,
        ...discovery,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Katana scan failed: ${errMsg}`);

      return {
        ...this.emptyOutput(startTime),
        exitCode: 1,
        stderr: errMsg,
      };
    }
  }

  private buildArgs(targetUrl: string, _outputFile: string, scanMode: ScanMode, context: ScanContext): string[] {
    // Note: We don't use -o flag as it doesn't work reliably on Windows
    // Instead we capture stdout which outputs plain URLs (one per line)
    const args = [
      '-u', targetUrl,
      '-silent',         // Suppress banner
      '-nc',             // No color
    ];

    // Mode-specific settings
    switch (scanMode) {
      case 'quick':
        args.push('-d', '2');          // Shallow crawl for speed
        args.push('-c', '10');         // Lower concurrency
        args.push('-rl', '30');        // Rate limit 30 req/sec
        args.push('-timeout', '10');   // 10 second timeout per request
        break;

      case 'standard':
        args.push('-d', '4');          // Medium depth crawl
        args.push('-c', '20');         // Medium concurrency
        args.push('-rl', '50');        // Rate limit 50 req/sec
        args.push('-timeout', '15');   // 15 second timeout per request
        if (this.chromeAvailable) {
          args.push('-headless');      // Headless browser for JS-heavy sites
          args.push('-jc');            // JS crawling
        }
        break;

      case 'comprehensive':
        args.push('-d', '6');          // Deep crawl
        args.push('-c', '50');         // High concurrency
        args.push('-rl', '150');       // Higher rate limit
        args.push('-timeout', '120');  // 120 second timeout per request (headless is slower)
        if (this.chromeAvailable) {
          args.push('-headless');            // Enable browser rendering
          args.push('-js-crawl');            // Extract URLs from JavaScript
          args.push('-automatic-form-fill'); // Interact with forms
          args.push('-headless-no-sandbox'); // Required for Windows/Docker
          args.push('-system-chrome');       // Use installed Chrome
        }
        break;
    }

    // Add custom headers if provided
    const headers = context.config?.headers as Record<string, string> | undefined;
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        args.push('-H', `${key}: ${value}`);
      }
    }

    // Add auth cookies if provided
    const authConfig = context.config?.authConfig as { cookies?: string } | undefined;
    if (authConfig?.cookies) {
      args.push('-H', `Cookie: ${authConfig.cookies}`);
    }

    // Exclude paths
    const excludePaths = context.config?.excludePaths as string[] | undefined;
    if (excludePaths && excludePaths.length > 0) {
      for (const path of excludePaths) {
        args.push('-ef', path); // Exclude filter
      }
    }

    return args;
  }

  private getTimeout(scanMode: ScanMode, defaultTimeout: number): number {
    // Adjust timeout based on mode
    switch (scanMode) {
      case 'quick':
        return Math.min(defaultTimeout, 120000); // 2 min max for quick
      case 'standard':
        return Math.min(defaultTimeout, 300000); // 5 min max
      case 'comprehensive':
        return Math.max(defaultTimeout, 600000); // 10 min min for comprehensive (headless is slow)
      default:
        return defaultTimeout;
    }
  }

  private async parseStdoutUrls(stdout: string, _baseUrl: string): Promise<{
    discoveredUrls: string[];
    discoveredParams: DiscoveredParam[];
    discoveredForms: DiscoveredForm[];
    jsFiles: string[];
    totalRequests: number;
  }> {
    const discoveredUrls: string[] = [];
    const discoveredParams: DiscoveredParam[] = [];
    const jsFiles: string[] = [];
    const seenUrls = new Set<string>();
    const seenParams = new Set<string>();

    // Parse plain URLs from stdout (one per line)
    const lines = stdout.trim().split('\n').filter(line => line.trim());

    for (const line of lines) {
      const url = line.trim();
      if (!url || seenUrls.has(url)) continue;

      // Validate it looks like a URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) continue;

      seenUrls.add(url);
      discoveredUrls.push(url);

      // Check for JS files
      if (url.match(/\.js(\?|$)/i)) {
        jsFiles.push(url);
      }

      // Extract query parameters
      try {
        const parsed = new URL(url);
        if (parsed.search && parsed.search.length > 1) {
          const params = new URLSearchParams(parsed.search);
          for (const [name] of params) {
            const paramKey = `${parsed.pathname}:${name}`;
            if (!seenParams.has(paramKey)) {
              seenParams.add(paramKey);
              discoveredParams.push({
                url,
                method: 'GET',
                name,
                type: 'query',
              });
            }
          }
        }
      } catch {
        // Invalid URL, skip param extraction
      }
    }

    return {
      discoveredUrls,
      discoveredParams,
      discoveredForms: [], // No forms from plain URL output
      jsFiles,
      totalRequests: discoveredUrls.length,
    };
  }

  private emptyOutput(startTime: number): KatanaDiscoveryOutput {
    return {
      scanner: this.name,
      exitCode: 0,
      stdout: '',
      stderr: '',
      duration: Date.now() - startTime,
      timedOut: false,
      discoveredUrls: [],
      discoveredParams: [],
      discoveredForms: [],
      jsFiles: [],
      totalRequests: 0,
    };
  }

  /**
   * parseOutput is not used for Katana since it's a discovery scanner,
   * but we implement it to satisfy the IScanner interface
   */
  async parseOutput(_output: ScanOutput): Promise<NormalizedFinding[]> {
    // Katana is a discovery tool, not a vulnerability scanner
    // It doesn't produce security findings, only discovered URLs
    return [];
  }
}
