import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  AiProviderInterface,
  TriageRequest,
  TriageResult,
  AutoFixRequest,
  AutoFixResult,
} from './ai-provider.interface';
import { buildTriagePrompt, parseTriageResponse } from '../prompts/triage.prompt';
import { buildAutoFixPrompt, parseAutoFixResponse } from '../prompts/fix.prompt';

@Injectable()
export class ClaudeProvider implements AiProviderInterface {
  private readonly logger = new Logger(ClaudeProvider.name);
  private client: Anthropic | null = null;
  private readonly model: string;

  readonly name = 'claude';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log('Claude provider initialized');
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not configured - Claude provider disabled');
    }
    this.model = this.configService.get('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514');
  }

  async isAvailable(): Promise<boolean> {
    return this.client !== null;
  }

  async triageFinding(request: TriageRequest): Promise<TriageResult | null> {
    if (!this.client) {
      return null;
    }

    try {
      const prompt = buildTriagePrompt(request);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return parseTriageResponse(content.text);
    } catch (error) {
      this.logger.error(`Claude triage failed: ${error}`);
      return null;
    }
  }

  async generateFix(request: AutoFixRequest): Promise<AutoFixResult | null> {
    if (!this.client) {
      return null;
    }

    try {
      const prompt = buildAutoFixPrompt(request);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return parseAutoFixResponse(content.text);
    } catch (error) {
      this.logger.error(`Claude auto-fix generation failed: ${error}`);
      return null;
    }
  }

  async analyzeWithPrompt(prompt: string): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return content.text;
    } catch (error) {
      this.logger.error(`Claude analysis failed: ${error}`);
      return null;
    }
  }
}
