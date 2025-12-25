import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { VectorDbService } from './vector-db.service';
import { EmbeddingService } from './embedding.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
  ],
  controllers: [RagController],
  providers: [
    RagService,
    VectorDbService,
    EmbeddingService,
  ],
  exports: [RagService],
})
export class RagModule {}
