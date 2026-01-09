// apps/api/src/ai/ai.service.ts
// Main AI service with Claude → Gemini failover + legacy compatibility

import { Injectable, Logger } from '@nestjs/common';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { AIProvider, CompletionRequest, CompletionResponse, StreamChunk } from './interfaces/ai-provider.interface';

// Legacy interfaces for backward compatibility with fix.service.ts
export interface TriageRequest {
  finding: {
    id: string;
    ruleId: string;
    title: string;
    description: string;
    severity: string;
    filePath: string;
    startLine: number;
    snippet?: string;
    cweId?: string;
  };
}

export interface TriageResult {
  analysis: string;
  confidence: number;
  suggestedSeverity?: string;
  isLikelyFalsePositive: boolean;
  exploitability: string;
  remediation: string;
}

export interface AutoFixRequest {
  finding: {
    ruleId: string;
    title: string;
    description: string;
    severity: string;
    filePath: string;
    startLine: number;
    endLine?: number;
    snippet?: string;
    cweId?: string;
  };
  fileContent: string;
}

export interface AutoFixResult {
  fixedCode: string;
  explanation: string;
  confidence: number;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private providers: AIProvider[];
  private currentProviderIndex = 0;

  constructor(
    private readonly claude: ClaudeProvider,
    private readonly gemini: GeminiProvider,
  ) {
    this.providers = [claude, gemini];
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startIndex = this.currentProviderIndex;
    let lastError: Error | null = null;

    for (let i = 0; i < this.providers.length; i++) {
      const providerIndex = (startIndex + i) % this.providers.length;
      const provider = this.providers[providerIndex];

      try {
        if (!(await provider.isAvailable())) {
          this.logger.warn(`Provider ${provider.name} unavailable, trying next`);
          continue;
        }

        const response = await provider.complete(request);
        this.currentProviderIndex = providerIndex;
        return response;
      } catch (error: any) {
        lastError = error;
        this.logger.error(`Provider ${provider.name} failed: ${error.message}`);
        if (error?.status === 429 || error?.status === 529) continue;
        throw error;
      }
    }

    throw lastError || new Error('All AI providers failed');
  }

  async *streamComplete(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const provider = this.providers[this.currentProviderIndex];
    yield* provider.streamComplete(request);
  }

  getCurrentProvider(): string {
    return this.providers[this.currentProviderIndex].name;
  }

  // Check if AI service is available
  async isAvailable(): Promise<boolean> {
    try {
      return await this.providers[this.currentProviderIndex].isAvailable();
    } catch {
      return false;
    }
  }

  // Batch triage multiple findings - returns Map<findingId, result>
  async batchTriageFindings(requests: TriageRequest[]): Promise<Map<string, TriageResult>> {
    const results = new Map<string, TriageResult>();
    for (const req of requests) {
      const result = await this.triageFinding(req);
      if (result) {
        results.set(req.finding.id, result);
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }
    return results;
  }

  // Legacy method for fix.service.ts compatibility
  async triageFinding(request: TriageRequest): Promise<TriageResult | null> {
    try {
      const response = await this.complete({
        systemPrompt: `You are a security expert triaging vulnerability findings. Analyze and respond with JSON only.`,
        messages: [{
          role: 'user',
          content: `Triage this finding:
Title: ${request.finding.title}
Rule: ${request.finding.ruleId}
Severity: ${request.finding.severity}
File: ${request.finding.filePath}:${request.finding.startLine}
CWE: ${request.finding.cweId || 'Unknown'}
Description: ${request.finding.description}
${request.finding.snippet ? `Code:\n${request.finding.snippet}` : ''}

Respond with JSON: { "analysis": "...", "confidence": 0.0-1.0, "suggestedSeverity": "...", "isLikelyFalsePositive": boolean, "exploitability": "low|medium|high", "remediation": "..." }`
        }],
        maxTokens: 800,
        responseFormat: 'json',
      });

      return JSON.parse(response.content);
    } catch (e) {
      this.logger.error('Triage failed', e);
      return null;
    }
  }

  // Legacy method for fix.service.ts compatibility
  async generateAutoFix(request: AutoFixRequest): Promise<AutoFixResult | null> {
    try {
      const response = await this.complete({
        systemPrompt: `You are a security engineer generating code fixes. Respond with JSON only.`,
        messages: [{
          role: 'user',
          content: `Generate a fix for this vulnerability:
Title: ${request.finding.title}
Rule: ${request.finding.ruleId}
File: ${request.finding.filePath}
Lines: ${request.finding.startLine}-${request.finding.endLine || request.finding.startLine}
CWE: ${request.finding.cweId || 'Unknown'}

Vulnerable code snippet:
${request.finding.snippet || 'Not provided'}

Full file content (for context):
${request.fileContent.substring(0, 3000)}

Respond with JSON: { "fixedCode": "...", "explanation": "...", "confidence": 0.0-1.0 }`
        }],
        maxTokens: 1500,
        responseFormat: 'json',
      });

      return JSON.parse(response.content);
    } catch (e) {
      this.logger.error('Auto-fix generation failed', e);
      return null;
    }
  }
}
