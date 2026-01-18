import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ScmService, CryptoService } from '../scm/services';
import { QueueService } from '../queue/services/queue.service';
import { GitHubProvider } from '../scm/providers';
import { ScanJobData } from '../queue/jobs';

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations?: Array<{
    physicalLocation?: {
      artifactLocation?: { uri: string };
      region?: {
        startLine?: number;
        endLine?: number;
        snippet?: { text: string };
      };
    };
  }>;
  fingerprints?: Record<string, string>;
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      version?: string;
      rules?: Array<{
        id: string;
        name?: string;
        shortDescription?: { text: string };
        fullDescription?: { text: string };
      }>;
    };
  };
  results: SarifResult[];
}

export interface UploadResult {
  scanId: string;
  findingsCount: number;
  dashboardUrl: string;
}

// Write-back capability types
export type WriteBackCapability =
  | 'pr_comments'      // Inline PR comments on findings
  | 'pr_summary'       // Summary comment on PR
  | 'check_status'     // GitHub check run status
  | 'annotations'      // Check run annotations
  | 'sarif_upload';    // Upload SARIF to GitHub Security tab

export interface WriteBackCapabilities {
  available: WriteBackCapability[];
  reason: string;
}

export interface TriggerScanResult {
  scanId: string;
  status: 'queued' | 'running';
  dashboardUrl: string;
  capabilities: WriteBackCapabilities;
  effectiveSettings: {
    source: 'cli' | 'repo_settings' | 'defaults';
    scanners: string[];
    writeBack: WriteBackCapability[];
    failOnSeverity: string;
    failOnCount: number;
    diffOnly: boolean;
  };
}

export interface TriggerScanOptions {
  repository: string;
  branch?: string;
  commitSha?: string;
  pullRequestId?: string;
  // Optional CLI overrides (take precedence over repo settings)
  scanners?: string[];
  writeBack?: WriteBackCapability[];
  failOnSeverity?: string;
  failOnCount?: number;
  diffOnly?: boolean; // Only report findings in changed files (compared to default branch)
}

@Injectable()
export class CliService {
  private readonly logger = new Logger(CliService.name);
  private readonly dashboardUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly scmService: ScmService,
    private readonly cryptoService: CryptoService,
    private readonly queueService: QueueService,
    private readonly githubProvider: GitHubProvider,
  ) {
    this.dashboardUrl = this.configService.get('DASHBOARD_URL') || 'http://localhost:3000';
  }

  async processSarifUpload(
    tenantId: string,
    sarif: any,
    repositoryName: string,
    branch: string,
    commitSha: string,
    pullRequestId?: string,
  ): Promise<UploadResult> {
    // Find or create repository
    let repository = await this.prisma.repository.findFirst({
      where: {
        tenantId,
        fullName: repositoryName,
      },
    });

    if (!repository) {
      // For CLI uploads, we might not have the repository in the system
      // Log a warning and create a placeholder
      this.logger.warn(`Repository ${repositoryName} not found for tenant ${tenantId}`);
      throw new NotFoundException(`Repository ${repositoryName} not found. Please add it via the dashboard first.`);
    }

    // Create scan record
    const scan = await this.prisma.scan.create({
      data: {
        tenantId,
        repositoryId: repository.id,
        commitSha,
        branch,
        triggeredBy: 'cli',
        triggerEvent: pullRequestId ? 'pull_request' : 'manual',
        pullRequestId,
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Process SARIF findings
    const findingsCount = await this.processSarifFindings(tenantId, scan.id, repository.id, sarif);

    // Update scan with findings count
    await this.prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: 'completed',
      },
    });

    return {
      scanId: scan.id,
      findingsCount,
      dashboardUrl: `${this.dashboardUrl}/dashboard/scans/${scan.id}`,
    };
  }

  async registerCliScan(
    tenantId: string,
    repositoryName: string,
    branch: string,
    commitSha: string,
    pullRequestId?: string,
  ) {
    const repository = await this.prisma.repository.findFirst({
      where: {
        tenantId,
        fullName: repositoryName,
      },
    });

    if (!repository) {
      throw new NotFoundException(`Repository ${repositoryName} not found`);
    }

    const scan = await this.prisma.scan.create({
      data: {
        tenantId,
        repositoryId: repository.id,
        commitSha,
        branch,
        triggeredBy: 'cli',
        triggerEvent: pullRequestId ? 'pull_request' : 'manual',
        pullRequestId,
        status: 'pending',
      },
    });

    return {
      scanId: scan.id,
      repository: repositoryName,
    };
  }

  private async processSarifFindings(
    tenantId: string,
    scanId: string,
    repositoryId: string,
    sarif: any,
  ): Promise<number> {
    const runs: SarifRun[] = sarif.runs || [];
    const findings: any[] = [];

    for (const run of runs) {
      const scanner = run.tool.driver.name;
      const rules = new Map<string, { name?: string; description?: string }>();

      // Build rules lookup
      for (const rule of run.tool.driver.rules || []) {
        rules.set(rule.id, {
          name: rule.name || rule.shortDescription?.text,
          description: rule.fullDescription?.text || rule.shortDescription?.text,
        });
      }

      // Process results
      for (const result of run.results || []) {
        const location = result.locations?.[0]?.physicalLocation;
        const rule = rules.get(result.ruleId);

        findings.push({
          tenantId,
          scanId,
          repositoryId,
          scanner: scanner.replace('ThreatDiviner/', '').toLowerCase(),
          ruleId: result.ruleId,
          severity: this.levelToSeverity(result.level),
          title: rule?.name || result.ruleId,
          description: result.message?.text || rule?.description,
          filePath: location?.artifactLocation?.uri || 'unknown',
          startLine: location?.region?.startLine || null,
          endLine: location?.region?.endLine || null,
          snippet: location?.region?.snippet?.text || null,
          status: 'open',
        });
      }
    }

    if (findings.length > 0) {
      await this.prisma.finding.createMany({
        data: findings,
        skipDuplicates: true,
      });
    }

    return findings.length;
  }

  private levelToSeverity(level: string): string {
    switch (level) {
      case 'error':
        return 'high';
      case 'warning':
        return 'medium';
      case 'note':
        return 'low';
      default:
        return 'info';
    }
  }

  // ========== Remote Scan Trigger for CLI/Pipeline ==========

  /**
   * Trigger a remote scan from CLI/pipeline.
   * The TD server will run the scan using its SCM connection.
   *
   * Settings priority: CLI flags > repo settings (if enabled) > minimal defaults
   */
  async triggerRemoteScan(
    tenantId: string,
    options: TriggerScanOptions,
  ): Promise<TriggerScanResult> {
    this.logger.log(`CLI trigger scan for ${options.repository}`);

    // Find the repository
    const repository = await this.prisma.repository.findFirst({
      where: {
        tenantId,
        fullName: options.repository,
        isActive: true,
      },
      include: {
        connection: true,
        scanConfig: true,
      },
    });

    if (!repository) {
      throw new NotFoundException(
        `Repository ${options.repository} not found. ` +
        `Please add it via the dashboard first.`
      );
    }

    // Determine write-back capabilities based on SCM connection and GitHub App
    const capabilities = await this.determineCapabilities(repository.connection, repository.fullName);

    // Resolve effective settings
    const effectiveSettings = this.resolveEffectiveSettings(
      repository.scanConfig,
      options,
      capabilities,
    );

    // Get the target branch
    const targetBranch = options.branch || repository.defaultBranch;

    // Get commit SHA (from options or fetch latest)
    let commitSha = options.commitSha;
    if (!commitSha) {
      try {
        const [owner, repoName] = repository.fullName.split('/');

        // Use ScmService to get latest commit
        const commit = await this.scmService.getLatestCommit(
          tenantId,
          repository.connectionId,
          owner,
          repoName,
          targetBranch,
        );
        commitSha = commit.sha;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new BadRequestException(
          `Could not fetch latest commit for ${targetBranch}: ${message}. ` +
          `Please provide commitSha explicitly.`
        );
      }
    }

    // Create check run if available and enabled
    let checkRunId: string | undefined;
    if (
      effectiveSettings.writeBack.includes('check_status') &&
      capabilities.available.includes('check_status')
    ) {
      try {
        const token = this.cryptoService.decrypt(repository.connection.accessToken);
        const [owner, repoName] = repository.fullName.split('/');
        checkRunId = await this.scmService.createCheckRun(
          token,
          repository.connection.provider,
          owner,
          repoName,
          commitSha,
          'ThreatDiviner Security Scan (CLI)',
          'queued',
        );
        this.logger.log(`Created check run ${checkRunId} for CLI scan`);
      } catch (error) {
        this.logger.warn(`Failed to create check run: ${error}`);
        // Continue without check run
      }
    }

    // Create scan record
    const scan = await this.prisma.scan.create({
      data: {
        tenantId,
        repositoryId: repository.id,
        projectId: repository.projectId,
        commitSha,
        branch: targetBranch,
        triggeredBy: 'cli',
        triggerEvent: options.pullRequestId ? 'pull_request' : 'push',
        pullRequestId: options.pullRequestId,
        status: 'queued',
        scanners: effectiveSettings.scanners,
        checkRunId,
        cliTriggered: true,
        cliWriteBackConfig: effectiveSettings.writeBack,
        cliFailOnSeverity: effectiveSettings.failOnSeverity,
        cliFailOnCount: effectiveSettings.failOnCount,
      },
    });

    // Build job data
    const jobData: ScanJobData = {
      scanId: scan.id,
      tenantId,
      repositoryId: repository.id,
      connectionId: repository.connectionId,
      commitSha,
      branch: targetBranch,
      cloneUrl: repository.cloneUrl,
      fullName: repository.fullName,
      pullRequestId: options.pullRequestId,
      checkRunId,
      triggeredBy: 'cli',
      config: this.buildScanConfig(effectiveSettings.scanners, repository.scanConfig, effectiveSettings.diffOnly),
    };

    // Queue scan job
    await this.queueService.enqueueScan(jobData);
    this.logger.log(`CLI scan ${scan.id} queued for ${repository.fullName}@${targetBranch}`);

    return {
      scanId: scan.id,
      status: 'queued',
      dashboardUrl: `${this.dashboardUrl}/dashboard/scans/${scan.id}`,
      capabilities,
      effectiveSettings,
    };
  }

  /**
   * Get write-back capabilities for a repository based on its SCM connection
   */
  async getCapabilities(
    tenantId: string,
    repositoryName: string,
  ): Promise<WriteBackCapabilities> {
    const repository = await this.prisma.repository.findFirst({
      where: {
        tenantId,
        fullName: repositoryName,
        isActive: true,
      },
      include: { connection: true },
    });

    if (!repository) {
      throw new NotFoundException(`Repository ${repositoryName} not found`);
    }

    return this.determineCapabilities(repository.connection, repository.fullName);
  }

  /**
   * Get the default settings that would apply if no CLI flags are provided
   */
  async getDefaultSettings(
    tenantId: string,
    repositoryName: string,
  ): Promise<{
    source: 'repo_settings' | 'defaults';
    scanners: string[];
    writeBack: WriteBackCapability[];
    failOnSeverity: string;
    failOnCount: number;
    diffOnly: boolean;
  }> {
    const repository = await this.prisma.repository.findFirst({
      where: {
        tenantId,
        fullName: repositoryName,
        isActive: true,
      },
      include: {
        connection: true,
        scanConfig: true,
      },
    });

    if (!repository) {
      throw new NotFoundException(`Repository ${repositoryName} not found`);
    }

    const capabilities = await this.determineCapabilities(repository.connection, repository.fullName);
    const settings = this.resolveEffectiveSettings(
      repository.scanConfig,
      {}, // No CLI overrides
      capabilities,
    );

    return {
      source: settings.source === 'cli' ? 'defaults' : settings.source,
      scanners: settings.scanners,
      writeBack: settings.writeBack,
      failOnSeverity: settings.failOnSeverity,
      failOnCount: settings.failOnCount,
      diffOnly: settings.diffOnly,
    };
  }

  /**
   * Determine write-back capabilities based on SCM connection type and GitHub App availability
   */
  private async determineCapabilities(
    connection: {
      provider: string;
      authType?: string | null;
    },
    repositoryFullName?: string,
  ): Promise<WriteBackCapabilities> {
    const available: WriteBackCapability[] = [];

    // GitHub has the most write-back capabilities
    if (connection.provider === 'github') {
      // GitHub OAuth or App can do PR comments
      available.push('pr_comments', 'pr_summary');

      // Check if GitHub App is configured and has access to the repo
      let hasGitHubApp = false;
      if (repositoryFullName && this.githubProvider.isAppConfigured()) {
        const [owner, repo] = repositoryFullName.split('/');
        const appToken = await this.githubProvider.getAppTokenForRepo(owner, repo);
        hasGitHubApp = !!appToken;
        if (hasGitHubApp) {
          this.logger.log(`GitHub App available for ${repositoryFullName}`);
        }
      }

      // GitHub App, OAuth, or token with checks:write can create check runs
      if (hasGitHubApp || connection.authType === 'app' || connection.authType === 'oauth') {
        available.push('check_status', 'annotations');
      }

      // SARIF upload requires GitHub Advanced Security or public repo
      // We'll add it as potentially available
      available.push('sarif_upload');

      const reason = hasGitHubApp
        ? 'GitHub App configured - full write-back capabilities available'
        : 'GitHub connection supports write-back capabilities';

      return { available, reason };
    }

    // GitLab supports PR comments and some status reporting
    if (connection.provider === 'gitlab') {
      available.push('pr_comments', 'pr_summary');
      // GitLab has commit status API
      available.push('check_status');

      return {
        available,
        reason: 'GitLab connection supports comments and commit status',
      };
    }

    // Bitbucket supports PR comments
    if (connection.provider === 'bitbucket') {
      available.push('pr_comments', 'pr_summary');

      return {
        available,
        reason: 'Bitbucket connection supports PR comments',
      };
    }

    // Azure DevOps supports status and comments
    if (connection.provider === 'azure_devops') {
      available.push('pr_comments', 'pr_summary', 'check_status');

      return {
        available,
        reason: 'Azure DevOps connection supports comments and status',
      };
    }

    return {
      available: [],
      reason: `Unknown provider ${connection.provider}`,
    };
  }

  /**
   * Resolve effective settings with priority: CLI flags > repo settings > defaults
   */
  private resolveEffectiveSettings(
    scanConfig: any | null,
    options: Partial<TriggerScanOptions>,
    capabilities: WriteBackCapabilities,
  ): {
    source: 'cli' | 'repo_settings' | 'defaults';
    scanners: string[];
    writeBack: WriteBackCapability[];
    failOnSeverity: string;
    failOnCount: number;
    diffOnly: boolean;
  } {
    // Check if CLI provided explicit settings
    const hasCLIOverrides = !!(
      options.scanners?.length ||
      options.writeBack?.length ||
      options.failOnSeverity !== undefined ||
      options.failOnCount !== undefined ||
      options.diffOnly !== undefined
    );

    // Check if repo settings should apply for CLI
    const useRepoSettings = scanConfig?.applySettingsForCLI === true;

    // Minimal defaults
    const defaults = {
      scanners: ['semgrep', 'trivy', 'gitleaks'],
      writeBack: ['pr_summary', 'check_status'] as WriteBackCapability[],
      failOnSeverity: 'critical',
      failOnCount: 0, // 0 = disabled
      diffOnly: false, // Full scan by default
    };

    // Build effective settings
    let source: 'cli' | 'repo_settings' | 'defaults' = 'defaults';
    let scanners = defaults.scanners;
    let writeBack = defaults.writeBack;
    let failOnSeverity = defaults.failOnSeverity;
    let failOnCount = defaults.failOnCount;
    let diffOnly = defaults.diffOnly;

    // Apply repo settings if enabled
    if (useRepoSettings && scanConfig) {
      source = 'repo_settings';

      // Build scanners from repo config
      const repoScanners: string[] = [];
      if (scanConfig.enableSast !== false) repoScanners.push('semgrep');
      if (scanConfig.enableSca !== false) repoScanners.push('trivy');
      if (scanConfig.enableSecrets !== false) repoScanners.push('gitleaks');
      if (scanConfig.enableIac !== false) repoScanners.push('checkov');
      if (repoScanners.length > 0) scanners = repoScanners;

      // Build write-back from repo config
      const repoWriteBack: WriteBackCapability[] = [];
      if (scanConfig.cliWriteBackPRComments !== false) repoWriteBack.push('pr_comments');
      if (scanConfig.cliWriteBackPRSummary !== false) repoWriteBack.push('pr_summary');
      if (scanConfig.cliWriteBackCheckStatus !== false) repoWriteBack.push('check_status');
      if (scanConfig.cliWriteBackAnnotations) repoWriteBack.push('annotations');
      if (scanConfig.cliWriteBackSarif) repoWriteBack.push('sarif_upload');
      if (repoWriteBack.length > 0) writeBack = repoWriteBack;

      // Pipeline gate settings
      if (scanConfig.cliFailOnSeverity) failOnSeverity = scanConfig.cliFailOnSeverity;
      if (scanConfig.cliFailOnCount !== undefined) failOnCount = scanConfig.cliFailOnCount;

      // Diff-only setting (from prDiffOnly in repo config)
      if (scanConfig.prDiffOnly !== undefined) diffOnly = scanConfig.prDiffOnly;
    }

    // Apply CLI overrides (highest priority)
    if (hasCLIOverrides) {
      source = 'cli';
      if (options.scanners?.length) scanners = options.scanners;
      if (options.writeBack?.length) writeBack = options.writeBack;
      if (options.failOnSeverity !== undefined) failOnSeverity = options.failOnSeverity;
      if (options.failOnCount !== undefined) failOnCount = options.failOnCount;
      if (options.diffOnly !== undefined) diffOnly = options.diffOnly;
    }

    // Filter write-back to only include available capabilities
    const effectiveWriteBack = writeBack.filter(wb => capabilities.available.includes(wb));

    return {
      source,
      scanners,
      writeBack: effectiveWriteBack,
      failOnSeverity,
      failOnCount,
      diffOnly,
    };
  }

  /**
   * Build ScanConfig from scanner list and repo config
   */
  private buildScanConfig(
    scanners: string[],
    repoConfig: any | null,
    diffOnly: boolean,
  ): ScanJobData['config'] {
    return {
      enableSast: scanners.includes('semgrep'),
      enableSca: scanners.includes('trivy'),
      enableSecrets: scanners.includes('gitleaks'),
      enableIac: scanners.includes('checkov'),
      enableDast: scanners.includes('dast'),
      enableContainerScan: scanners.includes('container'),
      targetUrls: repoConfig?.targetUrls || [],
      containerImages: repoConfig?.containerImages || [],
      skipPaths: repoConfig?.skipPaths || ['node_modules', 'vendor', '.git'],
      branches: repoConfig?.branches || ['main', 'master'],
      prDiffOnly: diffOnly,
    };
  }
}
