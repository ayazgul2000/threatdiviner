// apps/api/src/reporting/services/report-data.service.ts
// Service for gathering enriched data for reports

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EnrichedFinding,
  ScanReportData,
  FindingSummary,
  TrendData,
} from '../interfaces/report-data.interface';

@Injectable()
export class ReportDataService {
  private readonly logger = new Logger(ReportDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getScanReportData(
    tenantId: string,
    scanId: string,
    options?: { includeTrends?: boolean; includeAi?: boolean },
  ): Promise<ScanReportData> {
    const scan = await this.prisma.scan.findFirst({
      where: { id: scanId, tenantId },
      include: { repository: true, scannerResults: true },
    });

    if (!scan) throw new NotFoundException('Scan not found');

    const findings = await this.prisma.finding.findMany({
      where: { scanId, tenantId },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });

    const enrichedFindings = await this.enrichFindings(findings, options?.includeAi);
    const summary = this.calculateSummary(findings);

    let trends: TrendData | undefined;
    if (options?.includeTrends) {
      trends = await this.getRepositoryTrends(tenantId, scan.repositoryId);
    }

    return {
      scan: {
        id: scan.id,
        branch: scan.branch,
        commitSha: scan.commitSha,
        status: scan.status,
        triggeredBy: scan.triggeredBy,
        triggerEvent: scan.triggerEvent,
        pullRequestId: scan.pullRequestId,
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
        duration: scan.duration,
      },
      repository: {
        id: scan.repository.id,
        name: scan.repository.name,
        fullName: scan.repository.fullName,
        htmlUrl: scan.repository.htmlUrl,
        defaultBranch: scan.repository.defaultBranch,
        language: scan.repository.language,
      },
      scannerResults: scan.scannerResults.map((sr) => ({
        scanner: sr.scanner,
        category: sr.category,
        status: sr.status,
        duration: sr.duration,
        findingsCount: sr.findingsCount,
      })),
      findings: enrichedFindings,
      summary,
      trends,
      generatedAt: new Date(),
    };
  }

  private async enrichFindings(findings: any[], includeAi?: boolean): Promise<EnrichedFinding[]> {
    const enriched: EnrichedFinding[] = [];

    for (const f of findings) {
      const ef: EnrichedFinding = {
        id: f.id,
        title: f.title,
        description: f.description,
        severity: f.severity,
        status: f.status,
        scanner: f.scanner,
        ruleId: f.ruleId,
        filePath: f.filePath,
        startLine: f.startLine,
        endLine: f.endLine,
        snippet: f.snippet,
        fingerprint: f.fingerprint,
        firstSeenAt: f.firstSeenAt,
        createdAt: f.createdAt,
        riskScore: f.riskScore,
        compliance: [],
        remediation: {
          summary: f.remediation,
          autoFix: f.autoFix,
          steps: [],
          references: [],
        },
      };

      // Add CVE data
      if (f.cveId) {
        const cve = await this.prisma.cve.findUnique({ where: { id: f.cveId } });
        if (cve) {
          ef.cve = {
            id: cve.id,
            description: cve.description,
            cvssV3Score: cve.cvssV3Score,
            cvssV3Vector: cve.cvssV3Vector,
            cvssV3Severity: cve.cvssV3Severity,
            epssScore: cve.epssScore,
            epssPercentile: cve.epssPercentile,
            isKev: cve.isKev,
            kevDateAdded: cve.kevDateAdded,
            kevDueDate: cve.kevDueDate,
            publishedDate: cve.publishedDate,
            references: cve.references as any[],
            affectedProducts: cve.affectedProducts as any[],
          };
        }
      }

      // Add CWE data
      if (f.cweId) {
        const cwe = await this.prisma.cwe.findUnique({
          where: { id: f.cweId },
          include: { complianceMappings: true },
        });
        if (cwe) {
          ef.cwe = {
            id: cwe.id,
            name: cwe.name,
            description: cwe.description,
            extendedDescription: cwe.extendedDescription,
            likelihoodOfExploit: cwe.likelihoodOfExploit,
            commonConsequences: cwe.commonConsequences as any[],
            potentialMitigations: cwe.potentialMitigations as any[],
            relatedWeaknesses: cwe.relatedWeaknesses,
          };

          if (cwe.potentialMitigations && Array.isArray(cwe.potentialMitigations)) {
            ef.remediation.steps = (cwe.potentialMitigations as any[]).map((m) => m.description || m);
          }

          for (const mapping of cwe.complianceMappings) {
            ef.compliance.push({
              framework: mapping.frameworkId,
              frameworkName: this.getFrameworkName(mapping.frameworkId),
              controlId: mapping.controlId,
              controlName: mapping.controlName,
              controlDescription: mapping.controlDescription,
              category: '',
            });
          }
        }
      }

      // Add OWASP data
      if (f.owaspCategory) {
        const owasp = await this.prisma.owaspTop10.findUnique({ where: { id: f.owaspCategory } });
        if (owasp) {
          ef.owasp = {
            id: owasp.id,
            year: owasp.year,
            rank: owasp.rank,
            name: owasp.name,
            description: owasp.description,
            preventionTips: owasp.preventionTips as any[],
          };
        }
      }

      // Add ATT&CK data
      if (f.attackTechniques && Array.isArray(f.attackTechniques)) {
        ef.attack = [];
        for (const at of f.attackTechniques as any[]) {
          const technique = await this.prisma.attackTechnique.findUnique({
            where: { id: at.id || at },
            include: { tactic: true },
          });
          if (technique) {
            ef.attack.push({
              techniqueId: technique.id,
              tacticId: technique.tacticId,
              name: technique.name,
              description: technique.description,
              platforms: technique.platforms,
              detection: technique.detection,
              mitigations: technique.mitigations as any[],
            });
          }
        }
      }

      // Add AI analysis
      if (includeAi && f.aiAnalysis) {
        ef.aiAnalysis = {
          analysis: f.aiAnalysis,
          confidence: f.aiConfidence,
          severity: f.aiSeverity,
          isFalsePositive: f.aiFalsePositive,
          exploitability: f.aiExploitability,
          remediation: f.aiRemediation,
          triagedAt: f.aiTriagedAt,
        };
      }

      enriched.push(ef);
    }

    return enriched;
  }

  private calculateSummary(findings: any[]): FindingSummary {
    const summary: FindingSummary = {
      total: findings.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      byScanner: [],
      byStatus: [],
    };

    const scannerCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};

    for (const f of findings) {
      switch (f.severity?.toLowerCase()) {
        case 'critical': summary.critical++; break;
        case 'high': summary.high++; break;
        case 'medium': summary.medium++; break;
        case 'low': summary.low++; break;
        default: summary.info++;
      }
      scannerCounts[f.scanner] = (scannerCounts[f.scanner] || 0) + 1;
      statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;
    }

    summary.byScanner = Object.entries(scannerCounts).map(([scanner, count]) => ({ scanner, count }));
    summary.byStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    return summary;
  }

  private async getRepositoryTrends(tenantId: string, repositoryId: string): Promise<TrendData> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const scans = await this.prisma.scan.findMany({
      where: {
        repositoryId,
        tenantId,
        completedAt: { gte: thirtyDaysAgo },
        status: 'completed',
      },
      include: { findings: { select: { severity: true, createdAt: true } } },
      orderBy: { completedAt: 'asc' },
    });

    const findingsOverTime: { date: string; count: number; severity: string }[] = [];
    const scansOverTime: { date: string; count: number }[] = [];
    const severityDistribution: { date: string; critical: number; high: number; medium: number; low: number }[] = [];
    const dateGroups: Record<string, any> = {};

    for (const scan of scans) {
      const date = scan.completedAt?.toISOString().split('T')[0] || '';
      if (!dateGroups[date]) {
        dateGroups[date] = { scans: 0, critical: 0, high: 0, medium: 0, low: 0 };
      }
      dateGroups[date].scans++;

      for (const f of scan.findings) {
        switch (f.severity?.toLowerCase()) {
          case 'critical': dateGroups[date].critical++; break;
          case 'high': dateGroups[date].high++; break;
          case 'medium': dateGroups[date].medium++; break;
          case 'low': dateGroups[date].low++; break;
        }
      }
    }

    for (const [date, data] of Object.entries(dateGroups)) {
      scansOverTime.push({ date, count: (data as any).scans });
      severityDistribution.push({
        date,
        critical: (data as any).critical,
        high: (data as any).high,
        medium: (data as any).medium,
        low: (data as any).low,
      });
      findingsOverTime.push({
        date,
        count: (data as any).critical + (data as any).high + (data as any).medium + (data as any).low,
        severity: 'total',
      });
    }

    return { findingsOverTime, scansOverTime, severityDistributionOverTime: severityDistribution, mttrOverTime: [] };
  }

  private getFrameworkName(frameworkId: string): string {
    const names: Record<string, string> = {
      soc2: 'SOC 2 Type II',
      pci_dss: 'PCI DSS 4.0',
      hipaa: 'HIPAA',
      gdpr: 'GDPR',
      iso27001: 'ISO 27001',
      nist_csf: 'NIST CSF',
      cis: 'CIS Controls',
      owasp: 'OWASP',
      essential_eight: 'Essential Eight',
    };
    return names[frameworkId] || frameworkId.toUpperCase();
  }
}
