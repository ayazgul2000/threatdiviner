import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ScmModule } from '../scm/scm.module';
import { QueueModule } from '../queue/queue.module';
import { AIModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScansModule } from '../scans/scans.module';

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

// IaC Scanners
import { CheckovScanner } from './iac/checkov/checkov.scanner';

// DAST Scanners
import { NucleiScanner } from './dast/nuclei/nuclei.scanner';
import { ZapScanner } from './dast/zap/zap.scanner';

// Discovery Scanners
import { KatanaScanner } from './discovery/katana/katana.scanner';

// Services
import { FindingProcessorService } from './services/finding-processor.service';
import { DiffFilterService } from './services/diff-filter.service';

// Processors
import { ScanProcessor, NotifyProcessor } from '../queue/processors';
import { TargetScanProcessor } from '../queue/processors/target-scan.processor';

@Module({
  imports: [ConfigModule, PrismaModule, ScmModule, QueueModule, AIModule, ScansModule, forwardRef(() => NotificationsModule)],
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

    // IaC Scanners
    CheckovScanner,

    // DAST Scanners
    NucleiScanner,
    ZapScanner,

    // Discovery Scanners
    KatanaScanner,

    // Services
    FindingProcessorService,
    DiffFilterService,

    // Queue Processors
    ScanProcessor,
    NotifyProcessor,
    TargetScanProcessor,
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
    CheckovScanner,
    NucleiScanner,
    ZapScanner,
    KatanaScanner,
    FindingProcessorService,
    DiffFilterService,
  ],
})
export class ScannersModule {}
