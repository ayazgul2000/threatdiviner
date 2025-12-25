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
} from '@nestjs/common';
import { ThreatModelingService } from './threat-modeling.service';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';

interface AuthRequest {
  user: {
    tenantId: string;
    userId: string;
  };
}

@Controller('threat-modeling')
@UseGuards(JwtAuthGuard)
export class ThreatModelingController {
  constructor(private readonly service: ThreatModelingService) {}

  // ===== THREAT MODELS =====

  @Get()
  async listThreatModels(
    @Req() req: AuthRequest,
    @Query('status') status?: string,
    @Query('repositoryId') repositoryId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listThreatModels(req.user.tenantId, {
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
      description?: string;
      methodology?: string;
      repositoryId?: string;
    },
  ) {
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
    const mermaid = await this.service.generateMermaidDiagram(req.user.tenantId, id);
    return { mermaid };
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
