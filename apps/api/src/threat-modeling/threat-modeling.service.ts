import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateThreatModelDto {
  name: string;
  description?: string;
  methodology?: string;
  repositoryId?: string;
}

interface UpdateThreatModelDto {
  name?: string;
  description?: string;
  methodology?: string;
  status?: string;
}

interface CreateComponentDto {
  name: string;
  description?: string;
  type: string;
  technology?: string;
  criticality?: string;
  dataClassification?: string;
  positionX?: number;
  positionY?: number;
  metadata?: Record<string, unknown>;
}

interface CreateDataFlowDto {
  sourceId: string;
  targetId: string;
  label?: string;
  dataType?: string;
  protocol?: string;
  authentication?: boolean;
  encryption?: boolean;
}

interface CreateThreatDto {
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
}

interface CreateMitigationDto {
  title: string;
  description: string;
  type: string;
  priority?: number;
  effort?: string;
  cost?: string;
  owner?: string;
  dueDate?: string;
  threatIds?: string[];
}

const RISK_SCORES: Record<string, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  very_high: 5,
};

@Injectable()
export class ThreatModelingService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== THREAT MODELS =====

  async listThreatModels(tenantId: string, options?: {
    status?: string;
    repositoryId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = { tenantId };

    if (options?.status) where.status = options.status;
    if (options?.repositoryId) where.repositoryId = options.repositoryId;

    const [models, total] = await Promise.all([
      this.prisma.threatModel.findMany({
        where,
        include: {
          _count: {
            select: {
              components: true,
              dataFlows: true,
              threats: true,
              mitigations: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.threatModel.count({ where }),
    ]);

    return { models, total };
  }

  async getThreatModel(tenantId: string, id: string) {
    const model = await this.prisma.threatModel.findFirst({
      where: { id, tenantId },
      include: {
        components: true,
        dataFlows: {
          include: {
            source: true,
            target: true,
          },
        },
        threats: {
          include: {
            components: { include: { component: true } },
            dataFlows: { include: { dataFlow: true } },
            mitigations: { include: { mitigation: true } },
          },
        },
        mitigations: {
          include: {
            threats: { include: { threat: true } },
          },
        },
      },
    });

    if (!model) {
      throw new NotFoundException('Threat model not found');
    }

    return model;
  }

  async createThreatModel(tenantId: string, userId: string, dto: CreateThreatModelDto) {
    return this.prisma.threatModel.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        methodology: dto.methodology || 'stride',
        repositoryId: dto.repositoryId,
        createdBy: userId,
        status: 'draft',
      },
    });
  }

  async updateThreatModel(tenantId: string, id: string, userId: string, dto: UpdateThreatModelDto) {
    const model = await this.prisma.threatModel.findFirst({
      where: { id, tenantId },
    });

    if (!model) {
      throw new NotFoundException('Threat model not found');
    }

    const updateData: Record<string, unknown> = {
      ...dto,
      lastModifiedBy: userId,
    };

    if (dto.status === 'completed' && model.status !== 'completed') {
      updateData.completedAt = new Date();
    }

    if (dto.status === 'archived' && model.status !== 'archived') {
      updateData.archivedAt = new Date();
    }

    return this.prisma.threatModel.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteThreatModel(tenantId: string, id: string) {
    const model = await this.prisma.threatModel.findFirst({
      where: { id, tenantId },
    });

    if (!model) {
      throw new NotFoundException('Threat model not found');
    }

    await this.prisma.threatModel.delete({ where: { id } });
    return { deleted: true };
  }

  async duplicateThreatModel(tenantId: string, id: string, userId: string, newName?: string) {
    const original = await this.getThreatModel(tenantId, id);

    // Create new model
    const newModel = await this.prisma.threatModel.create({
      data: {
        tenantId,
        name: newName || `${original.name} (Copy)`,
        description: original.description,
        methodology: original.methodology,
        repositoryId: original.repositoryId,
        createdBy: userId,
        status: 'draft',
      },
    });

    // Copy components
    const componentIdMap = new Map<string, string>();
    for (const comp of original.components) {
      const newComp = await this.prisma.threatModelComponent.create({
        data: {
          threatModelId: newModel.id,
          name: comp.name,
          description: comp.description,
          type: comp.type,
          technology: comp.technology,
          criticality: comp.criticality,
          dataClassification: comp.dataClassification,
          positionX: comp.positionX,
          positionY: comp.positionY,
          metadata: (comp.metadata as Prisma.InputJsonValue) || {},
        },
      });
      componentIdMap.set(comp.id, newComp.id);
    }

    // Copy data flows
    const dataFlowIdMap = new Map<string, string>();
    for (const flow of original.dataFlows) {
      const newSourceId = componentIdMap.get(flow.sourceId);
      const newTargetId = componentIdMap.get(flow.targetId);
      if (newSourceId && newTargetId) {
        const newFlow = await this.prisma.threatModelDataFlow.create({
          data: {
            threatModelId: newModel.id,
            sourceId: newSourceId,
            targetId: newTargetId,
            label: flow.label,
            dataType: flow.dataType,
            protocol: flow.protocol,
            authentication: flow.authentication,
            encryption: flow.encryption,
            metadata: flow.metadata as object || {},
          },
        });
        dataFlowIdMap.set(flow.id, newFlow.id);
      }
    }

    // Copy mitigations
    const mitigationIdMap = new Map<string, string>();
    for (const mit of original.mitigations) {
      const newMit = await this.prisma.threatMitigation.create({
        data: {
          threatModelId: newModel.id,
          title: mit.title,
          description: mit.description,
          type: mit.type,
          implementationStatus: 'planned',
          priority: mit.priority,
          effort: mit.effort,
          cost: mit.cost,
          metadata: mit.metadata as object || {},
        },
      });
      mitigationIdMap.set(mit.id, newMit.id);
    }

    // Copy threats with mappings
    for (const threat of original.threats) {
      const newThreat = await this.prisma.threat.create({
        data: {
          threatModelId: newModel.id,
          title: threat.title,
          description: threat.description,
          category: threat.category,
          attackVector: threat.attackVector,
          likelihood: threat.likelihood,
          impact: threat.impact,
          riskScore: threat.riskScore,
          status: 'identified',
          strideCategory: threat.strideCategory,
          attackTechniqueIds: threat.attackTechniqueIds,
          cweIds: threat.cweIds,
          capecIds: threat.capecIds,
          metadata: threat.metadata as object || {},
        },
      });

      // Map components
      for (const mapping of threat.components) {
        const newCompId = componentIdMap.get(mapping.componentId);
        if (newCompId) {
          await this.prisma.threatComponentMapping.create({
            data: { threatId: newThreat.id, componentId: newCompId },
          });
        }
      }

      // Map data flows
      for (const mapping of threat.dataFlows) {
        const newFlowId = dataFlowIdMap.get(mapping.dataFlowId);
        if (newFlowId) {
          await this.prisma.threatDataFlowMapping.create({
            data: { threatId: newThreat.id, dataFlowId: newFlowId },
          });
        }
      }

      // Map mitigations
      for (const mapping of threat.mitigations) {
        const newMitId = mitigationIdMap.get(mapping.mitigationId);
        if (newMitId) {
          await this.prisma.threatMitigationMapping.create({
            data: { threatId: newThreat.id, mitigationId: newMitId, effectiveness: mapping.effectiveness },
          });
        }
      }
    }

    return this.getThreatModel(tenantId, newModel.id);
  }

  // ===== COMPONENTS =====

  async addComponent(tenantId: string, threatModelId: string, dto: CreateComponentDto) {
    const model = await this.prisma.threatModel.findFirst({
      where: { id: threatModelId, tenantId },
    });

    if (!model) {
      throw new NotFoundException('Threat model not found');
    }

    return this.prisma.threatModelComponent.create({
      data: {
        threatModelId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        technology: dto.technology,
        criticality: dto.criticality || 'medium',
        dataClassification: dto.dataClassification,
        positionX: dto.positionX || 0,
        positionY: dto.positionY || 0,
        metadata: (dto.metadata as Prisma.InputJsonValue) || {},
      },
    });
  }

  async updateComponent(tenantId: string, componentId: string, dto: Partial<CreateComponentDto>) {
    const component = await this.prisma.threatModelComponent.findFirst({
      where: { id: componentId },
      include: { threatModel: true },
    });

    if (!component || component.threatModel.tenantId !== tenantId) {
      throw new NotFoundException('Component not found');
    }

    const updateData: Prisma.ThreatModelComponentUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.technology !== undefined) updateData.technology = dto.technology;
    if (dto.criticality !== undefined) updateData.criticality = dto.criticality;
    if (dto.dataClassification !== undefined) updateData.dataClassification = dto.dataClassification;
    if (dto.positionX !== undefined) updateData.positionX = dto.positionX;
    if (dto.positionY !== undefined) updateData.positionY = dto.positionY;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata as Prisma.InputJsonValue;

    return this.prisma.threatModelComponent.update({
      where: { id: componentId },
      data: updateData,
    });
  }

  async deleteComponent(tenantId: string, componentId: string) {
    const component = await this.prisma.threatModelComponent.findFirst({
      where: { id: componentId },
      include: { threatModel: true },
    });

    if (!component || component.threatModel.tenantId !== tenantId) {
      throw new NotFoundException('Component not found');
    }

    await this.prisma.threatModelComponent.delete({ where: { id: componentId } });
    return { deleted: true };
  }

  // ===== DATA FLOWS =====

  async addDataFlow(tenantId: string, threatModelId: string, dto: CreateDataFlowDto) {
    const model = await this.prisma.threatModel.findFirst({
      where: { id: threatModelId, tenantId },
    });

    if (!model) {
      throw new NotFoundException('Threat model not found');
    }

    return this.prisma.threatModelDataFlow.create({
      data: {
        threatModelId,
        sourceId: dto.sourceId,
        targetId: dto.targetId,
        label: dto.label,
        dataType: dto.dataType,
        protocol: dto.protocol,
        authentication: dto.authentication ?? false,
        encryption: dto.encryption ?? false,
      },
      include: {
        source: true,
        target: true,
      },
    });
  }

  async updateDataFlow(tenantId: string, dataFlowId: string, dto: Partial<CreateDataFlowDto>) {
    const flow = await this.prisma.threatModelDataFlow.findFirst({
      where: { id: dataFlowId },
      include: { threatModel: true },
    });

    if (!flow || flow.threatModel.tenantId !== tenantId) {
      throw new NotFoundException('Data flow not found');
    }

    return this.prisma.threatModelDataFlow.update({
      where: { id: dataFlowId },
      data: dto,
      include: { source: true, target: true },
    });
  }

  async deleteDataFlow(tenantId: string, dataFlowId: string) {
    const flow = await this.prisma.threatModelDataFlow.findFirst({
      where: { id: dataFlowId },
      include: { threatModel: true },
    });

    if (!flow || flow.threatModel.tenantId !== tenantId) {
      throw new NotFoundException('Data flow not found');
    }

    await this.prisma.threatModelDataFlow.delete({ where: { id: dataFlowId } });
    return { deleted: true };
  }

  // ===== THREATS =====

  async addThreat(tenantId: string, threatModelId: string, userId: string, dto: CreateThreatDto) {
    const model = await this.prisma.threatModel.findFirst({
      where: { id: threatModelId, tenantId },
    });

    if (!model) {
      throw new NotFoundException('Threat model not found');
    }

    const likelihoodScore = RISK_SCORES[dto.likelihood || 'medium'] || 3;
    const impactScore = RISK_SCORES[dto.impact || 'medium'] || 3;
    const riskScore = likelihoodScore * impactScore;

    const threat = await this.prisma.threat.create({
      data: {
        threatModelId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        attackVector: dto.attackVector,
        likelihood: dto.likelihood || 'medium',
        impact: dto.impact || 'medium',
        riskScore,
        strideCategory: dto.strideCategory,
        attackTechniqueIds: dto.attackTechniqueIds || [],
        cweIds: dto.cweIds || [],
        capecIds: dto.capecIds || [],
        identifiedBy: userId,
        status: 'identified',
      },
    });

    // Add component mappings
    if (dto.componentIds?.length) {
      await this.prisma.threatComponentMapping.createMany({
        data: dto.componentIds.map(componentId => ({
          threatId: threat.id,
          componentId,
        })),
      });
    }

    // Add data flow mappings
    if (dto.dataFlowIds?.length) {
      await this.prisma.threatDataFlowMapping.createMany({
        data: dto.dataFlowIds.map(dataFlowId => ({
          threatId: threat.id,
          dataFlowId,
        })),
      });
    }

    return this.prisma.threat.findUnique({
      where: { id: threat.id },
      include: {
        components: { include: { component: true } },
        dataFlows: { include: { dataFlow: true } },
      },
    });
  }

  async updateThreat(tenantId: string, threatId: string, userId: string, dto: Partial<CreateThreatDto> & { status?: string }) {
    const threat = await this.prisma.threat.findFirst({
      where: { id: threatId },
      include: { threatModel: true },
    });

    if (!threat || threat.threatModel.tenantId !== tenantId) {
      throw new NotFoundException('Threat not found');
    }

    const updateData: Record<string, unknown> = { ...dto };

    // Recalculate risk score if likelihood or impact changed
    if (dto.likelihood || dto.impact) {
      const likelihood = dto.likelihood || threat.likelihood;
      const impact = dto.impact || threat.impact;
      updateData.riskScore = (RISK_SCORES[likelihood] || 3) * (RISK_SCORES[impact] || 3);
    }

    if (dto.status === 'analyzed' && threat.status !== 'analyzed') {
      updateData.analyzedBy = userId;
      updateData.analyzedAt = new Date();
    }

    // Update component mappings
    if (dto.componentIds !== undefined) {
      await this.prisma.threatComponentMapping.deleteMany({ where: { threatId } });
      if (dto.componentIds.length) {
        await this.prisma.threatComponentMapping.createMany({
          data: dto.componentIds.map(componentId => ({ threatId, componentId })),
        });
      }
      delete updateData.componentIds;
    }

    // Update data flow mappings
    if (dto.dataFlowIds !== undefined) {
      await this.prisma.threatDataFlowMapping.deleteMany({ where: { threatId } });
      if (dto.dataFlowIds.length) {
        await this.prisma.threatDataFlowMapping.createMany({
          data: dto.dataFlowIds.map(dataFlowId => ({ threatId, dataFlowId })),
        });
      }
      delete updateData.dataFlowIds;
    }

    return this.prisma.threat.update({
      where: { id: threatId },
      data: updateData,
      include: {
        components: { include: { component: true } },
        dataFlows: { include: { dataFlow: true } },
        mitigations: { include: { mitigation: true } },
      },
    });
  }

  async deleteThreat(tenantId: string, threatId: string) {
    const threat = await this.prisma.threat.findFirst({
      where: { id: threatId },
      include: { threatModel: true },
    });

    if (!threat || threat.threatModel.tenantId !== tenantId) {
      throw new NotFoundException('Threat not found');
    }

    await this.prisma.threat.delete({ where: { id: threatId } });
    return { deleted: true };
  }

  // ===== MITIGATIONS =====

  async addMitigation(tenantId: string, threatModelId: string, dto: CreateMitigationDto) {
    const model = await this.prisma.threatModel.findFirst({
      where: { id: threatModelId, tenantId },
    });

    if (!model) {
      throw new NotFoundException('Threat model not found');
    }

    const mitigation = await this.prisma.threatMitigation.create({
      data: {
        threatModelId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        priority: dto.priority || 0,
        effort: dto.effort,
        cost: dto.cost,
        owner: dto.owner,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        implementationStatus: 'planned',
      },
    });

    // Link to threats
    if (dto.threatIds?.length) {
      await this.prisma.threatMitigationMapping.createMany({
        data: dto.threatIds.map(threatId => ({
          threatId,
          mitigationId: mitigation.id,
          effectiveness: 'partial',
        })),
      });
    }

    return this.prisma.threatMitigation.findUnique({
      where: { id: mitigation.id },
      include: { threats: { include: { threat: true } } },
    });
  }

  async updateMitigation(tenantId: string, mitigationId: string, dto: Partial<CreateMitigationDto> & {
    implementationStatus?: string;
  }) {
    const mitigation = await this.prisma.threatMitigation.findFirst({
      where: { id: mitigationId },
      include: { threatModel: true },
    });

    if (!mitigation || mitigation.threatModel.tenantId !== tenantId) {
      throw new NotFoundException('Mitigation not found');
    }

    const updateData: Record<string, unknown> = { ...dto };

    if (dto.implementationStatus === 'implemented' && mitigation.implementationStatus !== 'implemented') {
      updateData.implementedAt = new Date();
    }

    if (dto.implementationStatus === 'verified' && mitigation.implementationStatus !== 'verified') {
      updateData.verifiedAt = new Date();
    }

    if (dto.dueDate) {
      updateData.dueDate = new Date(dto.dueDate);
    }

    // Update threat mappings
    if (dto.threatIds !== undefined) {
      await this.prisma.threatMitigationMapping.deleteMany({ where: { mitigationId } });
      if (dto.threatIds.length) {
        await this.prisma.threatMitigationMapping.createMany({
          data: dto.threatIds.map(threatId => ({
            threatId,
            mitigationId,
            effectiveness: 'partial',
          })),
        });
      }
      delete updateData.threatIds;
    }

    return this.prisma.threatMitigation.update({
      where: { id: mitigationId },
      data: updateData,
      include: { threats: { include: { threat: true } } },
    });
  }

  async deleteMitigation(tenantId: string, mitigationId: string) {
    const mitigation = await this.prisma.threatMitigation.findFirst({
      where: { id: mitigationId },
      include: { threatModel: true },
    });

    if (!mitigation || mitigation.threatModel.tenantId !== tenantId) {
      throw new NotFoundException('Mitigation not found');
    }

    await this.prisma.threatMitigation.delete({ where: { id: mitigationId } });
    return { deleted: true };
  }

  // ===== ANALYTICS =====

  async getThreatModelStats(tenantId: string, threatModelId: string) {
    const model = await this.getThreatModel(tenantId, threatModelId);

    const threatsByCategory: Record<string, number> = {};
    const threatsByStatus: Record<string, number> = {};
    const threatsByRisk: Record<string, number> = {};
    let totalRiskScore = 0;

    for (const threat of model.threats) {
      threatsByCategory[threat.category] = (threatsByCategory[threat.category] || 0) + 1;
      threatsByStatus[threat.status] = (threatsByStatus[threat.status] || 0) + 1;

      const riskLevel = threat.riskScore && threat.riskScore >= 16 ? 'critical' :
        threat.riskScore && threat.riskScore >= 9 ? 'high' :
        threat.riskScore && threat.riskScore >= 4 ? 'medium' : 'low';
      threatsByRisk[riskLevel] = (threatsByRisk[riskLevel] || 0) + 1;
      totalRiskScore += threat.riskScore || 0;
    }

    const mitigationsByStatus: Record<string, number> = {};
    for (const mit of model.mitigations) {
      mitigationsByStatus[mit.implementationStatus] = (mitigationsByStatus[mit.implementationStatus] || 0) + 1;
    }

    const mitigatedThreats = model.threats.filter(t => t.status === 'mitigated').length;
    const mitigationCoverage = model.threats.length > 0
      ? Math.round((mitigatedThreats / model.threats.length) * 100)
      : 100;

    return {
      componentCount: model.components.length,
      dataFlowCount: model.dataFlows.length,
      threatCount: model.threats.length,
      mitigationCount: model.mitigations.length,
      threatsByCategory,
      threatsByStatus,
      threatsByRisk,
      mitigationsByStatus,
      averageRiskScore: model.threats.length > 0 ? totalRiskScore / model.threats.length : 0,
      mitigationCoverage,
    };
  }

  // ===== DIAGRAM GENERATION =====

  async generateMermaidDiagram(tenantId: string, threatModelId: string): Promise<string> {
    const model = await this.getThreatModel(tenantId, threatModelId);

    const lines: string[] = ['flowchart LR'];

    // Filter regular components (trust boundaries are handled separately in future)
    const regularComponents = model.components.filter(c => c.type !== 'trust_boundary');

    // Component type to shape mapping
    const shapes: Record<string, [string, string]> = {
      process: ['[', ']'],
      datastore: ['[(', ')]'],
      external_entity: ['{{', '}}'],
    };

    // Add regular components
    for (const comp of regularComponents) {
      const [start, end] = shapes[comp.type] || ['[', ']'];
      lines.push(`    ${comp.id}${start}"${comp.name}"${end}`);
    }

    // Add data flows
    for (const flow of model.dataFlows) {
      const label = flow.label || flow.dataType || '';
      const arrow = flow.encryption ? '==>' : '-->';
      lines.push(`    ${flow.sourceId} ${arrow}|"${label}"| ${flow.targetId}`);
    }

    // Add threat annotations
    for (const threat of model.threats) {
      if (threat.components.length > 0) {
        const compId = threat.components[0].componentId;
        const riskEmoji = threat.riskScore && threat.riskScore >= 16 ? '🔴' :
          threat.riskScore && threat.riskScore >= 9 ? '🟠' :
          threat.riskScore && threat.riskScore >= 4 ? '🟡' : '🟢';
        lines.push(`    ${compId} -.-> threat_${threat.id}["${riskEmoji} ${threat.title}"]`);
        lines.push(`    style threat_${threat.id} fill:#fef2f2,stroke:#dc2626`);
      }
    }

    return lines.join('\n');
  }
}
