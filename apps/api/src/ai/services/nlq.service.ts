// apps/api/src/ai/services/nlq.service.ts
// Natural Language Query service for findings and chat

import { Injectable, Logger } from '@nestjs/common';
import { AIService } from '../ai.service';
import { PrismaService } from '../../prisma/prisma.service';

interface NlqQuery {
  query: string;
  tenantId: string;
  context?: {
    projectId?: string;
    scanId?: string;
    recentFindings?: any[];
  };
}

interface NlqResult {
  response: string;
  sqlGenerated?: string;
  findings?: any[];
  suggestedActions?: { label: string; action: string }[];
  provider: string;
}

@Injectable()
export class NlqService {
  private readonly logger = new Logger(NlqService.name);

  constructor(
    private readonly ai: AIService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Process natural language query about findings
   */
  async query(request: NlqQuery): Promise<NlqResult> {
    const intent = this.classifyIntent(request.query);

    switch (intent) {
      case 'count':
        return this.handleCountQuery(request);
      case 'list':
        return this.handleListQuery(request);
      case 'explain':
        return this.handleExplainQuery(request);
      case 'compare':
        return this.handleCompareQuery(request);
      case 'remediation':
        return this.handleRemediationQuery(request);
      default:
        return this.handleGeneralQuery(request);
    }
  }

  private classifyIntent(query: string): string {
    const lc = query.toLowerCase();
    
    if (/how many|count|total|number of/.test(lc)) return 'count';
    if (/list|show|display|what are|get all/.test(lc)) return 'list';
    if (/explain|what is|why|how does/.test(lc)) return 'explain';
    if (/compare|vs|versus|difference|between/.test(lc)) return 'compare';
    if (/fix|remediate|resolve|how to|solution/.test(lc)) return 'remediation';
    return 'general';
  }

  private async handleCountQuery(request: NlqQuery): Promise<NlqResult> {
    const filters = this.extractFilters(request.query);
    
    const where: any = { tenantId: request.tenantId };
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;
    if (request.context?.projectId) where.projectId = request.context.projectId;

    const count = await this.prisma.finding.count({ where });

    return {
      response: `Found ${count} ${filters.severity || ''} findings${filters.status ? ` with status ${filters.status}` : ''}.`,
      provider: 'deterministic',
    };
  }

  private async handleListQuery(request: NlqQuery): Promise<NlqResult> {
    const filters = this.extractFilters(request.query);
    
    const where: any = { tenantId: request.tenantId };
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;

    const findings = await this.prisma.finding.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, severity: true, status: true, filePath: true },
    });

    return {
      response: `Here are ${findings.length} ${filters.severity || ''} findings:`,
      findings,
      provider: 'deterministic',
    };
  }

  private async handleExplainQuery(request: NlqQuery): Promise<NlqResult> {
    // Use AI to explain security concepts
    const response = await this.ai.complete({
      systemPrompt: 'You are a security expert explaining vulnerabilities. Be concise but thorough.',
      messages: [{ role: 'user', content: request.query }],
      maxTokens: 500,
      temperature: 0.3,
    });

    return {
      response: response.content,
      provider: response.provider,
    };
  }

  private async handleCompareQuery(request: NlqQuery): Promise<NlqResult> {
    // Compare scans, severity trends, etc.
    return {
      response: 'Comparison queries require specific scan IDs. Please specify which scans to compare.',
      suggestedActions: [
        { label: 'Compare last 2 scans', action: 'compare_recent_scans' },
        { label: 'Show trend over time', action: 'show_trend' },
      ],
      provider: 'deterministic',
    };
  }

  private async handleRemediationQuery(request: NlqQuery): Promise<NlqResult> {
    const response = await this.ai.complete({
      systemPrompt: `You are a security engineer providing remediation guidance.
Be specific and provide code examples when relevant.
Focus on practical, actionable steps.`,
      messages: [{ role: 'user', content: request.query }],
      maxTokens: 800,
      temperature: 0.2,
    });

    return {
      response: response.content,
      provider: response.provider,
      suggestedActions: [
        { label: 'Generate fix code', action: 'generate_fix' },
        { label: 'Find related findings', action: 'find_related' },
      ],
    };
  }

  private async handleGeneralQuery(request: NlqQuery): Promise<NlqResult> {
    // Get some context for the AI
    const recentFindings = await this.prisma.finding.findMany({
      where: { tenantId: request.tenantId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { title: true, severity: true, status: true },
    });

    const context = recentFindings.length > 0
      ? `Recent findings: ${recentFindings.map(f => `${f.severity} - ${f.title}`).join('; ')}`
      : 'No recent findings.';

    const response = await this.ai.complete({
      systemPrompt: `You are ThreatDiviner's AI assistant helping with security analysis.
Context: ${context}
Be helpful, concise, and security-focused.`,
      messages: [{ role: 'user', content: request.query }],
      maxTokens: 600,
      temperature: 0.4,
    });

    return {
      response: response.content,
      provider: response.provider,
    };
  }

  private extractFilters(query: string): { severity?: string; status?: string } {
    const lc = query.toLowerCase();
    const filters: { severity?: string; status?: string } = {};

    if (lc.includes('critical')) filters.severity = 'critical';
    else if (lc.includes('high')) filters.severity = 'high';
    else if (lc.includes('medium')) filters.severity = 'medium';
    else if (lc.includes('low')) filters.severity = 'low';

    if (lc.includes('open')) filters.status = 'open';
    else if (lc.includes('fixed')) filters.status = 'fixed';
    else if (lc.includes('dismissed')) filters.status = 'dismissed';

    return filters;
  }
}
