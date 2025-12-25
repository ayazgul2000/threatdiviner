import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface CreateEnvironmentDto {
  name: string;
  type: string;
  description?: string;
  kubeConfig?: string;
  kubeContext?: string;
  namespace?: string;
  cloudProvider?: string;
  cloudRegion?: string;
  cloudProject?: string;
}

interface UpdateEnvironmentDto extends Partial<CreateEnvironmentDto> {
  isActive?: boolean;
}

interface CreateDeploymentDto {
  name: string;
  repositoryId?: string;
  version?: string;
  image?: string;
  imageDigest?: string;
  replicas?: number;
  status?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  exposedPorts?: number[];
  hasIngress?: boolean;
  ingressHosts?: string[];
}

@Injectable()
export class EnvironmentsService {
  constructor(private prisma: PrismaService) {}

  // ===== ENVIRONMENTS =====

  async listEnvironments(tenantId: string) {
    const environments = await this.prisma.environment.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { deployments: true },
        },
        deployments: {
          select: {
            id: true,
            name: true,
            status: true,
            vulnCount: true,
            criticalCount: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return environments.map((env) => ({
      ...env,
      deploymentCount: env._count.deployments,
      healthySummary: {
        healthy: env.deployments.filter((d) => d.status === 'healthy').length,
        degraded: env.deployments.filter((d) => d.status === 'degraded').length,
        unhealthy: env.deployments.filter((d) => d.status === 'unhealthy').length,
        unknown: env.deployments.filter((d) => d.status === 'unknown').length,
      },
      securitySummary: {
        totalVulns: env.deployments.reduce((sum, d) => sum + d.vulnCount, 0),
        criticalVulns: env.deployments.reduce((sum, d) => sum + d.criticalCount, 0),
      },
    }));
  }

  async getEnvironment(tenantId: string, id: string) {
    const env = await this.prisma.environment.findFirst({
      where: { id, tenantId },
      include: {
        deployments: {
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    return env;
  }

  async createEnvironment(tenantId: string, dto: CreateEnvironmentDto) {
    // Check for duplicate name
    const existing = await this.prisma.environment.findFirst({
      where: { tenantId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Environment with this name already exists');
    }

    return this.prisma.environment.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        description: dto.description,
        kubeConfig: dto.kubeConfig,
        kubeContext: dto.kubeContext,
        namespace: dto.namespace,
        cloudProvider: dto.cloudProvider,
        cloudRegion: dto.cloudRegion,
        cloudProject: dto.cloudProject,
      },
    });
  }

  async updateEnvironment(tenantId: string, id: string, dto: UpdateEnvironmentDto) {
    const env = await this.prisma.environment.findFirst({
      where: { id, tenantId },
    });

    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    // Check for duplicate name if name is being changed
    if (dto.name && dto.name !== env.name) {
      const existing = await this.prisma.environment.findFirst({
        where: { tenantId, name: dto.name, id: { not: id } },
      });

      if (existing) {
        throw new ConflictException('Environment with this name already exists');
      }
    }

    return this.prisma.environment.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        description: dto.description,
        kubeConfig: dto.kubeConfig,
        kubeContext: dto.kubeContext,
        namespace: dto.namespace,
        cloudProvider: dto.cloudProvider,
        cloudRegion: dto.cloudRegion,
        cloudProject: dto.cloudProject,
        isActive: dto.isActive,
      },
    });
  }

  async deleteEnvironment(tenantId: string, id: string) {
    const env = await this.prisma.environment.findFirst({
      where: { id, tenantId },
    });

    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    await this.prisma.environment.delete({ where: { id } });
    return { success: true };
  }

  // ===== DEPLOYMENTS =====

  async listDeployments(
    tenantId: string,
    options?: {
      environmentId?: string;
      repositoryId?: string;
      status?: string;
    },
  ) {
    const where: Prisma.DeploymentWhereInput = { tenantId };

    if (options?.environmentId) {
      where.environmentId = options.environmentId;
    }
    if (options?.repositoryId) {
      where.repositoryId = options.repositoryId;
    }
    if (options?.status) {
      where.status = options.status;
    }

    return this.prisma.deployment.findMany({
      where,
      include: {
        environment: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: [{ environmentId: 'asc' }, { name: 'asc' }],
    });
  }

  async getDeployment(tenantId: string, id: string) {
    const deployment = await this.prisma.deployment.findFirst({
      where: { id, tenantId },
      include: {
        environment: true,
      },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    return deployment;
  }

  async createDeployment(
    tenantId: string,
    environmentId: string,
    dto: CreateDeploymentDto,
  ) {
    const env = await this.prisma.environment.findFirst({
      where: { id: environmentId, tenantId },
    });

    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    // Check for duplicate name in this environment
    const existing = await this.prisma.deployment.findFirst({
      where: { environmentId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Deployment with this name already exists in this environment');
    }

    return this.prisma.deployment.create({
      data: {
        tenantId,
        environmentId,
        name: dto.name,
        repositoryId: dto.repositoryId,
        version: dto.version,
        image: dto.image,
        imageDigest: dto.imageDigest,
        replicas: dto.replicas || 1,
        status: dto.status || 'unknown',
        labels: (dto.labels || {}) as Prisma.InputJsonValue,
        annotations: (dto.annotations || {}) as Prisma.InputJsonValue,
        exposedPorts: dto.exposedPorts || [],
        hasIngress: dto.hasIngress || false,
        ingressHosts: dto.ingressHosts || [],
        deployedAt: new Date(),
      },
    });
  }

  async updateDeployment(
    tenantId: string,
    id: string,
    dto: Partial<CreateDeploymentDto>,
  ) {
    const deployment = await this.prisma.deployment.findFirst({
      where: { id, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    return this.prisma.deployment.update({
      where: { id },
      data: {
        version: dto.version,
        image: dto.image,
        imageDigest: dto.imageDigest,
        replicas: dto.replicas,
        status: dto.status,
        labels: dto.labels ? (dto.labels as Prisma.InputJsonValue) : undefined,
        annotations: dto.annotations ? (dto.annotations as Prisma.InputJsonValue) : undefined,
        exposedPorts: dto.exposedPorts,
        hasIngress: dto.hasIngress,
        ingressHosts: dto.ingressHosts,
        deployedAt: dto.version !== deployment.version ? new Date() : undefined,
      },
    });
  }

  async deleteDeployment(tenantId: string, id: string) {
    const deployment = await this.prisma.deployment.findFirst({
      where: { id, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    await this.prisma.deployment.delete({ where: { id } });
    return { success: true };
  }

  async updateDeploymentSecurityStatus(
    tenantId: string,
    id: string,
    scanId: string,
    sbomId: string,
    vulnCount: number,
    criticalCount: number,
  ) {
    const deployment = await this.prisma.deployment.findFirst({
      where: { id, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    return this.prisma.deployment.update({
      where: { id },
      data: {
        lastScanId: scanId,
        lastSbomId: sbomId,
        vulnCount,
        criticalCount,
      },
    });
  }

  // ===== DASHBOARD STATS =====

  async getEnvironmentsSummary(tenantId: string) {
    const environments = await this.prisma.environment.findMany({
      where: { tenantId, isActive: true },
      include: {
        deployments: {
          select: {
            status: true,
            vulnCount: true,
            criticalCount: true,
          },
        },
      },
    });

    const summary = {
      totalEnvironments: environments.length,
      totalDeployments: 0,
      healthyDeployments: 0,
      degradedDeployments: 0,
      unhealthyDeployments: 0,
      totalVulnerabilities: 0,
      criticalVulnerabilities: 0,
      byEnvironment: [] as Array<{
        id: string;
        name: string;
        type: string;
        deployments: number;
        healthy: number;
        degraded: number;
        unhealthy: number;
        vulns: number;
        criticalVulns: number;
      }>,
    };

    for (const env of environments) {
      const healthy = env.deployments.filter((d) => d.status === 'healthy').length;
      const degraded = env.deployments.filter((d) => d.status === 'degraded').length;
      const unhealthy = env.deployments.filter((d) => d.status === 'unhealthy').length;
      const vulns = env.deployments.reduce((sum, d) => sum + d.vulnCount, 0);
      const criticalVulns = env.deployments.reduce((sum, d) => sum + d.criticalCount, 0);

      summary.totalDeployments += env.deployments.length;
      summary.healthyDeployments += healthy;
      summary.degradedDeployments += degraded;
      summary.unhealthyDeployments += unhealthy;
      summary.totalVulnerabilities += vulns;
      summary.criticalVulnerabilities += criticalVulns;

      summary.byEnvironment.push({
        id: env.id,
        name: env.name,
        type: env.type,
        deployments: env.deployments.length,
        healthy,
        degraded,
        unhealthy,
        vulns,
        criticalVulns,
      });
    }

    return summary;
  }
}
