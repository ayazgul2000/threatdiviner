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
    const connections = await this.prisma.scmConnection.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        provider: true,
        authMethod: true,
        externalId: true,
        externalName: true,
        scope: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        repositories: {
          select: { id: true },
        },
      },
    });

    // Map to frontend expected format
    return connections.map((conn) => ({
      id: conn.id,
      provider: conn.provider,
      authMethod: conn.authMethod,
      accountName: conn.externalName || 'Unknown',
      accountId: conn.externalId || '',
      status: conn.isActive ? 'active' : 'revoked',
      scopes: conn.scope || [],
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
      repositoryCount: conn.repositories.length,
    }));
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

  async listAvailableRepositoriesForProject(
    tenantId: string,
    connectionId: string,
    projectId: string,
  ): Promise<ScmRepository[]> {
    const projectAccess = await this.prisma.projectScmAccess.findFirst({
      where: { projectId, connectionId },
      include: { repoAccess: true, connection: true },
    });

    if (!projectAccess || projectAccess.connection.tenantId !== tenantId) {
      return [];
    }

    const connection = await this.getConnection(tenantId, connectionId);
    const provider = this.getProvider(connection.provider);
    const token = this.cryptoService.decrypt(connection.accessToken);
    const allRepos = await provider.listRepositories(token);

    if (projectAccess.repoAccess.length === 0) {
      return allRepos;
    }

    const allowedRepoIds = new Set(projectAccess.repoAccess.map((r) => r.externalRepoId));
    return allRepos.filter((repo) => allowedRepoIds.has(repo.id));
  }

  async addRepository(tenantId: string, connectionId: string, fullName: string, projectId?: string): Promise<string> {
    // Check if repository already exists
    const existing = await this.prisma.repository.findFirst({
      where: { tenantId, fullName, isActive: true },
      include: { scanConfig: true },
    });
    if (existing) {
      // Update projectId if provided and different
      if (projectId && existing.projectId !== projectId) {
        await this.prisma.repository.update({
          where: { id: existing.id },
          data: { projectId },
        });
      }
      // Ensure ScanConfig exists for existing repository
      if (!existing.scanConfig) {
        await this.prisma.scanConfig.create({
          data: {
            tenantId,
            repositoryId: existing.id,
            updatedAt: new Date(),
          },
        });
      }
      return existing.id;
    }

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
        projectId,
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

  async listRepositories(tenantId: string, projectId?: string, connectionId?: string) {
    const repositories = await this.prisma.repository.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(projectId && { projectId }),
        ...(connectionId && { connectionId }),
      },
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

    // Transform scanConfig to frontend expected format
    return repositories.map((repo) => ({
      ...repo,
      scanConfig: repo.scanConfig ? this.transformScanConfig(repo.scanConfig) : null,
    }));
  }

  /**
   * Transform database ScanConfig to frontend expected format
   */
  private transformScanConfig(config: {
    id: string;
    repositoryId: string;
    enableSast: boolean;
    enableSca: boolean;
    enableSecrets: boolean;
    enableIac: boolean;
    enableDast: boolean;
    enableContainerScan: boolean;
    autoScanOnPush: boolean;
    autoScanOnPR: boolean;
    scheduleEnabled: boolean;
    scheduleCron: string | null;
    skipPaths: string[];
    branches: string[];
    targetUrls: string[];
    containerImages: string[];
  }) {
    // Build scanners array from enable flags
    const scanners: string[] = [];
    if (config.enableSast) scanners.push('semgrep');
    if (config.enableSca) scanners.push('trivy');
    if (config.enableSecrets) scanners.push('gitleaks');
    if (config.enableIac) scanners.push('checkov');
    if (config.enableDast) scanners.push('nuclei');
    if (config.enableContainerScan) scanners.push('container');

    return {
      id: config.id,
      repositoryId: config.repositoryId,
      enabled: true,
      scanOnPush: config.autoScanOnPush,
      scanOnPr: config.autoScanOnPR,
      scanOnSchedule: config.scheduleEnabled,
      schedulePattern: config.scheduleCron,
      scanners,
      excludePaths: config.skipPaths,
      branches: config.branches,
      targetUrls: config.targetUrls,
      containerImages: config.containerImages,
    };
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

    // Transform scanConfig to frontend expected format
    return {
      ...repository,
      scanConfig: repository.scanConfig ? this.transformScanConfig(repository.scanConfig) : null,
    };
  }

  async getBranches(tenantId: string, repositoryId: string) {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, tenantId },
      include: { connection: true },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    const provider = this.getProvider(repository.connection.provider);
    const token = this.cryptoService.decrypt(repository.connection.accessToken);
    const [owner, repoName] = repository.fullName.split('/');

    return provider.getBranches(token, owner, repoName);
  }

  async getPullRequests(
    tenantId: string,
    repositoryId: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50,
  ) {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, tenantId },
      include: { connection: true },
    });
    if (!repository) {
      throw new NotFoundException('Repository not found');
    }
    const provider = this.getProvider(repository.connection.provider);
    const token = this.cryptoService.decrypt(repository.connection.accessToken);
    const [owner, repoName] = repository.fullName.split('/');
    return provider.getPullRequests(token, owner, repoName, state, limit);
  }

  async getLanguages(tenantId: string, repositoryId: string) {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, tenantId },
      include: { connection: true },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    const provider = this.getProvider(repository.connection.provider);
    const token = this.cryptoService.decrypt(repository.connection.accessToken);
    const [owner, repoName] = repository.fullName.split('/');

    return provider.getLanguages(token, owner, repoName);
  }

  async updateScanConfig(tenantId: string, repositoryId: string, config: Partial<{
    enableSast: boolean;
    enableSca: boolean;
    enableSecrets: boolean;
    enableIac: boolean;
    enableDast: boolean;
    enableContainerScan: boolean;
    branches: string[];
    skipPaths: string[];
    scanners: string[];
    enabled: boolean;
    scanOnPush: boolean;
    scanOnPr: boolean;
    scanOnSchedule: boolean;
    schedulePattern: string | null;
    targetUrls: string[];
    containerImages: string[];
    checkRunEnabled: boolean;
    prCommentsEnabled: boolean;
    inlineAnnotations: boolean;
    sarifUploadEnabled: boolean;
    blockPrOnSeverity: string;
  }>) {
    this.logger.log(`Updating scan config for repository ${repositoryId}, config: ${JSON.stringify(config)}`);

    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, tenantId },
      include: { scanConfig: true },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    this.logger.log(`Repository found: ${repository.fullName}, has scanConfig: ${!!repository.scanConfig}`);

    // Build update data, converting scanners array to individual fields
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    // Handle scanners array -> individual enable fields
    if (config.scanners) {
      updateData.enableSast = config.scanners.includes('semgrep');
      updateData.enableSca = config.scanners.includes('trivy');
      updateData.enableSecrets = config.scanners.includes('gitleaks');
      updateData.enableIac = config.scanners.includes('checkov');
      updateData.enableDast = config.scanners.includes('nuclei') || config.scanners.includes('zap');
      updateData.enableContainerScan = config.scanners.includes('container');
    }

    // Handle individual enable fields (if passed directly)
    if (config.enableSast !== undefined) updateData.enableSast = config.enableSast;
    if (config.enableSca !== undefined) updateData.enableSca = config.enableSca;
    if (config.enableSecrets !== undefined) updateData.enableSecrets = config.enableSecrets;
    if (config.enableIac !== undefined) updateData.enableIac = config.enableIac;
    if (config.enableDast !== undefined) updateData.enableDast = config.enableDast;
    if (config.enableContainerScan !== undefined) updateData.enableContainerScan = config.enableContainerScan;

    // Handle scan triggers
    if (config.scanOnPush !== undefined) updateData.autoScanOnPush = config.scanOnPush;
    if (config.scanOnPr !== undefined) updateData.autoScanOnPR = config.scanOnPr;
    if (config.scanOnSchedule !== undefined) updateData.scheduleEnabled = config.scanOnSchedule;
    if (config.schedulePattern !== undefined) updateData.scheduleCron = config.schedulePattern;

    // Handle other fields
    if (config.branches !== undefined) updateData.branches = config.branches;
    if (config.skipPaths !== undefined) updateData.skipPaths = config.skipPaths;
    if (config.targetUrls !== undefined) updateData.targetUrls = config.targetUrls;
    if (config.containerImages !== undefined) updateData.containerImages = config.containerImages;

    // Handle write-back settings
    if (config.checkRunEnabled !== undefined) updateData.checkRunEnabled = config.checkRunEnabled;
    if (config.prCommentsEnabled !== undefined) updateData.prCommentsEnabled = config.prCommentsEnabled;
    if (config.inlineAnnotations !== undefined) updateData.inlineAnnotations = config.inlineAnnotations;
    if (config.sarifUploadEnabled !== undefined) updateData.sarifUploadEnabled = config.sarifUploadEnabled;
    if (config.blockPrOnSeverity !== undefined) updateData.blockPrOnSeverity = config.blockPrOnSeverity;

    // Use upsert to create ScanConfig if it doesn't exist
    this.logger.log(`Upserting scan config with data: ${JSON.stringify(updateData)}`);

    const updatedConfig = await this.prisma.scanConfig.upsert({
      where: { repositoryId },
      update: updateData,
      create: {
        tenantId,
        repositoryId,
        // Apply the same updates as create defaults
        enableSast: updateData.enableSast as boolean ?? true,
        enableSca: updateData.enableSca as boolean ?? true,
        enableSecrets: updateData.enableSecrets as boolean ?? true,
        enableIac: updateData.enableIac as boolean ?? true,
        enableDast: updateData.enableDast as boolean ?? false,
        enableContainerScan: updateData.enableContainerScan as boolean ?? false,
        autoScanOnPush: updateData.autoScanOnPush as boolean ?? true,
        autoScanOnPR: updateData.autoScanOnPR as boolean ?? true,
        scheduleEnabled: updateData.scheduleEnabled as boolean ?? false,
        scheduleCron: updateData.scheduleCron as string ?? null,
        branches: updateData.branches as string[] ?? ['main', 'master'],
        skipPaths: updateData.skipPaths as string[] ?? ['node_modules', 'vendor', '.git'],
        targetUrls: updateData.targetUrls as string[] ?? [],
        containerImages: updateData.containerImages as string[] ?? [],
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Scan config saved: id=${updatedConfig.id}, enableSast=${updatedConfig.enableSast}, scheduleEnabled=${updatedConfig.scheduleEnabled}`);

    // Return transformed config for frontend
    return this.transformScanConfig(updatedConfig);
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
  async triggerScan(tenantId: string, repositoryId: string, branch?: string, pullRequestId?: string): Promise<string> {
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
    const triggerEvent = pullRequestId ? 'pull_request' : 'manual';

    const [owner, repoName] = repository.fullName.split('/');
    const commit = await provider.getLatestCommit(token, owner, repoName, targetBranch);

    // Get scan config with defaults
    const scanConfig = repository.scanConfig || {};
    const effectiveConfig = this.getEffectiveConfig(scanConfig, targetBranch);

    // Build scanners array based on config
    const enabledScanners: string[] = [];
    if (effectiveConfig.enableSast) enabledScanners.push('semgrep');
    if (effectiveConfig.enableSca) enabledScanners.push('trivy');
    if (effectiveConfig.enableSecrets) enabledScanners.push('gitleaks');
    if (effectiveConfig.enableIac) enabledScanners.push('checkov');

    // Create check run for write-back if enabled
    let checkRunId: string | undefined;
    if (effectiveConfig.checkRunEnabled) {
      try {
        checkRunId = await provider.createCheckRun(
          token,
          owner,
          repoName,
          commit.sha,
          'ThreatDiviner Security Scan',
          'queued',
        );
        this.logger.log(`Created check run ${checkRunId} for manual scan`);
      } catch (error) {
        this.logger.warn(`Failed to create check run for manual scan: ${error}`);
        // Continue without check run - don't block scan
      }
    }

    const scan = await this.prisma.scan.create({
      data: {
        tenantId,
        repositoryId,
        projectId: repository.projectId,
        commitSha: commit.sha,
        branch: targetBranch,
        triggeredBy: triggerEvent,
        pullRequestId,
        status: 'queued',
        scanners: enabledScanners,
        checkRunId,
      },
    });

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
      checkRunId,
      pullRequestId,
      triggeredBy: triggerEvent,
      config: {
        enableSast: effectiveConfig.enableSast,
        enableSca: effectiveConfig.enableSca,
        enableSecrets: effectiveConfig.enableSecrets,
        enableIac: effectiveConfig.enableIac,
        enableDast: effectiveConfig.enableDast,
        enableContainerScan: effectiveConfig.enableContainerScan,
        targetUrls: effectiveConfig.targetUrls,
        containerImages: effectiveConfig.containerImages,
        skipPaths: effectiveConfig.skipPaths,
        branches: effectiveConfig.branches,
      },
    };

    // Queue scan job
    await this.queueService.enqueueScan(jobData);
    this.logger.log(`Scan ${scan.id} queued for ${repository.fullName}@${targetBranch}${checkRunId ? ' with check run' : ''}`);

    return scan.id;
  }

  /**
   * Get effective config merging repo-level with branch-level overrides
   */
  private getEffectiveConfig(scanConfig: any, branch: string): {
    enableSast: boolean;
    enableSca: boolean;
    enableSecrets: boolean;
    enableIac: boolean;
    enableDast: boolean;
    enableContainerScan: boolean;
    targetUrls: string[];
    containerImages: string[];
    skipPaths: string[];
    branches: string[];
    checkRunEnabled: boolean;
    prCommentsEnabled: boolean;
    inlineAnnotations: boolean;
    sarifUploadEnabled: boolean;
    blockPrOnSeverity: string;
  } {
    // Base config with defaults
    const base = {
      enableSast: scanConfig.enableSast ?? true,
      enableSca: scanConfig.enableSca ?? true,
      enableSecrets: scanConfig.enableSecrets ?? true,
      enableIac: scanConfig.enableIac ?? true,
      enableDast: scanConfig.enableDast ?? false,
      enableContainerScan: scanConfig.enableContainerScan ?? false,
      targetUrls: scanConfig.targetUrls ?? [],
      containerImages: scanConfig.containerImages ?? [],
      skipPaths: scanConfig.skipPaths ?? ['node_modules', 'vendor', '.git'],
      branches: scanConfig.branches ?? ['main', 'master'],
      checkRunEnabled: scanConfig.checkRunEnabled ?? true,
      prCommentsEnabled: scanConfig.prCommentsEnabled ?? true,
      inlineAnnotations: scanConfig.inlineAnnotations ?? true,
      sarifUploadEnabled: scanConfig.sarifUploadEnabled ?? false,
      blockPrOnSeverity: scanConfig.blockPrOnSeverity ?? 'none',
    };

    // Apply branch overrides if present
    const branchOverrides = scanConfig.branchOverrides as Record<string, any> | null;
    if (branchOverrides && branchOverrides[branch]) {
      const override = branchOverrides[branch];
      return { ...base, ...override };
    }

    return base;
  }

  async getScan(tenantId: string, scanId: string) {
    const scan = await this.prisma.scan.findFirst({
      where: { id: scanId, tenantId },
      include: {
        repository: {
          select: {
            fullName: true,
            htmlUrl: true,
            scanConfig: true,
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

    // Count findings by scanner type and severity in parallel
    const [scannerCounts, severityCounts] = await Promise.all([
      this.prisma.finding.groupBy({
        by: ['scanner'],
        where: { scanId },
        _count: { id: true },
      }),
      this.prisma.finding.groupBy({
        by: ['severity'],
        where: { scanId },
        _count: { id: true },
      }),
    ]);

    const findingsCount: Record<string, number> = {
      sast: 0,
      sca: 0,
      secrets: 0,
      iac: 0,
      dast: 0,
    };

    for (const item of scannerCounts) {
      const scanner = item.scanner.toLowerCase();
      if (scanner === 'semgrep' || scanner === 'bandit' || scanner === 'gosec') {
        findingsCount.sast += item._count.id;
      } else if (scanner === 'trivy') {
        findingsCount.sca += item._count.id;
      } else if (scanner === 'gitleaks') {
        findingsCount.secrets += item._count.id;
      } else if (scanner === 'checkov') {
        findingsCount.iac += item._count.id;
      } else if (scanner === 'nuclei') {
        findingsCount.dast += item._count.id;
      }
    }

    // Build severity stats
    const severityStats = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: 0,
    };
    for (const item of severityCounts) {
      const sev = item.severity?.toLowerCase() as keyof typeof severityStats;
      if (sev && sev in severityStats) {
        severityStats[sev] = item._count.id;
      }
      severityStats.total += item._count.id;
    }

    // Flatten scanConfig for easier frontend access
    const scanConfig = scan.repository?.scanConfig;
    return {
      ...scan,
      sastEnabled: scanConfig?.enableSast ?? true,
      scaEnabled: scanConfig?.enableSca ?? true,
      secretsEnabled: scanConfig?.enableSecrets ?? true,
      iacEnabled: scanConfig?.enableIac ?? true,
      dastEnabled: scanConfig?.enableDast ?? false,
      findingsCount,
      severityStats,
    };
  }

  async listScans(tenantId: string, repositoryId?: string, limit = 50, projectId?: string, branch?: string) {
    const scans = await this.prisma.scan.findMany({
      where: {
        tenantId,
        ...(repositoryId && { repositoryId }),
        ...(projectId && { projectId }),
        ...(branch && { branch }),
      },
      include: {
        repository: {
          select: {
            fullName: true,
            htmlUrl: true,
          },
        },
        _count: {
          select: { findings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Add findings breakdown by severity and scanners list for each scan
    const scansWithStats = await Promise.all(
      scans.map(async (scan) => {
        const [severityStats, scannerStats] = await Promise.all([
          this.prisma.finding.groupBy({
            by: ['severity'],
            where: { scanId: scan.id },
            _count: { severity: true },
          }),
          this.prisma.finding.groupBy({
            by: ['scanner'],
            where: { scanId: scan.id },
          }),
        ]);

        const stats = {
          total: scan._count.findings,
          critical: severityStats.find((s) => s.severity === 'critical')?._count?.severity || 0,
          high: severityStats.find((s) => s.severity === 'high')?._count?.severity || 0,
          medium: severityStats.find((s) => s.severity === 'medium')?._count?.severity || 0,
          low: severityStats.find((s) => s.severity === 'low')?._count?.severity || 0,
          info: severityStats.find((s) => s.severity === 'info')?._count?.severity || 0,
        };

        // Extract unique scanners that had findings
        const scannersWithFindings = scannerStats.map((s) => s.scanner).filter(Boolean);

        return {
          ...scan,
          findingsCount: stats.total,
          stats,
          scannersWithFindings,
          // scanners field is stored directly on scan record - no fallback for old scans
        };
      }),
    );

    return scansWithStats;
  }

  async listFindings(
    tenantId: string,
    filters: {
      scanId?: string;
      repositoryId?: string;
      projectId?: string;
      severity?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const { scanId, repositoryId, projectId, severity, status, limit = 50, offset = 0 } = filters;

    const where: any = { tenantId };
    if (scanId) where.scanId = scanId;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;
    if (repositoryId) {
      where.scan = { repositoryId };
    }

    // Base where clause without severity/status filters for total counts
    const baseWhere: any = { tenantId };
    if (scanId) baseWhere.scanId = scanId;
    if (projectId) baseWhere.projectId = projectId;
    if (repositoryId) {
      baseWhere.scan = { repositoryId };
    }

    const [findings, total, severityCounts] = await Promise.all([
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
      // Get counts by severity for open findings (ignoring current severity/status filters)
      this.prisma.finding.groupBy({
        by: ['severity'],
        where: { ...baseWhere, status: 'open' },
        _count: { severity: true },
      }),
    ]);

    // Transform findings to match frontend expected format
    const transformedFindings = findings.map((f) => this.transformFinding(f));

    // Transform severity counts into an object
    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    for (const item of severityCounts) {
      const sev = item.severity.toLowerCase() as keyof typeof counts;
      if (sev in counts) {
        counts[sev] = item._count.severity;
      }
    }

    return { findings: transformedFindings, total, counts };
  }

  async getFinding(tenantId: string, findingId: string) {
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId, tenantId },
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
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    return this.transformFinding(finding);
  }

  /**
   * Transform finding from DB format to API response format
   * Maps cweId/owasp (strings) to cwe/owasp (arrays) for frontend compatibility
   */
  private transformFinding(finding: any) {
    const { cweId, owasp, cveId, ...rest } = finding;
    return {
      ...rest,
      cwe: cweId ? [cweId] : [],
      cve: cveId ? [cveId] : [],
      owaspIds: owasp ? [owasp] : [],
      // Keep originals for backward compatibility
      cweId,
      cveId,
      owasp,
    };
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

  // ========== CLI/Pipeline Integration Methods ==========

  /**
   * Get latest commit for a branch (for CLI/pipeline use)
   */
  async getLatestCommit(
    tenantId: string,
    connectionId: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<{ sha: string; message?: string; author?: string }> {
    const connection = await this.getConnection(tenantId, connectionId);
    const provider = this.getProvider(connection.provider);
    const token = this.cryptoService.decrypt(connection.accessToken);

    const commit = await provider.getLatestCommit(token, owner, repo, branch);
    return {
      sha: commit.sha,
      message: commit.message,
      author: commit.author?.name,
    };
  }

  /**
   * Create a check run (for CLI/pipeline use)
   */
  async createCheckRun(
    token: string,
    providerName: string,
    owner: string,
    repo: string,
    sha: string,
    name: string,
    status: 'queued' | 'in_progress' | 'completed',
  ): Promise<string> {
    const provider = this.getProvider(providerName);

    // Only GitHub supports check runs directly
    if (providerName !== 'github' || !('createCheckRun' in provider)) {
      throw new BadRequestException(`Check runs not supported for provider ${providerName}`);
    }

    return (provider as GitHubProvider).createCheckRun(token, owner, repo, sha, name, status);
  }
}
