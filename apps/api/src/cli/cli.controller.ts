import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../libs/auth/decorators/current-user.decorator';
import { CliService, UploadResult } from './cli.service';

interface CliUploadDto {
  sarif: any;
  repository: string;
  branch: string;
  commitSha: string;
  pullRequestId?: string;
}

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

@ApiTags('cli')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
}
