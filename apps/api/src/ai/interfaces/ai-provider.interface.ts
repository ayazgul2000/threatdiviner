// apps/api/src/ai/interfaces/ai-provider.interface.ts
// Provider-agnostic AI interface for Claude/Gemini failover

export interface AIProvider {
  readonly name: 'claude' | 'gemini';
  readonly models: string[];
  
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  streamComplete(request: CompletionRequest): AsyncIterable<StreamChunk>;
  isAvailable(): Promise<boolean>;
  getRemainingQuota(): Promise<QuotaInfo>;
}

export interface CompletionRequest {
  model?: string;
  messages: Message[];
  maxTokens: number;
  temperature?: number;
  responseFormat?: 'json' | 'text';
  systemPrompt?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CompletionResponse {
  content: string;
  model: string;
  provider: 'claude' | 'gemini';
  usage: { inputTokens: number; outputTokens: number };
  finishReason: 'stop' | 'length' | 'error';
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface QuotaInfo {
  remainingTokens: number | null;
  resetAt: Date | null;
  isExhausted: boolean;
}
