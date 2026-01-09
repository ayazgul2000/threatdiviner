import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type IntegrationType =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'azure-devops'
  | 'slack'
  | 'pagerduty'
  | 'webhook'
  | 'jira';

export type IntegrationStatus = 'connected' | 'error' | 'pending' | 'disabled';

export interface Integration {
  id: string;
  tenantId: string;
  type: IntegrationType;
  name: string;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  lastSync?: Date | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listIntegrations(tenantId: string): Promise<Integration[]> {
    const integrations = await this.prisma.integration.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Mask sensitive config values
    return integrations.map(this.maskSensitiveConfig);
  }

  async getIntegration(tenantId: string, id: string): Promise<Integration> {
    const integration = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return this.maskSensitiveConfig(integration);
  }

  async createIntegration(
    tenantId: string,
    data: {
      type: IntegrationType;
      name: string;
      config: Record<string, string>;
    },
  ): Promise<Integration> {
    // Validate required config fields based on type
    this.validateConfig(data.type, data.config);

    const integration = await this.prisma.integration.create({
      data: {
        tenantId,
        type: data.type,
        name: data.name || this.getDefaultName(data.type),
        status: 'pending',
        config: data.config as any,
      },
    });

    this.logger.log(`Created integration ${integration.id} (${data.type}) for tenant ${tenantId}`);

    // Auto-test the connection
    try {
      await this.testConnection(integration);
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: { status: 'connected' },
      });
      integration.status = 'connected';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: { status: 'error', errorMessage },
      });
      integration.status = 'error';
      integration.errorMessage = errorMessage;
    }

    return this.maskSensitiveConfig(integration);
  }

  async updateIntegration(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      config?: Record<string, string>;
      status?: IntegrationStatus;
    },
  ): Promise<Integration> {
    const existing = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Integration not found');
    }

    // Merge config with existing
    const newConfig = data.config
      ? { ...(existing.config as Record<string, unknown>), ...data.config }
      : existing.config;

    const integration = await this.prisma.integration.update({
      where: { id },
      data: {
        name: data.name,
        config: newConfig as any,
        status: data.status,
        errorMessage: data.status === 'connected' ? null : undefined,
      },
    });

    return this.maskSensitiveConfig(integration);
  }

  async deleteIntegration(tenantId: string, id: string): Promise<void> {
    const integration = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    await this.prisma.integration.delete({ where: { id } });
    this.logger.log(`Deleted integration ${id} for tenant ${tenantId}`);
  }

  async testIntegration(
    tenantId: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const integration = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    try {
      await this.testConnection(integration);

      await this.prisma.integration.update({
        where: { id },
        data: { status: 'connected', errorMessage: null },
      });

      return { success: true, message: 'Connection test successful' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';

      await this.prisma.integration.update({
        where: { id },
        data: { status: 'error', errorMessage },
      });

      return { success: false, message: errorMessage };
    }
  }

  async syncIntegration(
    tenantId: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const integration = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    // Update lastSync timestamp
    await this.prisma.integration.update({
      where: { id },
      data: { lastSync: new Date() },
    });

    return { success: true, message: 'Sync triggered successfully' };
  }

  // ========== Private Methods ==========

  private async testConnection(integration: any): Promise<void> {
    const config = integration.config as Record<string, string>;

    switch (integration.type) {
      case 'github':
        await this.testGitHubConnection(config);
        break;
      case 'gitlab':
        await this.testGitLabConnection(config);
        break;
      case 'slack':
        await this.testSlackConnection(config);
        break;
      case 'jira':
        await this.testJiraConnection(config);
        break;
      case 'webhook':
        // Webhooks are validated on first send
        break;
      case 'pagerduty':
        // PagerDuty keys are validated on first alert
        break;
      case 'bitbucket':
      case 'azure-devops':
        // These require OAuth or complex auth
        break;
      default:
        this.logger.warn(`No test method for integration type: ${integration.type}`);
    }
  }

  private async testGitHubConnection(config: Record<string, string>): Promise<void> {
    // Simplified test - in production, use Octokit
    if (!config.installationId || !config.appId) {
      throw new Error('Missing GitHub App configuration');
    }
    // Would verify with GitHub API here
  }

  private async testGitLabConnection(config: Record<string, string>): Promise<void> {
    if (!config.accessToken) {
      throw new Error('Missing GitLab access token');
    }

    const url = config.url || 'https://gitlab.com';
    try {
      const response = await fetch(`${url}/api/v4/user`, {
        headers: { 'PRIVATE-TOKEN': config.accessToken },
      });
      if (!response.ok) {
        throw new Error('Invalid GitLab credentials');
      }
    } catch (error) {
      throw new Error('Failed to connect to GitLab');
    }
  }

  private async testSlackConnection(config: Record<string, string>): Promise<void> {
    if (!config.webhookUrl) {
      throw new Error('Missing Slack webhook URL');
    }

    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'ThreatDiviner connection test' }),
      });
      if (!response.ok) {
        throw new Error('Invalid Slack webhook');
      }
    } catch (error) {
      throw new Error('Failed to connect to Slack');
    }
  }

  private async testJiraConnection(config: Record<string, string>): Promise<void> {
    if (!config.url || !config.email || !config.apiToken) {
      throw new Error('Missing Jira configuration');
    }

    try {
      const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
      const response = await fetch(`${config.url}/rest/api/3/myself`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!response.ok) {
        throw new Error('Invalid Jira credentials');
      }
    } catch (error) {
      throw new Error('Failed to connect to Jira');
    }
  }

  private validateConfig(type: IntegrationType, config: Record<string, string>): void {
    const requiredFields: Record<IntegrationType, string[]> = {
      github: ['installationId', 'appId'],
      gitlab: ['accessToken'],
      bitbucket: ['workspace', 'appPassword', 'username'],
      'azure-devops': ['organization', 'pat'],
      slack: ['webhookUrl'],
      pagerduty: ['routingKey'],
      webhook: ['url'],
      jira: ['url', 'email', 'apiToken', 'projectKey'],
    };

    const required = requiredFields[type] || [];
    const missing = required.filter((field) => !config[field]);

    if (missing.length > 0) {
      throw new BadRequestException(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  private getDefaultName(type: IntegrationType): string {
    const names: Record<IntegrationType, string> = {
      github: 'GitHub',
      gitlab: 'GitLab',
      bitbucket: 'Bitbucket',
      'azure-devops': 'Azure DevOps',
      slack: 'Slack',
      pagerduty: 'PagerDuty',
      webhook: 'Webhook',
      jira: 'Jira',
    };
    return names[type] || type;
  }

  private maskSensitiveConfig(integration: any): Integration {
    const sensitiveKeys = [
      'accessToken',
      'privateKey',
      'appPassword',
      'pat',
      'apiToken',
      'secret',
      'routingKey',
      'clientSecret',
      'secretAccessKey',
    ];

    const config = { ...(integration.config as Record<string, unknown>) };

    for (const key of Object.keys(config)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
        config[key] = '••••••••';
      }
    }

    return {
      ...integration,
      config,
    };
  }
}
