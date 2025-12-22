import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ScmModule } from '../scm/scm.module';
import { QueueModule } from '../queue/queue.module';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';

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
import { TruffleHogScanner } from './secrets/trufflehog/trufflehog.scanner';

// IaC Scanners
import { CheckovScanner } from './iac/checkov/checkov.scanner';

// DAST Scanners
import { NucleiScanner } from './dast/nuclei/nuclei.scanner';
import { ZapScanner } from './dast/zap/zap.scanner';

// Services
import { FindingProcessorService } from './services/finding-processor.service';

// Processors
import { ScanProcessor, NotifyProcessor } from '../queue/processors';

@Module({
  imports: [ConfigModule, PrismaModule, ScmModule, QueueModule, AiModule, forwardRef(() => NotificationsModule)],
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
    TruffleHogScanner,

    // IaC Scanners
    CheckovScanner,

    // DAST Scanners
    NucleiScanner,
    ZapScanner,

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
    TruffleHogScanner,
    CheckovScanner,
    NucleiScanner,
    ZapScanner,
    FindingProcessorService,
  ],
})
export class ScannersModule {}
