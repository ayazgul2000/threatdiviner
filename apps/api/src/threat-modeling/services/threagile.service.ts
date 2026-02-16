import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import AdmZip from 'adm-zip';

export interface ThreagileHealthResponse {
  status: 'healthy' | 'unhealthy';
  version?: string;
  message?: string;
}

export interface ThreagileAnalysisRequest {
  yaml: string;
  threatModelId: string;
  tenantId: string;
  userId: string;
}

export interface ThreagileRisk {
  id: string;
  category: string;
  title: string;
  severity: string;
  exploitation_likelihood: string;
  exploitation_impact: string;
  most_relevant_technical_asset: string;
  most_relevant_communication_link?: string;
  most_relevant_trust_boundary?: string;
  most_relevant_data_asset?: string;
  data_breach_probability: string;
  data_breach_technical_assets: string[];
  cwe_id?: number;
  action: string;
  mitigation: string;
  check: string;
  detection_logic: string;
  risk_assessment: string;
  false_positive_probability: string;
}

export interface ThreagileAnalysisResult {
  success: boolean;
  risks: ThreagileRisk[];
  rawOutput: any;
  error?: string;
  duration_ms: number;
}

@Injectable()
export class ThreagileService {
  private readonly logger = new Logger(ThreagileService.name);
  private readonly threagileUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.threagileUrl = this.configService.get<string>('THREAGILE_URL', 'http://localhost:8080');
    this.timeout = this.configService.get<number>('THREAGILE_TIMEOUT_MS', 120000);
  }

  /**
   * Check if Threagile service is healthy
   */
  async healthCheck(): Promise<ThreagileHealthResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.threagileUrl}/meta/ping`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          status: 'healthy',
          version: data.version || 'unknown',
          message: data.message === 'pong' ? 'Threagile service is running' : 'Threagile service responded',
        };
      }

      return {
        status: 'unhealthy',
        message: `Health check returned status ${response.status}`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Threagile health check failed: ${errorMessage}`);
      return {
        status: 'unhealthy',
        message: errorMessage || 'Unable to connect to Threagile service',
      };
    }
  }

  /**
   * Run Threagile analysis on a threat model YAML
   */
  async analyze(request: ThreagileAnalysisRequest): Promise<ThreagileAnalysisResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Starting Threagile analysis for model ${request.threatModelId}`);

      // Create analysis run record
      const analysisRun = await this.prisma.analysisRun.create({
        data: {
          threatModelId: request.threatModelId,
          tenantId: request.tenantId,
          status: 'running',
          engine: 'threagile',
          triggeredBy: request.userId,
          startedAt: new Date(),
          yamlInput: request.yaml,
        },
      });

      // Update threat model status
      await this.prisma.threatModel.update({
        where: { id: request.threatModelId },
        data: {
          analysisStatus: 'running',
          lastAnalysisRunId: analysisRun.id,
        },
      });

      // Call Threagile API with multipart form-data
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const formData = new FormData();
      formData.append(
        'file',
        new Blob([request.yaml], { type: 'application/x-yaml' }),
        'threagile.yaml',
      );

      const response = await fetch(`${this.threagileUrl}/direct/analyze`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

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

      // Also extract stats.json for raw output
      const statsEntry = zip.getEntry('stats.json');
      const statsJson = statsEntry
        ? JSON.parse(statsEntry.getData().toString('utf-8'))
        : {};

      const result = { risks: risksJson, stats: statsJson };
      const risks = this.parseRisks(result);

      // Update analysis run with results and store full ZIP
      await this.prisma.analysisRun.update({
        where: { id: analysisRun.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          durationMs: duration,
          riskCount: risks.length,
          criticalCount: risks.filter(r => r.severity === 'critical').length,
          highCount: risks.filter(r => r.severity === 'elevated').length,
          mediumCount: risks.filter(r => r.severity === 'medium').length,
          lowCount: risks.filter(r => r.severity === 'low').length,
          rawOutput: result,
          reportZip: zipBuffer,
        },
      });

      // Update threat model status
      await this.prisma.threatModel.update({
        where: { id: request.threatModelId },
        data: {
          analysisStatus: 'completed',
          lastAnalysisAt: new Date(),
        },
      });

      this.logger.log(`Threagile analysis completed for model ${request.threatModelId}: ${risks.length} risks found in ${duration}ms`);

      return {
        success: true,
        risks,
        rawOutput: result,
        duration_ms: duration,
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Threagile analysis failed: ${errorObj.message}`);

      // Update threat model status on failure
      await this.prisma.threatModel.update({
        where: { id: request.threatModelId },
        data: {
          analysisStatus: 'failed',
        },
      });

      // Try to update analysis run if it was created
      try {
        const latestRun = await this.prisma.analysisRun.findFirst({
          where: { threatModelId: request.threatModelId },
          orderBy: { createdAt: 'desc' },
        });
        if (latestRun && latestRun.status === 'running') {
          await this.prisma.analysisRun.update({
            where: { id: latestRun.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              durationMs: duration,
              errorMessage: errorObj.message,
            },
          });
        }
      } catch (e: unknown) {
        const innerError = e instanceof Error ? e.message : 'Unknown error';
        this.logger.error(`Failed to update analysis run: ${innerError}`);
      }

      return {
        success: false,
        risks: [],
        rawOutput: null,
        error: this.parseErrorMessage(errorObj),
        duration_ms: duration,
      };
    }
  }

  /**
   * Parse risks from Threagile JSON output
   */
  private parseRisks(result: any): ThreagileRisk[] {
    const risks: ThreagileRisk[] = [];

    // Threagile outputs risks in different structures depending on version/endpoint
    // Try multiple parsing approaches
    if (Array.isArray(result.risks)) {
      // ZIP extraction format: { risks: [...], stats: {...} }
      for (const risk of result.risks) {
        risks.push(this.normalizeRisk(risk));
      }
    } else if (result.risks_identified) {
      // Legacy: risks_identified array
      for (const risk of result.risks_identified) {
        risks.push(this.normalizeRisk(risk));
      }
    } else if (result.generated_risks) {
      // Legacy: object format (keyed by risk ID)
      for (const [id, risk] of Object.entries(result.generated_risks)) {
        risks.push(this.normalizeRisk({ id, ...(risk as any) }));
      }
    } else if (Array.isArray(result)) {
      // Direct array
      for (const risk of result) {
        risks.push(this.normalizeRisk(risk));
      }
    }

    return risks;
  }

  /**
   * Normalize a risk object to our standard format
   */
  private normalizeRisk(raw: any): ThreagileRisk {
    return {
      id: raw.id || raw.synthetic_id || `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: raw.category || raw.risk_category || 'unknown',
      title: raw.title || raw.risk_title || 'Untitled Risk',
      severity: this.normalizeSeverity(raw.severity || raw.risk_severity),
      exploitation_likelihood: raw.exploitation_likelihood || 'likely',
      exploitation_impact: raw.exploitation_impact || 'medium',
      most_relevant_technical_asset: raw.most_relevant_technical_asset || '',
      most_relevant_communication_link: raw.most_relevant_communication_link,
      most_relevant_trust_boundary: raw.most_relevant_trust_boundary,
      most_relevant_data_asset: raw.most_relevant_data_asset,
      data_breach_probability: raw.data_breach_probability || 'improbable',
      data_breach_technical_assets: raw.data_breach_technical_assets || [],
      cwe_id: raw.cwe_id || raw.cwe,
      action: raw.action || raw.recommended_action || '',
      mitigation: raw.mitigation || '',
      check: raw.check || '',
      detection_logic: raw.detection_logic || '',
      risk_assessment: raw.risk_assessment || '',
      false_positive_probability: raw.false_positive_probability || 'unlikely',
    };
  }

  /**
   * Normalize severity to standard values
   */
  private normalizeSeverity(severity: string): string {
    const normalized = (severity || '').toLowerCase();
    if (normalized.includes('critical')) return 'critical';
    if (normalized.includes('elevated') || normalized.includes('high')) return 'elevated';
    if (normalized.includes('medium')) return 'medium';
    if (normalized.includes('low')) return 'low';
    return 'medium';
  }

  /**
   * Parse error message from various error types
   */
  private parseErrorMessage(error: Error): string {
    if (error.name === 'AbortError') {
      return `Analysis timed out after ${this.timeout}ms. The model may be too complex.`;
    }
    if (error.message) {
      // Try to extract meaningful error from Threagile output
      const yamlError = error.message.match(/yaml:?\s*(.+)/i);
      if (yamlError) {
        return `YAML parsing error: ${yamlError[1]}`;
      }
      return error.message;
    }
    return 'Unknown error occurred during analysis';
  }

  /**
   * Get analysis run by ID
   */
  async getAnalysisRun(runId: string, tenantId: string) {
    return this.prisma.analysisRun.findFirst({
      where: { id: runId, tenantId },
    });
  }

  /**
   * Get analysis history for a threat model
   */
  async getAnalysisHistory(threatModelId: string, tenantId: string, limit = 10) {
    return this.prisma.analysisRun.findMany({
      where: {
        threatModelId,
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Cancel a running analysis
   */
  async cancelAnalysis(runId: string, tenantId: string): Promise<boolean> {
    const run = await this.prisma.analysisRun.findFirst({
      where: {
        id: runId,
        tenantId,
        status: 'running',
      },
    });

    if (!run) {
      return false;
    }

    await this.prisma.analysisRun.update({
      where: { id: runId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        errorMessage: 'Cancelled by user',
      },
    });

    await this.prisma.threatModel.update({
      where: { id: run.threatModelId },
      data: {
        analysisStatus: 'idle',
      },
    });

    return true;
  }
}
