import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getAllFrameworks,
  getControlsForCWE,
  getControlsForCategory,
  SOC2_CONTROLS,
  PCIDSS_CONTROLS,
  HIPAA_CONTROLS,
  GDPR_CONTROLS,
  ISO27001_CONTROLS,
  ComplianceControl,
} from './frameworks';

export interface ComplianceScore {
  framework: string;
  frameworkName: string;
  version: string;
  overallScore: number; // 0-100
  passedControls: number;
  failedControls: number;
  totalControls: number;
  controlStatus: {
    controlId: string;
    controlName: string;
    status: 'passed' | 'failed' | 'warning';
    findingsCount: number;
    criticalFindings: number;
    highFindings: number;
  }[];
}

export interface ComplianceSummary {
  tenantId: string;
  repositoryId?: string;
  generatedAt: Date;
  frameworks: ComplianceScore[];
}

export interface ControlViolation {
  controlId: string;
  controlName: string;
  framework: string;
  findingId: string;
  severity: string;
  title: string;
  filePath: string;
}

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get available compliance frameworks
   */
  getFrameworks() {
    return getAllFrameworks();
  }

  /**
   * Get compliance score for a tenant
   */
  async getTenantComplianceScore(tenantId: string, frameworkId?: string): Promise<ComplianceSummary> {
    const findings = await this.prisma.finding.findMany({
      where: {
        tenantId,
        status: { in: ['open', 'triaged'] },
      },
      select: {
        id: true,
        severity: true,
        title: true,
        filePath: true,
        cweId: true,
        ruleId: true,
        scanner: true,
      },
    });

    const frameworks = frameworkId
      ? getAllFrameworks().filter(f => f.id === frameworkId)
      : getAllFrameworks();

    const frameworkScores = frameworks.map(framework =>
      this.calculateFrameworkScore(framework.id, framework.name, framework.version, findings),
    );

    return {
      tenantId,
      generatedAt: new Date(),
      frameworks: frameworkScores,
    };
  }

  /**
   * Get compliance score for a specific repository
   */
  async getRepositoryComplianceScore(
    tenantId: string,
    repositoryId: string,
    frameworkId?: string,
  ): Promise<ComplianceSummary> {
    const findings = await this.prisma.finding.findMany({
      where: {
        tenantId,
        repositoryId,
        status: { in: ['open', 'triaged'] },
      },
      select: {
        id: true,
        severity: true,
        title: true,
        filePath: true,
        cweId: true,
        ruleId: true,
        scanner: true,
      },
    });

    const frameworks = frameworkId
      ? getAllFrameworks().filter(f => f.id === frameworkId)
      : getAllFrameworks();

    const frameworkScores = frameworks.map(framework =>
      this.calculateFrameworkScore(framework.id, framework.name, framework.version, findings),
    );

    return {
      tenantId,
      repositoryId,
      generatedAt: new Date(),
      frameworks: frameworkScores,
    };
  }

  /**
   * Get control violations for a framework
   */
  async getControlViolations(
    tenantId: string,
    frameworkId: string,
    controlId?: string,
    repositoryId?: string,
  ): Promise<ControlViolation[]> {
    const where: any = {
      tenantId,
      status: { in: ['open', 'triaged'] },
    };

    if (repositoryId) {
      where.repositoryId = repositoryId;
    }

    const findings = await this.prisma.finding.findMany({
      where,
      select: {
        id: true,
        severity: true,
        title: true,
        filePath: true,
        cweId: true,
        ruleId: true,
        scanner: true,
      },
    });

    const violations: ControlViolation[] = [];
    const controls = this.getControlsForFramework(frameworkId);

    for (const finding of findings) {
      const affectedControls = this.getAffectedControls(finding, frameworkId);

      for (const affectedControlId of affectedControls) {
        if (controlId && affectedControlId !== controlId) continue;

        const control = controls.find(c => c.id === affectedControlId);
        if (!control) continue;

        violations.push({
          controlId: affectedControlId,
          controlName: control.name,
          framework: frameworkId,
          findingId: finding.id,
          severity: finding.severity,
          title: finding.title,
          filePath: finding.filePath,
        });
      }
    }

    return violations;
  }

  /**
   * Get compliance trend over time
   */
  async getComplianceTrend(
    tenantId: string,
    frameworkId: string,
    days = 30,
    repositoryId?: string,
  ) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get scans within the period
    const where: any = {
      tenantId,
      status: 'completed',
      completedAt: { gte: startDate, lte: endDate },
    };

    if (repositoryId) {
      where.repositoryId = repositoryId;
    }

    const scans = await this.prisma.scan.findMany({
      where,
      orderBy: { completedAt: 'asc' },
      select: {
        id: true,
        completedAt: true,
        findings: {
          select: {
            id: true,
            severity: true,
            cweId: true,
            ruleId: true,
            scanner: true,
            status: true,
          },
        },
      },
    });

    const trendData = scans.map(scan => {
      const openFindings = scan.findings.filter(f => f.status === 'open');
      const score = this.calculateFrameworkScore(
        frameworkId,
        '',
        '',
        openFindings,
      );

      return {
        date: scan.completedAt,
        scanId: scan.id,
        score: score.overallScore,
        failedControls: score.failedControls,
        totalFindings: openFindings.length,
      };
    });

    return {
      framework: frameworkId,
      period: { start: startDate, end: endDate },
      dataPoints: trendData,
    };
  }

  /**
   * Generate compliance report data
   */
  async generateComplianceReport(
    tenantId: string,
    frameworkId: string,
    repositoryId?: string,
  ) {
    const [complianceScore, violations] = await Promise.all([
      repositoryId
        ? this.getRepositoryComplianceScore(tenantId, repositoryId, frameworkId)
        : this.getTenantComplianceScore(tenantId, frameworkId),
      this.getControlViolations(tenantId, frameworkId, undefined, repositoryId),
    ]);

    const framework = getAllFrameworks().find(f => f.id === frameworkId);
    const score = complianceScore.frameworks[0];

    // Group violations by control
    const violationsByControl = new Map<string, ControlViolation[]>();
    for (const violation of violations) {
      const existing = violationsByControl.get(violation.controlId) || [];
      existing.push(violation);
      violationsByControl.set(violation.controlId, existing);
    }

    const controlDetails = score.controlStatus.map(control => ({
      ...control,
      violations: violationsByControl.get(control.controlId) || [],
    }));

    return {
      framework: {
        id: framework?.id,
        name: framework?.name,
        version: framework?.version,
      },
      generatedAt: new Date(),
      summary: {
        overallScore: score.overallScore,
        passedControls: score.passedControls,
        failedControls: score.failedControls,
        totalControls: score.totalControls,
        totalViolations: violations.length,
        criticalViolations: violations.filter(v => v.severity === 'critical').length,
        highViolations: violations.filter(v => v.severity === 'high').length,
      },
      controlDetails,
    };
  }

  private calculateFrameworkScore(
    frameworkId: string,
    frameworkName: string,
    version: string,
    findings: any[],
  ): ComplianceScore {
    const controls = this.getControlsForFramework(frameworkId);
    const controlFindings = new Map<string, { total: number; critical: number; high: number }>();

    // Initialize all controls
    for (const control of controls) {
      controlFindings.set(control.id, { total: 0, critical: 0, high: 0 });
    }

    // Map findings to controls
    for (const finding of findings) {
      const affectedControls = this.getAffectedControls(finding, frameworkId);

      for (const controlId of affectedControls) {
        const existing = controlFindings.get(controlId);
        if (existing) {
          existing.total++;
          if (finding.severity === 'critical') existing.critical++;
          if (finding.severity === 'high') existing.high++;
        }
      }
    }

    // Calculate control statuses
    const controlStatus = controls.map(control => {
      const stats = controlFindings.get(control.id) || { total: 0, critical: 0, high: 0 };
      let status: 'passed' | 'failed' | 'warning' = 'passed';

      if (stats.critical > 0 || stats.high > 2) {
        status = 'failed';
      } else if (stats.total > 0) {
        status = 'warning';
      }

      return {
        controlId: control.id,
        controlName: control.name,
        status,
        findingsCount: stats.total,
        criticalFindings: stats.critical,
        highFindings: stats.high,
      };
    });

    const passedControls = controlStatus.filter(c => c.status === 'passed').length;
    const failedControls = controlStatus.filter(c => c.status === 'failed').length;

    // Calculate overall score (100 - percentage of failed controls)
    const overallScore = Math.round(((passedControls + controlStatus.filter(c => c.status === 'warning').length * 0.5) / controls.length) * 100);

    return {
      framework: frameworkId,
      frameworkName: frameworkName || frameworkId.toUpperCase(),
      version,
      overallScore,
      passedControls,
      failedControls,
      totalControls: controls.length,
      controlStatus,
    };
  }

  private getControlsForFramework(frameworkId: string): ComplianceControl[] {
    switch (frameworkId.toLowerCase()) {
      case 'soc2':
        return SOC2_CONTROLS;
      case 'pci':
      case 'pci-dss':
        return PCIDSS_CONTROLS;
      case 'hipaa':
        return HIPAA_CONTROLS;
      case 'gdpr':
        return GDPR_CONTROLS;
      case 'iso27001':
        return ISO27001_CONTROLS;
      default:
        return [];
    }
  }

  private getAffectedControls(finding: any, frameworkId: string): string[] {
    const controls: string[] = [];

    // Try CWE mapping first
    if (finding.cweId) {
      const cweControls = getControlsForCWE(finding.cweId, frameworkId);
      controls.push(...cweControls);
    }

    // Try category mapping based on scanner/ruleId
    const category = this.inferCategory(finding);
    if (category) {
      const categoryControls = getControlsForCategory(category, frameworkId);
      controls.push(...categoryControls);
    }

    return [...new Set(controls)]; // Deduplicate
  }

  private inferCategory(finding: any): string | null {
    const ruleId = (finding.ruleId || '').toLowerCase();
    const scanner = (finding.scanner || '').toLowerCase();
    const title = (finding.title || '').toLowerCase();

    // Gitleaks findings
    if (scanner === 'gitleaks' || ruleId.includes('secret') || ruleId.includes('key') || ruleId.includes('token')) {
      return 'secrets';
    }

    // SQL injection
    if (ruleId.includes('sql') || title.includes('sql injection')) {
      return 'injection';
    }

    // XSS
    if (ruleId.includes('xss') || title.includes('cross-site scripting')) {
      return 'xss';
    }

    // Authentication
    if (ruleId.includes('auth') || title.includes('authentication')) {
      return 'authentication';
    }

    // Cryptography
    if (ruleId.includes('crypt') || ruleId.includes('hash') || title.includes('crypto')) {
      return 'cryptography';
    }

    // Dependencies
    if (scanner === 'trivy' || ruleId.includes('cve-')) {
      return 'dependency';
    }

    // Configuration
    if (scanner === 'checkov' || ruleId.includes('config')) {
      return 'configuration';
    }

    return null;
  }
}
