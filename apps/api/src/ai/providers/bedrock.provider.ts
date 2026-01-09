// apps/api/src/ai/providers/bedrock.provider.ts
// AWS Bedrock provider implementation (Claude via AWS)

import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  AIProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  QuotaInfo,
  ModelInfo,
  ConfigValidationResult,
  BedrockConfigSchema,
} from '../interfaces/ai-provider.interface';

interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface BedrockClaudeRequest {
  anthropic_version: string;
  max_tokens: number;
  messages: BedrockMessage[];
  system?: string;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
}

interface BedrockClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

@Injectable()
export class BedrockProvider implements AIProvider {
  private readonly logger = new Logger(BedrockProvider.name);

  readonly providerId = 'bedrock-aws';
  readonly name = 'bedrock' as const;
  readonly displayName = 'AWS Bedrock (Claude)';
  readonly configSchema = BedrockConfigSchema;

  readonly models: ModelInfo[] = [
    {
      id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      name: 'Claude 3.5 Sonnet v2 (Bedrock)',
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
      id: 'anthropic.claude-3-sonnet-20240229-v1:0',
      name: 'Claude 3 Sonnet (Bedrock)',
      contextWindow: 200000,
      maxOutputTokens: 4096,
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
      id: 'anthropic.claude-3-haiku-20240307-v1:0',
      name: 'Claude 3 Haiku (Bedrock)',
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
      id: 'amazon.titan-text-premier-v1:0',
      name: 'Amazon Titan Text Premier',
      contextWindow: 32000,
      maxOutputTokens: 8192,
      inputPrice: 0.5,
      outputPrice: 1.5,
      capabilities: {
        chat: true,
        completion: true,
        streaming: true,
        functionCalling: false,
        jsonMode: false,
        vision: false,
      },
    },
  ];

  private defaultModel = 'anthropic.claude-3-sonnet-20240229-v1:0';

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const config = this.getConfig();
    const model = request.model || this.defaultModel;

    // Determine if this is a Claude model or Titan model
    const isClaude = model.startsWith('anthropic.');

    if (isClaude) {
      return this.completeWithClaude(request, config, model);
    } else {
      return this.completeWithTitan(request, config, model);
    }
  }

  private async completeWithClaude(
    request: CompletionRequest,
    config: BedrockConfig,
    model: string
  ): Promise<CompletionResponse> {
    const endpoint = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${model}/invoke`;

    // Build Claude message format
    let systemPrompt = request.systemPrompt || '';
    if (request.responseFormat === 'json') {
      systemPrompt += '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code fences.';
    }

    const body: BedrockClaudeRequest = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: request.maxTokens,
      messages: request.messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : this.extractTextContent(m.content),
      })),
      ...(systemPrompt && { system: systemPrompt }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.topP !== undefined && { top_p: request.topP }),
      ...(request.stopSequences && { stop_sequences: request.stopSequences }),
    };

    const headers = await this.signRequest('POST', endpoint, JSON.stringify(body), config);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Bedrock API error: ${error}`);
    }

    const data: BedrockClaudeResponse = await res.json();
    let content = data.content[0]?.text || '';
    if (request.responseFormat === 'json') content = this.cleanJson(content);

    return {
      content,
      model,
      provider: 'bedrock',
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      finishReason: this.mapFinishReason(data.stop_reason),
    };
  }

  private async completeWithTitan(
    request: CompletionRequest,
    config: BedrockConfig,
    model: string
  ): Promise<CompletionResponse> {
    const endpoint = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${model}/invoke`;

    // Build Titan request format
    const prompt = this.buildTitanPrompt(request);

    const body = {
      inputText: prompt,
      textGenerationConfig: {
        maxTokenCount: request.maxTokens,
        temperature: request.temperature ?? 0,
        ...(request.topP !== undefined && { topP: request.topP }),
        ...(request.stopSequences && { stopSequences: request.stopSequences }),
      },
    };

    const headers = await this.signRequest('POST', endpoint, JSON.stringify(body), config);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Bedrock API error: ${error}`);
    }

    const data = await res.json();
    const content = data.results?.[0]?.outputText || '';

    return {
      content: request.responseFormat === 'json' ? this.cleanJson(content) : content,
      model,
      provider: 'bedrock',
      usage: {
        inputTokens: data.inputTextTokenCount || 0,
        outputTokens: data.results?.[0]?.tokenCount || 0,
        totalTokens: (data.inputTextTokenCount || 0) + (data.results?.[0]?.tokenCount || 0),
      },
      finishReason: 'stop',
    };
  }

  async *streamComplete(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const config = this.getConfig();
    const model = request.model || this.defaultModel;

    // Use invoke-with-response-stream endpoint
    const endpoint = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${model}/invoke-with-response-stream`;

    let systemPrompt = request.systemPrompt || '';
    if (request.responseFormat === 'json') {
      systemPrompt += '\n\nIMPORTANT: Respond with valid JSON only.';
    }

    const body: BedrockClaudeRequest = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: request.maxTokens,
      messages: request.messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : this.extractTextContent(m.content),
      })),
      ...(systemPrompt && { system: systemPrompt }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
    };

    const headers = await this.signRequest('POST', endpoint, JSON.stringify(body), config);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Bedrock streaming error: ${error}`);
    }

    // Bedrock uses event stream format
    const reader = res.body?.getReader();
    if (!reader) {
      yield { content: '', done: true };
      return;
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Parse Bedrock event stream format
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.includes('"delta"')) {
          try {
            // Extract the delta content from the event
            const match = line.match(/"text":"([^"]*)"/);
            if (match && match[1]) {
              yield { content: match[1], done: false };
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    yield { content: '', done: true };
  }

  async isAvailable(): Promise<boolean> {
    try {
      this.getConfig();
      await this.complete({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 10,
        model: 'anthropic.claude-3-haiku-20240307-v1:0',
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

    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!region) {
      errors.push('AWS_REGION environment variable is not set');
    }

    if (!accessKeyId) {
      warnings.push('AWS_ACCESS_KEY_ID not set - will use IAM role or instance profile');
    }

    if (!secretAccessKey && accessKeyId) {
      errors.push('AWS_SECRET_ACCESS_KEY is required when AWS_ACCESS_KEY_ID is set');
    }

    if (errors.length === 0 && accessKeyId) {
      try {
        const available = await this.isAvailable();
        if (!available) {
          errors.push('Unable to connect to AWS Bedrock');
        }
      } catch (e: any) {
        errors.push(`Connection test failed: ${e.message}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private getConfig(): BedrockConfig {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    if (!region) throw new Error('AWS_REGION not configured');

    return {
      region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    };
  }

  private async signRequest(
    method: string,
    url: string,
    body: string,
    config: BedrockConfig
  ): Promise<Record<string, string>> {
    // If no credentials, rely on IAM role
    if (!config.accessKeyId || !config.secretAccessKey) {
      return {};
    }

    const urlObj = new URL(url);
    const host = urlObj.hostname;
    const path = urlObj.pathname;
    const service = 'bedrock';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    // Create canonical request
    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-date';

    const canonicalRequest = [
      method,
      path,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n');

    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${config.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(config.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authorization = `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      'X-Amz-Date': amzDate,
      Authorization: authorization,
    };

    if (config.sessionToken) {
      headers['X-Amz-Security-Token'] = config.sessionToken;
    }

    return headers;
  }

  private extractTextContent(content: any[]): string {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }

  private buildTitanPrompt(request: CompletionRequest): string {
    let prompt = '';
    if (request.systemPrompt) {
      prompt += `${request.systemPrompt}\n\n`;
    }
    for (const msg of request.messages) {
      const content = typeof msg.content === 'string' ? msg.content : this.extractTextContent(msg.content);
      if (msg.role === 'user') {
        prompt += `User: ${content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${content}\n`;
      }
    }
    prompt += 'Assistant: ';
    return prompt;
  }

  private mapFinishReason(reason: string): 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
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

interface BedrockConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}
