// apps/api/src/ai/services/smart-triage.service.ts
// AI-powered vulnerability triage for edge cases (20% of findings)

import { Injectable, Logger } from '@nestjs/common';
import { StructuredAIService } from '../structured-ai.service';
import { TriageOutputSchema, TriageOutput } from '../schemas';
import { PrismaService } from '../../prisma/prisma.service';

interface FindingContext {
  id: string;
  title: string;
  description: string;
  severity: string;
  scanner: string;
  ruleId: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet?: string;
  cweId?: string;
}

interface TriageResult {
  findingId: string;
  status: string;
  confidence: string;
  reasoning: string;
  adjustedSeverity?: string;
  suggestedAction?: string;
  provider: string;
  tokensUsed: number;
}

@Injectable()
export class SmartTriageService {
  private readonly logger = new Logger(SmartTriageService.name);

  constructor(
    private readonly structuredAI: StructuredAIService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * AI triage for ambiguous findings (after rule engine marks as needs_review)
   */
  async triageFinding(finding: FindingContext, tenantContext?: any): Promise<TriageResult> {
    const systemPrompt = `You are a security expert triaging vulnerability findings.
Analyze the finding and determine:
1. Is this a true positive (confirmed), false positive, needs manual review, or should be suppressed?
2. Your confidence level (high/medium/low)
3. Brief reasoning (max 500 chars)
4. Optionally adjust severity if scanner assessment seems incorrect

Consider:
- Code context and surrounding logic
- Common false positive patterns for this scanner/rule
- Whether the vulnerability is actually exploitable
- The technology stack and framework protections`;

    const userPrompt = this.buildTriagePrompt(finding, tenantContext);

    try {
      const response = await this.structuredAI.execute({
        schema: TriageOutputSchema,
        systemPrompt,
        userPrompt,
        maxTokens: 500,
        temperature: 0,
      });

      // Log triage decision for audit
      await this.logTriageDecision(finding.id, response.data, response.provider, response.usage);

      return {
        ...response.data,
        findingId: finding.id,
        provider: response.provider,
        tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      };
    } catch (error) {
      this.logger.error(`AI triage failed for finding ${finding.id}`, error);
      // Fallback: mark for manual review
      return {
        findingId: finding.id,
        status: 'needs_review',
        confidence: 'low',
        reasoning: 'AI triage failed, requires manual review',
        provider: 'fallback',
        tokensUsed: 0,
      };
    }
  }

  /**
   * Batch triage multiple findings
   */
  async triageBatch(findings: FindingContext[], tenantContext?: any): Promise<TriageResult[]> {
    const results: TriageResult[] = [];
    
    for (const finding of findings) {
      const result = await this.triageFinding(finding, tenantContext);
      results.push(result);
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }

    return results;
  }

  private buildTriagePrompt(finding: FindingContext, tenantContext?: any): string {
    let prompt = `## Finding to Triage

**Title:** ${finding.title}
**Scanner:** ${finding.scanner}
**Rule ID:** ${finding.ruleId}
**Severity:** ${finding.severity}
**File:** ${finding.filePath}${finding.lineNumber ? `:${finding.lineNumber}` : ''}
${finding.cweId ? `**CWE:** ${finding.cweId}` : ''}

**Description:**
${finding.description}`;

    if (finding.codeSnippet) {
      prompt += `\n\n**Code Snippet:**\n\`\`\`\n${finding.codeSnippet}\n\`\`\``;
    }

    if (tenantContext?.techStack) {
      prompt += `\n\n**Tech Stack:** ${JSON.stringify(tenantContext.techStack)}`;
    }

    prompt += '\n\nAnalyze this finding and provide your triage decision.';
    return prompt;
  }

  private async logTriageDecision(
    findingId: string,
    decision: TriageOutput,
    provider: string,
    usage: { inputTokens: number; outputTokens: number }
  ): Promise<void> {
    try {
      // Log triage decision - aiTriageLog model required
      this.logger.log(`Triage: ${findingId} -> ${decision.status} (${provider})`);
    } catch (e) {
      this.logger.warn('Failed to log triage decision', e);
    }
  }
}
