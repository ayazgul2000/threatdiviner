// apps/api/src/ai/providers/gemini.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { AIProvider, CompletionRequest, CompletionResponse, StreamChunk, QuotaInfo } from '../interfaces/ai-provider.interface';

@Injectable()
export class GeminiProvider implements AIProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  readonly name = 'gemini' as const;
  readonly models = ['gemini-1.5-pro', 'gemini-1.5-flash'];
  private defaultModel = 'gemini-1.5-pro';

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${request.model || this.defaultModel}:generateContent?key=${apiKey}`;
    
    const systemPrompt = request.systemPrompt || '';
    const lastMsg = request.messages[request.messages.length - 1];
    const prompt = systemPrompt ? `${systemPrompt}\n\n${lastMsg.content}` : lastMsg.content;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: request.maxTokens,
        temperature: request.temperature ?? 0,
        responseMimeType: request.responseFormat === 'json' ? 'application/json' : 'text/plain'
      }
    };

    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error?.message || 'Gemini API error');

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      content: request.responseFormat === 'json' ? this.cleanJson(content) : content,
      model: request.model || this.defaultModel,
      provider: 'gemini',
      usage: { inputTokens: data.usageMetadata?.promptTokenCount || 0, outputTokens: data.usageMetadata?.candidatesTokenCount || 0 },
      finishReason: 'stop'
    };
  }

  async *streamComplete(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const response = await this.complete(request);
    yield { content: response.content, done: true };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.complete({ messages: [{ role: 'user', content: 'ping' }], maxTokens: 10 });
      return true;
    } catch { return false; }
  }

  async getRemainingQuota(): Promise<QuotaInfo> {
    return { remainingTokens: null, resetAt: null, isExhausted: false };
  }

  private cleanJson(content: string): string {
    content = content.trim();
    if (content.startsWith('```')) content = content.slice(content.indexOf('\n') + 1);
    if (content.endsWith('```')) content = content.slice(0, -3);
    return content.trim();
  }
}
