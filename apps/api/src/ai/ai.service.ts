import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import {
  AiProviderInterface,
  TriageRequest,
  TriageResult,
  AutoFixRequest,
  AutoFixResult,
} from './providers/ai-provider.interface';

// Re-export interfaces for backward compatibility
export {
  TriageRequest,
  TriageResult,
  AutoFixRequest,
  AutoFixResult,
} from './providers/ai-provider.interface';

/**
 * Extended result that includes provider source information
 */
export interface TriageResultWithSource extends TriageResult {
  source: string; // 'claude' | 'gemini'
}

export interface AutoFixResultWithSource extends AutoFixResult {
  source: string; // 'claude' | 'gemini'
}

/**
 * Configuration for AI service behavior
 */
export interface AiServiceConfig {
  /** Minimum confidence threshold for fallback (default: 0.6) */
  fallbackThreshold: number;
  /** Minimum confidence to post suggestions (default: 0.8) */
  suggestionThreshold: number;
  /** Maximum concurrent batch requests (default: 5) */
  batchSize: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly providers: AiProviderInterface[] = [];
  private readonly config: AiServiceConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly claudeProvider: ClaudeProvider,
    private readonly geminiProvider: GeminiProvider,
  ) {
    // Register providers in priority order (Claude first, Gemini fallback)
    this.providers = [this.claudeProvider, this.geminiProvider];

    // Load configuration
    this.config = {
      fallbackThreshold: this.configService.get('AI_FALLBACK_THRESHOLD', 0.6),
      suggestionThreshold: this.configService.get('AI_SUGGESTION_THRESHOLD', 0.8),
      batchSize: this.configService.get('AI_BATCH_SIZE', 5),
    };

    this.logger.log(`AI Service initialized with ${this.providers.length} providers`);
  }

  /**
   * Check if any AI provider is available
   */
  async isAvailable(): Promise<boolean> {
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get list of available providers
   */
  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        available.push(provider.name);
      }
    }
    return available;
  }

  /**
   * Triage a finding using AI with automatic fallback
   *
   * Strategy:
   * 1. Try primary provider (Claude)
   * 2. If fails or low confidence (<0.6), try secondary (Gemini)
   * 3. Return best result or null
   */
  async triageFinding(request: TriageRequest): Promise<TriageResult | null> {
    const result = await this.triageFindingWithSource(request);
    return result; // TriageResultWithSource extends TriageResult
  }

  /**
   * Triage with source tracking (for debugging/analytics)
   */
  async triageFindingWithSource(request: TriageRequest): Promise<TriageResultWithSource | null> {
    for (const provider of this.providers) {
      if (!(await provider.isAvailable())) {
        this.logger.debug(`Provider ${provider.name} not available, skipping`);
        continue;
      }

      try {
        this.logger.debug(`Trying ${provider.name} for triage`);
        const result = await provider.triageFinding(request);

        if (result) {
          // Check if confidence meets threshold or if this is the last provider
          if (result.confidence >= this.config.fallbackThreshold) {
            this.logger.log(`${provider.name} triage succeeded with confidence ${result.confidence}`);
            return { ...result, source: provider.name };
          } else {
            this.logger.debug(
              `${provider.name} confidence ${result.confidence} below threshold ${this.config.fallbackThreshold}, trying fallback`
            );
          }
        }
      } catch (error) {
        this.logger.error(`${provider.name} triage failed: ${error}`);
      }
    }

    this.logger.warn('All AI providers failed for triage');
    return null;
  }

  /**
   * Generate auto-fix using AI with automatic fallback
   */
  async generateAutoFix(request: AutoFixRequest): Promise<AutoFixResult | null> {
    const result = await this.generateAutoFixWithSource(request);
    return result;
  }

  /**
   * Generate fix with source tracking
   */
  async generateAutoFixWithSource(request: AutoFixRequest): Promise<AutoFixResultWithSource | null> {
    for (const provider of this.providers) {
      if (!(await provider.isAvailable())) {
        this.logger.debug(`Provider ${provider.name} not available, skipping`);
        continue;
      }

      try {
        this.logger.debug(`Trying ${provider.name} for auto-fix`);
        const result = await provider.generateFix(request);

        if (result && result.fixedCode) {
          // Check if confidence meets threshold
          if (result.confidence >= this.config.fallbackThreshold) {
            this.logger.log(`${provider.name} auto-fix succeeded with confidence ${result.confidence}`);
            return { ...result, source: provider.name };
          } else {
            this.logger.debug(
              `${provider.name} confidence ${result.confidence} below threshold, trying fallback`
            );
          }
        }
      } catch (error) {
        this.logger.error(`${provider.name} auto-fix failed: ${error}`);
      }
    }

    this.logger.warn('All AI providers failed for auto-fix');
    return null;
  }

  /**
   * Batch triage multiple findings
   */
  async batchTriageFindings(requests: TriageRequest[]): Promise<Map<string, TriageResult | null>> {
    const results = new Map<string, TriageResult | null>();

    // Process in parallel with rate limiting
    for (let i = 0; i < requests.length; i += this.config.batchSize) {
      const batch = requests.slice(i, i + this.config.batchSize);
      const batchResults = await Promise.all(
        batch.map(async (req) => ({
          id: req.finding.id,
          result: await this.triageFinding(req),
        })),
      );

      for (const { id, result } of batchResults) {
        results.set(id, result);
      }

      // Small delay between batches to avoid rate limiting
      if (i + this.config.batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Batch generate fixes for multiple findings
   */
  async batchGenerateFixes(requests: AutoFixRequest[]): Promise<Map<string, AutoFixResult | null>> {
    const results = new Map<string, AutoFixResult | null>();

    for (let i = 0; i < requests.length; i += this.config.batchSize) {
      const batch = requests.slice(i, i + this.config.batchSize);
      const batchResults = await Promise.all(
        batch.map(async (req) => ({
          id: req.finding.ruleId, // Use ruleId as key for fixes
          result: await this.generateAutoFix(req),
        })),
      );

      for (const { id, result } of batchResults) {
        results.set(id, result);
      }

      if (i + this.config.batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Check if a fix result meets the suggestion threshold
   */
  meetsSuggestionThreshold(result: AutoFixResult): boolean {
    return result.confidence >= this.config.suggestionThreshold;
  }

  /**
   * Get the current configuration
   */
  getConfig(): AiServiceConfig {
    return { ...this.config };
  }
}
