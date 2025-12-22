import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
