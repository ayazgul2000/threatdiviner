import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { Scan, Finding, Repository } from '@prisma/client';

export interface ReportData {
  tenant: {
    name: string;
  };
  scan?: Scan & { repository: Repository };
  repository?: Repository;
  findings: Finding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  generatedAt: Date;
}

@Injectable()
export class PdfGenerator {
  private readonly logger = new Logger(PdfGenerator.name);

  async generateScanReport(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Security Scan Report - ${data.scan?.repository?.name || data.repository?.name || 'Unknown'}`,
            Author: 'ThreatDiviner',
            Creator: 'ThreatDiviner Security Platform',
          },
        });

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        this.addHeader(doc, data);
        this.addExecutiveSummary(doc, data);
        this.addScanMetadata(doc, data);
        this.addFindingsSummary(doc, data);
        this.addFindingsTable(doc, data);
        this.addTopFindings(doc, data);
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private addHeader(doc: PDFKit.PDFDocument, data: ReportData): void {
    // Logo/Title
    doc
      .fontSize(24)
      .fillColor('#1a365d')
      .text('ThreatDiviner', { align: 'center' })
      .fontSize(16)
      .fillColor('#4a5568')
      .text('Security Scan Report', { align: 'center' })
      .moveDown(0.5);

    // Repository name
    const repoName = data.scan?.repository?.name || data.repository?.name || 'Unknown Repository';
    doc
      .fontSize(14)
      .fillColor('#2d3748')
      .text(repoName, { align: 'center' })
      .moveDown(1);

    // Divider
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(1);
  }

  private addExecutiveSummary(doc: PDFKit.PDFDocument, data: ReportData): void {
    doc
      .fontSize(16)
      .fillColor('#1a365d')
      .text('Executive Summary', { underline: true })
      .moveDown(0.5);

    const { summary } = data;
    const statusColor = summary.critical > 0 || summary.high > 0 ? '#c53030' :
                        summary.medium > 0 ? '#dd6b20' : '#38a169';
    const statusText = summary.critical > 0 || summary.high > 0 ? 'ACTION REQUIRED' :
                       summary.medium > 0 ? 'REVIEW RECOMMENDED' : 'PASSED';

    doc
      .fontSize(14)
      .fillColor(statusColor)
      .text(`Status: ${statusText}`, { continued: false })
      .moveDown(0.3);

    doc
      .fontSize(11)
      .fillColor('#4a5568')
      .text(`This scan identified ${summary.total} security findings across the codebase.`)
      .moveDown(0.3);

    if (summary.critical > 0) {
      doc.text(`- ${summary.critical} critical issue${summary.critical > 1 ? 's' : ''} requiring immediate attention`);
    }
    if (summary.high > 0) {
      doc.text(`- ${summary.high} high severity issue${summary.high > 1 ? 's' : ''} that should be addressed soon`);
    }
    if (summary.medium > 0) {
      doc.text(`- ${summary.medium} medium severity issue${summary.medium > 1 ? 's' : ''} to review`);
    }
    if (summary.low > 0) {
      doc.text(`- ${summary.low} low severity issue${summary.low > 1 ? 's' : ''}`);
    }
    if (summary.info > 0) {
      doc.text(`- ${summary.info} informational finding${summary.info > 1 ? 's' : ''}`);
    }

    doc.moveDown(1);
  }

  private addScanMetadata(doc: PDFKit.PDFDocument, data: ReportData): void {
    doc
      .fontSize(16)
      .fillColor('#1a365d')
      .text('Scan Details', { underline: true })
      .moveDown(0.5);

    const scan = data.scan;
    const repo = data.scan?.repository || data.repository;

    const metadata = [
      ['Repository', repo?.fullName || 'Unknown'],
      ['Branch', scan?.branch || repo?.defaultBranch || 'main'],
      ['Commit', scan?.commitSha ? scan.commitSha.substring(0, 7) : 'N/A'],
      ['Scan Date', scan?.createdAt ? new Date(scan.createdAt).toLocaleString() : new Date().toLocaleString()],
      ['Duration', scan?.duration ? `${scan.duration}s` : 'N/A'],
      ['Trigger', scan?.triggeredBy || 'manual'],
      ['Report Generated', data.generatedAt.toLocaleString()],
    ];

    doc.fontSize(10).fillColor('#4a5568');

    metadata.forEach(([label, value]) => {
      doc
        .font('Helvetica-Bold')
        .text(`${label}: `, { continued: true })
        .font('Helvetica')
        .text(value as string);
    });

    doc.moveDown(1);
  }

  private addFindingsSummary(doc: PDFKit.PDFDocument, data: ReportData): void {
    doc
      .fontSize(16)
      .fillColor('#1a365d')
      .text('Findings by Severity', { underline: true })
      .moveDown(0.5);

    const { summary } = data;
    const severities = [
      { label: 'Critical', count: summary.critical, color: '#c53030' },
      { label: 'High', count: summary.high, color: '#dd6b20' },
      { label: 'Medium', count: summary.medium, color: '#d69e2e' },
      { label: 'Low', count: summary.low, color: '#3182ce' },
      { label: 'Info', count: summary.info, color: '#718096' },
    ];

    const barWidth = 400;
    const barHeight = 20;
    const startX = 100;
    let y = doc.y;

    severities.forEach((sev) => {
      // Label
      doc
        .fontSize(10)
        .fillColor('#4a5568')
        .text(sev.label, 50, y + 5, { width: 45 });

      // Bar background
      doc
        .rect(startX, y, barWidth, barHeight)
        .fillColor('#e2e8f0')
        .fill();

      // Bar fill
      if (sev.count > 0 && summary.total > 0) {
        const fillWidth = (sev.count / summary.total) * barWidth;
        doc
          .rect(startX, y, fillWidth, barHeight)
          .fillColor(sev.color)
          .fill();
      }

      // Count
      doc
        .fontSize(10)
        .fillColor('#2d3748')
        .text(String(sev.count), startX + barWidth + 10, y + 5);

      y += barHeight + 5;
    });

    doc.y = y + 10;
    doc.moveDown(1);
  }

  private addFindingsTable(doc: PDFKit.PDFDocument, data: ReportData): void {
    // Check if we need a new page
    if (doc.y > 600) {
      doc.addPage();
    }

    doc
      .fontSize(16)
      .fillColor('#1a365d')
      .text('All Findings', { underline: true })
      .moveDown(0.5);

    if (data.findings.length === 0) {
      doc
        .fontSize(11)
        .fillColor('#38a169')
        .text('No security findings detected.')
        .moveDown(1);
      return;
    }

    // Table header
    const tableTop = doc.y;
    const columns = [
      { header: 'Severity', width: 60 },
      { header: 'Title', width: 180 },
      { header: 'File', width: 150 },
      { header: 'Line', width: 40 },
      { header: 'Status', width: 60 },
    ];

    let x = 50;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a365d');
    columns.forEach((col) => {
      doc.text(col.header, x, tableTop, { width: col.width });
      x += col.width;
    });

    doc.y = tableTop + 15;
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();

    doc.y += 5;

    // Table rows (limit to 50 for PDF size)
    const findingsToShow = data.findings.slice(0, 50);
    doc.font('Helvetica').fontSize(8).fillColor('#4a5568');

    findingsToShow.forEach((finding, index) => {
      if (doc.y > 750) {
        doc.addPage();
        doc.y = 50;
      }

      const rowY = doc.y;
      x = 50;

      // Severity with color
      const sevColors: Record<string, string> = {
        critical: '#c53030',
        high: '#dd6b20',
        medium: '#d69e2e',
        low: '#3182ce',
        info: '#718096',
      };
      doc.fillColor(sevColors[finding.severity] || '#718096');
      doc.text(finding.severity.toUpperCase(), x, rowY, { width: columns[0].width });
      x += columns[0].width;

      doc.fillColor('#4a5568');
      doc.text(this.truncate(finding.title, 35), x, rowY, { width: columns[1].width });
      x += columns[1].width;

      doc.text(this.truncate(finding.filePath, 30), x, rowY, { width: columns[2].width });
      x += columns[2].width;

      doc.text(String(finding.startLine || '-'), x, rowY, { width: columns[3].width });
      x += columns[3].width;

      doc.text(finding.status, x, rowY, { width: columns[4].width });

      doc.y = rowY + 12;
    });

    if (data.findings.length > 50) {
      doc
        .moveDown(0.5)
        .fontSize(9)
        .fillColor('#718096')
        .text(`... and ${data.findings.length - 50} more findings. View all in the dashboard.`);
    }

    doc.moveDown(1);
  }

  private addTopFindings(doc: PDFKit.PDFDocument, data: ReportData): void {
    const criticalAndHigh = data.findings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high'
    ).slice(0, 10);

    if (criticalAndHigh.length === 0) return;

    if (doc.y > 600) {
      doc.addPage();
    }

    doc
      .fontSize(16)
      .fillColor('#1a365d')
      .text('Critical & High Severity Findings', { underline: true })
      .moveDown(0.5);

    criticalAndHigh.forEach((finding, index) => {
      if (doc.y > 700) {
        doc.addPage();
        doc.y = 50;
      }

      const sevColor = finding.severity === 'critical' ? '#c53030' : '#dd6b20';

      doc
        .fontSize(11)
        .fillColor(sevColor)
        .font('Helvetica-Bold')
        .text(`${index + 1}. ${finding.title}`)
        .font('Helvetica')
        .moveDown(0.2);

      doc
        .fontSize(9)
        .fillColor('#4a5568')
        .text(`File: ${finding.filePath}:${finding.startLine || 0}`)
        .text(`Rule: ${finding.ruleId}`)
        .text(`Scanner: ${finding.scanner}`);

      if (finding.description) {
        doc.text(`Description: ${this.truncate(finding.description, 200)}`);
      }

      if (finding.aiRemediation) {
        doc
          .fillColor('#2b6cb0')
          .text(`AI Suggestion: ${this.truncate(finding.aiRemediation, 150)}`);
      }

      doc.moveDown(0.5);
    });
  }

  private addFooter(doc: PDFKit.PDFDocument): void {
    const pageCount = doc.bufferedPageRange().count;

    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor('#a0aec0')
        .text(
          `Generated by ThreatDiviner Security Platform | Page ${i + 1} of ${pageCount}`,
          50,
          780,
          { align: 'center' }
        );
    }
  }

  private truncate(str: string, maxLen: number): string {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
  }
}
