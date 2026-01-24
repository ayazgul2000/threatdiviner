import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  Header,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Response } from 'express';
import { ThreatModelingService } from './threat-modeling.service';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { StrideAnalyzer } from './analyzers/stride.analyzer';
import { EnterpriseStrideAnalyzer } from './analyzers/enterprise-stride.analyzer';
import { ThreatModelDiagramService } from './services/diagram.service';
import { ThreatModelExportService } from './services/export.service';
import { ThreagileService } from './services/threagile.service';
import { YamlGeneratorService } from './services/yaml-generator.service';
import { GapDetectionService } from './services/gap-detection.service';
import { ThreatModelComplianceService } from './services/threat-model-compliance.service';
import { QueueService } from '../queue/services/queue.service';
import { BatchUpdateAssetsDto, BatchUpdateLinksDto, BatchUpdateBoundariesDto } from './dto/batch-update.dto';

interface AuthRequest {
  user: {
    tenantId: string;
    userId: string;
  };
}

@Controller('threat-modeling')
@UseGuards(JwtAuthGuard)
export class ThreatModelingController {
  constructor(
    private readonly service: ThreatModelingService,
    private readonly strideAnalyzer: StrideAnalyzer,
    private readonly enterpriseStrideAnalyzer: EnterpriseStrideAnalyzer,
    private readonly diagramService: ThreatModelDiagramService,
    private readonly exportService: ThreatModelExportService,
    private readonly threagileService: ThreagileService,
    private readonly yamlGeneratorService: YamlGeneratorService,
    private readonly gapDetectionService: GapDetectionService,
    private readonly complianceService: ThreatModelComplianceService,
    private readonly queueService: QueueService,
  ) {}

  // ===== THREAT MODELS =====

  @Get()
  async listThreatModels(
    @Req() req: AuthRequest,
    @Query('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('repositoryId') repositoryId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId query parameter is required');
    }
    return this.service.listThreatModels(req.user.tenantId, {
      projectId,
      status,
      repositoryId,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get(':id')
  async getThreatModel(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.getThreatModel(req.user.tenantId, id);
  }

  @Post()
  async createThreatModel(
    @Req() req: AuthRequest,
    @Body() body: {
      name: string;
      projectId: string;
      description?: string;
      methodology?: string;
      repositoryId?: string;
    },
  ) {
    if (!body.projectId) {
      throw new BadRequestException('projectId is required');
    }
    return this.service.createThreatModel(req.user.tenantId, req.user.userId, body);
  }

  @Put(':id')
  async updateThreatModel(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      description?: string;
      methodology?: string;
      status?: string;
    },
  ) {
    return this.service.updateThreatModel(req.user.tenantId, id, req.user.userId, body);
  }

  @Delete(':id')
  async deleteThreatModel(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.deleteThreatModel(req.user.tenantId, id);
  }

  @Post(':id/duplicate')
  async duplicateThreatModel(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { name?: string },
  ) {
    return this.service.duplicateThreatModel(req.user.tenantId, id, req.user.userId, body.name);
  }

  @Get(':id/stats')
  async getThreatModelStats(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.getThreatModelStats(req.user.tenantId, id);
  }

  @Get(':id/diagram')
  async getDiagram(@Req() req: AuthRequest, @Param('id') id: string) {
    const mermaid = await this.diagramService.generateMermaidDiagram(id, req.user.tenantId);
    return { mermaid };
  }

  @Get(':id/diagram/matrix')
  async getThreatMatrix(@Req() req: AuthRequest, @Param('id') id: string) {
    const matrix = await this.diagramService.generateThreatMatrix(id, req.user.tenantId);
    return { matrix };
  }

  @Get(':id/diagram/heatmap')
  async getRiskHeatmap(@Req() req: AuthRequest, @Param('id') id: string) {
    const heatmap = await this.diagramService.generateRiskHeatmap(id, req.user.tenantId);
    return { heatmap };
  }

  @Get(':id/export/xlsx')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportToExcel(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('includeComponents') includeComponents?: string,
    @Query('includeDataFlows') includeDataFlows?: string,
    @Query('includeMatrix') includeMatrix?: string,
  ) {
    const buffer = await this.exportService.exportToExcel(id, req.user.tenantId, {
      format: 'xlsx',
      includeComponents: includeComponents !== 'false',
      includeDataFlows: includeDataFlows !== 'false',
      includeMatrix: includeMatrix !== 'false',
    });

    res.setHeader('Content-Disposition', `attachment; filename=threat-model-${id}.xlsx`);
    res.send(buffer);
  }

  @Get(':id/export/csv')
  @Header('Content-Type', 'text/csv')
  async exportToCsv(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportToCsv(id, req.user.tenantId);

    res.setHeader('Content-Disposition', `attachment; filename=threat-model-${id}.csv`);
    res.send(csv);
  }

  @Post(':id/analyze')
  async analyzeThreats(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() _body: { methodology?: string },
  ) {
    // Get the threat model with components and data flows
    const model = await this.service.getThreatModel(req.user.tenantId, id);

    if (!model.components || model.components.length === 0) {
      return {
        success: false,
        error: 'No components found. Add components before analyzing.',
        threats: [],
        summary: { totalThreats: 0, byCategory: {}, byRiskLevel: { high: 0, medium: 0, low: 0 } },
      };
    }

    // Run STRIDE analysis (default methodology)
    const result = this.strideAnalyzer.analyze(
      model.id,
      model.components,
      model.dataFlows || [],
    );

    // Save the generated threats to the database
    for (const threat of result.threats) {
      await this.service.addThreat(req.user.tenantId, id, req.user.userId, {
        title: threat.title,
        description: threat.description,
        category: threat.strideCategory,
        strideCategory: threat.strideCategory,
        likelihood: threat.likelihood,
        impact: threat.impact,
        cweIds: threat.cweIds,
        attackTechniqueIds: threat.attackTechniqueIds,
      });
    }

    return {
      success: true,
      threatsGenerated: result.threats.length,
      summary: result.summary,
    };
  }

  @Post(':id/analyze/enterprise')
  async analyzeThreatsEnterprise(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    // Get the threat model to verify it exists and has components
    const model = await this.service.getThreatModel(req.user.tenantId, id);

    if (!model.components || model.components.length === 0) {
      return {
        success: false,
        error: 'No components found. Add components before analyzing.',
        threats: [],
        summary: { totalThreats: 0, byCategory: {}, byRiskLevel: { critical: 0, high: 0, medium: 0, low: 0 } },
      };
    }

    // Run Enterprise STRIDE analysis - this saves threats directly to DB with all EMIA fields
    const result = await this.enterpriseStrideAnalyzer.analyze(id, req.user.tenantId);

    return {
      success: result.success,
      threatsGenerated: result.threatsCreated,
      threats: result.threats.length,
      methodology: result.methodology,
      enterpriseFormat: true,
    };
  }

  // ===== COMPONENTS =====

  @Post(':id/components')
  async addComponent(
    @Req() req: AuthRequest,
    @Param('id') threatModelId: string,
    @Body() body: {
      name: string;
      description?: string;
      type: string;
      technology?: string;
      criticality?: string;
      dataClassification?: string;
      positionX?: number;
      positionY?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.service.addComponent(req.user.tenantId, threatModelId, body);
  }

  @Put('components/:componentId')
  async updateComponent(
    @Req() req: AuthRequest,
    @Param('componentId') componentId: string,
    @Body() body: {
      name?: string;
      description?: string;
      type?: string;
      technology?: string;
      criticality?: string;
      dataClassification?: string;
      positionX?: number;
      positionY?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.service.updateComponent(req.user.tenantId, componentId, body);
  }

  @Delete('components/:componentId')
  async deleteComponent(@Req() req: AuthRequest, @Param('componentId') componentId: string) {
    return this.service.deleteComponent(req.user.tenantId, componentId);
  }

  // ===== DATA FLOWS =====

  @Post(':id/data-flows')
  async addDataFlow(
    @Req() req: AuthRequest,
    @Param('id') threatModelId: string,
    @Body() body: {
      sourceId: string;
      targetId: string;
      label?: string;
      dataType?: string;
      protocol?: string;
      authentication?: boolean;
      encryption?: boolean;
    },
  ) {
    return this.service.addDataFlow(req.user.tenantId, threatModelId, body);
  }

  @Put('data-flows/:dataFlowId')
  async updateDataFlow(
    @Req() req: AuthRequest,
    @Param('dataFlowId') dataFlowId: string,
    @Body() body: {
      sourceId?: string;
      targetId?: string;
      label?: string;
      dataType?: string;
      protocol?: string;
      authentication?: boolean;
      encryption?: boolean;
    },
  ) {
    return this.service.updateDataFlow(req.user.tenantId, dataFlowId, body);
  }

  @Delete('data-flows/:dataFlowId')
  async deleteDataFlow(@Req() req: AuthRequest, @Param('dataFlowId') dataFlowId: string) {
    return this.service.deleteDataFlow(req.user.tenantId, dataFlowId);
  }

  // ===== THREATS =====

  @Post(':id/threats')
  async addThreat(
    @Req() req: AuthRequest,
    @Param('id') threatModelId: string,
    @Body() body: {
      title: string;
      description: string;
      category: string;
      attackVector?: string;
      likelihood?: string;
      impact?: string;
      strideCategory?: string;
      attackTechniqueIds?: string[];
      cweIds?: string[];
      capecIds?: string[];
      componentIds?: string[];
      dataFlowIds?: string[];
    },
  ) {
    return this.service.addThreat(req.user.tenantId, threatModelId, req.user.userId, body);
  }

  @Put('threats/:threatId')
  async updateThreat(
    @Req() req: AuthRequest,
    @Param('threatId') threatId: string,
    @Body() body: {
      title?: string;
      description?: string;
      category?: string;
      attackVector?: string;
      likelihood?: string;
      impact?: string;
      status?: string;
      strideCategory?: string;
      attackTechniqueIds?: string[];
      cweIds?: string[];
      capecIds?: string[];
      componentIds?: string[];
      dataFlowIds?: string[];
    },
  ) {
    return this.service.updateThreat(req.user.tenantId, threatId, req.user.userId, body);
  }

  @Delete('threats/:threatId')
  async deleteThreat(@Req() req: AuthRequest, @Param('threatId') threatId: string) {
    return this.service.deleteThreat(req.user.tenantId, threatId);
  }

  // ===== MITIGATIONS =====

  @Post(':id/mitigations')
  async addMitigation(
    @Req() req: AuthRequest,
    @Param('id') threatModelId: string,
    @Body() body: {
      title: string;
      description: string;
      type: string;
      priority?: number;
      effort?: string;
      cost?: string;
      owner?: string;
      dueDate?: string;
      threatIds?: string[];
    },
  ) {
    return this.service.addMitigation(req.user.tenantId, threatModelId, body);
  }

  @Put('mitigations/:mitigationId')
  async updateMitigation(
    @Req() req: AuthRequest,
    @Param('mitigationId') mitigationId: string,
    @Body() body: {
      title?: string;
      description?: string;
      type?: string;
      priority?: number;
      effort?: string;
      cost?: string;
      owner?: string;
      dueDate?: string;
      implementationStatus?: string;
      threatIds?: string[];
    },
  ) {
    return this.service.updateMitigation(req.user.tenantId, mitigationId, body);
  }

  @Delete('mitigations/:mitigationId')
  async deleteMitigation(@Req() req: AuthRequest, @Param('mitigationId') mitigationId: string) {
    return this.service.deleteMitigation(req.user.tenantId, mitigationId);
  }

  // ===== THREAGILE ANALYSIS =====

  @Get('threagile/health')
  async getThreagileHealth() {
    return this.threagileService.healthCheck();
  }

  @Post(':id/validate')
  async validateModel(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.yamlGeneratorService.validateModel(id, req.user.tenantId);
  }

  // ===== GAP DETECTION (v2.5.0) =====

  @Get(':id/gaps')
  async detectGaps(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.gapDetectionService.detectGaps(req.user.tenantId, id);
  }

  @Patch(':id/assets/batch')
  async batchUpdateAssets(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: BatchUpdateAssetsDto,
  ) {
    const result = await this.gapDetectionService.batchUpdateAssets(
      req.user.tenantId,
      id,
      body.updates,
    );

    // Re-validate after updates
    const gaps = await this.gapDetectionService.detectGaps(req.user.tenantId, id);

    return {
      ...result,
      gaps: gaps.gaps,
      valid: gaps.valid,
    };
  }

  @Patch(':id/data-flows/batch')
  async batchUpdateDataFlows(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: BatchUpdateLinksDto,
  ) {
    const result = await this.gapDetectionService.batchUpdateDataFlows(
      req.user.tenantId,
      id,
      body.updates,
    );

    // Re-validate after updates
    const gaps = await this.gapDetectionService.detectGaps(req.user.tenantId, id);

    return {
      ...result,
      gaps: gaps.gaps,
      valid: gaps.valid,
    };
  }

  @Patch(':id/boundaries/batch')
  async batchUpdateBoundaries(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: BatchUpdateBoundariesDto,
  ) {
    const result = await this.gapDetectionService.batchUpdateBoundaries(
      req.user.tenantId,
      id,
      body.updates,
    );

    // Re-validate after updates
    const gaps = await this.gapDetectionService.detectGaps(req.user.tenantId, id);

    return {
      ...result,
      gaps: gaps.gaps,
      valid: gaps.valid,
    };
  }

  @Post(':id/gaps/fill')
  async fillGaps(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: {
      assetUpdates?: Array<{ id: string; fields: Record<string, any> }>;
      linkUpdates?: Array<{ id: string; fields: Record<string, any> }>;
      boundaryUpdates?: Array<{ id: string; fields: Record<string, any> }>;
    },
  ) {
    return this.gapDetectionService.batchFillGaps(
      req.user.tenantId,
      id,
      body.assetUpdates || [],
      body.linkUpdates || [],
      body.boundaryUpdates || [],
    );
  }

  // ===== COMPLIANCE (v4.1.0) =====

  @Get(':id/compliance')
  async getComplianceGaps(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Query('frameworks') frameworks?: string,
  ) {
    // Verify access to threat model
    await this.service.getThreatModel(req.user.tenantId, id);

    const frameworkIds = frameworks ? frameworks.split(',').map(f => f.trim()) : undefined;
    return this.complianceService.calculateComplianceGaps(id, frameworkIds);
  }

  @Get(':id/compliance/summary')
  async getComplianceGapSummary(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Query('framework') frameworkId?: string,
  ) {
    // Verify access to threat model
    await this.service.getThreatModel(req.user.tenantId, id);

    return this.complianceService.getComplianceGapSummary(id, frameworkId);
  }

  @Get(':id/compliance/framework/:frameworkId')
  async getFrameworkComplianceScore(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('frameworkId') frameworkId: string,
  ) {
    // Verify access to threat model
    await this.service.getThreatModel(req.user.tenantId, id);

    const score = await this.complianceService.getFrameworkComplianceScore(id, frameworkId);
    if (!score) {
      throw new BadRequestException(`Framework not found: ${frameworkId}`);
    }
    return score;
  }

  @Post(':id/compliance/invalidate')
  async invalidateComplianceCache(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    // Verify access to threat model
    await this.service.getThreatModel(req.user.tenantId, id);

    await this.complianceService.invalidateCache(id);
    return { success: true, message: 'Compliance cache invalidated' };
  }

  @Get('compliance/controls-for-risk/:canonicalRiskId')
  async getControlsForRisk(
    @Param('canonicalRiskId') canonicalRiskId: string,
  ) {
    const controls = await this.complianceService.getControlsForRisk(canonicalRiskId);
    return { controls };
  }

  @Get('compliance/risks-for-control/:controlId')
  async getRisksForControl(
    @Param('controlId') controlId: string,
  ) {
    const risks = await this.complianceService.getRisksForControl(controlId);
    return { risks };
  }

  @Get(':id/yaml')
  @Header('Content-Type', 'application/x-yaml')
  async generateYaml(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const yaml = await this.yamlGeneratorService.generateYaml(id, req.user.tenantId);
    res.setHeader('Content-Disposition', `attachment; filename=threat-model-${id}.yaml`);
    res.send(yaml);
  }

  @Post(':id/analyze/threagile')
  @HttpCode(HttpStatus.ACCEPTED)
  async runThreagileAnalysis(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { async?: boolean; skipGapCheck?: boolean },
  ) {
    // v2.5.0: Check for gaps before running analysis
    if (!body.skipGapCheck) {
      const gapResult = await this.gapDetectionService.detectGaps(req.user.tenantId, id);
      if (!gapResult.valid) {
        throw new UnprocessableEntityException({
          message: 'Model has gaps that must be filled before analysis',
          gaps: gapResult.gaps,
          summary: gapResult.summary,
          hint: 'Use GET /threat-modeling/:id/gaps to view gaps, then POST /threat-modeling/:id/gaps/fill to fill them',
        });
      }
    }

    // First validate the model
    const validation = await this.yamlGeneratorService.validateModel(id, req.user.tenantId);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Model validation failed',
        errors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // Generate YAML
    const yaml = await this.yamlGeneratorService.generateYaml(id, req.user.tenantId);

    // Check if async mode is requested (default to async)
    const useAsync = body.async !== false;

    if (useAsync) {
      // Create AnalysisRun record
      const analysisRun = await this.service.createAnalysisRun(
        req.user.tenantId,
        id,
        req.user.userId,
        yaml,
      );

      // Queue the analysis job
      await this.queueService.enqueueAnalysis({
        analysisRunId: analysisRun.id,
        threatModelId: id,
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        yaml,
      });

      return {
        success: true,
        async: true,
        analysisRunId: analysisRun.id,
        status: 'queued',
        message: 'Analysis queued. Poll GET /analysis-runs/:runId for progress.',
        warnings: validation.warnings,
      };
    }

    // Synchronous mode (for backward compatibility)
    const result = await this.threagileService.analyze({
      yaml,
      threatModelId: id,
      tenantId: req.user.tenantId,
      userId: req.user.userId,
    });

    if (!result.success) {
      throw new BadRequestException({
        message: 'Threagile analysis failed',
        error: result.error,
      });
    }

    // Create Threat records from the risks
    for (const risk of result.risks) {
      await this.service.addThreat(req.user.tenantId, id, req.user.userId, {
        title: risk.title,
        description: risk.mitigation || risk.risk_assessment || 'Risk identified by Threagile',
        category: risk.category,
        strideCategory: this.mapThreagileCategory(risk.category),
        likelihood: this.mapExploitationLikelihood(risk.exploitation_likelihood),
        impact: this.mapExploitationImpact(risk.exploitation_impact),
        cweIds: risk.cwe_id ? [String(risk.cwe_id)] : [],
        attackTechniqueIds: [],
      });
    }

    return {
      success: true,
      async: false,
      analysisRunId: result.rawOutput?.analysis_run_id,
      risksFound: result.risks.length,
      duration_ms: result.duration_ms,
      warnings: validation.warnings,
    };
  }

  @Get(':id/analysis-runs')
  async getAnalysisHistory(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.threagileService.getAnalysisHistory(
      id,
      req.user.tenantId,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get(':id/analysis-runs/:runId')
  async getAnalysisRun(
    @Req() req: AuthRequest,
    @Param('id') _id: string,
    @Param('runId') runId: string,
  ) {
    const run = await this.threagileService.getAnalysisRun(runId, req.user.tenantId);
    if (!run) {
      throw new BadRequestException('Analysis run not found');
    }
    return run;
  }

  @Delete(':id/analysis-runs/:runId')
  async cancelAnalysis(
    @Req() req: AuthRequest,
    @Param('id') _id: string,
    @Param('runId') runId: string,
  ) {
    // First try to cancel the queue job
    const queueCancelled = await this.queueService.cancelAnalysis(runId);

    // Then update the analysis run status
    const cancelled = await this.threagileService.cancelAnalysis(runId, req.user.tenantId);

    if (!cancelled && !queueCancelled) {
      throw new BadRequestException('Analysis run not found or not running');
    }
    return { success: true, message: 'Analysis cancelled' };
  }

  // ===== LOCKING =====

  @Get(':id/lock')
  async getLockStatus(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    const lock = await this.service.getLock(req.user.tenantId, id);
    if (!lock) {
      throw new BadRequestException('No lock found');
    }
    return lock;
  }

  @Post(':id/lock')
  async acquireLock(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: {
      lockedBy: string;
      lockedByName?: string;
      durationMinutes?: number;
    },
  ) {
    // Check if lock already exists and is not expired
    const existingLock = await this.service.getLock(req.user.tenantId, id);
    if (existingLock && new Date(existingLock.expiresAt) > new Date()) {
      if (existingLock.lockedBy !== body.lockedBy) {
        throw new BadRequestException({
          message: 'Lock already held by another user',
          existingLock,
        });
      }
      // Same user - extend the lock
      return this.service.refreshLock(
        req.user.tenantId,
        id,
        body.lockedBy,
        body.durationMinutes || 5,
      );
    }

    return this.service.acquireLock(
      req.user.tenantId,
      id,
      body.lockedBy,
      body.lockedByName,
      body.durationMinutes || 5,
    );
  }

  @Post(':id/lock/refresh')
  async refreshLock(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: {
      userId: string;
      durationMinutes?: number;
    },
  ) {
    const lock = await this.service.getLock(req.user.tenantId, id);
    if (!lock || lock.lockedBy !== body.userId) {
      throw new BadRequestException('Lock not found or not owned by user');
    }

    return this.service.refreshLock(
      req.user.tenantId,
      id,
      body.userId,
      body.durationMinutes || 5,
    );
  }

  @Delete(':id/lock')
  async releaseLock(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    const lock = await this.service.getLock(req.user.tenantId, id);
    if (!lock) {
      return { success: true, message: 'No lock to release' };
    }

    if (lock.lockedBy !== body.userId) {
      throw new BadRequestException('Cannot release lock owned by another user');
    }

    await this.service.releaseLock(req.user.tenantId, id);
    return { success: true, message: 'Lock released' };
  }

  @Post(':id/lock/force')
  async forceTakeLock(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: {
      lockedBy: string;
      lockedByName?: string;
      durationMinutes?: number;
    },
  ) {
    // Force take the lock (admin action)
    // First release any existing lock
    await this.service.releaseLock(req.user.tenantId, id);

    // Then acquire new lock
    return this.service.acquireLock(
      req.user.tenantId,
      id,
      body.lockedBy,
      body.lockedByName,
      body.durationMinutes || 5,
    );
  }

  // ===== VERSIONS =====

  @Get(':id/versions')
  async listVersions(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const versions = await this.service.listVersions(
      req.user.tenantId,
      id,
      limit ? parseInt(limit) : 20,
    );
    return { versions };
  }

  @Post(':id/versions')
  async createVersion(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: {
      xmlContent: string;
      isAutoSave?: boolean;
      versionName?: string;
    },
  ) {
    return this.service.createVersion(
      req.user.tenantId,
      id,
      req.user.userId,
      body.xmlContent,
      body.isAutoSave || false,
      body.versionName,
    );
  }

  @Get(':id/versions/:versionId')
  async getVersion(
    @Req() req: AuthRequest,
    @Param('id') _id: string,
    @Param('versionId') versionId: string,
  ) {
    const version = await this.service.getVersion(req.user.tenantId, versionId);
    if (!version) {
      throw new BadRequestException('Version not found');
    }
    return version;
  }

  // ===== HELPERS =====

  private mapThreagileCategory(category: string): string {
    const mapping: Record<string, string> = {
      'unencrypted-asset': 'information_disclosure',
      'unencrypted-communication': 'information_disclosure',
      'missing-authentication': 'spoofing',
      'missing-authentication-second-factor': 'spoofing',
      'missing-authorization': 'elevation_of_privilege',
      'sql-nosql-injection': 'tampering',
      'code-backdoor': 'tampering',
      'denial-of-service': 'denial_of_service',
      'untrusted-deserialization': 'tampering',
      'xml-external-entity': 'information_disclosure',
      'cross-site-scripting': 'tampering',
      'cross-site-request-forgery': 'spoofing',
      'missing-build-infrastructure': 'repudiation',
      'missing-cloud-hardening': 'elevation_of_privilege',
      'missing-identity-provider-isolation': 'spoofing',
      'missing-identity-propagation': 'spoofing',
      'missing-network-segmentation': 'elevation_of_privilege',
      'missing-vault': 'information_disclosure',
      'missing-waf': 'tampering',
      'path-traversal': 'information_disclosure',
      'push-instead-of-pull-deployment': 'tampering',
      'search-query-injection': 'tampering',
      'server-side-request-forgery': 'tampering',
      'service-registry-poisoning': 'spoofing',
      'unguarded-access-from-internet': 'information_disclosure',
      'unguarded-direct-datastore-access': 'information_disclosure',
      'unnecessary-communication-link': 'information_disclosure',
      'unnecessary-data-asset': 'information_disclosure',
      'unnecessary-data-transfer': 'information_disclosure',
      'unnecessary-technical-asset': 'elevation_of_privilege',
      'wrong-communication-link-content': 'information_disclosure',
      'wrong-trust-boundary-content': 'elevation_of_privilege',
    };
    return mapping[category?.toLowerCase()] || 'tampering';
  }

  private mapExploitationLikelihood(likelihood: string): string {
    const mapping: Record<string, string> = {
      'frequent': 'high',
      'likely': 'high',
      'occasional': 'medium',
      'unlikely': 'low',
      'rare': 'low',
    };
    return mapping[likelihood?.toLowerCase()] || 'medium';
  }

  private mapExploitationImpact(impact: string): string {
    const mapping: Record<string, string> = {
      'critical': 'high',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
      'negligible': 'low',
    };
    return mapping[impact?.toLowerCase()] || 'medium';
  }
}
