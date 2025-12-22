import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { ScmController } from './scm.controller';
import { WebhooksController } from './webhooks.controller';
import { ScmService, CryptoService, PRCommentsService } from './services';
import { GitHubProvider } from './providers';

@Module({
  imports: [ConfigModule, PrismaModule, QueueModule],
  controllers: [ScmController, WebhooksController],
  providers: [ScmService, CryptoService, PRCommentsService, GitHubProvider],
  exports: [ScmService, CryptoService, PRCommentsService, GitHubProvider],
})
export class ScmModule {}
