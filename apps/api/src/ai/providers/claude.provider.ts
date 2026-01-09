// apps/api/src/ai/providers/claude.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  QuotaInfo,
  ModelInfo,
  ConfigValidationResult,
  ClaudeConfigSchema,
} from '../interfaces/ai-provider.interface';
import { z } from 'zod';

@Injectable()
export class ClaudeProvider implements AIProvider {
  private readonly logger = new Logger(ClaudeProvider.name);

  readonly providerId = 'claude-anthropic';
  readonly name = 'claude' as const;
  readonly displayName = 'Anthropic Claude';
  readonly configSchema = ClaudeConfigSchema;

  readonly models: ModelInfo[] = [
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      inputPrice: 3.0,
      outputPrice: 15.0,
      capabilities: {
        chat: true,
        completion: true,
        streaming: true,
        functionCalling: true,
        jsonMode: true,
        vision: true,
      },
    },
    {
      id: 'claude-haiku-3-20240307',
      name: 'Claude Haiku 3',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      inputPrice: 0.25,
      outputPrice: 1.25,
      capabilities: {
        chat: true,
        completion: true,
        streaming: true,
        functionCalling: true,
        jsonMode: true,
        vision: true,
      },
    },
    {
      id: 'claude-opus-4-20250514',
      name: 'Claude Opus 4',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      inputPrice: 15.0,
      outputPrice: 75.0,
      capabilities: {
        chat: true,
        completion: true,
        streaming: true,
        functionCalling: true,
        jsonMode: true,
        vision: true,
      },
    },
  ];

  private client: Anthropic | null = null;
  private defaultModel = 'claude-sonnet-4-20250514';

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  invalidateClient(): void {
    this.client = null;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const client = this.getClient();
    let systemPrompt = request.systemPrompt || '';
    if (request.responseFormat === 'json') {
      systemPrompt += '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code fences.';
    }

    // Handle message content - extract text if it's an array
    const messages = request.messages.map(m => ({
      role: m.role === 'system' ? 'user' as const : m.role as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : this.extractTextContent(m.content),
    }));

    const response = await client.messages.create({
      model: request.model || this.defaultModel,
      max_tokens: request.maxTokens,
      temperature: request.temperature ?? 0,
      system: systemPrompt || undefined,
      messages,
      ...(request.stopSequences && { stop_sequences: request.stopSequences }),
      ...(request.topP !== undefined && { top_p: request.topP }),
    });

    let content = response.content[0].type === 'text' ? response.content[0].text : '';
    if (request.responseFormat === 'json') content = this.cleanJson(content);

    return {
      content,
      model: response.model,
      provider: 'claude',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: this.mapFinishReason(response.stop_reason),
    };
  }

  async *streamComplete(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const client = this.getClient();

    const messages = request.messages.map(m => ({
      role: m.role === 'system' ? 'user' as const : m.role as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : this.extractTextContent(m.content),
    }));

    const stream = await client.messages.stream({
      model: request.model || this.defaultModel,
      max_tokens: request.maxTokens,
      temperature: request.temperature ?? 0,
      system: request.systemPrompt || undefined,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { content: event.delta.text, done: false };
      }
    }
    yield { content: '', done: true };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.messages.create({
        model: 'claude-haiku-3-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch (e: any) {
      if (e?.status === 429 || e?.status === 529) return false;
      if (e?.status === 401) return false;
      throw e;
    }
  }

  async getRemainingQuota(): Promise<QuotaInfo> {
    return { remainingTokens: null, resetAt: null, isExhausted: false };
  }

  async validateConfig(): Promise<ConfigValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      errors.push('ANTHROPIC_API_KEY environment variable is not set');
    } else if (!apiKey.startsWith('sk-ant-')) {
      warnings.push('API key does not match expected Anthropic format');
    }

    if (errors.length === 0) {
      try {
        const available = await this.isAvailable();
        if (!available) {
          errors.push('Unable to connect to Anthropic API');
        }
      } catch (e: any) {
        errors.push(`Connection test failed: ${e.message}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private extractTextContent(content: any[]): string {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }

  private mapFinishReason(reason: string | null): 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  private cleanJson(content: string): string {
    content = content.trim();
    if (content.startsWith('```json')) content = content.slice(7);
    else if (content.startsWith('```')) content = content.slice(3);
    if (content.endsWith('```')) content = content.slice(0, -3);
    return content.trim();
  }
}
