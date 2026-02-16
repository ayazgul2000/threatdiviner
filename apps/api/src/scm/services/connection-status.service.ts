import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CryptoService } from './crypto.service';

interface ConnectionCheckResult {
  connectionId: string;
  valid: boolean;
  error?: string;
  checkedAt: Date;
}

/**
 * Service for monitoring and managing SCM connection health.
 * Runs hourly checks on all active connections.
 * Note: Results are logged but not persisted since schema doesn't have status fields.
 */
@Injectable()
export class ConnectionStatusService {
  private readonly logger = new Logger(ConnectionStatusService.name);
  // In-memory cache for connection status (since schema doesn't have these fields)
  private connectionStatusCache = new Map<string, ConnectionCheckResult>();

  constructor(
    private prisma: PrismaService,
    private cryptoService: CryptoService,
  ) {}

  /**
   * Hourly job to check all active connections
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkAllConnections() {
    this.logger.log('Starting scheduled connection health check...');

    const connections = await this.prisma.scmConnection.findMany({
      where: { isActive: true },
    });

    let valid = 0;
    let expired = 0;

    for (const connection of connections) {
      const result = await this.checkConnection(connection);
      if (result.valid) valid++;
      else expired++;
    }

    this.logger.log(`Connection health check complete: ${valid} valid, ${expired} expired out of ${connections.length}`);
  }

  /**
   * Check a single connection's validity by calling the provider API
   */
  async checkConnection(connection: any): Promise<ConnectionCheckResult> {
    const result: ConnectionCheckResult = {
      connectionId: connection.id,
      valid: false,
      checkedAt: new Date(),
    };

    try {
      const token = this.cryptoService.decrypt(connection.accessToken);

      switch (connection.provider.toLowerCase()) {
        case 'github':
          result.valid = await this.checkGitHubConnection(token);
          break;
        case 'gitlab':
          result.valid = await this.checkGitLabConnection(token);
          break;
        case 'bitbucket':
          result.valid = await this.checkBitbucketConnection(token);
          break;
        case 'azure_devops':
        case 'azure-devops':
          result.valid = await this.checkAzureDevOpsConnection(token);
          break;
        default:
          this.logger.warn(`Unknown provider: ${connection.provider}`);
          result.valid = true; // Don't mark unknown providers as invalid
      }

      if (!result.valid) {
        result.error = 'Token validation failed';
      }
    } catch (error: any) {
      this.logger.error(`Connection check failed for ${connection.id}: ${error.message}`);
      result.error = error.message || 'Connection check failed';
    }

    // Cache the result
    this.connectionStatusCache.set(connection.id, result);
    return result;
  }

  /**
   * Check GitHub connection by calling /user endpoint
   */
  private async checkGitHubConnection(token: string): Promise<boolean> {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'ThreatDiviner',
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check GitLab connection by calling /user endpoint
   */
  private async checkGitLabConnection(token: string, baseUrl?: string): Promise<boolean> {
    try {
      const url = baseUrl || 'https://gitlab.com';
      const res = await fetch(`${url}/api/v4/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check Bitbucket connection by calling /user endpoint
   */
  private async checkBitbucketConnection(token: string): Promise<boolean> {
    try {
      const res = await fetch('https://api.bitbucket.org/2.0/user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check Azure DevOps connection by listing projects
   */
  private async checkAzureDevOpsConnection(token: string, orgUrl?: string): Promise<boolean> {
    try {
      if (!orgUrl) return false;
      const res = await fetch(`${orgUrl}/_apis/projects?api-version=7.0`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Manually trigger a connection check
   */
  async checkConnectionById(tenantId: string, connectionId: string): Promise<{ valid: boolean; error?: string }> {
    const connection = await this.prisma.scmConnection.findFirst({
      where: { id: connectionId, tenantId },
    });

    if (!connection) {
      return { valid: false, error: 'Connection not found' };
    }

    const result = await this.checkConnection(connection);
    return {
      valid: result.valid,
      error: result.error,
    };
  }

  /**
   * Get connection status summary for a tenant
   */
  async getConnectionStatusSummary(tenantId: string) {
    const connections = await this.prisma.scmConnection.findMany({
      where: { tenantId, isActive: true },
      include: {
        _count: {
          select: { repositories: true },
        },
      },
    });

    return connections.map((conn) => {
      const cachedStatus = this.connectionStatusCache.get(conn.id);
      return {
        id: conn.id,
        provider: conn.provider,
        accountName: conn.externalName,
        repoCount: conn._count.repositories,
        lastCheckedAt: cachedStatus?.checkedAt || null,
        status: this.determineStatus(conn, cachedStatus),
        error: cachedStatus?.error || null,
      };
    });
  }

  private determineStatus(
    connection: { tokenExpiresAt: Date | null },
    cachedStatus?: ConnectionCheckResult,
  ): 'VALID' | 'EXPIRED' | 'ERROR' | 'UNKNOWN' {
    if (cachedStatus?.error) {
      return 'ERROR';
    }
    if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
      return 'EXPIRED';
    }
    if (cachedStatus?.valid === true) {
      return 'VALID';
    }
    return 'UNKNOWN';
  }
}
