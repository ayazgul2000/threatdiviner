import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface TriageRequest {
  finding: {
    id: string;
    title: string;
    description: string;
    severity: string;
    ruleId: string;
    filePath: string;
    startLine: number;
    snippet?: string;
    cweId?: string;
  };
  codeContext?: string;
  repositoryContext?: {
    name: string;
    language: string;
    framework?: string;
  };
}

export interface TriageResult {
  analysis: string;
  suggestedSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  isLikelyFalsePositive: boolean;
  confidence: number; // 0-1
  exploitability: 'easy' | 'moderate' | 'difficult' | 'unlikely';
  remediation: string;
  references: string[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log('Anthropic AI client initialized');
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not configured - AI triage disabled');
    }
    this.model = this.configService.get('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514');
  }

  async isAvailable(): Promise<boolean> {
    return this.client !== null;
  }

  async triageFinding(request: TriageRequest): Promise<TriageResult | null> {
    if (!this.client) {
      this.logger.warn('AI triage not available - API key not configured');
      return null;
    }

    try {
      const prompt = this.buildTriagePrompt(request);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return this.parseTriageResponse(content.text);
    } catch (error) {
      this.logger.error(`AI triage failed: ${error}`);
      return null;
    }
  }

  async batchTriageFindings(requests: TriageRequest[]): Promise<Map<string, TriageResult | null>> {
    const results = new Map<string, TriageResult | null>();

    // Process in parallel with rate limiting (max 5 concurrent)
    const batchSize = 5;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (req) => ({
          id: req.finding.id,
          result: await this.triageFinding(req),
        })),
      );

      for (const { id, result } of batchResults) {
        results.set(id, result);
      }
    }

    return results;
  }

  private buildTriagePrompt(request: TriageRequest): string {
    const { finding, codeContext, repositoryContext } = request;

    let prompt = `You are a security expert analyzing a vulnerability finding from a security scanner.

## Finding Details
- **Title**: ${finding.title}
- **Description**: ${finding.description}
- **Severity**: ${finding.severity}
- **Rule ID**: ${finding.ruleId}
- **File**: ${finding.filePath}:${finding.startLine}
${finding.cweId ? `- **CWE**: ${finding.cweId}` : ''}
`;

    if (finding.snippet) {
      prompt += `
## Code Snippet
\`\`\`
${finding.snippet}
\`\`\`
`;
    }

    if (codeContext) {
      prompt += `
## Additional Code Context
\`\`\`
${codeContext}
\`\`\`
`;
    }

    if (repositoryContext) {
      prompt += `
## Repository Context
- **Name**: ${repositoryContext.name}
- **Primary Language**: ${repositoryContext.language}
${repositoryContext.framework ? `- **Framework**: ${repositoryContext.framework}` : ''}
`;
    }

    prompt += `
## Your Task
Analyze this finding and provide:
1. **Analysis**: A concise explanation of the vulnerability, its potential impact, and whether it's likely a true positive or false positive
2. **Suggested Severity**: Your assessment of the true severity (critical/high/medium/low/info)
3. **Is False Positive**: Whether this is likely a false positive (true/false)
4. **Confidence**: Your confidence level in this assessment (0-1)
5. **Exploitability**: How easy it would be to exploit (easy/moderate/difficult/unlikely)
6. **Remediation**: Specific steps to fix this issue
7. **References**: Relevant documentation or resources

Respond in this exact JSON format:
{
  "analysis": "Your detailed analysis here",
  "suggestedSeverity": "high",
  "isLikelyFalsePositive": false,
  "confidence": 0.85,
  "exploitability": "moderate",
  "remediation": "Specific fix instructions",
  "references": ["https://example.com/reference"]
}`;

    return prompt;
  }

  private parseTriageResponse(text: string): TriageResult {
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize the response
    return {
      analysis: String(parsed.analysis || 'No analysis provided'),
      suggestedSeverity: this.normalizeSeverity(parsed.suggestedSeverity),
      isLikelyFalsePositive: Boolean(parsed.isLikelyFalsePositive),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      exploitability: this.normalizeExploitability(parsed.exploitability),
      remediation: String(parsed.remediation || 'No remediation provided'),
      references: Array.isArray(parsed.references) ? parsed.references.map(String) : [],
    };
  }

  private normalizeSeverity(severity: string): TriageResult['suggestedSeverity'] {
    const normalized = String(severity).toLowerCase();
    if (['critical', 'high', 'medium', 'low', 'info'].includes(normalized)) {
      return normalized as TriageResult['suggestedSeverity'];
    }
    return 'medium';
  }

  private normalizeExploitability(exploitability: string): TriageResult['exploitability'] {
    const normalized = String(exploitability).toLowerCase();
    if (['easy', 'moderate', 'difficult', 'unlikely'].includes(normalized)) {
      return normalized as TriageResult['exploitability'];
    }
    return 'moderate';
  }
}
