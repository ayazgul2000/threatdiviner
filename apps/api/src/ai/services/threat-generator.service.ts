// apps/api/src/ai/services/threat-generator.service.ts
// AI-powered threat model generation from context

import { Injectable, Logger } from '@nestjs/common';
import { StructuredAIService } from '../structured-ai.service';
import { ThreatModelOutputSchema, ThreatModelOutput } from '../schemas';
import { PrismaService } from '../../prisma/prisma.service';

interface ThreatGenContext {
  projectName: string;
  components: { name: string; type: string; technology?: string; criticality?: string }[];
  dataFlows: { source: string; target: string; dataType?: string; encrypted?: boolean }[];
  trustBoundaries?: string[];
  techStack?: { languages?: string[]; frameworks?: string[]; databases?: string[] };
}

@Injectable()
export class ThreatGeneratorService {
  private readonly logger = new Logger(ThreatGeneratorService.name);

  constructor(
    private readonly structuredAI: StructuredAIService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Generate STRIDE threats from system context
   * First applies templates, then uses AI for gaps
   */
  async generateThreats(context: ThreatGenContext): Promise<ThreatModelOutput> {
    // 1. Get template-based threats (deterministic)
    const templateThreats = await this.getTemplateThreats(context);
    
    // 2. Use AI to identify additional threats
    const aiThreats = await this.generateAIThreats(context, templateThreats.length);

    // 3. Combine and deduplicate
    const allThreats = [...templateThreats, ...aiThreats.threats];
    
    return {
      threats: allThreats,
      summary: aiThreats.summary,
      riskScore: this.calculateOverallRisk(allThreats),
    };
  }

  private async getTemplateThreats(context: ThreatGenContext): Promise<ThreatModelOutput['threats']> {
    const threats: ThreatModelOutput['threats'] = [];
    
    // Template-based threat generation - requires threatTemplate model
    // For now, return empty to use AI generation
    return threats;
  }

  private async generateAIThreats(context: ThreatGenContext, existingCount: number): Promise<ThreatModelOutput> {
    if (existingCount >= 20) {
      return { threats: [], summary: 'Sufficient threats from templates' };
    }

    const systemPrompt = `You are a threat modeling expert using STRIDE methodology.
Given a system architecture, identify security threats for each component.

Categories:
- SPOOFING: Identity attacks
- TAMPERING: Data modification
- REPUDIATION: Denying actions
- INFORMATION_DISCLOSURE: Data leaks
- DENIAL_OF_SERVICE: Availability attacks
- ELEVATION_OF_PRIVILEGE: Unauthorized access

Focus on threats NOT already covered by templates. Be specific to the technology stack.`;

    const userPrompt = `## System: ${context.projectName}

### Components:
${context.components.map(c => `- ${c.name} (${c.type}${c.technology ? `, ${c.technology}` : ''})`).join('\n')}

### Data Flows:
${context.dataFlows.map(f => `- ${f.source} → ${f.target}${f.dataType ? ` [${f.dataType}]` : ''}${f.encrypted ? ' (encrypted)' : ''}`).join('\n')}

${context.trustBoundaries?.length ? `### Trust Boundaries:\n${context.trustBoundaries.map(b => `- ${b}`).join('\n')}` : ''}

${context.techStack ? `### Tech Stack: ${JSON.stringify(context.techStack)}` : ''}

Identify additional STRIDE threats not covered by standard templates. Focus on business logic and integration risks.`;

    try {
      const response = await this.structuredAI.execute({
        schema: ThreatModelOutputSchema,
        systemPrompt,
        userPrompt,
        maxTokens: 3000,
        temperature: 0.1,
      });

      return response.data;
    } catch (error) {
      this.logger.error('AI threat generation failed', error);
      return { threats: [], summary: 'AI generation failed, using templates only' };
    }
  }

  private calculateOverallRisk(threats: ThreatModelOutput['threats']): number {
    if (threats.length === 0) return 0;

    const impactScores: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const likelihoodScores: Record<string, number> = { very_high: 5, high: 4, medium: 3, low: 2, very_low: 1 };

    let totalRisk = 0;
    for (const t of threats) {
      const impact = impactScores[t.impact] || 2;
      const likelihood = likelihoodScores[t.likelihood] || 3;
      totalRisk += (impact * likelihood) / 5;
    }

    return Math.min(10, Math.round((totalRisk / threats.length) * 2));
  }
}
