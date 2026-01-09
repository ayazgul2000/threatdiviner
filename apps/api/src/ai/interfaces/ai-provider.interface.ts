// apps/api/src/ai/interfaces/ai-provider.interface.ts
// Provider-agnostic AI interface with enhanced configuration support

import { z } from 'zod';

export type ProviderName = 'claude' | 'gemini' | 'openai' | 'azure-openai' | 'bedrock' | 'ollama';

export interface AIProvider {
  readonly providerId: string;
  readonly name: ProviderName;
  readonly displayName: string;
  readonly models: ModelInfo[];
  readonly configSchema: z.ZodSchema;

  complete(request: CompletionRequest): Promise<CompletionResponse>;
  streamComplete(request: CompletionRequest): AsyncIterable<StreamChunk>;
  isAvailable(): Promise<boolean>;
  getRemainingQuota(): Promise<QuotaInfo>;
  validateConfig(): Promise<ConfigValidationResult>;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputPrice: number;  // per 1M tokens
  outputPrice: number; // per 1M tokens
  capabilities: ModelCapabilities;
}

export interface ModelCapabilities {
  chat: boolean;
  completion: boolean;
  streaming: boolean;
  functionCalling: boolean;
  jsonMode: boolean;
  vision: boolean;
}

export interface CompletionRequest {
  model?: string;
  messages: Message[];
  maxTokens: number;
  temperature?: number;
  responseFormat?: 'json' | 'text';
  systemPrompt?: string;
  stopSequences?: string[];
  topP?: number;
  tools?: Tool[];
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
}

export interface MessageContent {
  type: 'text' | 'image';
  text?: string;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
}

export interface CompletionResponse {
  content: string;
  model: string;
  provider: ProviderName;
  usage: TokenUsage;
  finishReason: FinishReason;
  toolCalls?: ToolCall[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';

export interface StreamChunk {
  content: string;
  done: boolean;
  toolCall?: Partial<ToolCall>;
}

export interface QuotaInfo {
  remainingTokens: number | null;
  resetAt: Date | null;
  isExhausted: boolean;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Provider configuration schemas
export const ClaudeConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  defaultModel: z.string().default('claude-sonnet-4-20250514'),
  maxRetries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(1000).max(300000).default(60000),
});

export const GeminiConfigSchema = z.object({
  apiKey: z.string().min(1),
  defaultModel: z.string().default('gemini-1.5-pro'),
  maxRetries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(1000).max(300000).default(60000),
});

export const OpenAIConfigSchema = z.object({
  apiKey: z.string().min(1),
  organization: z.string().optional(),
  baseUrl: z.string().url().optional(),
  defaultModel: z.string().default('gpt-4o'),
  maxRetries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(1000).max(300000).default(60000),
});

export const AzureOpenAIConfigSchema = z.object({
  apiKey: z.string().min(1),
  endpoint: z.string().url(),
  deploymentName: z.string().min(1),
  apiVersion: z.string().default('2024-02-15-preview'),
  maxRetries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(1000).max(300000).default(60000),
});

export const BedrockConfigSchema = z.object({
  region: z.string().min(1),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  sessionToken: z.string().optional(),
  profile: z.string().optional(),
  defaultModel: z.string().default('anthropic.claude-3-sonnet-20240229-v1:0'),
  maxRetries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(1000).max(300000).default(60000),
});

export const OllamaConfigSchema = z.object({
  baseUrl: z.string().url().default('http://localhost:11434'),
  defaultModel: z.string().default('llama3'),
  timeout: z.number().int().min(1000).max(600000).default(120000),
});

export type ClaudeConfig = z.infer<typeof ClaudeConfigSchema>;
export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;
export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;
export type AzureOpenAIConfig = z.infer<typeof AzureOpenAIConfigSchema>;
export type BedrockConfig = z.infer<typeof BedrockConfigSchema>;
export type OllamaConfig = z.infer<typeof OllamaConfigSchema>;

export type ProviderConfig = ClaudeConfig | GeminiConfig | OpenAIConfig | AzureOpenAIConfig | BedrockConfig | OllamaConfig;
