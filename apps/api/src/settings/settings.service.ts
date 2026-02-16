import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        aiTriageEnabled: true,
        auditRetentionDays: true,
        findingRetentionDays: true,
        scanRetentionDays: true,
        maxRepositories: true,
        maxUsers: true,
        allowProjectConnections: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async updateTenantSettings(
    tenantId: string,
    data: {
      name?: string;
      aiTriageEnabled?: boolean;
      auditRetentionDays?: number;
      findingRetentionDays?: number;
      scanRetentionDays?: number;
      allowProjectConnections?: boolean;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        aiTriageEnabled: true,
        auditRetentionDays: true,
        findingRetentionDays: true,
        scanRetentionDays: true,
        maxRepositories: true,
        maxUsers: true,
        allowProjectConnections: true,
      },
    });
  }
}
