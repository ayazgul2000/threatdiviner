import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AiController],
  providers: [
    ClaudeProvider,
    GeminiProvider,
    AiService,
  ],
  exports: [AiService, ClaudeProvider, GeminiProvider],
})
export class AiModule {}
