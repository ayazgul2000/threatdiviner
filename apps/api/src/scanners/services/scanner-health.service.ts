import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ScannerStatus {
  name: string;
  available: boolean;
  version?: string;
  error?: string;
  checkedAt: Date;
}

interface ScannerConfig {
  name: string;
  command: string;
  versionPattern?: RegExp;
}

@Injectable()
export class ScannerHealthService implements OnModuleInit {
  private readonly logger = new Logger(ScannerHealthService.name);
  private readonly scannerStatuses = new Map<string, ScannerStatus>();

  private readonly scanners: ScannerConfig[] = [
    { name: 'semgrep', command: 'semgrep --version' },
    { name: 'trivy', command: 'trivy --version' },
    { name: 'gitleaks', command: 'gitleaks version' },
    { name: 'checkov', command: 'checkov --version' },
    { name: 'bandit', command: 'bandit --version' },
    { name: 'gosec', command: 'gosec --version' },
    { name: 'nuclei', command: 'nuclei --version' },
  ];

  async onModuleInit(): Promise<void> {
    await this.checkAllScanners();
    this.logScannerSummary();
  }

  async checkAllScanners(): Promise<Map<string, ScannerStatus>> {
    const checks = this.scanners.map((s) =>
      this.checkScanner(s.name, s.command),
    );
    await Promise.allSettled(checks);
    return this.scannerStatuses;
  }

  async checkScanner(name: string, command: string): Promise<ScannerStatus> {
    try {
      const { stdout } = await execAsync(command, { timeout: 10000 });
      const version = stdout.trim().split('\n')[0];
      const status: ScannerStatus = {
        name,
        available: true,
        version,
        checkedAt: new Date(),
      };
      this.scannerStatuses.set(name.toLowerCase(), status);
      return status;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const status: ScannerStatus = {
        name,
        available: false,
        error: errorMessage,
        checkedAt: new Date(),
      };
      this.scannerStatuses.set(name.toLowerCase(), status);
      return status;
    }
  }

  isAvailable(scannerName: string): boolean {
    const status = this.scannerStatuses.get(scannerName.toLowerCase());
    return status?.available ?? false;
  }

  getStatus(scannerName: string): ScannerStatus | undefined {
    return this.scannerStatuses.get(scannerName.toLowerCase());
  }

  getAllStatuses(): ScannerStatus[] {
    return Array.from(this.scannerStatuses.values());
  }

  getAvailableScanners(): string[] {
    return Array.from(this.scannerStatuses.entries())
      .filter(([, status]) => status.available)
      .map(([name]) => name);
  }

  getUnavailableScanners(): string[] {
    return Array.from(this.scannerStatuses.entries())
      .filter(([, status]) => !status.available)
      .map(([name]) => name);
  }

  filterToAvailable(requestedScanners: string[]): {
    available: string[];
    skipped: string[];
  } {
    const available: string[] = [];
    const skipped: string[] = [];

    for (const scanner of requestedScanners) {
      if (this.isAvailable(scanner)) {
        available.push(scanner);
      } else {
        skipped.push(scanner);
      }
    }

    return { available, skipped };
  }

  private logScannerSummary(): void {
    const available = this.getAvailableScanners();
    const unavailable = this.getUnavailableScanners();

    this.logger.log(
      `Scanner availability: ${available.length}/${this.scanners.length}`,
    );

    if (available.length > 0) {
      this.logger.log(`Available: ${available.join(', ')}`);
    }

    if (unavailable.length > 0) {
      this.logger.warn(`Unavailable: ${unavailable.join(', ')}`);
    }
  }
}
