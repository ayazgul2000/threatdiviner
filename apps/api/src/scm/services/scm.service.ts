import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from './crypto.service';
import { GitHubProvider, GitLabProvider, ScmProvider, ScmRepository } from '../providers';
import { QueueService } from '../../queue/services/queue.service';
import { ScanJobData } from '../../queue/jobs';
import * as crypto from 'crypto';

@Injectable()
export class ScmService {
  private readonly logger = new Logger(ScmService.name);
  private readonly providers: Map<string, ScmProvider> = new Map();
  private readonly oauthStates: Map<string, { tenantId: string; expiresAt: number; provider: string }> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    githubProvider: GitHubProvider,
    gitlabProvider: GitLabProvider,
  ) {
    this.providers.set('github', githubProvider);
    this.providers.set('gitlab', gitlabProvider);
  }

  private getProvider(provider: string): ScmProvider {
    const p = this.providers.get(provider);
    if (!p) {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }
    return p;
  }

  // OAuth flow
  initiateOAuth(tenantId: string, provider: string): string {
    const scmProvider = this.getProvider(provider);
    const state = crypto.randomBytes(32).toString('hex');

    // Store state for verification (expires in 10 minutes)
    this.oauthStates.set(state, {
      tenantId,
      provider,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const redirectUri = `${this.configService.get('API_BASE_URL')}/scm/oauth/callback`;
    return scmProvider.getOAuthUrl(state, redirectUri);
  }

  async handleOAuthCallback(code: string, state: string): Promise<{ tenantId: string; connectionId: string }> {
    const stateData = this.oauthStates.get(state);
    if (!stateData || stateData.expiresAt < Date.now()) {
      this.oauthStates.delete(state);
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    this.oauthStates.delete(state);
    const { tenantId, provider: providerName } = stateData;

    // Get the provider from the stored state
    const provider = this.getProvider(providerName);
    const redirectUri = `${this.configService.get('API_BASE_URL')}/scm/oauth/callback`;

    const tokenResponse = await provider.exchangeCodeForToken(code, redirectUri);
    const user = await provider.getCurrentUser(tokenResponse.accessToken);

    // Encrypt tokens before storing
    const encryptedAccessToken = this.cryptoService.encrypt(tokenResponse.accessToken);
    const encryptedRefreshToken = tokenResponse.refreshToken
      ? this.cryptoService.encrypt(tokenResponse.refreshToken)
      : null;

    // Create or update connection
    const connection = await this.prisma.scmConnection.upsert({
      where: {
        tenantId_provider_externalId: {
          tenantId,
          provider: providerName,
          externalId: user.id,
        },
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokenResponse.expiresAt,
        scope: tokenResponse.scope,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        provider: providerName,
        authMethod: 'oauth',
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokenResponse.expiresAt,
        externalId: user.id,
        externalName: user.login,
        scope: tokenResponse.scope,
        updatedAt: new Date(),
      },
    });

    return { tenantId, connectionId: connection.id };
  }

  async connectWithPat(tenantId: string, provider: string, token: string): Promise<string> {
    const scmProvider = this.getProvider(provider);

    // Verify token works
    const user = await scmProvider.getCurrentUser(token);

    // Encrypt token
    const encryptedToken = this.cryptoService.encrypt(token);

    // Create connection
    const connection = await this.prisma.scmConnection.upsert({
      where: {
        tenantId_provider_externalId: {
          tenantId,
          provider,
          externalId: user.id,
        },
      },
      update: {
        accessToken: encryptedToken,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        provider,
        authMethod: 'pat',
        accessToken: encryptedToken,
        externalId: user.id,
        externalName: user.login,
        scope: ['repo', 'read:user'],
        updatedAt: new Date(),
      },
    });

    return connection.id;
  }

  // Connection management
  async listConnections(tenantId: string) {
    return this.prisma.scmConnection.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        provider: true,
        authMethod: true,
        externalName: true,
        scope: true,
        createdAt: true,
        repositories: {
          select: { id: true },
        },
      },
    });
  }

  async deleteConnection(tenantId: string, connectionId: string): Promise<void> {
    const connection = await this.prisma.scmConnection.findFirst({
      where: { id: connectionId, tenantId },
    });

    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    await this.prisma.scmConnection.update({
      where: { id: connectionId },
      data: { isActive: false },
    });
  }

  // Repository management
  async listAvailableRepositories(tenantId: string, connectionId: string): Promise<ScmRepository[]> {
    const connection = await this.getConnection(tenantId, connectionId);
    const provider = this.getProvider(connection.provider);
    const token = this.cryptoService.decrypt(connection.accessToken);

    return provider.listRepositories(token);
  }

  async addRepository(tenantId: string, connectionId: string, fullName: string): Promise<string> {
    const connection = await this.getConnection(tenantId, connectionId);
    const provider = this.getProvider(connection.provider);
    const token = this.cryptoService.decrypt(connection.accessToken);

    const [owner, repoName] = fullName.split('/');
    const repoData = await provider.getRepository(token, owner, repoName);

    // Create webhook
    const webhookSecret = this.cryptoService.generateWebhookSecret();
    const webhookUrl = `${this.configService.get('API_BASE_URL')}/webhooks/${connection.provider}`;

    try {
      const webhookId = await provider.createWebhook(token, owner, repoName, webhookUrl, webhookSecret);
      this.logger.log(`Created webhook ${webhookId} for ${fullName}`);
    } catch (error) {
      this.logger.warn(`Failed to create webhook for ${fullName}: ${error}`);
      // Continue without webhook - can be added later
    }

    // Create repository
    const repository = await this.prisma.repository.create({
      data: {
        tenantId,
        connectionId,
        name: repoData.name,
        fullName: repoData.fullName,
        cloneUrl: repoData.cloneUrl,
        htmlUrl: repoData.htmlUrl,
        defaultBranch: repoData.defaultBranch,
        language: repoData.language,
        isPrivate: repoData.isPrivate,
        updatedAt: new Date(),
      },
    });

    // Create default scan config
    await this.prisma.scanConfig.create({
      data: {
        tenantId,
        repositoryId: repository.id,
        updatedAt: new Date(),
      },
    });

    return repository.id;
  }

  async listRepositories(tenantId: string) {
    return this.prisma.repository.findMany({
      where: { tenantId, isActive: true },
      include: {
        connection: {
          select: {
            provider: true,
            externalName: true,
          },
        },
        scanConfig: true,
        _count: {
          select: { scans: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getRepository(tenantId: string, repositoryId: string) {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, tenantId },
      include: {
        connection: {
          select: {
            provider: true,
            externalName: true,
          },
        },
        scanConfig: true,
        scans: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { findings: true },
            },
          },
        },
      },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    return repository;
  }

  async updateScanConfig(tenantId: string, repositoryId: string, config: Partial<{
    enableSast: boolean;
    enableSca: boolean;
    enableSecrets: boolean;
    enableIac: boolean;
    enableDast: boolean;
    branches: string[];
    skipPaths: string[];
  }>) {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, tenantId },
      include: { scanConfig: true },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    return this.prisma.scanConfig.update({
      where: { repositoryId },
      data: {
        ...config,
        updatedAt: new Date(),
      },
    });
  }

  async removeRepository(tenantId: string, repositoryId: string): Promise<void> {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, tenantId },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    await this.prisma.repository.update({
      where: { id: repositoryId },
      data: { isActive: false },
    });
  }

  // Scan operations
  async triggerScan(tenantId: string, repositoryId: string, branch?: string): Promise<string> {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, tenantId },
      include: { connection: true, scanConfig: true },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    const provider = this.getProvider(repository.connection.provider);
    const token = this.cryptoService.decrypt(repository.connection.accessToken);
    const targetBranch = branch || repository.defaultBranch;

    const [owner, repoName] = repository.fullName.split('/');
    const commit = await provider.getLatestCommit(token, owner, repoName, targetBranch);

    const scan = await this.prisma.scan.create({
      data: {
        tenantId,
        repositoryId,
        commitSha: commit.sha,
        branch: targetBranch,
        triggeredBy: 'manual',
        status: 'queued',
      },
    });

    // Get scan config (use defaults if not configured)
    const scanConfig = repository.scanConfig || {
      enableSast: true,
      enableSca: true,
      enableSecrets: true,
      enableIac: true,
      enableDast: false,
      enableContainerScan: false,
      targetUrls: [] as string[],
      containerImages: [] as string[],
      skipPaths: ['node_modules', 'vendor', '.git'] as string[],
      branches: [repository.defaultBranch] as string[],
    };

    // Build job data
    const jobData: ScanJobData = {
      scanId: scan.id,
      tenantId,
      repositoryId,
      connectionId: repository.connectionId,
      commitSha: commit.sha,
      branch: targetBranch,
      cloneUrl: repository.cloneUrl,
      fullName: repository.fullName,
      config: {
        enableSast: scanConfig.enableSast,
        enableSca: scanConfig.enableSca,
        enableSecrets: scanConfig.enableSecrets,
        enableIac: scanConfig.enableIac,
        enableDast: 'enableDast' in scanConfig ? scanConfig.enableDast : false,
        enableContainerScan: 'enableContainerScan' in scanConfig ? scanConfig.enableContainerScan : false,
        targetUrls: 'targetUrls' in scanConfig ? (scanConfig.targetUrls as string[]) : [],
        containerImages: 'containerImages' in scanConfig ? (scanConfig.containerImages as string[]) : [],
        skipPaths: (scanConfig.skipPaths as string[]) || [],
        branches: (scanConfig.branches as string[]) || [repository.defaultBranch],
      },
    };

    // Queue scan job
    await this.queueService.enqueueScan(jobData);
    this.logger.log(`Scan ${scan.id} queued for ${repository.fullName}@${targetBranch}`);

    return scan.id;
  }

  async getScan(tenantId: string, scanId: string) {
    const scan = await this.prisma.scan.findFirst({
      where: { id: scanId, tenantId },
      include: {
        repository: {
          select: {
            fullName: true,
            htmlUrl: true,
          },
        },
        findings: {
          orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    return scan;
  }

  async listScans(tenantId: string, repositoryId?: string, limit = 50) {
    return this.prisma.scan.findMany({
      where: {
        tenantId,
        ...(repositoryId && { repositoryId }),
      },
      include: {
        repository: {
          select: {
            fullName: true,
            htmlUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listFindings(
    tenantId: string,
    filters: {
      scanId?: string;
      repositoryId?: string;
      severity?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const { scanId, repositoryId, severity, status, limit = 50, offset = 0 } = filters;

    const where: any = { tenantId };
    if (scanId) where.scanId = scanId;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (repositoryId) {
      where.scan = { repositoryId };
    }

    const [findings, total] = await Promise.all([
      this.prisma.finding.findMany({
        where,
        include: {
          scan: {
            select: {
              repository: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.finding.count({ where }),
    ]);

    return { findings, total };
  }

  async updateFindingStatus(tenantId: string, findingId: string, status: string) {
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId, tenantId },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    return this.prisma.finding.update({
      where: { id: findingId },
      data: { status, updatedAt: new Date() },
    });
  }

  // Helper methods
  private async getConnection(tenantId: string, connectionId: string) {
    const connection = await this.prisma.scmConnection.findFirst({
      where: { id: connectionId, tenantId, isActive: true },
    });

    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    return connection;
  }

  getDecryptedToken(connection: { accessToken: string }): string {
    return this.cryptoService.decrypt(connection.accessToken);
  }
}
