import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../scm/services/crypto.service';
import {
  UpdateJiraConfigDto,
  JiraConfigResponse,
  JiraProject,
  JiraIssueType,
  JiraIssueResponse,
} from './dto';

interface JiraApiResponse<T> {
  data: T;
  status: number;
}

@Injectable()
export class JiraService {
  private readonly logger = new Logger(JiraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Get Jira configuration for a tenant
   */
  async getConfig(tenantId: string): Promise<JiraConfigResponse | null> {
    const config = await this.prisma.jiraConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      jiraUrl: config.jiraUrl,
      email: config.email,
      projectKey: config.projectKey,
      issueType: config.issueType,
      enabled: config.enabled,
      autoCreate: config.autoCreate,
      autoCreateSeverities: config.autoCreateSeverities,
      hasApiToken: !!config.apiToken,
    };
  }

  /**
   * Update Jira configuration
   */
  async updateConfig(tenantId: string, dto: UpdateJiraConfigDto): Promise<JiraConfigResponse> {
    const data: Record<string, unknown> = {};

    if (dto.jiraUrl !== undefined) data.jiraUrl = dto.jiraUrl;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.apiToken !== undefined) {
      data.apiToken = dto.apiToken ? this.cryptoService.encrypt(dto.apiToken) : null;
    }
    if (dto.projectKey !== undefined) data.projectKey = dto.projectKey;
    if (dto.issueType !== undefined) data.issueType = dto.issueType;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.autoCreate !== undefined) data.autoCreate = dto.autoCreate;
    if (dto.autoCreateSeverities !== undefined) data.autoCreateSeverities = dto.autoCreateSeverities;

    const config = await this.prisma.jiraConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        jiraUrl: dto.jiraUrl || '',
        email: dto.email || '',
        apiToken: dto.apiToken ? this.cryptoService.encrypt(dto.apiToken) : '',
        projectKey: dto.projectKey || '',
        ...data,
      },
      update: data,
    });

    return {
      id: config.id,
      jiraUrl: config.jiraUrl,
      email: config.email,
      projectKey: config.projectKey,
      issueType: config.issueType,
      enabled: config.enabled,
      autoCreate: config.autoCreate,
      autoCreateSeverities: config.autoCreateSeverities,
      hasApiToken: !!config.apiToken,
    };
  }

  /**
   * Test Jira connection
   */
  async testConnection(tenantId: string): Promise<{ success: boolean; message: string }> {
    const config = await this.prisma.jiraConfig.findUnique({
      where: { tenantId },
    });

    if (!config || !config.jiraUrl || !config.email || !config.apiToken) {
      return { success: false, message: 'Jira configuration incomplete' };
    }

    try {
      const apiToken = this.cryptoService.decrypt(config.apiToken);
      const response = await this.makeJiraRequest(config.jiraUrl, config.email, apiToken, '/myself');

      if (response.status === 200) {
        return { success: true, message: 'Connection successful' };
      }
      return { success: false, message: `Connection failed with status ${response.status}` };
    } catch (error) {
      this.logger.error(`Jira connection test failed: ${error}`);
      return { success: false, message: `Connection failed: ${error}` };
    }
  }

  /**
   * List available Jira projects
   */
  async getProjects(tenantId: string): Promise<JiraProject[]> {
    const config = await this.getConfigWithCredentials(tenantId);

    const response = await this.makeJiraRequest<{ values: JiraProject[] }>(
      config.jiraUrl,
      config.email,
      config.apiToken,
      '/project/search',
    );

    return response.data.values.map((p: any) => ({
      id: p.id,
      key: p.key,
      name: p.name,
    }));
  }

  /**
   * Get issue types for a project
   */
  async getIssueTypes(tenantId: string, projectKey: string): Promise<JiraIssueType[]> {
    const config = await this.getConfigWithCredentials(tenantId);

    const response = await this.makeJiraRequest<{ issueTypes: JiraIssueType[] }>(
      config.jiraUrl,
      config.email,
      config.apiToken,
      `/project/${projectKey}`,
    );

    return response.data.issueTypes?.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
    })) || [];
  }

  /**
   * Create a Jira issue from a finding
   */
  async createIssue(
    tenantId: string,
    findingId: string,
    projectKey?: string,
    issueType?: string,
    additionalDescription?: string,
  ): Promise<JiraIssueResponse> {
    const config = await this.getConfigWithCredentials(tenantId);

    // Get the finding
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId, tenantId },
      include: {
        scan: {
          include: {
            repository: true,
          },
        },
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    const useProjectKey = projectKey || config.projectKey;
    const useIssueType = issueType || config.issueType;

    if (!useProjectKey) {
      throw new BadRequestException('Project key not specified');
    }

    // Build issue description
    const description = this.buildIssueDescription(finding, additionalDescription);
    const summary = this.buildIssueSummary(finding);
    const priority = this.mapSeverityToPriority(finding.severity);
    const labels = ['threatdiviner', 'security', finding.severity];

    const issueData = {
      fields: {
        project: { key: useProjectKey },
        issuetype: { name: useIssueType },
        summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: description }],
            },
          ],
        },
        priority: { name: priority },
        labels,
      },
    };

    const response = await this.makeJiraRequest<{ id: string; key: string; self: string }>(
      config.jiraUrl,
      config.email,
      config.apiToken,
      '/issue',
      'POST',
      issueData,
    );

    const issueUrl = `${config.jiraUrl}/browse/${response.data.key}`;

    // Update finding with Jira issue info
    await this.prisma.finding.update({
      where: { id: findingId },
      data: {
        jiraIssueKey: response.data.key,
        jiraIssueUrl: issueUrl,
      },
    });

    return {
      id: response.data.id,
      key: response.data.key,
      self: response.data.self,
      url: issueUrl,
    };
  }

  /**
   * Link an existing Jira issue to a finding
   */
  async linkFindingToIssue(
    tenantId: string,
    findingId: string,
    issueKey: string,
  ): Promise<void> {
    const config = await this.getConfigWithCredentials(tenantId);

    // Verify the issue exists
    await this.makeJiraRequest(
      config.jiraUrl,
      config.email,
      config.apiToken,
      `/issue/${issueKey}`,
    );

    const issueUrl = `${config.jiraUrl}/browse/${issueKey}`;

    await this.prisma.finding.update({
      where: { id: findingId },
      data: {
        jiraIssueKey: issueKey,
        jiraIssueUrl: issueUrl,
      },
    });
  }

  /**
   * Get linked Jira issue for a finding
   */
  async getLinkedIssue(tenantId: string, findingId: string): Promise<{
    issueKey: string | null;
    issueUrl: string | null;
  }> {
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId, tenantId },
      select: { jiraIssueKey: true, jiraIssueUrl: true },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    return {
      issueKey: finding.jiraIssueKey,
      issueUrl: finding.jiraIssueUrl,
    };
  }

  /**
   * Auto-create Jira issues for findings matching severities
   */
  async autoCreateIssuesForScan(tenantId: string, scanId: string): Promise<number> {
    const config = await this.prisma.jiraConfig.findUnique({
      where: { tenantId },
    });

    if (!config?.enabled || !config.autoCreate) {
      return 0;
    }

    const findings = await this.prisma.finding.findMany({
      where: {
        scanId,
        tenantId,
        severity: { in: config.autoCreateSeverities },
        jiraIssueKey: null, // Only create for findings without existing issue
      },
    });

    let created = 0;
    for (const finding of findings) {
      try {
        await this.createIssue(tenantId, finding.id);
        created++;
      } catch (error) {
        this.logger.error(`Failed to auto-create Jira issue for finding ${finding.id}: ${error}`);
      }
    }

    return created;
  }

  // Private helper methods

  private async getConfigWithCredentials(tenantId: string): Promise<{
    jiraUrl: string;
    email: string;
    apiToken: string;
    projectKey: string;
    issueType: string;
  }> {
    const config = await this.prisma.jiraConfig.findUnique({
      where: { tenantId },
    });

    if (!config || !config.jiraUrl || !config.email || !config.apiToken) {
      throw new BadRequestException('Jira configuration incomplete');
    }

    return {
      jiraUrl: config.jiraUrl,
      email: config.email,
      apiToken: this.cryptoService.decrypt(config.apiToken),
      projectKey: config.projectKey,
      issueType: config.issueType,
    };
  }

  private async makeJiraRequest<T>(
    jiraUrl: string,
    email: string,
    apiToken: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    body?: unknown,
  ): Promise<JiraApiResponse<T>> {
    const url = `${jiraUrl}/rest/api/3${endpoint}`;
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { data, status: response.status };
  }

  private buildIssueSummary(finding: any): string {
    const severity = finding.severity.toUpperCase();
    const file = finding.filePath.split('/').pop() || finding.filePath;
    return `[ThreatDiviner] ${severity}: ${finding.ruleId} in ${file}`;
  }

  private buildIssueDescription(finding: any, additional?: string): string {
    const parts = [
      `*Security Finding from ThreatDiviner*`,
      ``,
      `*Severity:* ${finding.severity.toUpperCase()}`,
      `*Scanner:* ${finding.scanner}`,
      `*Rule:* ${finding.ruleId}`,
      `*File:* ${finding.filePath}${finding.startLine ? `:${finding.startLine}` : ''}`,
      ``,
      `*Description:*`,
      finding.description || finding.title,
    ];

    if (finding.snippet) {
      parts.push(``, `*Code Snippet:*`, `{code}`, finding.snippet, `{code}`);
    }

    if (finding.aiRemediation) {
      parts.push(``, `*AI Remediation Suggestion:*`, finding.aiRemediation);
    }

    if (finding.cweId) {
      parts.push(``, `*CWE:* ${finding.cweId}`);
    }

    if (finding.cveId) {
      parts.push(``, `*CVE:* ${finding.cveId}`);
    }

    if (additional) {
      parts.push(``, `*Additional Notes:*`, additional);
    }

    const repoName = finding.scan?.repository?.fullName || 'Unknown';
    parts.push(
      ``,
      `---`,
      `Found in repository: ${repoName}`,
      `Scan ID: ${finding.scanId}`,
      `Finding ID: ${finding.id}`,
    );

    return parts.join('\n');
  }

  private mapSeverityToPriority(severity: string): string {
    const mapping: Record<string, string> = {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      info: 'Lowest',
    };
    return mapping[severity.toLowerCase()] || 'Medium';
  }
}
