// apps/api/src/knowledge/knowledge.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';

// Sync services
import { CveSyncService } from './sync/cve-sync.service';
import { CweSyncService } from './sync/cwe-sync.service';
import { CapecSyncService } from './sync/capec-sync.service';
import { AttackSyncService } from './sync/attack-sync.service';
import { KevSyncService } from './sync/kev-sync.service';
import { EpssSyncService } from './sync/epss-sync.service';
import { OwaspSyncService } from './sync/owasp-sync.service';

// RAG services
import { EmbeddingService } from './rag/embedding.service';
import { RetrievalService } from './rag/retrieval.service';

// Knowledge services
import { PlaybookService } from './playbook.service';
import { KnowledgeSyncOrchestrator } from './knowledge-sync.orchestrator';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [
    // Sync
    CveSyncService,
    CweSyncService,
    CapecSyncService,
    AttackSyncService,
    KevSyncService,
    EpssSyncService,
    OwaspSyncService,
    // RAG
    EmbeddingService,
    RetrievalService,
    // Knowledge
    PlaybookService,
    KnowledgeSyncOrchestrator,
  ],
  exports: [
    CveSyncService,
    KevSyncService,
    EpssSyncService,
    EmbeddingService,
    RetrievalService,
    PlaybookService,
    KnowledgeSyncOrchestrator,
  ],
})
export class KnowledgeModule {}
