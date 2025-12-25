import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubProvider } from './providers';
import { CryptoService } from './services/crypto.service';
import { QueueService } from '../queue/services/queue.service';
import { ScanJobData } from '../queue/jobs';

interface GitHubWebhookPayload {
  action?: string;
  ref?: string;
  after?: string;
  before?: string;
  repository?: {
    id: number;
    full_name: string;
    default_branch: string;
  };
  sender?: {
    login: string;
  };
  pull_request?: {
    number: number;
    title: string;
    state: string;
    html_url: string;
    head: {
      sha: string;
      ref: string;
    };
    base: {
      ref: string;
    };
  };
  installation?: {
    id: number;
  };
}

interface GitLabWebhookPayload {
  object_kind?: string;
  event_type?: string;
  ref?: string;
  checkout_sha?: string;
  before?: string;
  after?: string;
  project?: {
    id: number;
    path_with_namespace: string;
    default_branch: string;
  };
  user?: {
    username: string;
  };
  object_attributes?: {
    iid: number;
    title: string;
    state: string;
    url: string;
    action?: string;
    source_branch: string;
    target_branch: string;
    last_commit?: {
      id: string;
    };
  };
}

interface BitbucketWebhookPayload {
  event?: string;
  push?: {
    changes: Array<{
      new?: {
        name: string;
        target: {
          hash: string;
        };
      };
      old?: {
        name: string;
      };
    }>;
  };
  pullrequest?: {
    id: number;
    title: string;
    state: string;
    source: {
      branch: { name: string };
      commit: { hash: string };
    };
    destination: {
      branch: { name: string };
    };
    links: {
      html: { href: string };
    };
  };
  repository?: {
    full_name: string;
    uuid: string;
  };
  actor?: {
    nickname: string;
  };
}

interface AzureDevOpsWebhookPayload {
  eventType?: string;
  resource?: {
    refUpdates?: Array<{
      name: string;
      newObjectId: string;
      oldObjectId: string;
    }>;
    pullRequestId?: number;
    title?: string;
    status?: string;
    sourceRefName?: string;
    targetRefName?: string;
    lastMergeSourceCommit?: {
      commitId: string;
    };
    url?: string;
    commits?: Array<{
      commitId: string;
    }>;
  };
  resourceContainers?: {
    project?: {
      id: string;
      baseUrl: string;
    };
  };
}

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubProvider: GitHubProvider,
    private readonly cryptoService: CryptoService,
    private readonly queueService: QueueService,
  ) {}

  @Post('github')
  @HttpCode(HttpStatus.OK)
  async handleGitHubWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: GitHubWebhookPayload,
  ) {
    // TODO: Use raw body for signature verification
    // const rawBody = req.rawBody?.toString() || JSON.stringify(payload);

    this.logger.log(`Received GitHub webhook: ${event} (${deliveryId})`);

    // Log webhook event
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        provider: 'github',
        eventType: event,
        deliveryId,
        signature: signature || '',
        payload: this.sanitizePayload(payload),
      },
    });

    try {
      // Find repository and tenant
      if (!payload.repository) {
        this.logger.warn('Webhook missing repository info');
        return { received: true };
      }

      const repository = await this.prisma.repository.findFirst({
        where: {
          fullName: payload.repository.full_name,
          isActive: true,
        },
        include: {
          connection: true,
          scanConfig: true,
        },
      });

      if (!repository) {
        this.logger.warn(`Repository not found: ${payload.repository.full_name}`);
        return { received: true };
      }

      // Update webhook event with tenant
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { tenantId: repository.tenantId },
      });

      // TODO: Verify webhook signature with stored secret
      // For now, we'll process all webhooks

      // Handle different event types
      switch (event) {
        case 'push':
          await this.handlePushEvent(repository, payload);
          break;
        case 'pull_request':
          await this.handlePullRequestEvent(repository, payload);
          break;
        default:
          this.logger.log(`Ignoring event type: ${event}`);
      }

      // Mark as processed
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      return { received: true };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error}`);

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processed: true,
          processedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      return { received: true, error: 'Processing failed' };
    }
  }

  private async handlePushEvent(
    repository: any,
    payload: GitHubWebhookPayload,
  ) {
    if (!payload.ref || !payload.after) {
      return;
    }

    // Check if auto-scan on push is enabled
    if (repository.scanConfig && repository.scanConfig.autoScanOnPush === false) {
      this.logger.log(`Auto-scan on push is disabled for ${repository.fullName}`);
      return;
    }

    // Extract branch name from ref (refs/heads/main -> main)
    const branch = payload.ref.replace('refs/heads/', '');

    // Check if this branch is configured for scanning
    const configuredBranches = repository.scanConfig?.branches || ['main', 'master'];
    if (!configuredBranches.includes(branch)) {
      this.logger.log(`Branch ${branch} not configured for scanning`);
      return;
    }

    // Skip if commit is all zeros (branch deleted)
    if (payload.after === '0000000000000000000000000000000000000000') {
      this.logger.log(`Branch ${branch} was deleted, skipping scan`);
      return;
    }

    // Create scan
    const scan = await this.prisma.scan.create({
      data: {
        tenantId: repository.tenantId,
        repositoryId: repository.id,
        commitSha: payload.after,
        branch,
        triggeredBy: 'webhook',
        triggerEvent: 'push',
        status: 'queued',
      },
    });

    this.logger.log(`Created scan ${scan.id} for push to ${repository.fullName}@${branch}`);

    // Queue scan job
    const scanConfig = repository.scanConfig || {};
    const jobData: ScanJobData = {
      scanId: scan.id,
      tenantId: repository.tenantId,
      repositoryId: repository.id,
      connectionId: repository.connectionId,
      commitSha: payload.after,
      branch,
      cloneUrl: repository.cloneUrl,
      fullName: repository.fullName,
      triggeredBy: payload.sender?.login || 'webhook',
      config: {
        enableSast: scanConfig.enableSast ?? true,
        enableSca: scanConfig.enableSca ?? true,
        enableSecrets: scanConfig.enableSecrets ?? true,
        enableIac: scanConfig.enableIac ?? true,
        enableDast: scanConfig.enableDast ?? false,
        enableContainerScan: scanConfig.enableContainerScan ?? false,
        targetUrls: scanConfig.targetUrls || [],
        containerImages: scanConfig.containerImages || [],
        skipPaths: scanConfig.skipPaths || ['node_modules', 'vendor', '.git'],
        branches: scanConfig.branches || ['main', 'master'],
      },
    };

    await this.queueService.enqueueScan(jobData);
    this.logger.log(`Queued scan job for ${repository.fullName}@${branch}`);
  }

  private async handlePullRequestEvent(
    repository: any,
    payload: GitHubWebhookPayload,
  ) {
    const pr = payload.pull_request;
    if (!pr) {
      return;
    }

    // Check if auto-scan on PR is enabled
    if (repository.scanConfig && repository.scanConfig.autoScanOnPR === false) {
      this.logger.log(`Auto-scan on PR is disabled for ${repository.fullName}`);
      return;
    }

    // Only scan on opened, synchronize (new commits), or reopened
    const scanActions = ['opened', 'synchronize', 'reopened'];
    if (!payload.action || !scanActions.includes(payload.action)) {
      this.logger.log(`Ignoring PR action: ${payload.action}`);
      return;
    }

    // Create scan
    const scan = await this.prisma.scan.create({
      data: {
        tenantId: repository.tenantId,
        repositoryId: repository.id,
        commitSha: pr.head.sha,
        branch: pr.head.ref,
        triggeredBy: 'webhook',
        triggerEvent: 'pull_request',
        pullRequestId: String(pr.number),
        pullRequestUrl: pr.html_url,
        status: 'queued',
      },
    });

    this.logger.log(`Created scan ${scan.id} for PR #${pr.number} on ${repository.fullName}`);

    // Create GitHub check run
    let checkRunId: string | undefined;
    try {
      const token = this.cryptoService.decrypt(repository.connection.accessToken);
      const [owner, repoName] = repository.fullName.split('/');

      checkRunId = await this.githubProvider.createCheckRun(
        token,
        owner,
        repoName,
        pr.head.sha,
        'ThreatDiviner Security Scan',
        'queued',
      );

      await this.prisma.scan.update({
        where: { id: scan.id },
        data: { checkRunId },
      });

      this.logger.log(`Created check run ${checkRunId} for scan ${scan.id}`);
    } catch (error) {
      this.logger.error(`Failed to create check run: ${error}`);
    }

    // Queue scan job
    const scanConfig = repository.scanConfig || {};
    const jobData: ScanJobData = {
      scanId: scan.id,
      tenantId: repository.tenantId,
      repositoryId: repository.id,
      connectionId: repository.connectionId,
      commitSha: pr.head.sha,
      branch: pr.head.ref,
      cloneUrl: repository.cloneUrl,
      fullName: repository.fullName,
      pullRequestId: String(pr.number),
      checkRunId,
      triggeredBy: payload.sender?.login || 'webhook',
      config: {
        enableSast: scanConfig.enableSast ?? true,
        enableSca: scanConfig.enableSca ?? true,
        enableSecrets: scanConfig.enableSecrets ?? true,
        enableIac: scanConfig.enableIac ?? true,
        enableDast: scanConfig.enableDast ?? false,
        enableContainerScan: scanConfig.enableContainerScan ?? false,
        targetUrls: scanConfig.targetUrls || [],
        containerImages: scanConfig.containerImages || [],
        skipPaths: scanConfig.skipPaths || ['node_modules', 'vendor', '.git'],
        branches: scanConfig.branches || ['main', 'master'],
      },
    };

    await this.queueService.enqueueScan(jobData);
    this.logger.log(`Queued scan job for PR #${pr.number} on ${repository.fullName}`);
  }

  // ========== GitLab Webhook Handler ==========

  @Post('gitlab')
  @HttpCode(HttpStatus.OK)
  async handleGitLabWebhook(
    @Headers('x-gitlab-event') event: string,
    @Headers('x-gitlab-token') token: string,
    @Body() payload: GitLabWebhookPayload,
  ) {
    this.logger.log(`Received GitLab webhook: ${event}`);

    // Log webhook event
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        provider: 'gitlab',
        eventType: event || payload.object_kind || 'unknown',
        deliveryId: crypto.randomUUID(),
        signature: token || '',
        payload: this.sanitizePayload(payload),
      },
    });

    try {
      if (!payload.project) {
        this.logger.warn('Webhook missing project info');
        return { received: true };
      }

      const repository = await this.prisma.repository.findFirst({
        where: {
          fullName: payload.project.path_with_namespace,
          isActive: true,
        },
        include: {
          connection: true,
          scanConfig: true,
        },
      });

      if (!repository) {
        this.logger.warn(`Repository not found: ${payload.project.path_with_namespace}`);
        return { received: true };
      }

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { tenantId: repository.tenantId },
      });

      // Handle different event types
      const eventType = payload.object_kind || event;
      switch (eventType) {
        case 'push':
        case 'Push Hook':
          await this.handleGitLabPush(repository, payload);
          break;
        case 'merge_request':
        case 'Merge Request Hook':
          await this.handleGitLabMergeRequest(repository, payload);
          break;
        default:
          this.logger.log(`Ignoring GitLab event type: ${eventType}`);
      }

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() },
      });

      return { received: true };
    } catch (error) {
      this.logger.error(`Error processing GitLab webhook: ${error}`);
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processed: true,
          processedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return { received: true, error: 'Processing failed' };
    }
  }

  private async handleGitLabPush(repository: any, payload: GitLabWebhookPayload) {
    if (!payload.ref || !payload.after) return;

    if (repository.scanConfig?.autoScanOnPush === false) {
      this.logger.log(`Auto-scan on push is disabled for ${repository.fullName}`);
      return;
    }

    const branch = payload.ref.replace('refs/heads/', '');
    const configuredBranches = repository.scanConfig?.branches || ['main', 'master'];
    if (!configuredBranches.includes(branch)) {
      this.logger.log(`Branch ${branch} not configured for scanning`);
      return;
    }

    if (payload.after === '0000000000000000000000000000000000000000') {
      this.logger.log(`Branch ${branch} was deleted, skipping scan`);
      return;
    }

    const scan = await this.prisma.scan.create({
      data: {
        tenantId: repository.tenantId,
        repositoryId: repository.id,
        commitSha: payload.after,
        branch,
        triggeredBy: 'webhook',
        triggerEvent: 'push',
        status: 'queued',
      },
    });

    await this.enqueueScan(repository, scan, branch, payload.after, payload.user?.username);
    this.logger.log(`Queued GitLab scan for ${repository.fullName}@${branch}`);
  }

  private async handleGitLabMergeRequest(repository: any, payload: GitLabWebhookPayload) {
    const mr = payload.object_attributes;
    if (!mr) return;

    if (repository.scanConfig?.autoScanOnPR === false) {
      this.logger.log(`Auto-scan on MR is disabled for ${repository.fullName}`);
      return;
    }

    const scanActions = ['open', 'update', 'reopen'];
    if (!mr.action || !scanActions.includes(mr.action)) {
      this.logger.log(`Ignoring MR action: ${mr.action}`);
      return;
    }

    const commitSha = mr.last_commit?.id || payload.checkout_sha || '';
    const scan = await this.prisma.scan.create({
      data: {
        tenantId: repository.tenantId,
        repositoryId: repository.id,
        commitSha,
        branch: mr.source_branch,
        triggeredBy: 'webhook',
        triggerEvent: 'merge_request',
        pullRequestId: String(mr.iid),
        pullRequestUrl: mr.url,
        status: 'queued',
      },
    });

    await this.enqueueScan(repository, scan, mr.source_branch, commitSha, payload.user?.username, String(mr.iid));
    this.logger.log(`Queued GitLab scan for MR !${mr.iid} on ${repository.fullName}`);
  }

  // ========== Bitbucket Webhook Handler ==========

  @Post('bitbucket')
  @HttpCode(HttpStatus.OK)
  async handleBitbucketWebhook(
    @Headers('x-event-key') eventKey: string,
    @Headers('x-hook-uuid') hookUuid: string,
    @Body() payload: BitbucketWebhookPayload,
  ) {
    this.logger.log(`Received Bitbucket webhook: ${eventKey}`);

    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        provider: 'bitbucket',
        eventType: eventKey || 'unknown',
        deliveryId: hookUuid || crypto.randomUUID(),
        signature: '',
        payload: this.sanitizePayload(payload),
      },
    });

    try {
      if (!payload.repository) {
        this.logger.warn('Webhook missing repository info');
        return { received: true };
      }

      const repository = await this.prisma.repository.findFirst({
        where: {
          fullName: payload.repository.full_name,
          isActive: true,
        },
        include: {
          connection: true,
          scanConfig: true,
        },
      });

      if (!repository) {
        this.logger.warn(`Repository not found: ${payload.repository.full_name}`);
        return { received: true };
      }

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { tenantId: repository.tenantId },
      });

      // Handle different event types
      if (eventKey.startsWith('repo:push')) {
        await this.handleBitbucketPush(repository, payload);
      } else if (eventKey.startsWith('pullrequest:')) {
        await this.handleBitbucketPullRequest(repository, payload, eventKey);
      } else {
        this.logger.log(`Ignoring Bitbucket event: ${eventKey}`);
      }

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() },
      });

      return { received: true };
    } catch (error) {
      this.logger.error(`Error processing Bitbucket webhook: ${error}`);
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processed: true,
          processedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return { received: true, error: 'Processing failed' };
    }
  }

  private async handleBitbucketPush(repository: any, payload: BitbucketWebhookPayload) {
    if (!payload.push?.changes?.length) return;

    if (repository.scanConfig?.autoScanOnPush === false) {
      this.logger.log(`Auto-scan on push is disabled for ${repository.fullName}`);
      return;
    }

    for (const change of payload.push.changes) {
      if (!change.new) continue; // Branch deleted

      const branch = change.new.name;
      const configuredBranches = repository.scanConfig?.branches || ['main', 'master'];
      if (!configuredBranches.includes(branch)) continue;

      const commitSha = change.new.target.hash;
      const scan = await this.prisma.scan.create({
        data: {
          tenantId: repository.tenantId,
          repositoryId: repository.id,
          commitSha,
          branch,
          triggeredBy: 'webhook',
          triggerEvent: 'push',
          status: 'queued',
        },
      });

      await this.enqueueScan(repository, scan, branch, commitSha, payload.actor?.nickname);
      this.logger.log(`Queued Bitbucket scan for ${repository.fullName}@${branch}`);
    }
  }

  private async handleBitbucketPullRequest(
    repository: any,
    payload: BitbucketWebhookPayload,
    eventKey: string,
  ) {
    const pr = payload.pullrequest;
    if (!pr) return;

    if (repository.scanConfig?.autoScanOnPR === false) {
      this.logger.log(`Auto-scan on PR is disabled for ${repository.fullName}`);
      return;
    }

    const scanEvents = ['pullrequest:created', 'pullrequest:updated'];
    if (!scanEvents.includes(eventKey)) {
      this.logger.log(`Ignoring Bitbucket PR event: ${eventKey}`);
      return;
    }

    const commitSha = pr.source.commit.hash;
    const branch = pr.source.branch.name;

    const scan = await this.prisma.scan.create({
      data: {
        tenantId: repository.tenantId,
        repositoryId: repository.id,
        commitSha,
        branch,
        triggeredBy: 'webhook',
        triggerEvent: 'pull_request',
        pullRequestId: String(pr.id),
        pullRequestUrl: pr.links.html.href,
        status: 'queued',
      },
    });

    await this.enqueueScan(repository, scan, branch, commitSha, payload.actor?.nickname, String(pr.id));
    this.logger.log(`Queued Bitbucket scan for PR #${pr.id} on ${repository.fullName}`);
  }

  // ========== Azure DevOps Webhook Handler ==========

  @Post('azure-devops')
  @HttpCode(HttpStatus.OK)
  async handleAzureDevOpsWebhook(
    @Body() payload: AzureDevOpsWebhookPayload,
  ) {
    this.logger.log(`Received Azure DevOps webhook: ${payload.eventType}`);

    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        provider: 'azure-devops',
        eventType: payload.eventType || 'unknown',
        deliveryId: crypto.randomUUID(),
        signature: '',
        payload: this.sanitizePayload(payload),
      },
    });

    try {
      // Azure DevOps webhooks can be tricky to match - we'll try multiple approaches
      const projectId = payload.resourceContainers?.project?.id;

      // Find all Azure DevOps repositories and try to match
      const repositories = await this.prisma.repository.findMany({
        where: {
          isActive: true,
          connection: { provider: 'azure-devops' },
        },
        include: {
          connection: true,
          scanConfig: true,
        },
      });

      // Match by URL pattern or project ID in clone URL
      const repository = repositories.find(r =>
        r.cloneUrl.includes(projectId || '') ||
        r.htmlUrl.includes(projectId || ''),
      );

      if (!repository) {
        this.logger.warn(`Repository not found for Azure DevOps project: ${projectId}`);
        return { received: true };
      }

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { tenantId: repository.tenantId },
      });

      // Handle different event types
      switch (payload.eventType) {
        case 'git.push':
          await this.handleAzureDevOpsPush(repository, payload);
          break;
        case 'git.pullrequest.created':
        case 'git.pullrequest.updated':
          await this.handleAzureDevOpsPullRequest(repository, payload);
          break;
        default:
          this.logger.log(`Ignoring Azure DevOps event: ${payload.eventType}`);
      }

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date() },
      });

      return { received: true };
    } catch (error) {
      this.logger.error(`Error processing Azure DevOps webhook: ${error}`);
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processed: true,
          processedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return { received: true, error: 'Processing failed' };
    }
  }

  private async handleAzureDevOpsPush(repository: any, payload: AzureDevOpsWebhookPayload) {
    const refUpdates = payload.resource?.refUpdates;
    if (!refUpdates?.length) return;

    if (repository.scanConfig?.autoScanOnPush === false) {
      this.logger.log(`Auto-scan on push is disabled for ${repository.fullName}`);
      return;
    }

    for (const refUpdate of refUpdates) {
      if (!refUpdate.name.startsWith('refs/heads/')) continue;

      const branch = refUpdate.name.replace('refs/heads/', '');
      const configuredBranches = repository.scanConfig?.branches || ['main', 'master'];
      if (!configuredBranches.includes(branch)) continue;

      if (refUpdate.newObjectId === '0000000000000000000000000000000000000000') continue;

      const scan = await this.prisma.scan.create({
        data: {
          tenantId: repository.tenantId,
          repositoryId: repository.id,
          commitSha: refUpdate.newObjectId,
          branch,
          triggeredBy: 'webhook',
          triggerEvent: 'push',
          status: 'queued',
        },
      });

      await this.enqueueScan(repository, scan, branch, refUpdate.newObjectId);
      this.logger.log(`Queued Azure DevOps scan for ${repository.fullName}@${branch}`);
    }
  }

  private async handleAzureDevOpsPullRequest(repository: any, payload: AzureDevOpsWebhookPayload) {
    const pr = payload.resource;
    if (!pr?.pullRequestId) return;

    if (repository.scanConfig?.autoScanOnPR === false) {
      this.logger.log(`Auto-scan on PR is disabled for ${repository.fullName}`);
      return;
    }

    const branch = pr.sourceRefName?.replace('refs/heads/', '') || 'unknown';
    const commitSha = pr.lastMergeSourceCommit?.commitId || '';

    const scan = await this.prisma.scan.create({
      data: {
        tenantId: repository.tenantId,
        repositoryId: repository.id,
        commitSha,
        branch,
        triggeredBy: 'webhook',
        triggerEvent: 'pull_request',
        pullRequestId: String(pr.pullRequestId),
        pullRequestUrl: pr.url,
        status: 'queued',
      },
    });

    await this.enqueueScan(repository, scan, branch, commitSha, undefined, String(pr.pullRequestId));
    this.logger.log(`Queued Azure DevOps scan for PR #${pr.pullRequestId} on ${repository.fullName}`);
  }

  // ========== Helper Methods ==========

  private async enqueueScan(
    repository: any,
    scan: any,
    branch: string,
    commitSha: string,
    triggeredBy?: string,
    pullRequestId?: string,
  ) {
    const scanConfig = repository.scanConfig || {};
    const jobData: ScanJobData = {
      scanId: scan.id,
      tenantId: repository.tenantId,
      repositoryId: repository.id,
      connectionId: repository.connectionId,
      commitSha,
      branch,
      cloneUrl: repository.cloneUrl,
      fullName: repository.fullName,
      pullRequestId,
      triggeredBy: triggeredBy || 'webhook',
      config: {
        enableSast: scanConfig.enableSast ?? true,
        enableSca: scanConfig.enableSca ?? true,
        enableSecrets: scanConfig.enableSecrets ?? true,
        enableIac: scanConfig.enableIac ?? true,
        enableDast: scanConfig.enableDast ?? false,
        enableContainerScan: scanConfig.enableContainerScan ?? false,
        targetUrls: scanConfig.targetUrls || [],
        containerImages: scanConfig.containerImages || [],
        skipPaths: scanConfig.skipPaths || ['node_modules', 'vendor', '.git'],
        branches: scanConfig.branches || ['main', 'master'],
        prDiffOnly: scanConfig.prDiffOnly ?? true,
      },
    };

    await this.queueService.enqueueScan(jobData);
  }

  private sanitizePayload(payload: any): any {
    // Remove sensitive data from payload before storing
    const sanitized = { ...payload };

    // Remove any tokens or secrets that might be in the payload
    if (sanitized.installation?.access_tokens_url) {
      delete sanitized.installation.access_tokens_url;
    }

    return sanitized;
  }
}
