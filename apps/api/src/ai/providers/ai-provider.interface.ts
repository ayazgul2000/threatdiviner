/**
 * AI Provider Interface
 * Defines the contract for AI providers (Claude, Gemini, etc.)
 */

export interface TriageRequest {
  finding: {
    id: string;
    title: string;
    description: string;
    severity: string;
    ruleId: string;
    filePath: string;
    startLine: number;
    endLine?: number;
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
  language?: string;
}

export interface AutoFixResult {
  fixedCode: string;
  explanation: string;
  confidence: number; // 0-1
}

export interface AiProviderInterface {
  /**
   * Provider name (e.g., 'claude', 'gemini')
   */
  readonly name: string;

  /**
   * Check if the provider is available (API key configured, etc.)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Triage a security finding
   */
  triageFinding(request: TriageRequest): Promise<TriageResult | null>;

  /**
   * Generate an auto-fix for a vulnerability
   */
  generateFix(request: AutoFixRequest): Promise<AutoFixResult | null>;
}

/**
 * Configuration for AI providers
 */
export interface AiProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}
