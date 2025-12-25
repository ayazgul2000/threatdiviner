import { Controller, Get, Post, Param, Query, UseGuards, HttpException, HttpStatus, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { VulnDbService, CveSearchQuery } from './vulndb.service';
import { FindingEnrichmentService } from './finding-enrichment.service';
import { SlaService } from './sla.service';
import {
  NvdSyncService,
  CweSyncService,
  EpssSyncService,
  KevSyncService,
  OwaspSyncService,
  CweMappingSyncService,
  AttackSyncService,
} from './sync';

@Controller('vulndb')
@UseGuards(JwtAuthGuard)
export class VulnDbController {
  constructor(
    private readonly vulnDbService: VulnDbService,
    private readonly findingEnrichmentService: FindingEnrichmentService,
    private readonly slaService: SlaService,
    private readonly nvdSyncService: NvdSyncService,
    private readonly cweSyncService: CweSyncService,
    private readonly epssSyncService: EpssSyncService,
    private readonly kevSyncService: KevSyncService,
    private readonly owaspSyncService: OwaspSyncService,
    private readonly cweMappingSyncService: CweMappingSyncService,
    private readonly attackSyncService: AttackSyncService,
  ) {}

  // ==================
  // CVE Endpoints
  // ==================

  @Get('cve/:id')
  async getCve(@Param('id') id: string) {
    const cve = await this.vulnDbService.getCve(id);
    if (!cve) {
      throw new HttpException('CVE not found', HttpStatus.NOT_FOUND);
    }
    return cve;
  }

  @Get('cve')
  async searchCves(
    @Query('keyword') keyword?: string,
    @Query('severity') severity?: string,
    @Query('isKev') isKev?: string,
    @Query('minEpss') minEpss?: string,
    @Query('cweId') cweId?: string,
    @Query('publishedAfter') publishedAfter?: string,
    @Query('publishedBefore') publishedBefore?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const query: CveSearchQuery = {
      keyword,
      severity,
      isKev: isKev === 'true' ? true : isKev === 'false' ? false : undefined,
      minEpss: minEpss ? parseFloat(minEpss) : undefined,
      cweId,
      publishedAfter: publishedAfter ? new Date(publishedAfter) : undefined,
      publishedBefore: publishedBefore ? new Date(publishedBefore) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };

    return this.vulnDbService.searchCves(query);
  }

  @Get('cve/recent')
  async getRecentCves(@Query('limit') limit?: string) {
    return this.vulnDbService.getRecentCves(limit ? parseInt(limit, 10) : 20);
  }

  @Get('cve/kev')
  async getKevCves(@Query('limit') limit?: string) {
    return this.vulnDbService.getKevCves(limit ? parseInt(limit, 10) : 100);
  }

  @Get('cve/high-epss')
  async getHighEpssCves(
    @Query('minScore') minScore?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vulnDbService.getHighEpssCves(
      minScore ? parseFloat(minScore) : 0.5,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // ==================
  // CWE Endpoints
  // ==================

  @Get('cwe/:id')
  async getCwe(@Param('id') id: string) {
    const cwe = await this.vulnDbService.getCweWithCompliance(id);
    if (!cwe) {
      throw new HttpException('CWE not found', HttpStatus.NOT_FOUND);
    }
    return cwe;
  }

  @Get('cwe')
  async searchCwes(
    @Query('keyword') keyword: string,
    @Query('limit') limit?: string,
  ) {
    if (!keyword) {
      throw new HttpException('Keyword is required', HttpStatus.BAD_REQUEST);
    }
    return this.vulnDbService.searchCwes(keyword, limit ? parseInt(limit, 10) : 50);
  }

  // ==================
  // OWASP Endpoints
  // ==================

  @Get('owasp')
  async getOwaspTop10(@Query('year') year?: string) {
    return this.vulnDbService.getOwaspTop10(year ? parseInt(year, 10) : 2021);
  }

  @Get('owasp/:id')
  async getOwaspCategory(@Param('id') id: string) {
    const owasp = await this.vulnDbService.getOwaspById(id);
    if (!owasp) {
      throw new HttpException('OWASP category not found', HttpStatus.NOT_FOUND);
    }
    return owasp;
  }

  // ==================
  // ATT&CK Endpoints
  // ==================

  @Get('attack/tactics')
  async getAttackTactics() {
    return this.vulnDbService.getAttackTactics();
  }

  @Get('attack/techniques/:id')
  async getAttackTechnique(@Param('id') id: string) {
    const technique = await this.vulnDbService.getAttackTechnique(id);
    if (!technique) {
      throw new HttpException('Technique not found', HttpStatus.NOT_FOUND);
    }
    return technique;
  }

  @Get('attack/techniques')
  async searchAttackTechniques(
    @Query('keyword') keyword: string,
    @Query('limit') limit?: string,
  ) {
    if (!keyword) {
      throw new HttpException('Keyword is required', HttpStatus.BAD_REQUEST);
    }
    return this.vulnDbService.searchAttackTechniques(keyword, limit ? parseInt(limit, 10) : 50);
  }

  @Get('attack/surface')
  async getAttackSurface(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.vulnDbService.getAttackSurface(tenantId);
  }

  @Get('attack/surface/:repositoryId')
  async getAttackSurfaceForRepo(
    @Req() req: any,
    @Param('repositoryId') repositoryId: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.vulnDbService.getAttackSurface(tenantId, repositoryId);
  }

  @Get('attack/groups/relevant')
  async getRelevantThreatGroups(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.vulnDbService.getRelevantThreatGroups(tenantId);
  }

  @Get('attack/killchain')
  async getKillChainStatus(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.vulnDbService.getKillChainStatus(tenantId);
  }

  // ==================
  // Compliance Endpoints
  // ==================

  @Get('compliance/cwe/:cweId')
  async getComplianceForCwe(@Param('cweId') cweId: string) {
    return this.vulnDbService.getControlsByCwe(cweId);
  }

  @Get('compliance/framework/:frameworkId/cwes')
  async getCwesForFramework(@Param('frameworkId') frameworkId: string) {
    return this.vulnDbService.getCwesByFramework(frameworkId);
  }

  // ==================
  // Enrichment Endpoints
  // ==================

  @Get('enrich')
  async enrichFinding(
    @Query('cveId') cveId?: string,
    @Query('cweId') cweId?: string,
  ) {
    if (!cveId && !cweId) {
      throw new HttpException('At least one of cveId or cweId is required', HttpStatus.BAD_REQUEST);
    }
    return this.vulnDbService.enrichFinding({ cveId, cweId });
  }

  // ==================
  // Sync Endpoints
  // ==================

  @Get('sync/status')
  async getSyncStatus() {
    return this.vulnDbService.getSyncStatus();
  }

  @Get('stats')
  async getStats() {
    return this.vulnDbService.getStats();
  }

  @Post('sync/nvd')
  async syncNvd(@Query('full') full?: string) {
    if (full === 'true') {
      return this.nvdSyncService.syncAll();
    }
    return this.nvdSyncService.syncRecent(7);
  }

  @Post('sync/cwe')
  async syncCwe() {
    return this.cweSyncService.sync();
  }

  @Post('sync/epss')
  async syncEpss() {
    return this.epssSyncService.sync();
  }

  @Post('sync/kev')
  async syncKev() {
    return this.kevSyncService.sync();
  }

  @Post('sync/owasp')
  async syncOwasp() {
    return this.owaspSyncService.sync();
  }

  @Post('sync/cwe-mapping')
  async syncCweMapping() {
    return this.cweMappingSyncService.sync();
  }

  @Post('sync/attack')
  async syncAttack() {
    return this.attackSyncService.sync();
  }

  @Post('sync/all')
  async syncAll() {
    const results: Record<string, any> = {};

    try {
      results.owasp = await this.owaspSyncService.sync();
    } catch (e) {
      results.owasp = { error: e instanceof Error ? e.message : 'Unknown error' };
    }

    try {
      results.cweMapping = await this.cweMappingSyncService.sync();
    } catch (e) {
      results.cweMapping = { error: e instanceof Error ? e.message : 'Unknown error' };
    }

    try {
      results.kev = await this.kevSyncService.sync();
    } catch (e) {
      results.kev = { error: e instanceof Error ? e.message : 'Unknown error' };
    }

    try {
      results.attack = await this.attackSyncService.sync();
    } catch (e) {
      results.attack = { error: e instanceof Error ? e.message : 'Unknown error' };
    }

    return results;
  }

  // ==================
  // Finding Enrichment Endpoints
  // ==================

  @Post('enrichment/scan/:scanId')
  async enrichScanFindings(@Param('scanId') scanId: string) {
    return this.findingEnrichmentService.enrichScanFindings(scanId);
  }

  @Post('enrichment/finding/:findingId')
  async enrichSingleFinding(@Param('findingId') findingId: string) {
    await this.findingEnrichmentService.enrichFinding(findingId);
    return { success: true };
  }

  @Post('enrichment/batch')
  async enrichBatch(
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.findingEnrichmentService.enrichUnenrichedFindings(
      tenantId,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Get('findings/kev')
  async getKevFindings(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.findingEnrichmentService.getKevFindings(tenantId);
  }

  @Get('findings/high-risk')
  async getHighRiskFindings(
    @Req() req: any,
    @Query('minEpss') minEpss?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.findingEnrichmentService.getHighRiskFindings(
      tenantId,
      minEpss ? parseFloat(minEpss) : 0.5,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('findings/compliance/:frameworkId')
  async getFindingsByFramework(
    @Req() req: any,
    @Param('frameworkId') frameworkId: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.findingEnrichmentService.getFindingsByFramework(tenantId, frameworkId);
  }

  // ==================
  // SLA Endpoints
  // ==================

  @Get('sla/policies')
  async getSlaPolicies() {
    return this.slaService.getAllPolicies();
  }

  @Get('sla/summary')
  async getSlaSummary(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.slaService.getSlaSummary(tenantId);
  }

  @Get('sla/summary/by-severity')
  async getSlaSummaryBySeverity(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.slaService.getSlaSummaryBySeverity(tenantId);
  }

  @Get('sla/at-risk')
  async getAtRiskFindings(
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.slaService.getAtRiskFindings(
      tenantId,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('sla/breached')
  async getBreachedFindings(
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.slaService.getBreachedFindings(
      tenantId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('sla/mttr')
  async getMTTR(
    @Req() req: any,
    @Query('days') days?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new HttpException('Tenant ID required', HttpStatus.BAD_REQUEST);
    }
    return this.slaService.getMTTR(
      tenantId,
      days ? parseInt(days, 10) : 90,
    );
  }
}
