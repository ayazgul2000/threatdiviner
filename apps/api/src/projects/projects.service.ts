import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const projects = await this.prisma.project.findMany({
      where: { tenantId, status: { not: 'DELETED' } },
      include: {
        _count: {
          select: {
            repositories: true,
            scans: true,
            findings: true,
            threatModels: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Add findings breakdown by status for each project
    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const findingStats = await this.prisma.finding.groupBy({
          by: ['status'],
          where: { projectId: project.id, tenantId },
          _count: { status: true },
        });

        const openCount = findingStats.find((f) => f.status === 'open')?._count?.status || 0;
        const resolvedCount = findingStats.find((f) => f.status === 'fixed')?._count?.status || 0;
        const acceptedCount = findingStats.find((f) => f.status === 'false_positive')?._count?.status || 0;

        return {
          ...project,
          findingStats: {
            open: openCount,
            resolved: resolvedCount,
            accepted: acceptedCount,
            total: project._count.findings,
          },
        };
      }),
    );

    return projectsWithStats;
  }

  async findOne(tenantId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId, status: { not: 'DELETED' } },
      include: {
        repositories: {
          take: 10,
          orderBy: { updatedAt: 'desc' },
        },
        _count: {
          select: {
            repositories: true,
            scans: true,
            findings: true,
            threatModels: true,
            sboms: true,
            environments: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async create(tenantId: string, data: { name: string; description?: string }) {
    // Check for duplicate name
    const existing = await this.prisma.project.findFirst({
      where: { tenantId, name: data.name, status: { not: 'DELETED' } },
    });

    if (existing) {
      throw new ConflictException('Project with this name already exists');
    }

    return this.prisma.project.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
      },
    });
  }

  async update(tenantId: string, id: string, data: { name?: string; description?: string }) {
    const project = await this.findOne(tenantId, id);

    if (data.name && data.name !== project.name) {
      const existing = await this.prisma.project.findFirst({
        where: { tenantId, name: data.name, status: { not: 'DELETED' }, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException('Project with this name already exists');
      }
    }

    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async archive(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.project.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  async delete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.project.update({
      where: { id },
      data: { status: 'DELETED' },
    });
  }

  async getStats(tenantId: string, id: string) {
    const project = await this.findOne(tenantId, id);

    const [openFindings, recentScans, criticalFindings] = await Promise.all([
      this.prisma.finding.count({
        where: { projectId: id, tenantId, status: 'open' },
      }),
      this.prisma.scan.count({
        where: { projectId: id, tenantId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.finding.count({
        where: { projectId: id, tenantId, status: 'open', severity: 'critical' },
      }),
    ]);

    return {
      project,
      stats: {
        openFindings,
        criticalFindings,
        recentScans,
        repositories: project._count.repositories,
        threatModels: project._count.threatModels,
      },
    };
  }

  async linkRepository(tenantId: string, projectId: string, repositoryId: string) {
    await this.findOne(tenantId, projectId);
    return this.prisma.repository.update({
      where: { id: repositoryId },
      data: { projectId },
    });
  }

  async unlinkRepository(tenantId: string, projectId: string, repositoryId: string) {
    await this.findOne(tenantId, projectId);
    return this.prisma.repository.update({
      where: { id: repositoryId },
      data: { projectId: null },
    });
  }

  // ========== SCM Access Management ==========

  /**
   * Get all SCM connections available to a project
   */
  async getScmAccess(tenantId: string, projectId: string) {
    await this.findOne(tenantId, projectId);

    const access = await this.prisma.projectScmAccess.findMany({
      where: { projectId },
      include: {
        connection: {
          select: {
            id: true,
            provider: true,
            externalName: true,
            isActive: true,
          },
        },
        repoAccess: true,
      },
    });

    return access;
  }

  /**
   * Grant a project access to an SCM connection
   */
  async grantScmAccess(tenantId: string, projectId: string, connectionId: string) {
    await this.findOne(tenantId, projectId);

    // Verify connection belongs to tenant
    const connection = await this.prisma.scmConnection.findFirst({
      where: { id: connectionId, tenantId },
    });
    if (!connection) {
      throw new NotFoundException('SCM connection not found');
    }

    // Check if already exists
    const existing = await this.prisma.projectScmAccess.findFirst({
      where: { projectId, connectionId },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.projectScmAccess.create({
      data: { projectId, connectionId },
      include: {
        connection: {
          select: {
            id: true,
            provider: true,
            externalName: true,
          },
        },
      },
    });
  }

  /**
   * Revoke a project's access to an SCM connection
   */
  async revokeScmAccess(tenantId: string, projectId: string, connectionId: string) {
    await this.findOne(tenantId, projectId);

    const access = await this.prisma.projectScmAccess.findFirst({
      where: { projectId, connectionId },
    });
    if (!access) {
      throw new NotFoundException('SCM access not found');
    }

    await this.prisma.projectScmAccess.delete({
      where: { id: access.id },
    });

    return { success: true };
  }

  /**
   * Get allowed repositories for a project from a connection
   */
  async getRepoAccess(tenantId: string, projectId: string, connectionId: string) {
    await this.findOne(tenantId, projectId);

    const access = await this.prisma.projectScmAccess.findFirst({
      where: { projectId, connectionId },
      include: { repoAccess: true },
    });

    if (!access) {
      throw new NotFoundException('Project does not have access to this connection');
    }

    return access.repoAccess;
  }

  /**
   * Grant a project access to specific repositories from a connection
   */
  async grantRepoAccess(
    tenantId: string,
    projectId: string,
    connectionId: string,
    repos: { externalRepoId: string; fullName: string }[],
  ) {
    await this.findOne(tenantId, projectId);

    const access = await this.prisma.projectScmAccess.findFirst({
      where: { projectId, connectionId },
    });

    if (!access) {
      throw new NotFoundException('Project does not have access to this connection. Grant connection access first.');
    }

    // Create repo access entries
    const created = await Promise.all(
      repos.map(async (repo) => {
        const existing = await this.prisma.projectRepoAccess.findFirst({
          where: { projectAccessId: access.id, externalRepoId: repo.externalRepoId },
        });
        if (existing) return existing;

        return this.prisma.projectRepoAccess.create({
          data: {
            projectAccessId: access.id,
            externalRepoId: repo.externalRepoId,
            fullName: repo.fullName,
          },
        });
      }),
    );

    return created;
  }

  /**
   * Revoke a project's access to specific repositories
   */
  async revokeRepoAccess(tenantId: string, projectId: string, connectionId: string, externalRepoIds: string[]) {
    await this.findOne(tenantId, projectId);

    const access = await this.prisma.projectScmAccess.findFirst({
      where: { projectId, connectionId },
    });

    if (!access) {
      throw new NotFoundException('Project does not have access to this connection');
    }

    await this.prisma.projectRepoAccess.deleteMany({
      where: {
        projectAccessId: access.id,
        externalRepoId: { in: externalRepoIds },
      },
    });

    return { success: true };
  }

  /**
   * Check if a project can access a specific repository
   */
  async canAccessRepo(_tenantId: string, projectId: string, connectionId: string, externalRepoId: string): Promise<boolean> {
    const access = await this.prisma.projectScmAccess.findFirst({
      where: { projectId, connectionId },
      include: {
        repoAccess: {
          where: { externalRepoId },
        },
      },
    });

    if (!access) return false;

    // If no repo restrictions (repoAccess is empty for this connection), allow all repos
    const totalRepoAccess = await this.prisma.projectRepoAccess.count({
      where: { projectAccessId: access.id },
    });

    if (totalRepoAccess === 0) return true; // No restrictions, allow all

    return access.repoAccess.length > 0; // Has specific access
  }

  /**
   * Get project with full hierarchy including repositories, threat models,
   * environments, and pipeline gates with nested data
   */
  async getProjectHierarchy(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId, status: { not: 'DELETED' } },
      include: {
        repositories: {
          where: { isActive: true },
          include: {
            scans: {
              take: 5,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                status: true,
                branch: true,
                createdAt: true,
                completedAt: true,
              },
            },
            _count: {
              select: {
                scans: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
        threatModels: {
          where: { status: { not: 'DELETED' } },
          select: {
            id: true,
            name: true,
            status: true,
            methodology: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                components: true,
                threats: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
        environments: {
          select: {
            id: true,
            name: true,
            type: true,
            cloudProvider: true,
            isActive: true,
            deployments: {
              take: 5,
              orderBy: { deployedAt: 'desc' },
              select: {
                id: true,
                name: true,
                version: true,
                status: true,
                deployedAt: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        },
        pipelineGates: {
          select: {
            id: true,
            stage: true,
            enabled: true,
            blockSeverity: true,
          },
          orderBy: { stage: 'asc' },
        },
        _count: {
          select: {
            repositories: true,
            threatModels: true,
            environments: true,
            pipelineGates: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }
}
