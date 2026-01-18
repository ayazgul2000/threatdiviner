import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
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
export class GeminiProvider implements AiProviderInterface {
  private readonly logger = new Logger(GeminiProvider.name);
  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private readonly modelName: string = 'gemini-1.5-pro';

  readonly name = 'gemini';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
      this.modelName = this.configService.get('GEMINI_MODEL', 'gemini-1.5-pro');
      this.model = this.client.getGenerativeModel({ model: this.modelName });
      this.logger.log(`Gemini provider initialized with model: ${this.modelName}`);
    } else {
      this.logger.warn('GEMINI_API_KEY not configured - Gemini provider disabled');
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.client !== null && this.model !== null;
  }

  async triageFinding(request: TriageRequest): Promise<TriageResult | null> {
    if (!this.model) {
      return null;
    }

    try {
      const prompt = buildTriagePrompt(request);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      return parseTriageResponse(text);
    } catch (error) {
      this.logger.error(`Gemini triage failed: ${error}`);
      return null;
    }
  }

  async generateFix(request: AutoFixRequest): Promise<AutoFixResult | null> {
    if (!this.model) {
      return null;
    }

    try {
      const prompt = buildAutoFixPrompt(request);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      return parseAutoFixResponse(text);
    } catch (error) {
      this.logger.error(`Gemini auto-fix generation failed: ${error}`);
      return null;
    }
  }
}
