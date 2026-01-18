import { Controller, Post, Get, Body, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../libs/auth/decorators/current-user.decorator';
import { CliAuthGuard } from './cli-auth.guard';
import {
  CliService,
  UploadResult,
  TriggerScanResult,
  WriteBackCapability,
  WriteBackCapabilities,
} from './cli.service';

interface CliUploadDto {
  sarif: any;
  repository: string;
  branch: string;
  commitSha: string;
  pullRequestId?: string;
}

interface TriggerScanDto {
  repository: string;
  branch?: string;
  commitSha?: string;
  pullRequestId?: string;
  scanners?: string[];
  writeBack?: WriteBackCapability[];
  failOnSeverity?: string;
  failOnCount?: number;
  diffOnly?: boolean; // Only report findings in changed files (compared to default branch)
}

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

@ApiTags('cli')
@ApiBearerAuth()
@UseGuards(CliAuthGuard)
@Controller('cli')
export class CliController {
  private readonly logger = new Logger(CliController.name);

  constructor(private readonly cliService: CliService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload SARIF results from CLI' })
  async uploadSarif(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CliUploadDto,
  ): Promise<UploadResult> {
    this.logger.log(`CLI upload for ${dto.repository} by tenant ${user.tenantId}`);

    const result = await this.cliService.processSarifUpload(
      user.tenantId,
      dto.sarif,
      dto.repository,
      dto.branch,
      dto.commitSha,
      dto.pullRequestId,
    );

    return result;
  }

  @Post('register-scan')
  @ApiOperation({ summary: 'Register a scan from CLI before uploading results' })
  async registerScan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { repository: string; branch: string; commitSha: string; pullRequestId?: string },
  ) {
    return this.cliService.registerCliScan(
      user.tenantId,
      dto.repository,
      dto.branch,
      dto.commitSha,
      dto.pullRequestId,
    );
  }

  // ========== Remote Scan Trigger (CLI/Pipeline Integration) ==========

  @Post('trigger-scan')
  @ApiOperation({
    summary: 'Trigger a remote scan from CLI/Pipeline',
    description: `
      Triggers a scan on the ThreatDiviner server. The server will:
      1. Clone the repository using its SCM connection
      2. Run the configured scanners
      3. Write results back to SCM (PR comments, check status, etc.)

      Settings priority: CLI flags > repo settings (if enabled) > minimal defaults

      Minimal defaults (when no settings configured):
      - Scanners: semgrep, trivy, gitleaks
      - Write-back: PR summary, check status
      - Fail on: critical severity
    `,
  })
  async triggerScan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TriggerScanDto,
  ): Promise<TriggerScanResult> {
    this.logger.log(`CLI trigger-scan request for ${dto.repository} by tenant ${user.tenantId}`);

    return this.cliService.triggerRemoteScan(user.tenantId, {
      repository: dto.repository,
      branch: dto.branch,
      commitSha: dto.commitSha,
      pullRequestId: dto.pullRequestId,
      scanners: dto.scanners,
      writeBack: dto.writeBack,
      failOnSeverity: dto.failOnSeverity,
      failOnCount: dto.failOnCount,
      diffOnly: dto.diffOnly,
    });
  }

  @Get('capabilities')
  @ApiOperation({
    summary: 'Get write-back capabilities for a repository',
    description: `
      Returns the available write-back capabilities based on the SCM connection type.
      Use this to understand what feedback mechanisms are available before triggering a scan.
    `,
  })
  @ApiQuery({ name: 'repository', required: true, description: 'Full repository name (e.g., owner/repo)' })
  async getCapabilities(
    @CurrentUser() user: AuthenticatedUser,
    @Query('repository') repository: string,
  ): Promise<WriteBackCapabilities> {
    return this.cliService.getCapabilities(user.tenantId, repository);
  }

  @Get('default-settings')
  @ApiOperation({
    summary: 'Get default scan settings for a repository',
    description: `
      Returns the settings that would apply if no CLI flags are provided.
      Shows whether repo settings or minimal defaults will be used.
    `,
  })
  @ApiQuery({ name: 'repository', required: true, description: 'Full repository name (e.g., owner/repo)' })
  async getDefaultSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Query('repository') repository: string,
  ) {
    return this.cliService.getDefaultSettings(user.tenantId, repository);
  }
}
