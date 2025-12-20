import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard } from '../libs/auth';
import { ScmService } from './services/scm.service';
import {
  InitiateOAuthDto,
  OAuthCallbackDto,
  ConnectWithPatDto,
  AddRepositoryDto,
  UpdateScanConfigDto,
  TriggerScanDto,
} from './dto';
import { ConfigService } from '@nestjs/config';

@Controller('scm')
export class ScmController {
  constructor(
    private readonly scmService: ScmService,
    private readonly configService: ConfigService,
  ) {}

  // OAuth flow
  @Post('oauth/initiate')
  @UseGuards(JwtAuthGuard)
  initiateOAuth(
    @CurrentUser() user: { tenantId: string },
    @Body() dto: InitiateOAuthDto,
  ) {
    const authUrl = this.scmService.initiateOAuth(user.tenantId, dto.provider);
    return { authUrl };
  }

  @Get('oauth/callback')
  async handleOAuthCallback(
    @Query() query: OAuthCallbackDto,
    @Res() res: Response,
  ) {
    try {
      const result = await this.scmService.handleOAuthCallback(query.code, query.state);
      // Redirect to dashboard with success
      const dashboardUrl = this.configService.get('DASHBOARD_URL') || 'http://localhost:3000';
      res.redirect(`${dashboardUrl}/dashboard/connections?connected=${result.connectionId}`);
    } catch (error) {
      const dashboardUrl = this.configService.get('DASHBOARD_URL') || 'http://localhost:3000';
      res.redirect(`${dashboardUrl}/dashboard/connections?error=oauth_failed`);
    }
  }

  @Post('connect/pat')
  @UseGuards(JwtAuthGuard)
  async connectWithPat(
    @CurrentUser() user: { tenantId: string },
    @Body() dto: ConnectWithPatDto,
  ) {
    const connectionId = await this.scmService.connectWithPat(
      user.tenantId,
      dto.provider,
      dto.token,
    );
    return { connectionId };
  }

  // Connections
  @Get('connections')
  @UseGuards(JwtAuthGuard)
  async listConnections(@CurrentUser() user: { tenantId: string }) {
    return this.scmService.listConnections(user.tenantId);
  }

  @Delete('connections/:connectionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteConnection(
    @CurrentUser() user: { tenantId: string },
    @Param('connectionId') connectionId: string,
  ) {
    await this.scmService.deleteConnection(user.tenantId, connectionId);
    return { success: true };
  }

  // Available repositories (from provider)
  @Get('connections/:connectionId/available-repos')
  @UseGuards(JwtAuthGuard)
  async listAvailableRepositories(
    @CurrentUser() user: { tenantId: string },
    @Param('connectionId') connectionId: string,
  ) {
    return this.scmService.listAvailableRepositories(
      user.tenantId,
      connectionId,
    );
  }

  // Repositories (added to ThreatDiviner)
  @Get('repositories')
  @UseGuards(JwtAuthGuard)
  async listRepositories(@CurrentUser() user: { tenantId: string }) {
    return this.scmService.listRepositories(user.tenantId);
  }

  @Post('repositories')
  @UseGuards(JwtAuthGuard)
  async addRepository(
    @CurrentUser() user: { tenantId: string },
    @Body() dto: AddRepositoryDto,
  ) {
    const repositoryId = await this.scmService.addRepository(
      user.tenantId,
      dto.connectionId,
      dto.fullName,
    );
    return { repositoryId };
  }

  @Get('repositories/:repositoryId')
  @UseGuards(JwtAuthGuard)
  async getRepository(
    @CurrentUser() user: { tenantId: string },
    @Param('repositoryId') repositoryId: string,
  ) {
    const repository = await this.scmService.getRepository(user.tenantId, repositoryId);
    return { repository };
  }

  @Put('repositories/:repositoryId/config')
  @UseGuards(JwtAuthGuard)
  async updateScanConfig(
    @CurrentUser() user: { tenantId: string },
    @Param('repositoryId') repositoryId: string,
    @Body() dto: UpdateScanConfigDto,
  ) {
    const config = await this.scmService.updateScanConfig(user.tenantId, repositoryId, dto);
    return { config };
  }

  @Delete('repositories/:repositoryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async removeRepository(
    @CurrentUser() user: { tenantId: string },
    @Param('repositoryId') repositoryId: string,
  ) {
    await this.scmService.removeRepository(user.tenantId, repositoryId);
    return { success: true };
  }

  // Scans
  @Get('scans')
  @UseGuards(JwtAuthGuard)
  async listScans(
    @CurrentUser() user: { tenantId: string },
    @Query('repositoryId') repositoryId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.scmService.listScans(
      user.tenantId,
      repositoryId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('scans')
  @UseGuards(JwtAuthGuard)
  async triggerScan(
    @CurrentUser() user: { tenantId: string },
    @Body() dto: TriggerScanDto,
  ) {
    const scanId = await this.scmService.triggerScan(
      user.tenantId,
      dto.repositoryId,
      dto.branch,
    );
    return { scanId };
  }

  @Get('scans/:scanId')
  @UseGuards(JwtAuthGuard)
  async getScan(
    @CurrentUser() user: { tenantId: string },
    @Param('scanId') scanId: string,
  ) {
    const scan = await this.scmService.getScan(user.tenantId, scanId);
    return { scan };
  }

  // Findings
  @Get('findings')
  @UseGuards(JwtAuthGuard)
  async listFindings(
    @CurrentUser() user: { tenantId: string },
    @Query('scanId') scanId?: string,
    @Query('repositoryId') repositoryId?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.scmService.listFindings(user.tenantId, {
      scanId,
      repositoryId,
      severity,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('findings/:findingId')
  @UseGuards(JwtAuthGuard)
  async getFinding(
    @CurrentUser() user: { tenantId: string },
    @Param('findingId') findingId: string,
  ) {
    // Reuse listFindings with the specific ID
    const result = await this.scmService.listFindings(user.tenantId, { limit: 1 });
    const finding = result.findings.find(f => f.id === findingId);
    if (!finding) {
      throw new Error('Finding not found');
    }
    return finding;
  }

  @Put('findings/:findingId/status')
  @UseGuards(JwtAuthGuard)
  async updateFindingStatus(
    @CurrentUser() user: { tenantId: string },
    @Param('findingId') findingId: string,
    @Body('status') status: string,
  ) {
    return this.scmService.updateFindingStatus(user.tenantId, findingId, status);
  }
}
