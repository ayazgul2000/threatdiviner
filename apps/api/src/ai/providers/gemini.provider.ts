// apps/api/src/ai/providers/gemini.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  QuotaInfo,
  ModelInfo,
  ConfigValidationResult,
  GeminiConfigSchema,
} from '../interfaces/ai-provider.interface';

@Injectable()
export class GeminiProvider implements AIProvider {
  private readonly logger = new Logger(GeminiProvider.name);

  readonly providerId = 'gemini-google';
  readonly name = 'gemini' as const;
  readonly displayName = 'Google Gemini';
  readonly configSchema = GeminiConfigSchema;

  readonly models: ModelInfo[] = [
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      contextWindow: 2000000,
      maxOutputTokens: 8192,
      inputPrice: 3.5,
      outputPrice: 10.5,
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
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      inputPrice: 0.35,
      outputPrice: 1.05,
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
      id: 'gemini-2.0-flash-exp',
      name: 'Gemini 2.0 Flash (Experimental)',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      inputPrice: 0.0,
      outputPrice: 0.0,
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

  private defaultModel = 'gemini-1.5-pro';

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const model = request.model || this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Build conversation history for multi-turn
    const contents = this.buildContents(request);

    const body: any = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens,
        temperature: request.temperature ?? 0,
        ...(request.topP !== undefined && { topP: request.topP }),
        ...(request.stopSequences && { stopSequences: request.stopSequences }),
        ...(request.responseFormat === 'json' && { responseMimeType: 'application/json' }),
      },
    };

    // Add system instruction if provided
    if (request.systemPrompt) {
      body.systemInstruction = { parts: [{ text: request.systemPrompt }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      const errorMessage = data.error?.message || 'Gemini API error';
      throw new Error(errorMessage);
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const finishReason = this.mapFinishReason(data.candidates?.[0]?.finishReason);

    return {
      content: request.responseFormat === 'json' ? this.cleanJson(content) : content,
      model,
      provider: 'gemini',
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
      finishReason,
    };
  }

  async *streamComplete(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const model = request.model || this.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;

    const contents = this.buildContents(request);

    const body: any = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens,
        temperature: request.temperature ?? 0,
      },
    };

    if (request.systemPrompt) {
      body.systemInstruction = { parts: [{ text: request.systemPrompt }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message || 'Gemini streaming error');
    }

    // Gemini returns newline-delimited JSON
    const reader = res.body?.getReader();
    if (!reader) {
      yield { content: '', done: true };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) {
            yield { content: text, done: false };
          }
        } catch {
          // Ignore parse errors in stream
        }
      }
    }

    yield { content: '', done: true };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.complete({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }

  async getRemainingQuota(): Promise<QuotaInfo> {
    return { remainingTokens: null, resetAt: null, isExhausted: false };
  }

  async validateConfig(): Promise<ConfigValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      errors.push('GEMINI_API_KEY environment variable is not set');
    }

    if (errors.length === 0) {
      try {
        const available = await this.isAvailable();
        if (!available) {
          errors.push('Unable to connect to Gemini API');
        }
      } catch (e: any) {
        errors.push(`Connection test failed: ${e.message}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private buildContents(request: CompletionRequest): any[] {
    return request.messages.map(m => {
      const content = typeof m.content === 'string' ? m.content : this.extractTextContent(m.content);
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: content }],
      };
    });
  }

  private extractTextContent(content: any[]): string {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }

  private mapFinishReason(reason: string | undefined): 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      case 'RECITATION':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  private cleanJson(content: string): string {
    content = content.trim();
    if (content.startsWith('```json')) content = content.slice(7);
    else if (content.startsWith('```')) content = content.slice(content.indexOf('\n') + 1);
    if (content.endsWith('```')) content = content.slice(0, -3);
    return content.trim();
  }
}
