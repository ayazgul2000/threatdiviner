import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RiskParserService } from '../../threat-modeling/services/risk-parser.service';
import { QUEUE_NAMES } from '../queue.constants';
import { AnalysisJobData, AnalysisStage } from '../jobs';
import { BULL_CONNECTION } from '../custom-bull.module';
import AdmZip from 'adm-zip';

export interface AnalysisProgressEvent {
  analysisRunId: string;
  threatModelId: string;
  stage: AnalysisStage;
  progress: number;
  message: string;
}

@Injectable()
export class AnalysisProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalysisProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly riskParserService: RiskParserService,
    @Inject(BULL_CONNECTION) private readonly connection: { host: string; port: number },
  ) {}

  async onModuleInit() {
    try {
      this.logger.log(`Connecting to Redis at ${this.connection.host}:${this.connection.port}...`);

      this.worker = new Worker(
        QUEUE_NAMES.ANALYSIS,
        async (job: Job<AnalysisJobData>) => this.process(job),
        {
          connection: this.connection,
          concurrency: 2, // Process up to 2 analysis jobs concurrently
        },
      );

      this.worker.on('completed', (job) => {
        this.logger.log(`Analysis job ${job.id} completed successfully`);
      });

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Analysis job ${job?.id} failed: ${err.message}`, err.stack);
      });

      this.worker.on('error', (err) => {
        this.logger.error(`Analysis worker error: ${err.message}`, err.stack);
      });

      this.worker.on('ready', () => {
        this.logger.log('Analysis worker connected to Redis and ready to process jobs');
      });

      this.worker.on('active', (job) => {
        this.logger.log(`Analysis job ${job.id} started for threat model ${job.data?.threatModelId || 'unknown'}`);
      });

      this.worker.on('progress', (job, progress) => {
        this.logger.debug(`Analysis job ${job.id} progress: ${progress}%`);
      });

      // Wait for the worker to be ready
      await this.worker.waitUntilReady();
      this.logger.log(`Analysis worker started on queue '${QUEUE_NAMES.ANALYSIS}'`);
    } catch (error) {
      this.logger.error(`Failed to start analysis worker: ${error}`);
      // Don't throw - allow app to start even if Redis is not available
      this.logger.warn('Analysis processing will not work until Redis is available');
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('Analysis worker stopped');
    }
  }

  async process(job: Job<AnalysisJobData>): Promise<void> {
    const { analysisRunId, threatModelId, tenantId, userId, yaml } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing analysis ${analysisRunId} for threat model ${threatModelId}`);

    try {
      // Stage: Validating
      await this.updateStage(job, analysisRunId, threatModelId, 'validating', 10, 'Validating threat model...');

      // Validate the model
      const threatModel = await this.prisma.threatModel.findFirst({
        where: { id: threatModelId, tenantId },
        include: { components: true, dataFlows: true },
      });

      if (!threatModel) {
        throw new Error('Threat model not found');
      }

      if (threatModel.components.length === 0) {
        throw new Error('Threat model has no components. Add components before running analysis.');
      }

      await job.updateProgress(20);

      // Stage: Running Threagile
      await this.updateStage(job, analysisRunId, threatModelId, 'running', 30, 'Running Threagile analysis...');

      // Call Threagile directly (not via threagileService.analyze to avoid double AnalysisRun creation)
      const threagileUrl = this.configService.get<string>('THREAGILE_URL', 'http://localhost:8080');
      const timeout = this.configService.get<number>('THREAGILE_TIMEOUT_MS', 120000);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let response: Response;
      try {
        const formData = new FormData();
        formData.append(
          'file',
          new Blob([yaml], { type: 'application/x-yaml' }),
          'threagile.yaml',
        );

        response = await fetch(`${threagileUrl}/direct/analyze`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      await job.updateProgress(70);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Threagile analysis failed: ${errorText}`);
      }

      // Response is a ZIP file containing risks.json
      const zipBuffer = Buffer.from(await response.arrayBuffer());
      const zip = new AdmZip(zipBuffer);
      const risksEntry = zip.getEntry('risks.json');
      if (!risksEntry) {
        throw new Error('Threagile response ZIP does not contain risks.json');
      }
      const risksJson = JSON.parse(risksEntry.getData().toString('utf-8'));
      const result = { risks: risksJson };

      // Stage: Processing results
      await this.updateStage(job, analysisRunId, threatModelId, 'processing', 80, 'Processing analysis results...');

      // Parse risks using RiskParserService (v2.4.0 - with deduplication)
      // risks.json is already a direct array, wrap in object for parser
      const parsedRisks = this.riskParserService.parseThreagileOutput(risksJson);
      const duration = Date.now() - startTime;

      // Count by severity
      const criticalCount = parsedRisks.filter(r => r.severity === 'critical').length;
      const highCount = parsedRisks.filter(r => r.severity === 'high').length;
      const mediumCount = parsedRisks.filter(r => r.severity === 'medium').length;
      const lowCount = parsedRisks.filter(r => r.severity === 'low').length;

      // Update AnalysisRun with results and store full ZIP
      await this.prisma.analysisRun.update({
        where: { id: analysisRunId },
        data: {
          status: 'processing',
          riskCount: parsedRisks.length,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
          rawOutput: result,
          reportZip: zipBuffer,
        },
      });

      await job.updateProgress(85);

      // Process risks with deduplication, canonical lookup, and component linking (v2.4.0)
      const processResult = await this.riskParserService.processRisks(
        tenantId,
        threatModelId,
        userId,
        analysisRunId,
        parsedRisks,
      );

      this.logger.log(`Risk processing: ${processResult.created} created, ${processResult.updated} updated, ${processResult.linked} component links`);

      await job.updateProgress(95);

      // Update AnalysisRun as completed
      await this.prisma.analysisRun.update({
        where: { id: analysisRunId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          durationMs: duration,
        },
      });

      // Update threat model status
      await this.prisma.threatModel.update({
        where: { id: threatModelId },
        data: {
          analysisStatus: 'completed',
          lastAnalysisAt: new Date(),
        },
      });

      // Stage: Completed
      const completionMsg = `Analysis complete. ${parsedRisks.length} risks found (${processResult.created} new, ${processResult.updated} updated).`;
      await this.updateStage(job, analysisRunId, threatModelId, 'completed', 100, completionMsg);

      this.logger.log(`Analysis ${analysisRunId} completed: ${parsedRisks.length} risks found in ${duration}ms`);

    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Analysis ${analysisRunId} failed: ${errorMessage}`);

      // Update AnalysisRun as failed
      await this.prisma.analysisRun.update({
        where: { id: analysisRunId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          durationMs: duration,
          errorMessage,
        },
      });

      // Update threat model status
      await this.prisma.threatModel.update({
        where: { id: threatModelId },
        data: { analysisStatus: 'failed' },
      });

      // Emit failed stage
      await this.updateStage(job, analysisRunId, threatModelId, 'failed', 0, `Analysis failed: ${errorMessage}`);

      throw error;
    }
  }

  private async updateStage(
    job: Job<AnalysisJobData>,
    analysisRunId: string,
    _threatModelId: string,
    stage: AnalysisStage,
    progress: number,
    message: string,
  ): Promise<void> {
    // Update job progress
    await job.updateProgress(progress);

    this.logger.log(`Analysis ${analysisRunId} - Stage: ${stage} (${progress}%) - ${message}`);

    // Update AnalysisRun status and progress message
    if (stage !== 'completed' && stage !== 'failed') {
      await this.prisma.analysisRun.update({
        where: { id: analysisRunId },
        data: {
          status: stage,
          // Store progress message in a way the frontend can poll
          rawOutput: {
            currentStage: stage,
            progress,
            message,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  // Note: Risk parsing logic moved to RiskParserService (v2.4.0)
  // Methods removed: parseRisks, normalizeRisk, normalizeSeverity, mapThreagileCategory, mapExploitationLikelihood, mapExploitationImpact
}
