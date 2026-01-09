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

  /**
   * Generate pentest report with methodology, findings, and recommendations
   */
  private async generatePentestReport(tenantId: string, dto: CreateReportDto): Promise<GeneratedReport> {
    if (!dto.targetId) throw new NotFoundException('targetId required for pentest report');

    const target = await this.prisma.pentestTarget.findFirst({
      where: { id: dto.targetId, tenantId },
      include: {
        scans: {
          orderBy: { startedAt: 'desc' },
          take: 10,
          include: {
            scannerResults: true,
          },
        },
      },
    });

    if (!target) throw new NotFoundException('Pentest target not found');

    // Gather findings from scans
    const findings = await this.prisma.securityFinding.findMany({
      where: {
        scan: { pentestTargetId: target.id },
        tenantId,
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Penetration Test Report - ${target.name}`,
          Author: 'ThreatDiviner',
        },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        const id = `pentest-${target.id}-${Date.now()}`;
        const url = await this.uploadOrReturnDataUrl(tenantId, id, buffer, 'pdf');
        resolve({ id, url, buffer, size: buffer.length, format: 'pdf' });
      });
      doc.on('error', reject);

      // Cover Page
      this.addPdfHeader(doc, 'Penetration Test Report', target.name);

      // Engagement Overview
      this.addPdfSection(doc, 'Engagement Overview');
      doc.fontSize(10).fillColor('#4a5568');
      doc.text(`Target: ${target.name}`);
      doc.text(`Type: ${target.type || 'Web Application'}`);
      doc.text(`URL/IP: ${target.url || target.ipAddress || 'N/A'}`);
      doc.text(`Status: ${target.status}`);
      doc.text(`Test Period: ${target.createdAt.toLocaleDateString()} - ${new Date().toLocaleDateString()}`);
      doc.moveDown(1);

      // Executive Summary
      this.addPdfSection(doc, 'Executive Summary');
      const critical = findings.filter(f => f.severity === 'critical').length;
      const high = findings.filter(f => f.severity === 'high').length;
      const medium = findings.filter(f => f.severity === 'medium').length;
      const low = findings.filter(f => f.severity === 'low').length;

      const riskLevel = critical > 0 ? 'CRITICAL' : high > 0 ? 'HIGH' : medium > 0 ? 'MEDIUM' : 'LOW';
      const riskColor = critical > 0 ? '#c53030' : high > 0 ? '#dd6b20' : medium > 0 ? '#d69e2e' : '#38a169';

      doc.fontSize(12).fillColor(riskColor).text(`Overall Risk Level: ${riskLevel}`);
      doc.fontSize(10).fillColor('#4a5568');
      doc.text(`Total vulnerabilities identified: ${findings.length}`);
      doc.text(`  • Critical: ${critical}`);
      doc.text(`  • High: ${high}`);
      doc.text(`  • Medium: ${medium}`);
      doc.text(`  • Low: ${low}`);
      doc.moveDown(1);

      // Methodology
      this.addPdfSection(doc, 'Testing Methodology');
      doc.fontSize(9).fillColor('#4a5568');
      doc.text('The penetration test was conducted following industry-standard methodologies:');
      doc.text('  1. Reconnaissance - Information gathering and asset discovery');
      doc.text('  2. Scanning - Automated vulnerability scanning with multiple tools');
      doc.text('  3. Enumeration - Service identification and version detection');
      doc.text('  4. Exploitation - Manual verification of vulnerabilities');
      doc.text('  5. Post-Exploitation - Assessment of potential impact');
      doc.text('  6. Reporting - Documentation of findings and recommendations');
      doc.moveDown(1);

      // Tools Used
      this.addPdfSection(doc, 'Tools Used');
      const scannerTypes = [...new Set(target.scans.flatMap(s => s.scannerResults.map((sr: any) => sr.scanner)))];
      doc.fontSize(9).fillColor('#4a5568');
      scannerTypes.forEach(tool => {
        doc.text(`  • ${tool}`);
      });
      doc.moveDown(1);

      // Findings
      this.addPdfSection(doc, 'Detailed Findings');
      const sortedFindings = findings.sort((a, b) => {
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
      });

      sortedFindings.slice(0, 30).forEach((f, i) => {
        if (doc.y > 680) doc.addPage();

        const sevColor = f.severity === 'critical' ? '#c53030' : f.severity === 'high' ? '#dd6b20' : f.severity === 'medium' ? '#d69e2e' : '#3182ce';
        doc.fontSize(10).fillColor(sevColor).font('Helvetica-Bold');
        doc.text(`${i + 1}. ${f.title} [${f.severity.toUpperCase()}]`);
        doc.font('Helvetica').fontSize(9).fillColor('#4a5568');
        doc.text(`Location: ${f.filePath || f.affectedAsset || 'N/A'}`);
        if (f.description) doc.text(`Description: ${this.truncate(f.description, 200)}`);
        if (f.cweId) doc.text(`CWE: ${f.cweId}`);

        // Recommendations
        doc.text('Recommendation: ' + (f.remediation || 'Review and remediate according to security best practices.'));
        doc.moveDown(0.5);
      });

      if (findings.length > 30) {
        doc.fontSize(9).fillColor('#718096');
        doc.text(`... and ${findings.length - 30} additional findings. See the full report in the dashboard.`);
      }

      // Recommendations Summary
      doc.addPage();
      this.addPdfSection(doc, 'Recommendations Summary');
      doc.fontSize(9).fillColor('#4a5568');
      doc.text('1. Address all Critical and High severity findings immediately');
      doc.text('2. Implement a vulnerability management program for ongoing assessment');
      doc.text('3. Conduct regular penetration testing (at least annually)');
      doc.text('4. Review and update security policies based on findings');
      doc.text('5. Provide security awareness training to development teams');

      this.addPdfFooter(doc);
      doc.end();
    });
  }

  /**
   * Generate repository security posture report
   */
  private async generateRepositoryReport(tenantId: string, dto: CreateReportDto): Promise<GeneratedReport> {
    if (!dto.repositoryId) throw new NotFoundException('repositoryId required for repository report');

    const repository = await this.prisma.repository.findFirst({
      where: { id: dto.repositoryId, tenantId },
    });

    if (!repository) throw new NotFoundException('Repository not found');

    // Get historical scan data
    const scans = await this.prisma.scan.findMany({
      where: { repositoryId: repository.id },
      orderBy: { startedAt: 'desc' },
      take: 30,
      include: {
        scannerResults: true,
      },
    });

    // Get current findings
    const findings = await this.prisma.securityFinding.findMany({
      where: { repositoryId: repository.id },
      orderBy: { severity: 'desc' },
    });

    // Calculate trends
    const findingsByDate = await this.prisma.securityFinding.groupBy({
      by: ['createdAt'],
      where: { repositoryId: repository.id },
      _count: true,
    });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Repository Security Report - ${repository.name}`,
          Author: 'ThreatDiviner',
        },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        const id = `repo-${repository.id}-${Date.now()}`;
        const url = await this.uploadOrReturnDataUrl(tenantId, id, buffer, 'pdf');
        resolve({ id, url, buffer, size: buffer.length, format: 'pdf' });
      });
      doc.on('error', reject);

      this.addPdfHeader(doc, 'Repository Security Report', repository.fullName || repository.name);

      // Repository Info
      this.addPdfSection(doc, 'Repository Overview');
      doc.fontSize(10).fillColor('#4a5568');
      doc.text(`Name: ${repository.fullName || repository.name}`);
      doc.text(`Default Branch: ${repository.defaultBranch || 'main'}`);
      doc.text(`Language: ${repository.language || 'Unknown'}`);
      doc.text(`Last Scan: ${scans[0]?.startedAt?.toISOString() || 'Never'}`);
      doc.text(`Total Scans: ${scans.length}`);
      doc.moveDown(1);

      // Security Score
      this.addPdfSection(doc, 'Security Posture');
      const critical = findings.filter(f => f.severity === 'critical' && f.status !== 'resolved').length;
      const high = findings.filter(f => f.severity === 'high' && f.status !== 'resolved').length;
      const medium = findings.filter(f => f.severity === 'medium' && f.status !== 'resolved').length;
      const low = findings.filter(f => f.severity === 'low' && f.status !== 'resolved').length;

      // Simple score calculation
      const score = Math.max(0, 100 - (critical * 20) - (high * 10) - (medium * 3) - (low * 1));
      const scoreColor = score >= 80 ? '#38a169' : score >= 60 ? '#d69e2e' : score >= 40 ? '#dd6b20' : '#c53030';

      doc.fontSize(14).fillColor(scoreColor).text(`Security Score: ${score}/100`);
      doc.fontSize(10).fillColor('#4a5568');
      doc.text(`Open vulnerabilities: ${critical + high + medium + low}`);
      doc.text(`  • Critical: ${critical}`);
      doc.text(`  • High: ${high}`);
      doc.text(`  • Medium: ${medium}`);
      doc.text(`  • Low: ${low}`);
      doc.moveDown(1);

      // Recent Activity
      this.addPdfSection(doc, 'Recent Scan Activity');
      const recentScans = scans.slice(0, 10);
      recentScans.forEach(scan => {
        doc.fontSize(9).fillColor('#4a5568');
        doc.text(`${scan.startedAt?.toLocaleDateString()} - ${scan.status} - ${scan.branch} - ${scan.scannerResults.reduce((sum: number, sr: any) => sum + sr.findingsCount, 0)} findings`);
      });
      doc.moveDown(1);

      // Top Issues
      this.addPdfSection(doc, 'Top Security Issues');
      const topIssues = findings.filter(f => f.status !== 'resolved').slice(0, 10);
      topIssues.forEach((f, i) => {
        const sevColor = f.severity === 'critical' ? '#c53030' : f.severity === 'high' ? '#dd6b20' : '#d69e2e';
        doc.fontSize(9).fillColor(sevColor);
        doc.text(`${i + 1}. [${f.severity.toUpperCase()}] ${f.title}`);
        doc.fontSize(8).fillColor('#718096');
        doc.text(`   ${f.filePath}:${f.startLine || ''}`);
      });

      this.addPdfFooter(doc);
      doc.end();
    });
  }

  /**
   * Generate compliance report for specific frameworks
   */
  private async generateComplianceReport(tenantId: string, dto: CreateReportDto): Promise<GeneratedReport> {
    const frameworks = dto.complianceFrameworks || [ComplianceFramework.SOC2];

    // Get compliance scores
    const complianceScores = await this.prisma.complianceScore.findMany({
      where: {
        tenantId,
        framework: { in: frameworks },
      },
      orderBy: { calculatedAt: 'desc' },
    });

    // Get related findings
    const findings = await this.prisma.securityFinding.findMany({
      where: {
        tenantId,
        complianceMappings: { not: '[]' },
      },
      orderBy: { severity: 'desc' },
    });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Compliance Report - ${frameworks.join(', ')}`,
          Author: 'ThreatDiviner',
        },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        const id = `compliance-${Date.now()}`;
        const url = await this.uploadOrReturnDataUrl(tenantId, id, buffer, 'pdf');
        resolve({ id, url, buffer, size: buffer.length, format: 'pdf' });
      });
      doc.on('error', reject);

      this.addPdfHeader(doc, 'Compliance Status Report', `Frameworks: ${frameworks.join(', ')}`);

      // Executive Summary
      this.addPdfSection(doc, 'Compliance Summary');
      doc.fontSize(10).fillColor('#4a5568');
      doc.text(`Report Date: ${new Date().toISOString()}`);
      doc.text(`Frameworks Assessed: ${frameworks.length}`);
      doc.moveDown(1);

      // Framework Scores
      for (const framework of frameworks) {
        this.addPdfSection(doc, this.getFrameworkDisplayName(framework));

        const score = complianceScores.find(s => s.framework === framework);
        if (score) {
          const scoreValue = typeof score.score === 'number' ? score.score : 0;
          const scoreColor = scoreValue >= 80 ? '#38a169' : scoreValue >= 60 ? '#d69e2e' : '#c53030';

          doc.fontSize(12).fillColor(scoreColor).text(`Compliance Score: ${scoreValue}%`);
          doc.fontSize(10).fillColor('#4a5568');
          doc.text(`Last Assessment: ${score.calculatedAt.toLocaleDateString()}`);

          // Control breakdown if available
          if (score.controlScores) {
            const controls = score.controlScores as any;
            if (typeof controls === 'object') {
              doc.text('Control Categories:');
              Object.entries(controls).forEach(([control, value]) => {
                doc.fontSize(9).text(`  • ${control}: ${value}%`);
              });
            }
          }
        } else {
          doc.fontSize(10).fillColor('#718096').text('No compliance assessment available');
        }
        doc.moveDown(1);
      }

      // Compliance Gaps
      this.addPdfSection(doc, 'Identified Compliance Gaps');
      const complianceFindings = findings.filter(f => {
        try {
          const mappings = JSON.parse(f.complianceMappings || '[]');
          return mappings.some((m: any) => frameworks.includes(m.framework));
        } catch {
          return false;
        }
      });

      if (complianceFindings.length === 0) {
        doc.fontSize(10).fillColor('#38a169').text('No compliance gaps identified.');
      } else {
        complianceFindings.slice(0, 20).forEach((f, i) => {
          if (doc.y > 680) doc.addPage();
          const sevColor = f.severity === 'critical' ? '#c53030' : f.severity === 'high' ? '#dd6b20' : '#d69e2e';
          doc.fontSize(9).fillColor(sevColor);
          doc.text(`${i + 1}. [${f.severity.toUpperCase()}] ${f.title}`);
          doc.fontSize(8).fillColor('#718096');

          try {
            const mappings = JSON.parse(f.complianceMappings || '[]');
            const controlIds = mappings.map((m: any) => m.controlId).join(', ');
            doc.text(`   Affected Controls: ${controlIds}`);
          } catch {
            // Skip if parsing fails
          }
        });
      }

      // Recommendations
      doc.addPage();
      this.addPdfSection(doc, 'Recommendations');
      doc.fontSize(10).fillColor('#4a5568');
      doc.text('1. Address all critical and high severity findings immediately');
      doc.text('2. Implement automated compliance monitoring');
      doc.text('3. Schedule regular compliance assessments');
      doc.text('4. Document exception processes for any accepted risks');
      doc.text('5. Train teams on compliance requirements');

      this.addPdfFooter(doc);
      doc.end();
    });
  }

  /**
   * Generate threat model report
   */
  private async generateThreatModelReport(tenantId: string, dto: CreateReportDto): Promise<GeneratedReport> {
    if (!dto.threatModelId) throw new NotFoundException('threatModelId required for threat model report');

    const threatModel = await this.prisma.threatModel.findFirst({
      where: { id: dto.threatModelId, project: { tenantId } },
      include: {
        project: true,
        threats: true,
      },
    });

    if (!threatModel) throw new NotFoundException('Threat model not found');

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Threat Model Report - ${threatModel.name}`,
          Author: 'ThreatDiviner',
        },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        const id = `threatmodel-${threatModel.id}-${Date.now()}`;
        const url = await this.uploadOrReturnDataUrl(tenantId, id, buffer, 'pdf');
        resolve({ id, url, buffer, size: buffer.length, format: 'pdf' });
      });
      doc.on('error', reject);

      this.addPdfHeader(doc, 'Threat Model Report', threatModel.name);

      // Overview
      this.addPdfSection(doc, 'Model Overview');
      doc.fontSize(10).fillColor('#4a5568');
      doc.text(`Name: ${threatModel.name}`);
      doc.text(`Project: ${threatModel.project.name}`);
      doc.text(`Status: ${threatModel.status}`);
      doc.text(`Created: ${threatModel.createdAt.toLocaleDateString()}`);
      doc.text(`Last Updated: ${threatModel.updatedAt.toLocaleDateString()}`);
      if (threatModel.description) {
        doc.moveDown(0.5);
        doc.text(`Description: ${threatModel.description}`);
      }
      doc.moveDown(1);

      // System Description
      if (threatModel.systemDescription) {
        this.addPdfSection(doc, 'System Description');
        doc.fontSize(10).fillColor('#4a5568');
        doc.text(threatModel.systemDescription);
        doc.moveDown(1);
      }

      // Identified Threats
      this.addPdfSection(doc, 'Identified Threats');
      const threats = threatModel.threats || [];

      if (threats.length === 0) {
        doc.fontSize(10).fillColor('#718096').text('No threats have been identified yet.');
      } else {
        // Group by severity
        const byPriority = {
          critical: threats.filter(t => t.priority === 'critical'),
          high: threats.filter(t => t.priority === 'high'),
          medium: threats.filter(t => t.priority === 'medium'),
          low: threats.filter(t => t.priority === 'low'),
        };

        for (const [priority, threatList] of Object.entries(byPriority)) {
          if (threatList.length === 0) continue;

          const color = priority === 'critical' ? '#c53030' : priority === 'high' ? '#dd6b20' : priority === 'medium' ? '#d69e2e' : '#3182ce';
          doc.fontSize(11).fillColor(color).font('Helvetica-Bold');
          doc.text(`${priority.toUpperCase()} Priority (${threatList.length})`);
          doc.font('Helvetica');

          threatList.forEach((threat, i) => {
            if (doc.y > 680) doc.addPage();

            doc.fontSize(10).fillColor('#2d3748');
            doc.text(`${i + 1}. ${threat.title}`);
            doc.fontSize(9).fillColor('#4a5568');
            if (threat.description) doc.text(`   ${this.truncate(threat.description, 150)}`);
            if (threat.category) doc.text(`   Category: ${threat.category}`);
            if (threat.attackVector) doc.text(`   Attack Vector: ${threat.attackVector}`);
            if (threat.mitigation) doc.text(`   Mitigation: ${this.truncate(threat.mitigation, 100)}`);
            doc.text(`   Status: ${threat.status}`);
            doc.moveDown(0.3);
          });
          doc.moveDown(0.5);
        }
      }

      // Summary Statistics
      doc.addPage();
      this.addPdfSection(doc, 'Summary Statistics');
      doc.fontSize(10).fillColor('#4a5568');
      doc.text(`Total Threats Identified: ${threats.length}`);
      doc.text(`  • Critical: ${threats.filter(t => t.priority === 'critical').length}`);
      doc.text(`  • High: ${threats.filter(t => t.priority === 'high').length}`);
      doc.text(`  • Medium: ${threats.filter(t => t.priority === 'medium').length}`);
      doc.text(`  • Low: ${threats.filter(t => t.priority === 'low').length}`);
      doc.moveDown(0.5);

      const mitigated = threats.filter(t => t.status === 'mitigated').length;
      const accepted = threats.filter(t => t.status === 'accepted').length;
      const open = threats.filter(t => t.status === 'open' || t.status === 'identified').length;

      doc.text(`Mitigation Status:`);
      doc.text(`  • Mitigated: ${mitigated}`);
      doc.text(`  • Accepted Risk: ${accepted}`);
      doc.text(`  • Open/In Progress: ${open}`);

      this.addPdfFooter(doc);
      doc.end();
    });
  }

  /**
   * Generate executive summary report
   */
  private async generateExecutiveReport(tenantId: string, dto: CreateReportDto): Promise<GeneratedReport> {
    // Get overall statistics
    const [
      totalFindings,
      criticalFindings,
      highFindings,
      totalScans,
      recentScans,
      repositories,
    ] = await Promise.all([
      this.prisma.securityFinding.count({ where: { tenantId, status: { not: 'resolved' } } }),
      this.prisma.securityFinding.count({ where: { tenantId, severity: 'critical', status: { not: 'resolved' } } }),
      this.prisma.securityFinding.count({ where: { tenantId, severity: 'high', status: { not: 'resolved' } } }),
      this.prisma.scan.count({ where: { tenantId } }),
      this.prisma.scan.findMany({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        take: 30,
      }),
      this.prisma.repository.count({ where: { tenantId } }),
    ]);

    // Calculate trends
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const findingsLast30Days = await this.prisma.securityFinding.count({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
    });

    const resolvedLast30Days = await this.prisma.securityFinding.count({
      where: { tenantId, status: 'resolved', updatedAt: { gte: thirtyDaysAgo } },
    });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: 'Executive Security Summary',
          Author: 'ThreatDiviner',
        },
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        const id = `executive-${Date.now()}`;
        const url = await this.uploadOrReturnDataUrl(tenantId, id, buffer, 'pdf');
        resolve({ id, url, buffer, size: buffer.length, format: 'pdf' });
      });
      doc.on('error', reject);

      this.addPdfHeader(doc, 'Executive Security Summary', new Date().toLocaleDateString());

      // Key Metrics
      this.addPdfSection(doc, 'Key Security Metrics');

      // Risk Level
      const riskLevel = criticalFindings > 0 ? 'CRITICAL' : highFindings > 5 ? 'HIGH' : highFindings > 0 ? 'ELEVATED' : 'LOW';
      const riskColor = criticalFindings > 0 ? '#c53030' : highFindings > 5 ? '#dd6b20' : highFindings > 0 ? '#d69e2e' : '#38a169';

      doc.fontSize(14).fillColor(riskColor).text(`Overall Risk Level: ${riskLevel}`);
      doc.moveDown(0.5);

      doc.fontSize(10).fillColor('#4a5568');
      doc.text(`Open Vulnerabilities: ${totalFindings}`);
      doc.text(`  • Critical: ${criticalFindings}`);
      doc.text(`  • High: ${highFindings}`);
      doc.moveDown(0.5);

      doc.text(`Security Coverage:`);
      doc.text(`  • Repositories Monitored: ${repositories}`);
      doc.text(`  • Total Scans Performed: ${totalScans}`);
      doc.text(`  • Scans (Last 30 Days): ${recentScans.length}`);
      doc.moveDown(1);

      // Trend Analysis
      this.addPdfSection(doc, 'Trend Analysis (Last 30 Days)');
      doc.fontSize(10).fillColor('#4a5568');
      doc.text(`New Vulnerabilities: ${findingsLast30Days}`);
      doc.text(`Resolved Vulnerabilities: ${resolvedLast30Days}`);

      const trend = resolvedLast30Days >= findingsLast30Days ? 'IMPROVING' : 'NEEDS ATTENTION';
      const trendColor = resolvedLast30Days >= findingsLast30Days ? '#38a169' : '#dd6b20';
      doc.fillColor(trendColor).text(`Trend: ${trend}`);
      doc.moveDown(1);

      // Recommendations
      this.addPdfSection(doc, 'Recommended Actions');
      doc.fontSize(10).fillColor('#4a5568');

      if (criticalFindings > 0) {
        doc.fillColor('#c53030').text(`⚠️ URGENT: ${criticalFindings} critical vulnerabilities require immediate attention`);
        doc.fillColor('#4a5568');
      }

      if (highFindings > 0) {
        doc.text(`• Address ${highFindings} high-severity findings within 7 days`);
      }

      doc.text('• Continue regular security scanning of all repositories');
      doc.text('• Review and update security policies quarterly');
      doc.text('• Conduct security awareness training for development teams');
      doc.text('• Consider penetration testing for critical applications');

      // Compliance Summary (if available)
      const complianceScores = await this.prisma.complianceScore.findMany({
        where: { tenantId },
        orderBy: { calculatedAt: 'desc' },
        distinct: ['framework'],
        take: 5,
      });

      if (complianceScores.length > 0) {
        doc.addPage();
        this.addPdfSection(doc, 'Compliance Status');
        doc.fontSize(10).fillColor('#4a5568');

        complianceScores.forEach(score => {
          const scoreValue = typeof score.score === 'number' ? score.score : 0;
          const color = scoreValue >= 80 ? '#38a169' : scoreValue >= 60 ? '#d69e2e' : '#c53030';
          doc.fillColor(color);
          doc.text(`${this.getFrameworkDisplayName(score.framework)}: ${scoreValue}%`);
        });
      }

      this.addPdfFooter(doc);
      doc.end();
    });
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
