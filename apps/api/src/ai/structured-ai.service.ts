// apps/api/src/ai/structured-ai.service.ts
// Structured output executor with Zod validation

import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AIService } from './ai.service';
import { Message } from './interfaces/ai-provider.interface';

export interface StructuredRequest<T extends z.ZodType> {
  schema: T;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
}

export interface StructuredResponse<T> {
  data: T;
  provider: 'claude' | 'gemini';
  usage: { inputTokens: number; outputTokens: number };
  retries: number;
}

@Injectable()
export class StructuredAIService {
  private readonly logger = new Logger(StructuredAIService.name);

  constructor(private readonly ai: AIService) {}

  async execute<T extends z.ZodType>(request: StructuredRequest<T>): Promise<StructuredResponse<z.infer<T>>> {
    const maxRetries = request.maxRetries ?? 2;
    let lastError: Error | null = null;
    let retries = 0;

    const schemaDesc = this.generateSchemaDescription(request.schema);
    const systemPrompt = `${request.systemPrompt}\n\nRespond with valid JSON matching this schema:\n${schemaDesc}`;
    const messages: Message[] = [{ role: 'user', content: request.userPrompt }];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.ai.complete({
          systemPrompt,
          messages,
          maxTokens: request.maxTokens || 1000,
          temperature: request.temperature ?? 0,
          responseFormat: 'json',
        });

        const parsed = JSON.parse(response.content);
        const validated = request.schema.parse(parsed);

        return { data: validated, provider: response.provider, usage: response.usage, retries };
      } catch (error: any) {
        lastError = error;
        retries++;

        if (error instanceof z.ZodError) {
          this.logger.warn(`Schema validation failed (attempt ${attempt + 1})`);
          const zodErr = error as z.ZodError;
          messages.push(
            { role: 'assistant', content: 'Invalid response' },
            { role: 'user', content: `Schema errors: ${zodErr.issues.map((e) => e.message).join(', ')}. Try again.` }
          );
        } else if (error instanceof SyntaxError) {
          this.logger.warn(`JSON parse failed (attempt ${attempt + 1})`);
          messages.push(
            { role: 'assistant', content: 'Invalid JSON' },
            { role: 'user', content: 'Return ONLY valid JSON, no markdown.' }
          );
        } else {
          throw error;
        }
      }
    }

    throw lastError || new Error('Structured AI request failed');
  }

  private generateSchemaDescription(schema: z.ZodType): string {
    if (schema instanceof z.ZodObject) {
      const shape = (schema as any).shape;
      const fields = Object.entries(shape).map(([key, value]) => {
        return `  "${key}": ${this.describeZodType(value as z.ZodType)}`;
      });
      return `{\n${fields.join(',\n')}\n}`;
    }
    return this.describeZodType(schema);
  }

  private describeZodType(type: z.ZodType): string {
    if (type instanceof z.ZodString) return 'string';
    if (type instanceof z.ZodNumber) return 'number';
    if (type instanceof z.ZodBoolean) return 'boolean';
    if (type instanceof z.ZodArray) return `array`;
    if (type instanceof z.ZodEnum) return `enum`;
    if (type instanceof z.ZodOptional) return `optional`;
    if (type instanceof z.ZodObject) return 'object';
    return 'any';
  }
}
