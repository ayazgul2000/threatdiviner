// apps/api/src/ai/services/fix-generator.service.ts
// AI-powered contextual fix generation

import { Injectable, Logger } from '@nestjs/common';
import { StructuredAIService } from '../structured-ai.service';
import { RemediationOutputSchema, RemediationOutput } from '../schemas';
import { PrismaService } from '../../prisma/prisma.service';

interface FixRequest {
  findingId: string;
  title: string;
  description: string;
  cweId?: string;
  vulnerableCode: string;
  filePath: string;
  language: string;
  framework?: string;
}

interface FixResult {
  findingId: string;
  summary: string;
  fixedCode: string;
  explanation: string;
  additionalSteps?: string[];
  references?: { title: string; url: string }[];
  estimatedEffort?: string;
  provider: string;
  tokensUsed: number;
  fromPlaybook: boolean;
}

@Injectable()
export class FixGeneratorService {
  private readonly logger = new Logger(FixGeneratorService.name);

  constructor(
    private readonly structuredAI: StructuredAIService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Generate contextual fix for a finding
   * First checks playbook, then falls back to AI
   */
  async generateFix(request: FixRequest): Promise<FixResult> {
    // 1. Try playbook first (deterministic)
    const playbookFix = await this.getPlaybookFix(request);
    if (playbookFix) {
      return { ...playbookFix, findingId: request.findingId, provider: 'playbook', tokensUsed: 0, fromPlaybook: true };
    }

    // 2. Fall back to AI
    return this.generateAIFix(request);
  }

  private async getPlaybookFix(request: FixRequest): Promise<RemediationOutput | null> {
    if (!request.cweId) return null;

    // Playbook lookup - requires playbook model with codeExamples relation
    // For now, return null to use AI fallback
    return null;
  }

  private async generateAIFix(request: FixRequest): Promise<FixResult> {
    const systemPrompt = `You are a security engineer providing code fixes.
Given vulnerable code, provide:
1. A brief summary of the fix
2. The corrected code (complete, copy-paste ready)
3. Explanation of why this fixes the vulnerability
4. Any additional steps needed (dependencies, config, testing)

Focus on:
- Minimal changes to fix the issue
- Following ${request.language}/${request.framework || 'standard'} best practices
- Preserving existing functionality
- Being production-ready`;

    const userPrompt = `## Vulnerability to Fix

**Issue:** ${request.title}
**CWE:** ${request.cweId || 'Unknown'}
**Language:** ${request.language}
${request.framework ? `**Framework:** ${request.framework}` : ''}
**File:** ${request.filePath}

**Description:**
${request.description}

**Vulnerable Code:**
\`\`\`${request.language}
${request.vulnerableCode}
\`\`\`

Provide a secure fix for this code.`;

    try {
      const response = await this.structuredAI.execute({
        schema: RemediationOutputSchema,
        systemPrompt,
        userPrompt,
        maxTokens: 1500,
        temperature: 0,
      });

      return {
        ...response.data,
        findingId: request.findingId,
        provider: response.provider,
        tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
        fromPlaybook: false,
      };
    } catch (error) {
      this.logger.error(`AI fix generation failed for ${request.findingId}`, error);
      return {
        findingId: request.findingId,
        summary: 'Fix generation failed',
        fixedCode: '// AI fix generation failed - manual review required',
        explanation: 'The AI service was unable to generate a fix. Please review manually.',
        provider: 'fallback',
        tokensUsed: 0,
        fromPlaybook: false,
      };
    }
  }
}
