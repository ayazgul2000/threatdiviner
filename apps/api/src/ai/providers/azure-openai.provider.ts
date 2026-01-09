// apps/api/src/ai/providers/azure-openai.provider.ts
// Azure OpenAI provider implementation

import { Injectable, Logger } from '@nestjs/common';
import {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  QuotaInfo,
  ModelInfo,
  ConfigValidationResult,
  AzureOpenAIConfigSchema,
  ToolCall,
} from '../interfaces/ai-provider.interface';

interface AzureChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

interface AzureOpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: AzureChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class AzureOpenAIProvider implements AIProvider {
  private readonly logger = new Logger(AzureOpenAIProvider.name);

  readonly providerId = 'azure-openai';
  readonly name = 'azure-openai' as const;
  readonly displayName = 'Azure OpenAI';
  readonly configSchema = AzureOpenAIConfigSchema;

  // Azure model list depends on deployment, but common ones:
  readonly models: ModelInfo[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o (Azure)',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      inputPrice: 2.5,  // Azure pricing may vary
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
      id: 'gpt-4',
      name: 'GPT-4 (Azure)',
      contextWindow: 8192,
      maxOutputTokens: 4096,
      inputPrice: 30.0,
      outputPrice: 60.0,
      capabilities: {
        chat: true,
        completion: true,
        streaming: true,
        functionCalling: true,
        jsonMode: true,
        vision: false,
      },
    },
    {
      id: 'gpt-35-turbo',
      name: 'GPT-3.5 Turbo (Azure)',
      contextWindow: 16384,
      maxOutputTokens: 4096,
      inputPrice: 0.5,
      outputPrice: 1.5,
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

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const { endpoint, deploymentName, apiKey, apiVersion } = this.getConfig();
    const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    const messages = this.buildMessages(request);

    const body: any = {
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

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const data: AzureOpenAIResponse = await res.json();

    if (!res.ok) {
      const error = (data as any).error;
      throw new Error(error?.message || 'Azure OpenAI API error');
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
      provider: 'azure-openai',
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
    const { endpoint, deploymentName, apiKey, apiVersion } = this.getConfig();
    const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    const messages = this.buildMessages(request);

    const body: any = {
      messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature ?? 0,
      stream: true,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message || 'Azure OpenAI streaming error');
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
      this.getConfig(); // Validates config exists
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

    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;

    if (!endpoint) {
      errors.push('AZURE_OPENAI_ENDPOINT environment variable is not set');
    } else if (!endpoint.startsWith('https://')) {
      warnings.push('Azure endpoint should use HTTPS');
    }

    if (!deploymentName) {
      errors.push('AZURE_OPENAI_DEPLOYMENT_NAME environment variable is not set');
    }

    if (!apiKey) {
      errors.push('AZURE_OPENAI_API_KEY environment variable is not set');
    }

    if (errors.length === 0) {
      try {
        const available = await this.isAvailable();
        if (!available) {
          errors.push('Unable to connect to Azure OpenAI API');
        }
      } catch (e: any) {
        errors.push(`Connection test failed: ${e.message}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private getConfig(): { endpoint: string; deploymentName: string; apiKey: string; apiVersion: string } {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

    if (!endpoint) throw new Error('AZURE_OPENAI_ENDPOINT not configured');
    if (!deploymentName) throw new Error('AZURE_OPENAI_DEPLOYMENT_NAME not configured');
    if (!apiKey) throw new Error('AZURE_OPENAI_API_KEY not configured');

    return { endpoint, deploymentName, apiKey, apiVersion };
  }

  private buildMessages(request: CompletionRequest): AzureChatMessage[] {
    const messages: AzureChatMessage[] = [];

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
