import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AwsProvider } from './providers/aws/aws.provider';
import { AzureProvider } from './providers/azure/azure.provider';
import { GcpProvider } from './providers/gcp/gcp.provider';
import { ProwlerScanner } from './providers/prowler.scanner';

export type CloudProvider = 'aws' | 'azure' | 'gcp';

export interface CloudAccount {
  id: string;
  tenantId: string;
  provider: CloudProvider;
  name: string;
  accountId: string;
  credentials: Record<string, string>;
  regions?: string[];
  enabled: boolean;
  lastScanAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CspmFinding {
  id: string;
  accountId: string;
  provider: CloudProvider;
  service: string;
  region: string;
  resourceId: string;
  resourceType: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  remediation?: string;
  compliance?: string[];
  status: 'open' | 'resolved' | 'suppressed';
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface CspmScanResult {
  accountId: string;
  provider: CloudProvider;
  findings: CspmFinding[];
  duration: number;
  completedAt: Date;
}

@Injectable()
export class CspmService {
  private readonly logger = new Logger(CspmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly awsProvider: AwsProvider,
    private readonly azureProvider: AzureProvider,
    private readonly gcpProvider: GcpProvider,
    private readonly prowlerScanner: ProwlerScanner,
  ) {}

  /**
   * Get all cloud accounts for a tenant
   */
  async getAccounts(tenantId: string): Promise<CloudAccount[]> {
    const accounts = await this.prisma.cloudAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return accounts as unknown as CloudAccount[];
  }

  /**
   * Get a single cloud account
   */
  async getAccount(tenantId: string, accountId: string): Promise<CloudAccount> {
    const account = await this.prisma.cloudAccount.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!account) {
      throw new NotFoundException('Cloud account not found');
    }

    return account as unknown as CloudAccount;
  }

  /**
   * Create a new cloud account connection
   */
  async createAccount(
    tenantId: string,
    data: {
      provider: CloudProvider;
      name: string;
      accountId: string;
      credentials: Record<string, string>;
      regions?: string[];
    },
  ): Promise<CloudAccount> {
    // Validate credentials before saving
    const isValid = await this.validateCredentials(data.provider, data.credentials);
    if (!isValid) {
      throw new Error('Invalid cloud credentials');
    }

    const account = await this.prisma.cloudAccount.create({
      data: {
        tenantId,
        provider: data.provider,
        name: data.name,
        accountId: data.accountId,
        credentials: data.credentials as any,
        regions: data.regions || [],
        enabled: true,
      },
    });

    this.logger.log(`Created cloud account ${account.id} for tenant ${tenantId}`);
    return account as unknown as CloudAccount;
  }

  /**
   * Update cloud account
   */
  async updateAccount(
    tenantId: string,
    accountId: string,
    data: Partial<{
      name: string;
      credentials: Record<string, string>;
      regions: string[];
      enabled: boolean;
    }>,
  ): Promise<CloudAccount> {
    const account = await this.getAccount(tenantId, accountId);

    if (data.credentials) {
      const isValid = await this.validateCredentials(
        account.provider,
        data.credentials,
      );
      if (!isValid) {
        throw new Error('Invalid cloud credentials');
      }
    }

    const updated = await this.prisma.cloudAccount.update({
      where: { id: accountId },
      data: {
        name: data.name,
        credentials: data.credentials as any,
        regions: data.regions,
        enabled: data.enabled,
      },
    });

    return updated as unknown as CloudAccount;
  }

  /**
   * Delete cloud account
   */
  async deleteAccount(tenantId: string, accountId: string): Promise<void> {
    await this.getAccount(tenantId, accountId);

    await this.prisma.cloudAccount.delete({
      where: { id: accountId },
    });

    this.logger.log(`Deleted cloud account ${accountId}`);
  }

  /**
   * Validate cloud credentials
   */
  async validateCredentials(
    provider: CloudProvider,
    credentials: Record<string, string>,
  ): Promise<boolean> {
    try {
      let result: { valid: boolean };
      switch (provider) {
        case 'aws':
          result = await this.awsProvider.validateCredentials(credentials as any);
          return result.valid;
        case 'azure':
          result = await this.azureProvider.validateCredentials(credentials as any);
          return result.valid;
        case 'gcp':
          result = await this.gcpProvider.validateCredentials(credentials as any);
          return result.valid;
        default:
          return false;
      }
    } catch (error) {
      this.logger.error(`Credential validation failed: ${error}`);
      return false;
    }
  }

  /**
   * Run CSPM scan on a cloud account
   */
  async runScan(tenantId: string, accountId: string): Promise<CspmScanResult> {
    const account = await this.getAccount(tenantId, accountId);

    if (!account.enabled) {
      throw new Error('Cloud account is disabled');
    }

    this.logger.log(`Starting CSPM scan for account ${accountId}`);
    const startTime = Date.now();

    // Run Prowler scan
    const findings = await this.prowlerScanner.scan(account);

    // Update last scan time
    await this.prisma.cloudAccount.update({
      where: { id: accountId },
      data: { lastScanAt: new Date() },
    });

    const result: CspmScanResult = {
      accountId,
      provider: account.provider,
      findings,
      duration: Date.now() - startTime,
      completedAt: new Date(),
    };

    this.logger.log(
      `CSPM scan completed for account ${accountId}: ${findings.length} findings`,
    );

    return result;
  }

  /**
   * Get CSPM findings for a tenant
   */
  async getFindings(
    tenantId: string,
    filters?: {
      accountId?: string;
      provider?: CloudProvider;
      severity?: string[];
      status?: string[];
      service?: string;
    },
  ): Promise<CspmFinding[]> {
    const accounts = await this.getAccounts(tenantId);
    const accountIds = filters?.accountId
      ? [filters.accountId]
      : accounts.map((a) => a.id);

    const findings = await this.prisma.cspmFinding.findMany({
      where: {
        accountId: { in: accountIds },
        provider: filters?.provider,
        severity: filters?.severity ? { in: filters.severity } : undefined,
        status: filters?.status ? { in: filters.status } : undefined,
        service: filters?.service,
      },
      orderBy: [{ severity: 'asc' }, { lastSeenAt: 'desc' }],
    });

    return findings as unknown as CspmFinding[];
  }

  /**
   * Get CSPM summary statistics
   */
  async getSummary(tenantId: string): Promise<{
    totalAccounts: number;
    totalFindings: number;
    bySeverity: Record<string, number>;
    byProvider: Record<string, number>;
    byStatus: Record<string, number>;
    complianceScore: number;
  }> {
    const accounts = await this.getAccounts(tenantId);
    const accountIds = accounts.map((a) => a.id);

    const findings = await this.prisma.cspmFinding.findMany({
      where: { accountId: { in: accountIds } },
      select: { severity: true, provider: true, status: true },
    });

    const bySeverity: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const finding of findings) {
      bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
      byProvider[finding.provider] = (byProvider[finding.provider] || 0) + 1;
      byStatus[finding.status] = (byStatus[finding.status] || 0) + 1;
    }

    // Calculate compliance score (simple: % of resolved findings)
    const resolved = byStatus['resolved'] || 0;
    const total = findings.length;
    const complianceScore = total > 0 ? Math.round((resolved / total) * 100) : 100;

    return {
      totalAccounts: accounts.length,
      totalFindings: findings.length,
      bySeverity,
      byProvider,
      byStatus,
      complianceScore,
    };
  }

  /**
   * Update finding status
   */
  async updateFindingStatus(
    tenantId: string,
    findingId: string,
    status: 'open' | 'resolved' | 'suppressed',
  ): Promise<CspmFinding> {
    // Verify finding belongs to tenant's account
    const finding = await this.prisma.cspmFinding.findUnique({
      where: { id: findingId },
      include: { account: true },
    });

    if (!finding || (finding.account as any).tenantId !== tenantId) {
      throw new NotFoundException('Finding not found');
    }

    const updated = await this.prisma.cspmFinding.update({
      where: { id: findingId },
      data: { status },
    });

    return updated as unknown as CspmFinding;
  }
}
