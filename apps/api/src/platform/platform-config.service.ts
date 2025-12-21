import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    let config = await this.prisma.platformConfig.findFirst();

    if (!config) {
      // Create default config if not exists
      config = await this.prisma.platformConfig.create({
        data: {
          aiProvider: 'anthropic',
          aiModel: 'claude-sonnet-4-20250514',
          aiApiKey: null,
          defaultPlan: 'free',
          defaultMaxUsers: 5,
          defaultMaxRepositories: 10,
          maintenanceMode: false,
        },
      });
    }

    return {
      id: config.id,
      aiProvider: config.aiProvider,
      aiModel: config.aiModel,
      aiApiKeySet: !!config.aiApiKey,
      defaultPlan: config.defaultPlan,
      defaultMaxUsers: config.defaultMaxUsers,
      defaultMaxRepositories: config.defaultMaxRepositories,
      maintenanceMode: config.maintenanceMode,
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  async update(data: {
    aiProvider?: string;
    aiModel?: string;
    defaultPlan?: string;
    defaultMaxUsers?: number;
    defaultMaxRepositories?: number;
    maintenanceMode?: boolean;
  }) {
    let config = await this.prisma.platformConfig.findFirst();

    if (!config) {
      config = await this.prisma.platformConfig.create({
        data: {
          aiProvider: data.aiProvider || 'anthropic',
          aiModel: data.aiModel || 'claude-sonnet-4-20250514',
          defaultPlan: data.defaultPlan || 'free',
          defaultMaxUsers: data.defaultMaxUsers || 5,
          defaultMaxRepositories: data.defaultMaxRepositories || 10,
          maintenanceMode: data.maintenanceMode || false,
        },
      });
    } else {
      config = await this.prisma.platformConfig.update({
        where: { id: config.id },
        data,
      });
    }

    return {
      id: config.id,
      aiProvider: config.aiProvider,
      aiModel: config.aiModel,
      aiApiKeySet: !!config.aiApiKey,
      defaultPlan: config.defaultPlan,
      defaultMaxUsers: config.defaultMaxUsers,
      defaultMaxRepositories: config.defaultMaxRepositories,
      maintenanceMode: config.maintenanceMode,
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  async updateAiKey(apiKey: string) {
    let config = await this.prisma.platformConfig.findFirst();

    if (!config) {
      config = await this.prisma.platformConfig.create({
        data: {
          aiProvider: 'anthropic',
          aiModel: 'claude-sonnet-4-20250514',
          aiApiKey: apiKey,
          defaultPlan: 'free',
          defaultMaxUsers: 5,
          defaultMaxRepositories: 10,
          maintenanceMode: false,
        },
      });
    } else {
      config = await this.prisma.platformConfig.update({
        where: { id: config.id },
        data: { aiApiKey: apiKey },
      });
    }

    return { success: true };
  }

  async getAiApiKey(): Promise<string | null> {
    const config = await this.prisma.platformConfig.findFirst();
    return config?.aiApiKey || null;
  }
}
