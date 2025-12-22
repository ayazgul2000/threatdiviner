import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { CspmController } from './cspm.controller';
import { CspmService } from './cspm.service';
import { AwsProvider } from './providers/aws/aws.provider';
import { AzureProvider } from './providers/azure/azure.provider';
import { GcpProvider } from './providers/gcp/gcp.provider';
import { ProwlerScanner } from './providers/prowler.scanner';

@Module({
  imports: [ConfigModule, PrismaModule, QueueModule],
  controllers: [CspmController],
  providers: [
    CspmService,
    AwsProvider,
    AzureProvider,
    GcpProvider,
    ProwlerScanner,
  ],
  exports: [CspmService],
})
export class CspmModule {}
