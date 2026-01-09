// apps/api/src/ai/providers/openai.provider.ts
// OpenAI provider implementation

import { Injectable, Logger } from '@nestjs/common';
import {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  QuotaInfo,
  ModelInfo,
  ConfigValidationResult,
  OpenAIConfigSchema,
  ToolCall,
} from '../interfaces/ai-provider.interface';

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class OpenAIProvider implements AIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);

  readonly providerId = 'openai';
  readonly name = 'openai' as const;
  readonly displayName = 'OpenAI';
  readonly configSchema = OpenAIConfigSchema;

  readonly models: ModelInfo[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      inputPrice: 2.5,
      outputPrice: 10.0,
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
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      inputPrice: 0.15,
      outputPrice: 0.6,
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
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      inputPrice: 10.0,
      outputPrice: 30.0,
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
      id: 'o1',
      name: 'o1',
      contextWindow: 200000,
      maxOutputTokens: 100000,
      inputPrice: 15.0,
      outputPrice: 60.0,
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
      id: 'o1-mini',
      name: 'o1-mini',
      contextWindow: 128000,
      maxOutputTokens: 65536,
      inputPrice: 3.0,
      outputPrice: 12.0,
      capabilities: {
        chat: true,
        completion: true,
        streaming: true,
        functionCalling: true,
        jsonMode: true,
        vision: false,
      },
    },
  ];

  private defaultModel = 'gpt-4o';
  private baseUrl = 'https://api.openai.com/v1';

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const model = request.model || this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    const messages = this.buildMessages(request);

    const body: any = {
      model,
      messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature ?? 0,
      ...(request.topP !== undefined && { top_p: request.topP }),
      ...(request.stopSequences && { stop: request.stopSequences }),
    };

    // Add response format for JSON mode
    if (request.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    // Add tools if provided
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    const organization = process.env.OPENAI_ORGANIZATION;
    if (organization) {
      headers['OpenAI-Organization'] = organization;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data: OpenAIResponse = await res.json();

    if (!res.ok) {
      const error = (data as any).error;
      throw new Error(error?.message || 'OpenAI API error');
    }

    const choice = data.choices[0];
    const content = choice.message.content || '';

    // Extract tool calls if present
    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    return {
      content: request.responseFormat === 'json' ? this.cleanJson(content) : content,
      model: data.model,
      provider: 'openai',
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      finishReason: this.mapFinishReason(choice.finish_reason),
      toolCalls,
    };
  }

  async *streamComplete(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const model = request.model || this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    const messages = this.buildMessages(request);

    const body: any = {
      model,
      messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature ?? 0,
      stream: true,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    const organization = process.env.OPENAI_ORGANIZATION;
    if (organization) {
      headers['OpenAI-Organization'] = organization;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message || 'OpenAI streaming error');
    }

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
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          yield { content: '', done: true };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            yield { content: delta, done: false };
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
        model: 'gpt-4o-mini',
      });
      return true;
    } catch {
      return false;
    }
  }

  async getRemainingQuota(): Promise<QuotaInfo> {
    // OpenAI doesn't expose quota in API responses
    return { remainingTokens: null, resetAt: null, isExhausted: false };
  }

  async validateConfig(): Promise<ConfigValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      errors.push('OPENAI_API_KEY environment variable is not set');
    } else if (!apiKey.startsWith('sk-')) {
      warnings.push('API key does not match expected OpenAI format');
    }

    if (errors.length === 0) {
      try {
        const available = await this.isAvailable();
        if (!available) {
          errors.push('Unable to connect to OpenAI API');
        }
      } catch (e: any) {
        errors.push(`Connection test failed: ${e.message}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private buildMessages(request: CompletionRequest): OpenAIChatMessage[] {
    const messages: OpenAIChatMessage[] = [];

    // Add system prompt if provided
    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt,
      });
    }

    // Add conversation messages
    for (const msg of request.messages) {
      const content = typeof msg.content === 'string' ? msg.content : this.extractTextContent(msg.content);
      messages.push({
        role: msg.role as 'system' | 'user' | 'assistant',
        content,
      });
    }

    return messages;
  }

  private extractTextContent(content: any[]): string {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }

  private mapFinishReason(reason: string): 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
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
    else if (content.startsWith('```')) content = content.slice(content.indexOf('\n') + 1);
    if (content.endsWith('```')) content = content.slice(0, -3);
    return content.trim();
  }
}
