import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  Logger,
  BadRequestException,
  NotFoundException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

interface GitHubPushPayload {
  ref: string;
  before: string;
  after: string;
  repository: {
    id: number;
    full_name: string;
    clone_url: string;
    default_branch: string;
  };
  pusher: {
    name: string;
    email: string;
  };
  head_commit?: {
    id: string;
    message: string;
    url: string;
  };
}

interface GitHubPullRequestPayload {
  action: 'opened' | 'synchronize' | 'reopened' | 'closed';
  number: number;
  pull_request: {
    id: number;
    number: number;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
    };
    html_url: string;
    title: string;
  };
  repository: {
    id: number;
    full_name: string;
    clone_url: string;
  };
}

interface GitLabPushPayload {
  ref: string;
  before: string;
  after: string;
  project: {
    id: number;
    path_with_namespace: string;
    http_url: string;
    default_branch: string;
  };
  user_name: string;
  commits: Array<{
    id: string;
    message: string;
    url: string;
  }>;
}

interface GitLabMergeRequestPayload {
  object_kind: 'merge_request';
  object_attributes: {
    id: number;
    iid: number;
    action: 'open' | 'update' | 'merge' | 'close';
    source_branch: string;
    target_branch: string;
    last_commit: {
      id: string;
    };
    url: string;
    title: string;
  };
  project: {
    id: number;
    path_with_namespace: string;
  };
}

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('scans') private readonly scansQueue: Queue,
  ) {}

  /**
   * GitHub Webhook handler
   * POST /webhooks/github/:repoId
   */
  @Post('github/:repoId')
  async handleGitHubWebhook(
    @Param('repoId') repoId: string,
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
  ) {
    this.logger.log(`GitHub webhook received for repo ${repoId}, event: ${event}`);

    // Get repository with webhook config
    const repo = await this.prisma.repository.findUnique({
      where: { id: repoId },
      include: { connection: true, scanConfig: true },
    });

    if (!repo) {
      throw new NotFoundException('Repository not found');
    }

    // Verify signature
    if (repo.webhookSecret && signature) {
      const rawBody = req.rawBody || JSON.stringify(body);
      const isValid = this.verifyGitHubSignature(
        rawBody.toString(),
        signature,
        repo.webhookSecret,
      );

      if (!isValid) {
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    // Handle different event types
    switch (event) {
      case 'push':
        return this.handleGitHubPush(repo, body as GitHubPushPayload);

      case 'pull_request':
        return this.handleGitHubPullRequest(repo, body as GitHubPullRequestPayload);

      default:
        this.logger.log(`Ignoring GitHub event: ${event}`);
        return { received: true, action: 'ignored', event };
    }
  }

  /**
   * GitLab Webhook handler
   * POST /webhooks/gitlab/:repoId
   */
  @Post('gitlab/:repoId')
  async handleGitLabWebhook(
    @Param('repoId') repoId: string,
    @Headers('x-gitlab-token') token: string,
    @Headers('x-gitlab-event') event: string,
    @Body() body: any,
  ) {
    this.logger.log(`GitLab webhook received for repo ${repoId}, event: ${event}`);

    // Get repository with webhook config
    const repo = await this.prisma.repository.findUnique({
      where: { id: repoId },
      include: { connection: true, scanConfig: true },
    });

    if (!repo) {
      throw new NotFoundException('Repository not found');
    }

    // Verify token
    if (repo.webhookSecret && token !== repo.webhookSecret) {
      throw new BadRequestException('Invalid webhook token');
    }

    // Handle different event types
    switch (event) {
      case 'Push Hook':
        return this.handleGitLabPush(repo, body as GitLabPushPayload);

      case 'Merge Request Hook':
        return this.handleGitLabMergeRequest(repo, body as GitLabMergeRequestPayload);

      default:
        this.logger.log(`Ignoring GitLab event: ${event}`);
        return { received: true, action: 'ignored', event };
    }
  }

  // ============ GitHub Event Handlers ============

  private async handleGitHubPush(repo: any, payload: GitHubPushPayload) {
    const branch = payload.ref.replace('refs/heads/', '');

    // Check branch filters
    if (!this.matchesBranchFilter(branch, repo)) {
      this.logger.log(`Branch ${branch} does not match filters, skipping scan`);
      return { received: true, action: 'skipped', reason: 'branch_filtered' };
    }

    // Queue scan
    const scanJob = await this.scansQueue.add('webhook-scan', {
      repositoryId: repo.id,
      tenantId: repo.tenantId,
      branch,
      commitSha: payload.after,
      trigger: 'webhook',
      triggerEvent: 'push',
      scanners: repo.webhookScannersEnabled?.length
        ? repo.webhookScannersEnabled
        : this.getDefaultScanners(repo.scanConfig),
      diffOnly: repo.webhookDiffOnly,
    });

    this.logger.log(`Queued webhook scan for ${repo.fullName}:${branch}, job: ${scanJob.id}`);

    return {
      received: true,
      action: 'scan_queued',
      scanJobId: scanJob.id,
      branch,
      commit: payload.after,
    };
  }

  private async handleGitHubPullRequest(repo: any, payload: GitHubPullRequestPayload) {
    // Only scan on opened, synchronize, or reopened
    if (!['opened', 'synchronize', 'reopened'].includes(payload.action)) {
      return { received: true, action: 'ignored', reason: `action_${payload.action}` };
    }

    const branch = payload.pull_request.head.ref;

    // Check branch filters
    if (!this.matchesBranchFilter(branch, repo)) {
      this.logger.log(`PR branch ${branch} does not match filters, skipping scan`);
      return { received: true, action: 'skipped', reason: 'branch_filtered' };
    }

    // Queue scan
    const scanJob = await this.scansQueue.add('webhook-scan', {
      repositoryId: repo.id,
      tenantId: repo.tenantId,
      branch,
      commitSha: payload.pull_request.head.sha,
      trigger: 'webhook',
      triggerEvent: 'pull_request',
      pullRequestNumber: payload.number,
      pullRequestUrl: payload.pull_request.html_url,
      scanners: repo.webhookScannersEnabled?.length
        ? repo.webhookScannersEnabled
        : this.getDefaultScanners(repo.scanConfig),
      diffOnly: repo.webhookDiffOnly,
      inlineComments: repo.webhookInlineComments,
      blockSeverity: repo.webhookBlockSeverity,
    });

    this.logger.log(`Queued PR scan for ${repo.fullName} PR#${payload.number}, job: ${scanJob.id}`);

    return {
      received: true,
      action: 'scan_queued',
      scanJobId: scanJob.id,
      pullRequest: payload.number,
      branch,
    };
  }

  // ============ GitLab Event Handlers ============

  private async handleGitLabPush(repo: any, payload: GitLabPushPayload) {
    const branch = payload.ref.replace('refs/heads/', '');

    // Check branch filters
    if (!this.matchesBranchFilter(branch, repo)) {
      this.logger.log(`Branch ${branch} does not match filters, skipping scan`);
      return { received: true, action: 'skipped', reason: 'branch_filtered' };
    }

    // Queue scan
    const scanJob = await this.scansQueue.add('webhook-scan', {
      repositoryId: repo.id,
      tenantId: repo.tenantId,
      branch,
      commitSha: payload.after,
      trigger: 'webhook',
      triggerEvent: 'push',
      scanners: repo.webhookScannersEnabled?.length
        ? repo.webhookScannersEnabled
        : this.getDefaultScanners(repo.scanConfig),
      diffOnly: repo.webhookDiffOnly,
    });

    this.logger.log(`Queued GitLab webhook scan for ${repo.fullName}:${branch}, job: ${scanJob.id}`);

    return {
      received: true,
      action: 'scan_queued',
      scanJobId: scanJob.id,
      branch,
      commit: payload.after,
    };
  }

  private async handleGitLabMergeRequest(repo: any, payload: GitLabMergeRequestPayload) {
    const attrs = payload.object_attributes;

    // Only scan on open or update
    if (!['open', 'update'].includes(attrs.action)) {
      return { received: true, action: 'ignored', reason: `action_${attrs.action}` };
    }

    const branch = attrs.source_branch;

    // Check branch filters
    if (!this.matchesBranchFilter(branch, repo)) {
      return { received: true, action: 'skipped', reason: 'branch_filtered' };
    }

    // Queue scan
    const scanJob = await this.scansQueue.add('webhook-scan', {
      repositoryId: repo.id,
      tenantId: repo.tenantId,
      branch,
      commitSha: attrs.last_commit.id,
      trigger: 'webhook',
      triggerEvent: 'merge_request',
      pullRequestNumber: attrs.iid,
      pullRequestUrl: attrs.url,
      scanners: repo.webhookScannersEnabled?.length
        ? repo.webhookScannersEnabled
        : this.getDefaultScanners(repo.scanConfig),
      diffOnly: repo.webhookDiffOnly,
      inlineComments: repo.webhookInlineComments,
      blockSeverity: repo.webhookBlockSeverity,
    });

    this.logger.log(`Queued GitLab MR scan for ${repo.fullName} MR!${attrs.iid}, job: ${scanJob.id}`);

    return {
      received: true,
      action: 'scan_queued',
      scanJobId: scanJob.id,
      mergeRequest: attrs.iid,
      branch,
    };
  }

  // ============ Helpers ============

  private verifyGitHubSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const expected = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  }

  private matchesBranchFilter(branch: string, repo: any): boolean {
    const includes = repo.webhookBranchFilters || [];
    const excludes = repo.webhookBranchExcludes || [];

    // Check excludes first
    for (const pattern of excludes) {
      if (this.matchGlob(branch, pattern)) {
        return false;
      }
    }

    // If no include patterns, allow all
    if (includes.length === 0) {
      return true;
    }

    // Check includes
    for (const pattern of includes) {
      if (this.matchGlob(branch, pattern)) {
        return true;
      }
    }

    return false;
  }

  private matchGlob(str: string, pattern: string): boolean {
    // Simple glob matching: * matches anything
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(str);
  }

  private getDefaultScanners(scanConfig: any): string[] {
    const scanners: string[] = [];
    if (scanConfig?.enableSast !== false) scanners.push('semgrep');
    if (scanConfig?.enableSca !== false) scanners.push('trivy');
    if (scanConfig?.enableSecrets !== false) scanners.push('gitleaks');
    if (scanConfig?.enableIac) scanners.push('checkov');
    return scanners.length > 0 ? scanners : ['semgrep', 'trivy', 'gitleaks'];
  }
}
