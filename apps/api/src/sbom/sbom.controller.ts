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
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { SbomService } from './sbom.service';
import { SbomCveMatcherService, SbomPackage, SbomAnalysisResult } from './sbom-cve-matcher.service';
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
  constructor(
    private readonly service: SbomService,
    private readonly cveMatcherService: SbomCveMatcherService,
  ) {}

  // ===== SBOM CRUD =====

  @Get()
  async listSboms(
    @Req() req: AuthRequest,
    @Query('projectId') projectId: string,
    @Query('repositoryId') repositoryId?: string,
    @Query('format') format?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId query parameter is required');
    }
    return this.service.listSboms(req.user.tenantId, {
      projectId,
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

  // ===== CVE MATCHING =====

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyzeSbomForCves(
    @Body() body: { packages: SbomPackage[] },
  ): Promise<SbomAnalysisResult> {
    if (!body.packages || body.packages.length === 0) {
      throw new BadRequestException('No packages provided');
    }
    return this.cveMatcherService.analyzeSbom(body.packages);
  }

  @Post('analyze/content')
  @HttpCode(HttpStatus.OK)
  async analyzeContent(
    @Body() body: { content: string; format?: 'cyclonedx' | 'spdx' | 'auto' },
  ): Promise<SbomAnalysisResult> {
    if (!body.content) {
      throw new BadRequestException('No SBOM content provided');
    }

    try {
      const packages = this.cveMatcherService.parseSBOM(body.content, body.format);
      return this.cveMatcherService.analyzeSbom(packages);
    } catch (error: any) {
      throw new BadRequestException(`Failed to parse SBOM: ${error.message}`);
    }
  }

  @Post('check-package')
  @HttpCode(HttpStatus.OK)
  async checkPackage(@Body() pkg: SbomPackage) {
    return this.cveMatcherService.findVulnerabilitiesForPackage(pkg);
  }

  @Get('supported-formats')
  getSupportedFormats() {
    return {
      supported: [
        {
          name: 'CycloneDX',
          versions: ['1.4', '1.5'],
          formats: ['json', 'xml'],
          description: 'OWASP CycloneDX Software Bill of Materials format',
        },
        {
          name: 'SPDX',
          versions: ['2.2', '2.3'],
          formats: ['json'],
          description: 'Software Package Data Exchange format',
        },
      ],
      ecosystems: [
        { type: 'npm', description: 'Node.js/JavaScript packages' },
        { type: 'pypi', description: 'Python packages' },
        { type: 'maven', description: 'Java/Maven packages' },
        { type: 'nuget', description: '.NET/NuGet packages' },
        { type: 'go', description: 'Go modules' },
        { type: 'cargo', description: 'Rust crates' },
        { type: 'gem', description: 'Ruby gems' },
        { type: 'composer', description: 'PHP Composer packages' },
      ],
    };
  }
}
