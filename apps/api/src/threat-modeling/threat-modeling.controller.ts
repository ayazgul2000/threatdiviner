import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  Header,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ThreatModelingService } from './threat-modeling.service';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { StrideAnalyzer } from './analyzers/stride.analyzer';
import { EnterpriseStrideAnalyzer } from './analyzers/enterprise-stride.analyzer';
import { ThreatModelDiagramService } from './services/diagram.service';
import { ThreatModelExportService } from './services/export.service';

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
}
