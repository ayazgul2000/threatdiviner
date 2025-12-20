import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ScmModule } from '../scm/scm.module';
import { QueueModule } from '../queue/queue.module';

// Utils
import { GitService } from './utils/git.service';

// Execution
import { LocalExecutorService } from './execution/local-executor.service';

// Parsers
import { SarifParser } from './parsers/sarif.parser';

// Scanners
import { SemgrepScanner } from './sast/semgrep/semgrep.scanner';

// Services
import { FindingProcessorService } from './services/finding-processor.service';

// Processors
import { ScanProcessor, NotifyProcessor } from '../queue/processors';

@Module({
  imports: [ConfigModule, PrismaModule, ScmModule, QueueModule],
  providers: [
    // Utils
    GitService,

    // Execution
    LocalExecutorService,

    // Parsers
    SarifParser,

    // Scanners
    SemgrepScanner,

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
    FindingProcessorService,
  ],
})
export class ScannersModule {}
