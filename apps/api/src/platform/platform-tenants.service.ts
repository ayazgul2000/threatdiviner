import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformTenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Get stats for each tenant
    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const [userCount, repositoryCount, scanCount, findingCount] = await Promise.all([
          this.prisma.user.count({ where: { tenantId: tenant.id } }),
          this.prisma.repository.count({ where: { tenantId: tenant.id } }),
          this.prisma.scan.count({
            where: { repository: { tenantId: tenant.id } },
          }),
          this.prisma.finding.count({
            where: { scan: { repository: { tenantId: tenant.id } } },
          }),
        ]);

        return {
          ...tenant,
          stats: { userCount, repositoryCount, scanCount, findingCount },
        };
      }),
    );

    return tenantsWithStats;
  }

  async get(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const [userCount, repositoryCount, scanCount, findingCount] = await Promise.all([
      this.prisma.user.count({ where: { tenantId: tenant.id } }),
      this.prisma.repository.count({ where: { tenantId: tenant.id } }),
      this.prisma.scan.count({
        where: { repository: { tenantId: tenant.id } },
      }),
      this.prisma.finding.count({
        where: { scan: { repository: { tenantId: tenant.id } } },
      }),
    ]);

    return {
      ...tenant,
      stats: { userCount, repositoryCount, scanCount, findingCount },
    };
  }

  async create(data: {
    name: string;
    slug: string;
    plan?: 'free' | 'pro' | 'enterprise';
  }) {
    // Check if slug is unique
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw new ConflictException('Tenant slug already exists');
    }

    // Get default settings from platform config
    const config = await this.prisma.platformConfig.findFirst();

    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        plan: data.plan || config?.defaultPlan || 'free',
        maxUsers: config?.defaultMaxUsers || 5,
        maxRepositories: config?.defaultMaxRepositories || 10,
        aiTriageEnabled: false,
        isActive: true,
      },
    });

    return tenant;
  }

  async update(id: string, data: {
    name?: string;
    plan?: 'free' | 'pro' | 'enterprise';
    maxUsers?: number;
    maxRepositories?: number;
    aiTriageEnabled?: boolean;
    isActive?: boolean;
  }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Note: In production, this should be a soft delete or cascade delete
    // For now, we'll just delete the tenant
    await this.prisma.tenant.delete({
      where: { id },
    });

    return { success: true };
  }
}
