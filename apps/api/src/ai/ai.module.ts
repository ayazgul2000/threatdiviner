// apps/api/src/ai/ai.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Core services
import { AIService } from './ai.service';
import { StructuredAIService } from './structured-ai.service';
import { ProviderRegistryService } from './provider-registry.service';

// Providers
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { AzureOpenAIProvider } from './providers/azure-openai.provider';
import { BedrockProvider } from './providers/bedrock.provider';

// AI Services
import { SmartTriageService } from './services/smart-triage.service';
import { FixGeneratorService } from './services/fix-generator.service';
import { ThreatGeneratorService } from './services/threat-generator.service';
import { LogicAnalyzerService } from './services/logic-analyzer.service';
import { NlqService } from './services/nlq.service';
import { ChatService } from './services/chat.service';
import { AIRateLimiterService } from './services/ai-rate-limiter.service';
import { AICostService } from './services/ai-cost.service';

// Controllers
import { AiController } from './ai.controller';
import { ChatController } from './chat.controller';

// Other imports
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot(), ScheduleModule.forRoot()],
  controllers: [AiController, ChatController],
  providers: [
    // Providers
    ClaudeProvider,
    GeminiProvider,
    OpenAIProvider,
    AzureOpenAIProvider,
    BedrockProvider,

    // Registry
    ProviderRegistryService,

    // Core AI Services
    AIService,
    StructuredAIService,

    // Specialized Services
    SmartTriageService,
    FixGeneratorService,
    ThreatGeneratorService,
    LogicAnalyzerService,
    NlqService,
    ChatService,
    AIRateLimiterService,
    AICostService,
  ],
  exports: [
    // Providers (for direct access if needed)
    ClaudeProvider,
    GeminiProvider,
    OpenAIProvider,
    AzureOpenAIProvider,
    BedrockProvider,

    // Registry
    ProviderRegistryService,

    // Core AI Services
    AIService,
    StructuredAIService,

    // Specialized Services
    SmartTriageService,
    FixGeneratorService,
    ThreatGeneratorService,
    LogicAnalyzerService,
    NlqService,
    ChatService,
    AIRateLimiterService,
    AICostService,
  ],
})
export class AIModule implements OnModuleInit {
  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly claudeProvider: ClaudeProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly openaiProvider: OpenAIProvider,
    private readonly azureProvider: AzureOpenAIProvider,
    private readonly bedrockProvider: BedrockProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    // Register providers in priority order
    // Default priority: Claude > OpenAI > Gemini > Azure > Bedrock

    // Only register providers that have API keys configured
    if (process.env.ANTHROPIC_API_KEY) {
      this.registry.registerProvider(this.claudeProvider, 0);
    }

    if (process.env.OPENAI_API_KEY) {
      this.registry.registerProvider(this.openaiProvider, 1);
    }

    if (process.env.GEMINI_API_KEY) {
      this.registry.registerProvider(this.geminiProvider, 2);
    }

    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      this.registry.registerProvider(this.azureProvider, 3);
    }

    if ((process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION) &&
        (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE)) {
      this.registry.registerProvider(this.bedrockProvider, 4);
    }
  }
}
