// apps/api/src/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { StructuredAIService } from './structured-ai.service';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { SmartTriageService } from './services/smart-triage.service';
import { FixGeneratorService } from './services/fix-generator.service';
import { ThreatGeneratorService } from './services/threat-generator.service';
import { LogicAnalyzerService } from './services/logic-analyzer.service';
import { NlqService } from './services/nlq.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    ClaudeProvider,
    GeminiProvider,
    AIService,
    StructuredAIService,
    SmartTriageService,
    FixGeneratorService,
    ThreatGeneratorService,
    LogicAnalyzerService,
    NlqService,
  ],
  exports: [
    AIService,
    StructuredAIService,
    SmartTriageService,
    FixGeneratorService,
    ThreatGeneratorService,
    LogicAnalyzerService,
    NlqService,
  ],
})
export class AIModule {}
