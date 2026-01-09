// apps/api/src/ai/providers/claude.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, CompletionRequest, CompletionResponse, StreamChunk, QuotaInfo } from '../interfaces/ai-provider.interface';

@Injectable()
export class ClaudeProvider implements AIProvider {
  private readonly logger = new Logger(ClaudeProvider.name);
  readonly name = 'claude' as const;
  readonly models = ['claude-sonnet-4-20250514', 'claude-haiku-3-20240307'];
  
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

  invalidateClient(): void { this.client = null; }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const client = this.getClient();
    let systemPrompt = request.systemPrompt || '';
    if (request.responseFormat === 'json') {
      systemPrompt += '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code fences.';
    }

    const response = await client.messages.create({
      model: request.model || this.defaultModel,
      max_tokens: request.maxTokens,
      temperature: request.temperature ?? 0,
      system: systemPrompt || undefined,
      messages: request.messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content
      }))
    });

    let content = response.content[0].type === 'text' ? response.content[0].text : '';
    if (request.responseFormat === 'json') content = this.cleanJson(content);

    return {
      content,
      model: response.model,
      provider: 'claude',
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'length'
    };
  }

  async *streamComplete(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const client = this.getClient();
    const stream = await client.messages.stream({
      model: request.model || this.defaultModel,
      max_tokens: request.maxTokens,
      temperature: request.temperature ?? 0,
      system: request.systemPrompt || undefined,
      messages: request.messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content }))
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
      await client.messages.create({ model: 'claude-haiku-3-20240307', max_tokens: 10, messages: [{ role: 'user', content: 'ping' }] });
      return true;
    } catch (e: any) {
      if (e?.status === 429 || e?.status === 529) return false;
      throw e;
    }
  }

  async getRemainingQuota(): Promise<QuotaInfo> {
    return { remainingTokens: null, resetAt: null, isExhausted: false };
  }

  private cleanJson(content: string): string {
    content = content.trim();
    if (content.startsWith('```json')) content = content.slice(7);
    else if (content.startsWith('```')) content = content.slice(3);
    if (content.endsWith('```')) content = content.slice(0, -3);
    return content.trim();
  }
}
