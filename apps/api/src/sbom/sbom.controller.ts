import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SbomService } from './sbom.service';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';

interface AuthRequest {
  user: {
    tenantId: string;
    userId: string;
  };
}

@Controller('sbom')
@UseGuards(JwtAuthGuard)
export class SbomController {
  constructor(private readonly service: SbomService) {}

  // ===== SBOM CRUD =====

  @Get()
  async listSboms(
    @Req() req: AuthRequest,
    @Query('repositoryId') repositoryId?: string,
    @Query('format') format?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listSboms(req.user.tenantId, {
      repositoryId,
      format,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get(':id')
  async getSbom(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.getSbom(req.user.tenantId, id);
  }

  @Delete(':id')
  async deleteSbom(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.deleteSbom(req.user.tenantId, id);
  }

  @Get(':id/stats')
  async getSbomStats(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.getSbomStats(req.user.tenantId, id);
  }

  @Get(':id/tree')
  async getDependencyTree(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.getDependencyTree(req.user.tenantId, id);
  }

  // ===== UPLOAD/PARSE =====

  @Post('upload/spdx')
  async uploadSpdx(
    @Req() req: AuthRequest,
    @Body() body: { content: string; name?: string },
  ) {
    return this.service.parseSpdx(
      req.user.tenantId,
      req.user.userId,
      body.content,
      body.name || 'Imported SBOM',
    );
  }

  @Post('upload/cyclonedx')
  async uploadCycloneDx(
    @Req() req: AuthRequest,
    @Body() body: { content: string; name?: string },
  ) {
    return this.service.parseCycloneDx(
      req.user.tenantId,
      req.user.userId,
      body.content,
      body.name || 'Imported SBOM',
    );
  }

  // ===== COMPONENTS =====

  @Post(':id/components')
  async addComponent(
    @Req() req: AuthRequest,
    @Param('id') sbomId: string,
    @Body() body: {
      purl?: string;
      name: string;
      version?: string;
      type: string;
      supplier?: string;
      license?: string;
      isDirect?: boolean;
      scope?: string;
    },
  ) {
    return this.service.addComponent(req.user.tenantId, sbomId, body);
  }

  @Delete('components/:componentId')
  async deleteComponent(
    @Req() req: AuthRequest,
    @Param('componentId') componentId: string,
  ) {
    return this.service.deleteComponent(req.user.tenantId, componentId);
  }

  // ===== VULNERABILITIES =====

  @Post(':id/vulnerabilities')
  async addVulnerability(
    @Req() req: AuthRequest,
    @Param('id') sbomId: string,
    @Body() body: {
      cveId?: string;
      ghsaId?: string;
      severity: string;
      cvssScore?: number;
      title: string;
      description?: string;
      recommendation?: string;
      fixedVersion?: string;
      componentIds?: string[];
    },
  ) {
    return this.service.addVulnerability(req.user.tenantId, sbomId, body);
  }

  @Post('vulnerabilities/:vulnId/status')
  async updateVulnStatus(
    @Req() req: AuthRequest,
    @Param('vulnId') vulnId: string,
    @Body() body: { status: string; reason?: string },
  ) {
    return this.service.updateVulnerabilityStatus(
      req.user.tenantId,
      vulnId,
      body.status,
      req.user.userId,
      body.reason,
    );
  }
}
