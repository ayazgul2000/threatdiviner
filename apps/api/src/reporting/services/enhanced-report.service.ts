// apps/api/src/reporting/services/enhanced-report.service.ts
// Enhanced reporting with CVE/CWE/MITRE/Compliance details

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import * as Minio from 'minio';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportDataService } from './report-data.service';
import { CreateReportDto, ReportType, ReportFormat, ComplianceFramework } from '../dto/report.dto';
import { ScanReportData, EnrichedFinding } from '../interfaces/report-data.interface';

interface GeneratedReport {
  id: string;
  url: string;
  buffer?: Buffer;
  size: number;
  format: string;
}

@Injectable()
export class EnhancedReportService {
  private readonly logger = new Logger(EnhancedReportService.name);
  private readonly minioClient: Minio.Client | null = null;
  private readonly bucketName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly reportDataService: ReportDataService,
  ) {
    const minioEndpoint = this.configService.get('MINIO_ENDPOINT');
    const minioAccessKey = this.configService.get('MINIO_ACCESS_KEY');
    const minioSecretKey = this.configService.get('MINIO_SECRET_KEY');

    if (minioEndpoint && minioAccessKey && minioSecretKey) {
      this.minioClient = new Minio.Client({
        endPoint: minioEndpoint,
        port: parseInt(this.configService.get('MINIO_PORT', '9000'), 10),
        useSSL: this.configService.get('MINIO_USE_SSL', 'false') === 'true',
        accessKey: minioAccessKey,
        secretKey: minioSecretKey,
      });
    }

    this.bucketName = this.configService.get('MINIO_BUCKET', 'threatdiviner-reports');
  }

  /**
   * Generate a report based on type and parameters
   */
  async generateReport(tenantId: string, userId: string, dto: CreateReportDto): Promise<GeneratedReport> {
    this.logger.log(`Generating ${dto.type} report in ${dto.format} format`);

    switch (dto.type) {
      case ReportType.SCAN:
        return this.generateScanReport(tenantId, dto);
      case ReportType.PENTEST:
        return this.generatePentestReport(tenantId, dto);
      case ReportType.REPOSITORY:
        return this.generateRepositoryReport(tenantId, dto);
      case ReportType.COMPLIANCE:
        return this.generateComplianceReport(tenantId, dto);
      case ReportType.THREAT_MODEL:
        return this.generateThreatModelReport(tenantId, dto);
      case ReportType.EXECUTIVE:
        return this.generateExecutiveReport(tenantId, dto);
      default:
        throw new Error(`Report type ${dto.type} not supported`);
    }
  }

  /**
   * Generate detailed scan report with CVE/CWE/MITRE
   */
  private async generateScanReport(tenantId: string, dto: CreateReportDto): Promise<GeneratedReport> {
    if (!dto.scanId) throw new NotFoundException('scanId required for scan report');

    const data = await this.reportDataService.getScanReportData(tenantId, dto.scanId, {
      includeTrends: dto.includeTrends,
      includeAi: dto.includeAiAnalysis,
    });

    switch (dto.format) {
      case ReportFormat.PDF:
        return this.generateScanPdf(tenantId, data, dto);
      case ReportFormat.JSON:
        return this.generateJson(tenantId, data, 'scan');
      case ReportFormat.CSV:
        return this.generateScanCsv(tenantId, data);
      case ReportFormat.HTML:
        return this.generateScanHtml(tenantId, data);
      default:
        throw new Error(`Format ${dto.format} not supported for scan reports`);
    }
  }

  /**
   * Generate PDF with full CVE/CWE/MITRE/Compliance details
   */
  private async generateScanPdf(tenantId: string, data: ScanReportData, dto: CreateReportDto): Promise<GeneratedReport> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Security Scan Report - ${data.repository.name}`,
          Author: 'ThreatDiviner',
          Creator: 'ThreatDiviner Security Platform',
        },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        const id = `scan-${data.scan.id}-${Date.now()}`;
        const url = await this.uploadOrReturnDataUrl(tenantId, id, buffer, 'pdf');
        resolve({ id, url, buffer, size: buffer.length, format: 'pdf' });
      });
      doc.on('error', reject);

      // Header
      this.addPdfHeader(doc, `Security Scan Report`, data.repository.fullName);

      // Executive Summary
      this.addPdfSection(doc, 'Executive Summary');
      this.addScanSummary(doc, data);

      // Scan Metadata
      this.addPdfSection(doc, 'Scan Details');
      this.addScanMetadata(doc, data);

      // Scanner Results
      this.addPdfSection(doc, 'Scanner Results');
      this.addScannerResults(doc, data);

      // Findings by Severity
      this.addPdfSection(doc, 'Findings Overview');
      this.addFindingsOverview(doc, data);

      // Compliance Impact
      if (dto.complianceFrameworks?.length) {
        this.addPdfSection(doc, 'Compliance Impact');
        this.addComplianceImpact(doc, data, dto.complianceFrameworks);
      }

      // Detailed Findings
      this.addPdfSection(doc, 'Detailed Findings');
      this.addDetailedFindings(doc, data, dto.includeRemediation);

      // Footer
      this.addPdfFooter(doc);

      doc.end();
    });
  }

  private addPdfHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
    doc
      .fontSize(24)
      .fillColor('#1a365d')
      .text('ThreatDiviner', { align: 'center' })
      .fontSize(16)
      .fillColor('#4a5568')
      .text(title, { align: 'center' })
      .fontSize(12)
      .text(subtitle, { align: 'center' })
      .moveDown(0.5);

    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(1);
  }

  private addPdfSection(doc: PDFKit.PDFDocument, title: string): void {
    if (doc.y > 700) doc.addPage();

    doc
      .fontSize(14)
      .fillColor('#1a365d')
      .font('Helvetica-Bold')
      .text(title)
      .font('Helvetica')
      .moveDown(0.5);
  }

  private addScanSummary(doc: PDFKit.PDFDocument, data: ScanReportData): void {
    const { summary } = data;
    const statusColor = summary.critical > 0 ? '#c53030' : summary.high > 0 ? '#dd6b20' : summary.medium > 0 ? '#d69e2e' : '#38a169';
    const statusText = summary.critical > 0 ? 'CRITICAL - Immediate action required' :
                       summary.high > 0 ? 'HIGH RISK - Address soon' :
                       summary.medium > 0 ? 'MODERATE - Review recommended' : 'LOW RISK - Scan passed';

    doc.fontSize(12).fillColor(statusColor).text(statusText).moveDown(0.3);
    doc.fontSize(10).fillColor('#4a5568')
      .text(`Total Findings: ${summary.total}`)
      .text(`Critical: ${summary.critical} | High: ${summary.high} | Medium: ${summary.medium} | Low: ${summary.low}`)
      .moveDown(1);
  }

  private addScanMetadata(doc: PDFKit.PDFDocument, data: ScanReportData): void {
    const metadata = [
      ['Repository', data.repository.fullName],
      ['Branch', data.scan.branch],
      ['Commit', data.scan.commitSha.substring(0, 8)],
      ['Status', data.scan.status],
      ['Started', data.scan.startedAt?.toISOString() || 'N/A'],
      ['Completed', data.scan.completedAt?.toISOString() || 'N/A'],
      ['Duration', data.scan.duration ? `${data.scan.duration}s` : 'N/A'],
      ['Triggered By', data.scan.triggeredBy],
    ];

    doc.fontSize(9).fillColor('#4a5568');
    metadata.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(value as string);
    });
    doc.moveDown(1);
  }

  private addScannerResults(doc: PDFKit.PDFDocument, data: ScanReportData): void {
    const tableTop = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a365d');
    doc.text('Scanner', 50, tableTop, { width: 100 });
    doc.text('Category', 150, tableTop, { width: 80 });
    doc.text('Status', 230, tableTop, { width: 80 });
    doc.text('Findings', 310, tableTop, { width: 60 });
    doc.text('Duration', 370, tableTop, { width: 60 });

    doc.y = tableTop + 15;
    doc.strokeColor('#e2e8f0').moveTo(50, doc.y).lineTo(450, doc.y).stroke();
    doc.y += 5;

    doc.font('Helvetica').fontSize(8).fillColor('#4a5568');
    for (const sr of data.scannerResults) {
      doc.text(sr.scanner, 50, doc.y, { width: 100 });
      doc.text(sr.category, 150, doc.y, { width: 80 });
      doc.text(sr.status, 230, doc.y, { width: 80 });
      doc.text(String(sr.findingsCount), 310, doc.y, { width: 60 });
      doc.text(sr.duration ? `${sr.duration}ms` : '-', 370, doc.y, { width: 60 });
      doc.y += 12;
    }
    doc.moveDown(1);
  }

  private addFindingsOverview(doc: PDFKit.PDFDocument, data: ScanReportData): void {
    const { summary } = data;
    const severities = [
      { label: 'Critical', count: summary.critical, color: '#c53030' },
      { label: 'High', count: summary.high, color: '#dd6b20' },
      { label: 'Medium', count: summary.medium, color: '#d69e2e' },
      { label: 'Low', count: summary.low, color: '#3182ce' },
    ];

    const barWidth = 300;
    const barHeight = 16;
    const startX = 120;
    let y = doc.y;

    severities.forEach((sev) => {
      doc.fontSize(9).fillColor('#4a5568').text(sev.label, 50, y + 3, { width: 60 });
      doc.rect(startX, y, barWidth, barHeight).fillColor('#e2e8f0').fill();

      if (sev.count > 0 && summary.total > 0) {
        const fillWidth = (sev.count / summary.total) * barWidth;
        doc.rect(startX, y, fillWidth, barHeight).fillColor(sev.color).fill();
      }

      doc.fontSize(9).fillColor('#2d3748').text(String(sev.count), startX + barWidth + 10, y + 3);
      y += barHeight + 4;
    });

    doc.y = y + 10;
    doc.moveDown(1);
  }

  private addComplianceImpact(doc: PDFKit.PDFDocument, data: ScanReportData, frameworks: ComplianceFramework[]): void {
    const complianceMap: Record<string, EnrichedFinding[]> = {};

    for (const f of data.findings) {
      for (const c of f.compliance) {
        if (frameworks.includes(c.framework as ComplianceFramework)) {
          if (!complianceMap[c.framework]) complianceMap[c.framework] = [];
          complianceMap[c.framework].push(f);
        }
      }
    }

    for (const [framework, findings] of Object.entries(complianceMap)) {
      doc.fontSize(10).fillColor('#1a365d').font('Helvetica-Bold').text(this.getFrameworkDisplayName(framework));
      doc.font('Helvetica').fontSize(9).fillColor('#4a5568');

      const controls = new Set<string>();
      findings.forEach((f) => {
        f.compliance.filter((c) => c.framework === framework).forEach((c) => {
          controls.add(`${c.controlId}: ${c.controlName}`);
        });
      });

      doc.text(`Affected Controls: ${controls.size}`).text(`Related Findings: ${findings.length}`);
      controls.forEach((ctrl) => doc.text(`  • ${ctrl}`));
      doc.moveDown(0.5);
    }
    doc.moveDown(1);
  }

  private addDetailedFindings(doc: PDFKit.PDFDocument, data: ScanReportData, includeRemediation?: boolean): void {
    const criticalHigh = data.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').slice(0, 20);

    for (const f of criticalHigh) {
      if (doc.y > 680) doc.addPage();

      const sevColor = f.severity === 'critical' ? '#c53030' : '#dd6b20';

      doc.fontSize(11).fillColor(sevColor).font('Helvetica-Bold').text(f.title).font('Helvetica').moveDown(0.2);
      doc.fontSize(8).fillColor('#718096').text(`${f.scanner} | ${f.ruleId} | ${f.filePath}:${f.startLine || 0}`);

      if (f.description) {
        doc.fontSize(9).fillColor('#4a5568').text(this.truncate(f.description, 300)).moveDown(0.2);
      }

      // CVE Info
      if (f.cve) {
        doc.fontSize(8).fillColor('#c53030').text(`CVE: ${f.cve.id} | CVSS: ${f.cve.cvssV3Score || 'N/A'} | ${f.cve.cvssV3Severity || ''}`);
        if (f.cve.isKev) doc.fillColor('#9b2c2c').text('⚠️ CISA KEV - Known Exploited Vulnerability');
        if (f.cve.epssScore) doc.fillColor('#744210').text(`EPSS Score: ${(f.cve.epssScore * 100).toFixed(1)}% probability of exploitation`);
      }

      // CWE Info
      if (f.cwe) {
        doc.fontSize(8).fillColor('#2b6cb0').text(`CWE: ${f.cwe.id} - ${f.cwe.name}`);
      }

      // OWASP Info
      if (f.owasp) {
        doc.fontSize(8).fillColor('#6b46c1').text(`OWASP ${f.owasp.year} #${f.owasp.rank}: ${f.owasp.name}`);
      }

      // ATT&CK Info
      if (f.attack?.length) {
        const techniques = f.attack.map((a) => `${a.techniqueId} (${a.name})`).join(', ');
        doc.fontSize(8).fillColor('#c05621').text(`MITRE ATT&CK: ${techniques}`);
      }

      // Compliance
      if (f.compliance.length) {
        const frameworks = [...new Set(f.compliance.map((c) => c.frameworkName))].join(', ');
        doc.fontSize(8).fillColor('#2f855a').text(`Compliance: ${frameworks}`);
      }

      // Remediation
      if (includeRemediation && f.remediation.steps.length) {
        doc.fontSize(8).fillColor('#2b6cb0').text('Remediation:');
        f.remediation.steps.slice(0, 3).forEach((step) => {
          doc.fontSize(8).fillColor('#4a5568').text(`  • ${this.truncate(step, 100)}`);
        });
      }

      // AI Analysis
      if (f.aiAnalysis?.analysis) {
        doc.fontSize(8).fillColor('#805ad5').text(`AI Insight: ${this.truncate(f.aiAnalysis.analysis, 150)}`);
      }

      doc.moveDown(0.8);
    }

    if (data.findings.length > 20) {
      doc.fontSize(9).fillColor('#718096').text(`... and ${data.findings.length - 20} more findings. View all in the ThreatDiviner dashboard.`);
    }
  }

  private addPdfFooter(doc: PDFKit.PDFDocument): void {
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#a0aec0')
        .text(`Generated by ThreatDiviner | ${new Date().toISOString()} | Page ${i + 1} of ${pageCount}`, 50, 780, { align: 'center' });
    }
  }

  // Helper methods
  private truncate(str: string | null, maxLen: number): string {
    if (!str) return '';
    return str.length <= maxLen ? str : str.substring(0, maxLen - 3) + '...';
  }

  private getFrameworkDisplayName(framework: string): string {
    const names: Record<string, string> = {
      soc2: 'SOC 2 Type II', pci_dss: 'PCI DSS 4.0', hipaa: 'HIPAA', gdpr: 'GDPR',
      iso27001: 'ISO 27001', nist_csf: 'NIST CSF', cis: 'CIS Controls', owasp: 'OWASP',
      essential_eight: 'Essential Eight',
    };
    return names[framework] || framework.toUpperCase();
  }

  private async uploadOrReturnDataUrl(tenantId: string, id: string, buffer: Buffer, ext: string): Promise<string> {
    if (this.minioClient) {
      const objectName = `${tenantId}/reports/${id}.${ext}`;
      try {
        const exists = await this.minioClient.bucketExists(this.bucketName);
        if (!exists) await this.minioClient.makeBucket(this.bucketName);
        await this.minioClient.putObject(this.bucketName, objectName, buffer, buffer.length, {
          'Content-Type': ext === 'pdf' ? 'application/pdf' : ext === 'json' ? 'application/json' : 'text/csv',
        });
        return await this.minioClient.presignedGetObject(this.bucketName, objectName, 86400);
      } catch (error) {
        this.logger.error('MinIO upload failed', error);
      }
    }
    const base64 = buffer.toString('base64');
    const mimeType = ext === 'pdf' ? 'application/pdf' : ext === 'json' ? 'application/json' : 'text/csv';
    return `data:${mimeType};base64,${base64}`;
  }

  // Stub implementations for other report types
  private async generatePentestReport(tenantId: string, dto: CreateReportDto): Promise<GeneratedReport> {
    throw new Error('Pentest report not yet implemented');
  }

  private async generateRepositoryReport(tenantId: string, dto: CreateReportDto): Promise<GeneratedReport> {
    throw new Error('Repository report not yet implemented');
  }

  private async generateComplianceReport(tenantId: string, dto: CreateReportDto): Promise<GeneratedReport> {
    throw new Error('Compliance report not yet implemented');
  }

  private async generateThreatModelReport(tenantId: string, dto: CreateReportDto): Promise<GeneratedReport> {
    throw new Error('Threat model report not yet implemented');
  }

  private async generateExecutiveReport(tenantId: string, dto: CreateReportDto): Promise<GeneratedReport> {
    throw new Error('Executive report not yet implemented');
  }

  private async generateJson(tenantId: string, data: any, prefix: string): Promise<GeneratedReport> {
    const buffer = Buffer.from(JSON.stringify(data, null, 2));
    const id = `${prefix}-${Date.now()}`;
    const url = await this.uploadOrReturnDataUrl(tenantId, id, buffer, 'json');
    return { id, url, buffer, size: buffer.length, format: 'json' };
  }

  private async generateScanCsv(tenantId: string, data: ScanReportData): Promise<GeneratedReport> {
    const headers = ['ID', 'Title', 'Severity', 'Status', 'Scanner', 'Rule ID', 'File', 'Line', 'CVE', 'CWE', 'CVSS', 'EPSS', 'KEV', 'Compliance'];
    const rows = data.findings.map((f) => [
      f.id, f.title, f.severity, f.status, f.scanner, f.ruleId, f.filePath, f.startLine || '',
      f.cve?.id || '', f.cwe?.id || '', f.cve?.cvssV3Score || '', f.cve?.epssScore || '',
      f.cve?.isKev ? 'Yes' : '', f.compliance.map((c) => c.controlId).join(';'),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const buffer = Buffer.from(csv);
    const id = `scan-${data.scan.id}-${Date.now()}`;
    const url = await this.uploadOrReturnDataUrl(tenantId, id, buffer, 'csv');
    return { id, url, buffer, size: buffer.length, format: 'csv' };
  }

  private async generateScanHtml(tenantId: string, data: ScanReportData): Promise<GeneratedReport> {
    // Simple HTML report
    const html = `<!DOCTYPE html>
<html><head><title>Scan Report - ${data.repository.name}</title>
<style>body{font-family:sans-serif;margin:40px}h1{color:#1a365d}.critical{color:#c53030}.high{color:#dd6b20}.medium{color:#d69e2e}.low{color:#3182ce}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f7fafc}</style>
</head><body>
<h1>ThreatDiviner Security Scan Report</h1>
<h2>${data.repository.fullName}</h2>
<p>Branch: ${data.scan.branch} | Commit: ${data.scan.commitSha.substring(0, 8)} | Date: ${data.generatedAt.toISOString()}</p>
<h3>Summary</h3>
<p>Total: ${data.summary.total} | <span class="critical">Critical: ${data.summary.critical}</span> | <span class="high">High: ${data.summary.high}</span> | <span class="medium">Medium: ${data.summary.medium}</span> | <span class="low">Low: ${data.summary.low}</span></p>
<h3>Findings</h3>
<table><tr><th>Severity</th><th>Title</th><th>File</th><th>CVE</th><th>CWE</th></tr>
${data.findings.slice(0, 100).map((f) => `<tr><td class="${f.severity}">${f.severity}</td><td>${f.title}</td><td>${f.filePath}:${f.startLine || ''}</td><td>${f.cve?.id || ''}</td><td>${f.cwe?.id || ''}</td></tr>`).join('')}
</table>
</body></html>`;

    const buffer = Buffer.from(html);
    const id = `scan-${data.scan.id}-${Date.now()}`;
    const url = await this.uploadOrReturnDataUrl(tenantId, id, buffer, 'html');
    return { id, url, buffer, size: buffer.length, format: 'html' };
  }
}
