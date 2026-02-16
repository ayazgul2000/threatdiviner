import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { AiModule } from '../ai/ai.module';
import { ScmController } from './scm.controller';
import { WebhooksController } from './webhooks.controller';
import { ScmService, CryptoService, PRCommentsService, ConnectionStatusService } from './services';
import { SarifUploadService } from './services/sarif-upload.service';
import { GitHubProvider, GitLabProvider, BitbucketProvider, AzureDevOpsProvider } from './providers';

@Module({
  imports: [ConfigModule, PrismaModule, QueueModule, forwardRef(() => AiModule)],
  controllers: [ScmController, WebhooksController],
  providers: [
    ScmService,
    CryptoService,
    PRCommentsService,
    SarifUploadService,
    ConnectionStatusService,
    GitHubProvider,
    GitLabProvider,
    BitbucketProvider,
    AzureDevOpsProvider,
  ],
  exports: [
    ScmService,
    CryptoService,
    PRCommentsService,
    SarifUploadService,
    ConnectionStatusService,
    GitHubProvider,
    GitLabProvider,
    BitbucketProvider,
    AzureDevOpsProvider,
  ],
})
export class ScmModule {}
