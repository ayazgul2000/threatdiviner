import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as ExcelJS from 'exceljs';

export type ExportFormat = 'csv' | 'json' | 'xlsx';

export interface ExportOptions {
  format: ExportFormat;
  filters?: {
    projectId?: string;
    repositoryId?: string;
    scanId?: string;
    severity?: string[];
    status?: string[];
    startDate?: Date;
    endDate?: Date;
  };
}

export interface ExportResult {
  filename: string;
  contentType: string;
  data: string | Buffer;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export findings data
   */
  async exportFindings(tenantId: string, options: ExportOptions): Promise<ExportResult> {
    const { format, filters = {} } = options;

    const where: any = { tenantId };

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }
    if (filters.repositoryId) {
      where.scan = { repositoryId: filters.repositoryId };
    }
    if (filters.scanId) {
      where.scanId = filters.scanId;
    }
    if (filters.severity?.length) {
      where.severity = { in: filters.severity };
    }
    if (filters.status?.length) {
      where.status = { in: filters.status };
    }
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const findings = await this.prisma.finding.findMany({
      where,
      include: {
        scan: {
          include: {
            repository: {
              select: { fullName: true },
            },
          },
        },
      },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });

    this.logger.log(`Exporting ${findings.length} findings as ${format}`);

    const exportData = findings.map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      status: f.status,
      scanner: f.scanner,
      ruleId: f.ruleId,
      filePath: f.filePath,
      lineStart: f.startLine,
      lineEnd: f.endLine,
      description: f.description,
      recommendation: f.aiRemediation || '',
      cweId: f.cweId,
      cveId: f.cveId,
      cvss: '',
      repository: f.scan?.repository?.fullName || '',
      branch: f.scan?.branch || '',
      commitSha: f.scan?.commitSha || '',
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }));

    if (format === 'json') {
      return {
        filename: `findings-export-${Date.now()}.json`,
        contentType: 'application/json',
        data: JSON.stringify(exportData, null, 2),
      };
    }

    const columns = [
      'id', 'title', 'severity', 'status', 'scanner', 'ruleId',
      'filePath', 'lineStart', 'lineEnd', 'description', 'recommendation',
      'cweId', 'cveId', 'cvss', 'repository', 'branch', 'commitSha',
      'createdAt', 'updatedAt',
    ];

    if (format === 'xlsx') {
      const xlsxData = await this.convertToExcel(exportData, columns, 'Findings');
      return {
        filename: `findings-export-${Date.now()}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: xlsxData,
      };
    }

    // CSV format
    const csvData = this.convertToCSV(exportData, columns);

    return {
      filename: `findings-export-${Date.now()}.csv`,
      contentType: 'text/csv',
      data: csvData,
    };
  }

  /**
   * Export scans data
   */
  async exportScans(tenantId: string, options: ExportOptions): Promise<ExportResult> {
    const { format, filters = {} } = options;

    const where: any = { tenantId };

    if (filters.repositoryId) {
      where.repositoryId = filters.repositoryId;
    }
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const scans = await this.prisma.scan.findMany({
      where,
      include: {
        repository: {
          select: { fullName: true },
        },
        _count: {
          select: { findings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(`Exporting ${scans.length} scans as ${format}`);

    const exportData = scans.map(s => ({
      id: s.id,
      repository: s.repository?.fullName || '',
      branch: s.branch,
      commitSha: s.commitSha,
      status: s.status,
      triggeredBy: s.triggeredBy,
      startedAt: s.startedAt?.toISOString() || '',
      completedAt: s.completedAt?.toISOString() || '',
      durationSeconds: s.duration || '',
      findingsCount: s._count.findings,
      errorMessage: s.errorMessage || '',
      createdAt: s.createdAt.toISOString(),
    }));

    if (format === 'json') {
      return {
        filename: `scans-export-${Date.now()}.json`,
        contentType: 'application/json',
        data: JSON.stringify(exportData, null, 2),
      };
    }

    const columns = [
      'id', 'repository', 'branch', 'commitSha', 'status', 'triggeredBy',
      'startedAt', 'completedAt', 'durationSeconds', 'findingsCount',
      'errorMessage', 'createdAt',
    ];

    if (format === 'xlsx') {
      const xlsxData = await this.convertToExcel(exportData, columns, 'Scans');
      return {
        filename: `scans-export-${Date.now()}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: xlsxData,
      };
    }

    const csvData = this.convertToCSV(exportData, columns);

    return {
      filename: `scans-export-${Date.now()}.csv`,
      contentType: 'text/csv',
      data: csvData,
    };
  }

  /**
   * Export repositories data
   */
  async exportRepositories(tenantId: string, options: ExportOptions): Promise<ExportResult> {
    const { format } = options;

    const repositories = await this.prisma.repository.findMany({
      where: { tenantId, isActive: true },
      include: {
        _count: {
          select: { scans: true },
        },
        scans: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true,
            createdAt: true,
          },
        },
      },
    });

    this.logger.log(`Exporting ${repositories.length} repositories as ${format}`);

    const exportData = repositories.map(r => ({
      id: r.id,
      name: r.name,
      fullName: r.fullName,
      htmlUrl: r.htmlUrl,
      defaultBranch: r.defaultBranch,
      language: r.language || '',
      isPrivate: r.isPrivate,
      totalScans: r._count.scans,
      lastScanStatus: r.scans[0]?.status || '',
      lastScanDate: r.scans[0]?.createdAt?.toISOString() || '',
      createdAt: r.createdAt.toISOString(),
    }));

    if (format === 'json') {
      return {
        filename: `repositories-export-${Date.now()}.json`,
        contentType: 'application/json',
        data: JSON.stringify(exportData, null, 2),
      };
    }

    const columns = [
      'id', 'name', 'fullName', 'htmlUrl', 'defaultBranch', 'language',
      'isPrivate', 'totalScans', 'lastScanStatus', 'lastScanDate', 'createdAt',
    ];

    if (format === 'xlsx') {
      const xlsxData = await this.convertToExcel(exportData, columns, 'Repositories');
      return {
        filename: `repositories-export-${Date.now()}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: xlsxData,
      };
    }

    const csvData = this.convertToCSV(exportData, columns);

    return {
      filename: `repositories-export-${Date.now()}.csv`,
      contentType: 'text/csv',
      data: csvData,
    };
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(tenantId: string, options: ExportOptions): Promise<ExportResult> {
    const { format, filters = {} } = options;

    const where: any = { tenantId };

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000, // Limit to prevent memory issues
    });

    this.logger.log(`Exporting ${logs.length} audit logs as ${format}`);

    const exportData = logs.map(l => ({
      id: l.id,
      action: l.action,
      resource: l.resource,
      resourceId: l.resourceId || '',
      userId: l.userId || '',
      userEmail: l.userEmail || '',
      ipAddress: l.ipAddress || '',
      userAgent: l.userAgent || '',
      details: typeof l.details === 'object' ? JSON.stringify(l.details) : '',
      createdAt: l.createdAt.toISOString(),
    }));

    if (format === 'json') {
      return {
        filename: `audit-logs-export-${Date.now()}.json`,
        contentType: 'application/json',
        data: JSON.stringify(exportData, null, 2),
      };
    }

    const columns = [
      'id', 'action', 'resource', 'resourceId', 'userId', 'userEmail',
      'ipAddress', 'userAgent', 'details', 'createdAt',
    ];

    if (format === 'xlsx') {
      const xlsxData = await this.convertToExcel(exportData, columns, 'Audit Logs');
      return {
        filename: `audit-logs-export-${Date.now()}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: xlsxData,
      };
    }

    const csvData = this.convertToCSV(exportData, columns);

    return {
      filename: `audit-logs-export-${Date.now()}.csv`,
      contentType: 'text/csv',
      data: csvData,
    };
  }

  /**
   * Generate SARIF report for a scan
   */
  async exportScanSarif(tenantId: string, scanId: string): Promise<ExportResult> {
    const scan = await this.prisma.scan.findFirst({
      where: { id: scanId, tenantId },
      include: {
        repository: true,
        findings: true,
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    const sarif = {
      version: '2.1.0',
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [
        {
          tool: {
            driver: {
              name: 'ThreatDiviner',
              version: '1.0.0',
              informationUri: 'https://threatdiviner.com',
              rules: this.buildSarifRules(scan.findings),
            },
          },
          results: scan.findings.map(f => ({
            ruleId: f.ruleId,
            level: this.mapSeverityToSarif(f.severity),
            message: {
              text: f.description || f.title,
            },
            locations: f.filePath ? [{
              physicalLocation: {
                artifactLocation: {
                  uri: f.filePath,
                },
                region: {
                  startLine: f.startLine || 1,
                  endLine: f.endLine || f.startLine || 1,
                },
              },
            }] : [],
          })),
          versionControlProvenance: [{
            repositoryUri: scan.repository?.htmlUrl,
            revisionId: scan.commitSha,
            branch: scan.branch,
          }],
        },
      ],
    };

    return {
      filename: `scan-${scanId}-sarif.json`,
      contentType: 'application/json',
      data: JSON.stringify(sarif, null, 2),
    };
  }

  /**
   * Convert array of objects to CSV string
   */
  private convertToCSV(data: any[], columns: string[]): string {
    if (data.length === 0) {
      return columns.join(',') + '\n';
    }

    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = columns.join(',');
    const rows = data.map(row =>
      columns.map(col => escapeCSV(row[col])).join(',')
    );

    return [header, ...rows].join('\n');
  }

  /**
   * Convert array of objects to Excel buffer
   */
  private async convertToExcel(
    data: any[],
    columns: string[],
    sheetName: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ThreatDiviner';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName);

    // Define columns with headers and widths
    worksheet.columns = columns.map((col) => ({
      header: this.formatColumnHeader(col),
      key: col,
      width: this.getColumnWidth(col),
    }));

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Add data rows
    for (const row of data) {
      const newRow = worksheet.addRow(row);

      // Apply severity-based styling for findings
      if (row.severity) {
        const severityCell = newRow.getCell('severity');
        switch (row.severity.toLowerCase()) {
          case 'critical':
            severityCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF8B0000' },
            };
            severityCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            break;
          case 'high':
            severityCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFF4500' },
            };
            severityCell.font = { color: { argb: 'FFFFFFFF' } };
            break;
          case 'medium':
            severityCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFA500' },
            };
            break;
          case 'low':
            severityCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF90EE90' },
            };
            break;
        }
      }

      // Apply status styling
      if (row.status) {
        const statusCell = newRow.getCell('status');
        switch (row.status.toLowerCase()) {
          case 'open':
            statusCell.font = { color: { argb: 'FFFF0000' } };
            break;
          case 'resolved':
          case 'fixed':
            statusCell.font = { color: { argb: 'FF008000' } };
            break;
          case 'suppressed':
          case 'false_positive':
            statusCell.font = { color: { argb: 'FF808080' } };
            break;
        }
      }
    }

    // Add filters to header row
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Add borders to all cells
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Format column header for display
   */
  private formatColumnHeader(column: string): string {
    return column
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/Id$/, 'ID')
      .replace(/Sha$/, 'SHA')
      .replace(/Url$/, 'URL')
      .replace(/Cwe/, 'CWE')
      .replace(/Cve/, 'CVE')
      .replace(/Cvss/, 'CVSS');
  }

  /**
   * Get appropriate column width based on column name
   */
  private getColumnWidth(column: string): number {
    const widthMap: Record<string, number> = {
      id: 36,
      title: 50,
      description: 60,
      recommendation: 60,
      filePath: 40,
      repository: 30,
      fullName: 30,
      htmlUrl: 40,
      userAgent: 40,
      details: 50,
      errorMessage: 40,
      commitSha: 12,
      branch: 20,
      severity: 12,
      status: 12,
      scanner: 15,
      ruleId: 25,
      lineStart: 10,
      lineEnd: 10,
      cweId: 12,
      cveId: 15,
      cvss: 8,
      action: 20,
      resource: 20,
      resourceId: 36,
      userId: 36,
      userEmail: 30,
      ipAddress: 15,
      createdAt: 22,
      updatedAt: 22,
      startedAt: 22,
      completedAt: 22,
    };
    return widthMap[column] || 15;
  }

  /**
   * Build SARIF rules from findings
   */
  private buildSarifRules(findings: any[]): any[] {
    const rulesMap = new Map<string, any>();

    for (const f of findings) {
      if (!rulesMap.has(f.ruleId)) {
        rulesMap.set(f.ruleId, {
          id: f.ruleId,
          name: f.title,
          shortDescription: { text: f.title },
          fullDescription: { text: f.description || f.title },
          defaultConfiguration: {
            level: this.mapSeverityToSarif(f.severity),
          },
          properties: {
            security: f.severity,
            cwe: f.cweId,
          },
        });
      }
    }

    return Array.from(rulesMap.values());
  }

  /**
   * Map severity to SARIF level
   */
  private mapSeverityToSarif(severity: string): string {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'note';
    }
  }

  /**
   * Export SBOM (Software Bill of Materials) in CycloneDX format
   */
  async exportSbom(tenantId: string, repositoryId: string): Promise<ExportResult> {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, tenantId },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    // Get latest scan with vulnerability findings (usually from Trivy)
    const latestScan = await this.prisma.scan.findFirst({
      where: { repositoryId, tenantId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      include: {
        findings: {
          where: { scanner: { in: ['trivy', 'snyk', 'dependabot'] } },
        },
      },
    });

    // Extract unique components from findings
    const componentsMap = new Map<string, {
      name: string;
      version: string;
      type: string;
      vulnerabilities: {
        id: string;
        severity: string;
        description: string;
      }[];
    }>();

    if (latestScan?.findings) {
      for (const finding of latestScan.findings) {
        // Parse component info from finding (format varies by scanner)
        const componentInfo = this.parseComponentFromFinding(finding);
        if (componentInfo) {
          const key = `${componentInfo.name}@${componentInfo.version}`;
          const existing = componentsMap.get(key);
          if (existing) {
            existing.vulnerabilities.push({
              id: finding.cveId || finding.ruleId,
              severity: finding.severity,
              description: finding.description || finding.title,
            });
          } else {
            componentsMap.set(key, {
              ...componentInfo,
              vulnerabilities: [{
                id: finding.cveId || finding.ruleId,
                severity: finding.severity,
                description: finding.description || finding.title,
              }],
            });
          }
        }
      }
    }

    // Build CycloneDX SBOM
    const sbom = {
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      serialNumber: `urn:uuid:${crypto.randomUUID()}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: [{
          vendor: 'ThreatDiviner',
          name: 'ThreatDiviner Security Platform',
          version: '1.0.0',
        }],
        component: {
          type: 'application',
          name: repository.name,
          version: latestScan?.commitSha?.substring(0, 7) || '0.0.0',
        },
      },
      components: Array.from(componentsMap.values()).map((comp) => ({
        type: comp.type,
        name: comp.name,
        version: comp.version,
        'bom-ref': `pkg:${comp.type}/${comp.name}@${comp.version}`,
        purl: `pkg:${comp.type}/${comp.name}@${comp.version}`,
      })),
      vulnerabilities: Array.from(componentsMap.values()).flatMap((comp) =>
        comp.vulnerabilities.map((vuln) => ({
          id: vuln.id,
          source: { name: 'ThreatDiviner' },
          ratings: [{
            severity: vuln.severity,
            method: 'other',
          }],
          description: vuln.description,
          affects: [{
            ref: `pkg:${comp.type}/${comp.name}@${comp.version}`,
          }],
        }))
      ),
    };

    return {
      filename: `sbom-${repository.name}-${Date.now()}.json`,
      contentType: 'application/vnd.cyclonedx+json',
      data: JSON.stringify(sbom, null, 2),
    };
  }

  private parseComponentFromFinding(finding: any): { name: string; version: string; type: string } | null {
    // Try to extract package info from finding title or file path
    const title = finding.title || '';
    const filePath = finding.filePath || '';

    // Common patterns
    // "CVE-XXXX in package@version"
    const packageMatch = title.match(/in\s+(\S+)@(\S+)/);
    if (packageMatch) {
      return {
        name: packageMatch[1],
        version: packageMatch[2],
        type: this.detectPackageType(filePath),
      };
    }

    // "package (version)"
    const altMatch = title.match(/(\S+)\s+\(([^)]+)\)/);
    if (altMatch) {
      return {
        name: altMatch[1],
        version: altMatch[2],
        type: this.detectPackageType(filePath),
      };
    }

    return null;
  }

  private detectPackageType(filePath: string): string {
    if (filePath.includes('package.json') || filePath.includes('node_modules')) return 'npm';
    if (filePath.includes('requirements.txt') || filePath.includes('.py')) return 'pypi';
    if (filePath.includes('Gemfile') || filePath.includes('.rb')) return 'gem';
    if (filePath.includes('go.mod') || filePath.includes('.go')) return 'golang';
    if (filePath.includes('pom.xml') || filePath.includes('.jar')) return 'maven';
    if (filePath.includes('Cargo.toml') || filePath.includes('.rs')) return 'cargo';
    if (filePath.includes('composer.json') || filePath.includes('.php')) return 'composer';
    return 'generic';
  }
}
