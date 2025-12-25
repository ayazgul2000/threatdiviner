import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateGateDto {
  repositoryId?: string;
  stage: string;
  enabled?: boolean;
  blockSeverity?: string;
  notifyOnFailure?: boolean;
}

export interface UpdateGateDto {
  enabled?: boolean;
  blockSeverity?: string;
  notifyOnFailure?: boolean;
}

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async getGates(tenantId: string, repositoryId?: string) {
    const where: any = { tenantId };
    if (repositoryId) {
      where.repositoryId = repositoryId;
    }

    const gates = await this.prisma.pipelineGate.findMany({
      where,
      orderBy: { stage: 'asc' },
    });

    // If no gates exist for this tenant/repo, return defaults
    if (gates.length === 0) {
      return this.getDefaultGates(tenantId, repositoryId);
    }

    return gates;
  }

  async getGate(tenantId: string, stageId: string) {
    const gate = await this.prisma.pipelineGate.findUnique({
      where: { id: stageId },
    });

    if (!gate || gate.tenantId !== tenantId) {
      throw new NotFoundException('Gate not found');
    }

    return gate;
  }

  async createGate(tenantId: string, dto: CreateGateDto) {
    return this.prisma.pipelineGate.upsert({
      where: {
        tenantId_repositoryId_stage: {
          tenantId,
          repositoryId: dto.repositoryId ?? '',
          stage: dto.stage,
        },
      },
      update: {
        enabled: dto.enabled ?? true,
        blockSeverity: dto.blockSeverity || 'critical',
        notifyOnFailure: dto.notifyOnFailure ?? true,
      },
      create: {
        tenantId,
        repositoryId: dto.repositoryId || null,
        stage: dto.stage,
        enabled: dto.enabled ?? true,
        blockSeverity: dto.blockSeverity || 'critical',
        notifyOnFailure: dto.notifyOnFailure ?? true,
      },
    });
  }

  async updateGate(tenantId: string, stageId: string, dto: UpdateGateDto) {
    const gate = await this.prisma.pipelineGate.findUnique({
      where: { id: stageId },
    });

    if (!gate || gate.tenantId !== tenantId) {
      throw new NotFoundException('Gate not found');
    }

    return this.prisma.pipelineGate.update({
      where: { id: stageId },
      data: {
        enabled: dto.enabled,
        blockSeverity: dto.blockSeverity,
        notifyOnFailure: dto.notifyOnFailure,
      },
    });
  }

  async deleteGate(tenantId: string, stageId: string) {
    const gate = await this.prisma.pipelineGate.findUnique({
      where: { id: stageId },
    });

    if (!gate || gate.tenantId !== tenantId) {
      throw new NotFoundException('Gate not found');
    }

    await this.prisma.pipelineGate.delete({
      where: { id: stageId },
    });

    return { success: true };
  }

  async evaluateGate(tenantId: string, repositoryId: string, stage: string, findings: any[]) {
    // Get gate config for this repo, or fall back to tenant default
    let gate = await this.prisma.pipelineGate.findFirst({
      where: { tenantId, repositoryId, stage },
    });

    if (!gate) {
      gate = await this.prisma.pipelineGate.findFirst({
        where: { tenantId, repositoryId: null, stage },
      });
    }

    if (!gate || !gate.enabled) {
      return { passed: true, reason: 'Gate not configured or disabled' };
    }

    const severityOrder = ['none', 'low', 'medium', 'high', 'critical'];
    const blockIndex = severityOrder.indexOf(gate.blockSeverity.toLowerCase());

    // Check if any findings exceed the block threshold
    const blockingFindings = findings.filter(f => {
      const findingSeverityIndex = severityOrder.indexOf(f.severity.toLowerCase());
      return findingSeverityIndex >= blockIndex;
    });

    if (blockingFindings.length > 0) {
      return {
        passed: false,
        reason: `${blockingFindings.length} findings exceed ${gate.blockSeverity} severity threshold`,
        blockingFindings: blockingFindings.length,
        notifyOnFailure: gate.notifyOnFailure,
      };
    }

    return { passed: true, reason: 'All findings within acceptable thresholds' };
  }

  private getDefaultGates(tenantId: string, repositoryId?: string) {
    const stages = ['code', 'build', 'test', 'deploy', 'prod'];
    return stages.map(stage => ({
      id: `default-${stage}`,
      tenantId,
      repositoryId: repositoryId || null,
      stage,
      enabled: true,
      blockSeverity: stage === 'prod' ? 'high' : 'critical',
      notifyOnFailure: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }
}
