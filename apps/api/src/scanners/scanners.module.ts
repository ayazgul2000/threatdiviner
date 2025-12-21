import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ScmModule } from '../scm/scm.module';
import { QueueModule } from '../queue/queue.module';
import { AiModule } from '../ai/ai.module';

// Utils
import { GitService } from './utils/git.service';

// Execution
import { LocalExecutorService } from './execution/local-executor.service';

// Parsers
import { SarifParser } from './parsers/sarif.parser';

// SAST Scanners
import { SemgrepScanner } from './sast/semgrep/semgrep.scanner';
import { BanditScanner } from './sast/bandit/bandit.scanner';
import { GosecScanner } from './sast/gosec/gosec.scanner';

// SCA Scanners
import { TrivyScanner } from './sca/trivy/trivy.scanner';

// Secrets Scanners
import { GitleaksScanner } from './secrets/gitleaks/gitleaks.scanner';

// Services
import { FindingProcessorService } from './services/finding-processor.service';

// Processors
import { ScanProcessor, NotifyProcessor } from '../queue/processors';

@Module({
  imports: [ConfigModule, PrismaModule, ScmModule, QueueModule, AiModule],
  providers: [
    // Utils
    GitService,

    // Execution
    LocalExecutorService,

    // Parsers
    SarifParser,

    // SAST Scanners
    SemgrepScanner,
    BanditScanner,
    GosecScanner,

    // SCA Scanners
    TrivyScanner,

    // Secrets Scanners
    GitleaksScanner,

    // Services
    FindingProcessorService,

    // Queue Processors
    ScanProcessor,
    NotifyProcessor,
  ],
  exports: [
    GitService,
    LocalExecutorService,
    SarifParser,
    SemgrepScanner,
    BanditScanner,
    GosecScanner,
    TrivyScanner,
    GitleaksScanner,
    FindingProcessorService,
  ],
})
export class ScannersModule {}
