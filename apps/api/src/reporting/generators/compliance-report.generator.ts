import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

// ============================================
// Interfaces
// ============================================

export interface ComplianceReportOptions {
  format: 'pdf' | 'xlsx';
  sections?: {
    coverPage?: boolean;
    executiveSummary?: boolean;
    frameworkOverview?: boolean;
    gapDetails?: boolean;
    riskInventory?: boolean;
    remediationRoadmap?: boolean;
  };
  frameworkIds?: string[];
}

export interface RelatedRisk {
  threatId: string;
  threatTitle: string;
  canonicalRiskId: string;
  canonicalRiskTitle: string;
  severity: string;
  mitigationStatus: string | null;
}

export interface ControlGap {
  controlId: string;
  controlName: string;
  frameworkId: string;
  frameworkName: string;
  gapStatus: 'gap' | 'partial' | 'satisfied';
  relatedRisks: RelatedRisk[];
  relevance: string;
}

export interface FrameworkScore {
  frameworkId: string;
  frameworkName: string;
  version: string;
  totalControls: number;
  satisfiedControls: number;
  partialControls: number;
  gapControls: number;
  compliancePercentage: number;
  controlDetails: ControlGap[];
}

export interface ComplianceReportData {
  tenant: {
    name: string;
  };
  threatModel: {
    id: string;
    name: string;
    description?: string;
  };
  generatedAt: Date;
  totalThreats: number;
  threatsWithCanonicalRisk: number;
  frameworks: FrameworkScore[];
  summary?: {
    totalGaps: number;
    criticalGaps: number;
    highGaps: number;
    mediumGaps: number;
    lowGaps: number;
  };
}

// ============================================
// Service
// ============================================

@Injectable()
export class ComplianceReportGenerator {

  /**
   * Generate compliance report in the specified format
   */
  async generate(
    data: ComplianceReportData,
    options: ComplianceReportOptions,
  ): Promise<Buffer> {
    if (options.format === 'xlsx') {
      return this.generateExcel(data, options);
    }
    return this.generatePdf(data, options);
  }

  // ============================================
  // PDF Generation
  // ============================================

  private async generatePdf(
    data: ComplianceReportData,
    options: ComplianceReportOptions,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          bufferPages: true,
          info: {
            Title: `Compliance Report - ${data.threatModel.name}`,
            Author: 'ThreatDiviner',
            Creator: 'ThreatDiviner Security Platform',
            Subject: 'Compliance Gap Analysis Report',
          },
        });

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const sections = options.sections || {
          coverPage: true,
          executiveSummary: true,
          frameworkOverview: true,
          gapDetails: true,
          riskInventory: true,
          remediationRoadmap: true,
        };

        // Cover Page
        if (sections.coverPage !== false) {
          this.addPdfCoverPage(doc, data);
          doc.addPage();
        }

        // Executive Summary
        if (sections.executiveSummary !== false) {
          this.addPdfExecutiveSummary(doc, data);
        }

        // Framework Overview
        if (sections.frameworkOverview !== false) {
          this.addPdfFrameworkOverview(doc, data);
        }

        // Gap Details
        if (sections.gapDetails !== false) {
          this.addPdfGapDetails(doc, data);
        }

        // Risk Inventory
        if (sections.riskInventory !== false) {
          this.addPdfRiskInventory(doc, data);
        }

        // Remediation Roadmap
        if (sections.remediationRoadmap !== false) {
          this.addPdfRemediationRoadmap(doc, data);
        }

        // Add page numbers
        this.addPdfPageNumbers(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private addPdfCoverPage(doc: PDFKit.PDFDocument, data: ComplianceReportData): void {
    // Logo placeholder - ThreatDiviner branding
    doc
      .fontSize(36)
      .fillColor('#1a365d')
      .text('ThreatDiviner', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(16)
      .fillColor('#4a5568')
      .text('Security Platform', { align: 'center' })
      .moveDown(3);

    // Report Title
    doc
      .fontSize(28)
      .fillColor('#1a365d')
      .text('Compliance Gap Analysis', { align: 'center' })
      .fontSize(18)
      .fillColor('#4a5568')
      .text('Report', { align: 'center' })
      .moveDown(2);

    // Threat Model Name
    doc
      .fontSize(20)
      .fillColor('#2d3748')
      .text(data.threatModel.name, { align: 'center' })
      .moveDown(1);

    if (data.threatModel.description) {
      doc
        .fontSize(12)
        .fillColor('#718096')
        .text(data.threatModel.description, { align: 'center' })
        .moveDown(2);
    }

    // Separator line
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(100, doc.y)
      .lineTo(495, doc.y)
      .stroke()
      .moveDown(2);

    // Metadata
    doc
      .fontSize(12)
      .fillColor('#4a5568')
      .text(`Prepared for: ${data.tenant.name}`, { align: 'center' })
      .moveDown(0.5)
      .text(`Generated: ${data.generatedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`, { align: 'center' })
      .moveDown(2);

    // Quick stats
    const totalGaps = data.frameworks.reduce((sum, f) => sum + f.gapControls, 0);
    const avgCompliance = data.frameworks.length > 0
      ? Math.round(data.frameworks.reduce((sum, f) => sum + f.compliancePercentage, 0) / data.frameworks.length)
      : 0;

    doc
      .fontSize(14)
      .fillColor('#2d3748')
      .text('Quick Overview', { align: 'center', underline: true })
      .moveDown(1);

    const statsY = doc.y;
    const boxWidth = 130;
    const startX = (595 - (boxWidth * 3 + 20 * 2)) / 2;

    // Stats boxes
    const stats = [
      { label: 'Frameworks', value: data.frameworks.length, color: '#3182ce' },
      { label: 'Avg. Compliance', value: `${avgCompliance}%`, color: avgCompliance >= 70 ? '#38a169' : avgCompliance >= 50 ? '#d69e2e' : '#c53030' },
      { label: 'Total Gaps', value: totalGaps, color: '#c53030' },
    ];

    let x = startX;
    for (const stat of stats) {
      doc
        .rect(x, statsY, boxWidth, 60)
        .fillColor('#f7fafc')
        .fill();

      doc
        .fontSize(24)
        .fillColor(stat.color)
        .text(String(stat.value), x, statsY + 12, { width: boxWidth, align: 'center' });

      doc
        .fontSize(10)
        .fillColor('#718096')
        .text(stat.label, x, statsY + 42, { width: boxWidth, align: 'center' });

      x += boxWidth + 20;
    }
  }

  private addPdfExecutiveSummary(doc: PDFKit.PDFDocument, data: ComplianceReportData): void {
    if (doc.y > 650) doc.addPage();

    doc
      .fontSize(18)
      .fillColor('#1a365d')
      .text('Executive Summary', { underline: true })
      .moveDown(1);

    // Summary paragraph
    const totalGaps = data.frameworks.reduce((sum, f) => sum + f.gapControls, 0);
    const totalPartial = data.frameworks.reduce((sum, f) => sum + f.partialControls, 0);
    const avgCompliance = data.frameworks.length > 0
      ? Math.round(data.frameworks.reduce((sum, f) => sum + f.compliancePercentage, 0) / data.frameworks.length)
      : 0;

    doc
      .fontSize(11)
      .fillColor('#2d3748')
      .text(
        `This report provides a comprehensive compliance gap analysis for "${data.threatModel.name}". ` +
        `The analysis evaluates ${data.frameworks.length} compliance framework(s) against ${data.totalThreats} identified threats, ` +
        `of which ${data.threatsWithCanonicalRisk} are mapped to canonical risk identifiers.`,
        { lineGap: 4 }
      )
      .moveDown(1);

    // Key Findings
    doc
      .fontSize(14)
      .fillColor('#1a365d')
      .text('Key Findings')
      .moveDown(0.5);

    const findings = [
      `Average compliance score across all frameworks: ${avgCompliance}%`,
      `Total control gaps requiring remediation: ${totalGaps}`,
      `Partially compliant controls requiring attention: ${totalPartial}`,
      `Frameworks analyzed: ${data.frameworks.map(f => f.frameworkName).join(', ')}`,
    ];

    doc.fontSize(11).fillColor('#4a5568');
    for (const finding of findings) {
      doc.text(`• ${finding}`, { indent: 20 }).moveDown(0.3);
    }

    doc.moveDown(1);

    // Compliance posture assessment
    let posture: string;
    let postureColor: string;
    if (avgCompliance >= 80) {
      posture = 'STRONG';
      postureColor = '#38a169';
    } else if (avgCompliance >= 60) {
      posture = 'MODERATE';
      postureColor = '#d69e2e';
    } else if (avgCompliance >= 40) {
      posture = 'NEEDS IMPROVEMENT';
      postureColor = '#ed8936';
    } else {
      posture = 'CRITICAL ATTENTION REQUIRED';
      postureColor = '#c53030';
    }

    doc
      .fontSize(12)
      .fillColor('#2d3748')
      .text('Overall Compliance Posture: ', { continued: true })
      .fillColor(postureColor)
      .font('Helvetica-Bold')
      .text(posture)
      .font('Helvetica')
      .moveDown(1);
  }

  private addPdfFrameworkOverview(doc: PDFKit.PDFDocument, data: ComplianceReportData): void {
    if (doc.y > 500) doc.addPage();

    doc
      .fontSize(18)
      .fillColor('#1a365d')
      .text('Framework Compliance Overview', { underline: true })
      .moveDown(1);

    for (const framework of data.frameworks) {
      if (doc.y > 650) doc.addPage();

      // Framework header
      doc
        .fontSize(14)
        .fillColor('#2d3748')
        .font('Helvetica-Bold')
        .text(`${framework.frameworkName} (${framework.version})`)
        .font('Helvetica')
        .moveDown(0.5);

      // Compliance percentage bar
      const barWidth = 400;
      const barHeight = 25;
      const barX = 50;
      const barY = doc.y;

      // Background bar
      doc
        .rect(barX, barY, barWidth, barHeight)
        .fillColor('#e2e8f0')
        .fill();

      // Progress bar
      const progressWidth = (framework.compliancePercentage / 100) * barWidth;
      const progressColor = framework.compliancePercentage >= 70 ? '#38a169'
        : framework.compliancePercentage >= 50 ? '#d69e2e' : '#c53030';

      doc
        .rect(barX, barY, progressWidth, barHeight)
        .fillColor(progressColor)
        .fill();

      // Percentage text
      doc
        .fontSize(12)
        .fillColor('#ffffff')
        .text(`${framework.compliancePercentage}%`, barX + 10, barY + 6);

      doc.y = barY + barHeight + 10;

      // Stats row
      const stats = [
        { label: 'Total Controls', value: framework.totalControls, color: '#4a5568' },
        { label: 'Satisfied', value: framework.satisfiedControls, color: '#38a169' },
        { label: 'Partial', value: framework.partialControls, color: '#d69e2e' },
        { label: 'Gaps', value: framework.gapControls, color: '#c53030' },
      ];

      let x = 50;
      doc.fontSize(10);
      for (const stat of stats) {
        doc
          .fillColor('#718096')
          .text(stat.label, x, doc.y);
        doc
          .fillColor(stat.color)
          .font('Helvetica-Bold')
          .text(String(stat.value), x, doc.y + 12)
          .font('Helvetica');
        x += 100;
      }

      doc.y += 35;
      doc.moveDown(1);
    }
  }

  private addPdfGapDetails(doc: PDFKit.PDFDocument, data: ComplianceReportData): void {
    doc.addPage();

    doc
      .fontSize(18)
      .fillColor('#1a365d')
      .text('Gap Details', { underline: true })
      .moveDown(1);

    for (const framework of data.frameworks) {
      const gaps = framework.controlDetails.filter(c => c.gapStatus !== 'satisfied');
      if (gaps.length === 0) continue;

      if (doc.y > 600) doc.addPage();

      doc
        .fontSize(14)
        .fillColor('#2d3748')
        .font('Helvetica-Bold')
        .text(`${framework.frameworkName} - ${gaps.length} Gap(s)`)
        .font('Helvetica')
        .moveDown(0.5);

      for (const gap of gaps) {
        if (doc.y > 700) doc.addPage();

        const statusColor = gap.gapStatus === 'gap' ? '#c53030' : '#d69e2e';
        const statusLabel = gap.gapStatus === 'gap' ? 'GAP' : 'PARTIAL';

        doc
          .fontSize(10)
          .fillColor(statusColor)
          .text(`[${statusLabel}] `, { continued: true })
          .fillColor('#2d3748')
          .font('Helvetica-Bold')
          .text(`${gap.controlId}: ${gap.controlName}`)
          .font('Helvetica')
          .moveDown(0.3);

        if (gap.relatedRisks.length > 0) {
          doc.fontSize(9).fillColor('#718096').text('Related Risks:', { indent: 20 });
          for (const risk of gap.relatedRisks.slice(0, 3)) {
            const sevColor = this.getSeverityColor(risk.severity);
            doc
              .fillColor(sevColor)
              .text(`• ${risk.canonicalRiskTitle} (${risk.severity})`, { indent: 30 });
          }
          if (gap.relatedRisks.length > 3) {
            doc.text(`  ... and ${gap.relatedRisks.length - 3} more`, { indent: 30 });
          }
        }

        doc.moveDown(0.5);
      }

      doc.moveDown(1);
    }
  }

  private addPdfRiskInventory(doc: PDFKit.PDFDocument, data: ComplianceReportData): void {
    doc.addPage();

    doc
      .fontSize(18)
      .fillColor('#1a365d')
      .text('Risk Inventory', { underline: true })
      .moveDown(1);

    // Collect all unique risks across all gaps
    const allRisks = new Map<string, {
      canonicalRiskId: string;
      canonicalRiskTitle: string;
      severity: string;
      threatTitle: string;
      affectedControls: string[];
    }>();

    for (const framework of data.frameworks) {
      for (const control of framework.controlDetails) {
        for (const risk of control.relatedRisks) {
          const existing = allRisks.get(risk.canonicalRiskId);
          if (existing) {
            if (!existing.affectedControls.includes(control.controlId)) {
              existing.affectedControls.push(control.controlId);
            }
          } else {
            allRisks.set(risk.canonicalRiskId, {
              ...risk,
              affectedControls: [control.controlId],
            });
          }
        }
      }
    }

    // Sort by severity
    const sortedRisks = Array.from(allRisks.values()).sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity as keyof typeof order] || 4) - (order[b.severity as keyof typeof order] || 4);
    });

    // Summary counts
    const counts = {
      critical: sortedRisks.filter(r => r.severity === 'critical').length,
      high: sortedRisks.filter(r => r.severity === 'high').length,
      medium: sortedRisks.filter(r => r.severity === 'medium').length,
      low: sortedRisks.filter(r => r.severity === 'low').length,
    };

    doc.fontSize(11).fillColor('#4a5568');
    doc.text(`Total Unique Risks: ${sortedRisks.length}`);
    doc
      .fillColor('#c53030').text(`Critical: ${counts.critical}`, { continued: true })
      .fillColor('#4a5568').text(' | ', { continued: true })
      .fillColor('#ed8936').text(`High: ${counts.high}`, { continued: true })
      .fillColor('#4a5568').text(' | ', { continued: true })
      .fillColor('#d69e2e').text(`Medium: ${counts.medium}`, { continued: true })
      .fillColor('#4a5568').text(' | ', { continued: true })
      .fillColor('#38a169').text(`Low: ${counts.low}`);
    doc.moveDown(1);

    // Risk table
    for (const risk of sortedRisks.slice(0, 25)) {
      if (doc.y > 700) doc.addPage();

      const sevColor = this.getSeverityColor(risk.severity);
      doc
        .fontSize(10)
        .fillColor(sevColor)
        .text(`[${risk.severity.toUpperCase()}] `, { continued: true })
        .fillColor('#2d3748')
        .font('Helvetica-Bold')
        .text(risk.canonicalRiskTitle)
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#718096')
        .text(`Threat: ${risk.threatTitle}`, { indent: 20 })
        .text(`Affects ${risk.affectedControls.length} control(s): ${risk.affectedControls.slice(0, 5).join(', ')}${risk.affectedControls.length > 5 ? '...' : ''}`, { indent: 20 })
        .moveDown(0.5);
    }

    if (sortedRisks.length > 25) {
      doc.fontSize(9).fillColor('#718096').text(`... and ${sortedRisks.length - 25} more risks`);
    }
  }

  private addPdfRemediationRoadmap(doc: PDFKit.PDFDocument, data: ComplianceReportData): void {
    doc.addPage();

    doc
      .fontSize(18)
      .fillColor('#1a365d')
      .text('Remediation Roadmap', { underline: true })
      .moveDown(1);

    doc
      .fontSize(11)
      .fillColor('#4a5568')
      .text(
        'The following prioritized roadmap outlines recommended remediation activities based on gap severity and control criticality.',
        { lineGap: 4 }
      )
      .moveDown(1);

    // Priority 1: Critical gaps
    const allGaps: Array<ControlGap & { priority: number }> = [];

    for (const framework of data.frameworks) {
      for (const control of framework.controlDetails) {
        if (control.gapStatus === 'satisfied') continue;

        const maxSeverity = control.relatedRisks.reduce((max, r) => {
          const order = { critical: 0, high: 1, medium: 2, low: 3 };
          const current = order[r.severity as keyof typeof order] ?? 4;
          const maxVal = order[max as keyof typeof order] ?? 4;
          return current < maxVal ? r.severity : max;
        }, 'low');

        let priority: number;
        if (maxSeverity === 'critical' && control.gapStatus === 'gap') priority = 1;
        else if (maxSeverity === 'high' || (maxSeverity === 'critical' && control.gapStatus === 'partial')) priority = 2;
        else if (maxSeverity === 'medium' && control.gapStatus === 'gap') priority = 3;
        else priority = 4;

        allGaps.push({ ...control, priority });
      }
    }

    // Sort by priority
    allGaps.sort((a, b) => a.priority - b.priority);

    const priorities = [
      { level: 1, label: 'Immediate (P1)', color: '#c53030', description: 'Critical gaps requiring immediate attention' },
      { level: 2, label: 'Short-term (P2)', color: '#ed8936', description: 'High-priority gaps to address within 30 days' },
      { level: 3, label: 'Medium-term (P3)', color: '#d69e2e', description: 'Medium-priority gaps to address within 90 days' },
      { level: 4, label: 'Long-term (P4)', color: '#38a169', description: 'Low-priority gaps for continuous improvement' },
    ];

    for (const prio of priorities) {
      const gaps = allGaps.filter(g => g.priority === prio.level);
      if (gaps.length === 0) continue;

      if (doc.y > 600) doc.addPage();

      doc
        .fontSize(14)
        .fillColor(prio.color)
        .font('Helvetica-Bold')
        .text(`${prio.label} - ${gaps.length} item(s)`)
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#718096')
        .text(prio.description)
        .moveDown(0.5);

      for (const gap of gaps.slice(0, 10)) {
        if (doc.y > 720) doc.addPage();

        doc
          .fontSize(10)
          .fillColor('#2d3748')
          .text(`• ${gap.controlId}: ${gap.controlName}`, { indent: 20 })
          .fontSize(9)
          .fillColor('#718096')
          .text(`  Framework: ${gap.frameworkName} | Status: ${gap.gapStatus}`, { indent: 20 });
      }

      if (gaps.length > 10) {
        doc.fontSize(9).fillColor('#718096').text(`  ... and ${gaps.length - 10} more`, { indent: 20 });
      }

      doc.moveDown(1);
    }
  }

  private addPdfPageNumbers(doc: PDFKit.PDFDocument): void {
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
          { align: 'center', width: 495 }
        );
    }
  }

  private getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      critical: '#c53030',
      high: '#ed8936',
      medium: '#d69e2e',
      low: '#38a169',
    };
    return colors[severity] || '#718096';
  }

  // ============================================
  // Excel Generation
  // ============================================

  private async generateExcel(
    data: ComplianceReportData,
    options: ComplianceReportOptions,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ThreatDiviner';
    workbook.created = new Date();

    const sections = options.sections || {
      coverPage: true,
      executiveSummary: true,
      frameworkOverview: true,
      gapDetails: true,
      riskInventory: true,
      remediationRoadmap: true,
    };

    // Summary Sheet
    if (sections.executiveSummary !== false) {
      this.addExcelSummarySheet(workbook, data);
    }

    // Framework Sheets
    if (sections.frameworkOverview !== false) {
      for (const framework of data.frameworks) {
        this.addExcelFrameworkSheet(workbook, framework, data);
      }
    }

    // Compliance Status Sheet (all controls)
    if (sections.gapDetails !== false) {
      this.addExcelComplianceStatusSheet(workbook, data);
    }

    // Risk Inventory Sheet
    if (sections.riskInventory !== false) {
      this.addExcelRiskInventorySheet(workbook, data);
    }

    // Remediation Roadmap Sheet
    if (sections.remediationRoadmap !== false) {
      this.addExcelRemediationSheet(workbook, data);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private addExcelSummarySheet(workbook: ExcelJS.Workbook, data: ComplianceReportData): void {
    const sheet = workbook.addWorksheet('Summary');

    // Title
    sheet.mergeCells('A1:E1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `Compliance Report: ${data.threatModel.name}`;
    titleCell.font = { bold: true, size: 18, color: { argb: 'FF1A365D' } };
    titleCell.alignment = { horizontal: 'center' };

    // Metadata
    sheet.getCell('A3').value = 'Organization:';
    sheet.getCell('B3').value = data.tenant.name;
    sheet.getCell('A4').value = 'Generated:';
    sheet.getCell('B4').value = data.generatedAt.toLocaleDateString();
    sheet.getCell('A5').value = 'Total Threats:';
    sheet.getCell('B5').value = data.totalThreats;
    sheet.getCell('A6').value = 'Threats with Risk Mapping:';
    sheet.getCell('B6').value = data.threatsWithCanonicalRisk;

    // Framework Summary Table
    sheet.getCell('A8').value = 'Framework Compliance Summary';
    sheet.getCell('A8').font = { bold: true, size: 14 };

    const headerRow = 9;
    const headers = ['Framework', 'Version', 'Compliance %', 'Total Controls', 'Satisfied', 'Partial', 'Gaps'];
    headers.forEach((header, idx) => {
      const cell = sheet.getCell(headerRow, idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' },
      };
      cell.alignment = { horizontal: 'center' };
    });

    let row = headerRow + 1;
    for (const framework of data.frameworks) {
      sheet.getCell(row, 1).value = framework.frameworkName;
      sheet.getCell(row, 2).value = framework.version;

      const compCell = sheet.getCell(row, 3);
      compCell.value = framework.compliancePercentage;
      compCell.numFmt = '0%';
      compCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: framework.compliancePercentage >= 70 ? 'FF38A169' : framework.compliancePercentage >= 50 ? 'FFD69E2E' : 'FFC53030' },
      };
      compCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };

      sheet.getCell(row, 4).value = framework.totalControls;
      sheet.getCell(row, 5).value = framework.satisfiedControls;
      sheet.getCell(row, 6).value = framework.partialControls;

      const gapCell = sheet.getCell(row, 7);
      gapCell.value = framework.gapControls;
      if (framework.gapControls > 0) {
        gapCell.font = { color: { argb: 'FFC53030' }, bold: true };
      }

      row++;
    }

    // Set column widths
    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 12;
    sheet.getColumn(6).width = 12;
    sheet.getColumn(7).width = 10;
  }

  private addExcelFrameworkSheet(
    workbook: ExcelJS.Workbook,
    framework: FrameworkScore,
    _data: ComplianceReportData,
  ): void {
    const sheetName = framework.frameworkName.substring(0, 31).replace(/[\\/*?:\[\]]/g, '_');
    const sheet = workbook.addWorksheet(sheetName);

    // Header
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${framework.frameworkName} (${framework.version})`;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1A365D' } };

    // Stats
    sheet.getCell('A3').value = 'Compliance:';
    sheet.getCell('B3').value = `${framework.compliancePercentage}%`;
    sheet.getCell('A4').value = 'Total Controls:';
    sheet.getCell('B4').value = framework.totalControls;
    sheet.getCell('A5').value = 'Satisfied:';
    sheet.getCell('B5').value = framework.satisfiedControls;
    sheet.getCell('A6').value = 'Partial:';
    sheet.getCell('B6').value = framework.partialControls;
    sheet.getCell('A7').value = 'Gaps:';
    sheet.getCell('B7').value = framework.gapControls;

    // Control Details Table
    const headerRow = 9;
    const headers = ['Control ID', 'Control Name', 'Status', 'Related Risks', 'Max Severity', 'Relevance'];
    headers.forEach((header, idx) => {
      const cell = sheet.getCell(headerRow, idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF059669' },
      };
    });

    let row = headerRow + 1;
    for (const control of framework.controlDetails) {
      sheet.getCell(row, 1).value = control.controlId;
      sheet.getCell(row, 2).value = control.controlName;

      const statusCell = sheet.getCell(row, 3);
      statusCell.value = control.gapStatus.toUpperCase();
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: control.gapStatus === 'satisfied' ? 'FF38A169'
            : control.gapStatus === 'partial' ? 'FFD69E2E' : 'FFC53030'
        },
      };
      statusCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };

      sheet.getCell(row, 4).value = control.relatedRisks.length;

      if (control.relatedRisks.length > 0) {
        const maxSeverity = control.relatedRisks.reduce((max, r) => {
          const order = { critical: 0, high: 1, medium: 2, low: 3 };
          const current = order[r.severity as keyof typeof order] ?? 4;
          const maxVal = order[max as keyof typeof order] ?? 4;
          return current < maxVal ? r.severity : max;
        }, 'low');

        const sevCell = sheet.getCell(row, 5);
        sevCell.value = maxSeverity.toUpperCase();
        sevCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: maxSeverity === 'critical' ? 'FFC53030'
              : maxSeverity === 'high' ? 'FFED8936'
              : maxSeverity === 'medium' ? 'FFD69E2E' : 'FF38A169'
          },
        };
      } else {
        sheet.getCell(row, 5).value = '-';
      }

      sheet.getCell(row, 6).value = control.relevance;
      row++;
    }

    // Set column widths
    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 40;
    sheet.getColumn(3).width = 12;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 12;

    // Auto-filter
    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: row - 1, column: 6 },
    };
  }

  private addExcelComplianceStatusSheet(workbook: ExcelJS.Workbook, data: ComplianceReportData): void {
    const sheet = workbook.addWorksheet('All Controls');

    const headers = ['Framework', 'Control ID', 'Control Name', 'Status', 'Risk Count', 'Max Severity', 'Risk Titles', 'Relevance'];
    const headerRow = 1;

    headers.forEach((header, idx) => {
      const cell = sheet.getCell(headerRow, idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' },
      };
    });

    let row = 2;
    for (const framework of data.frameworks) {
      for (const control of framework.controlDetails) {
        sheet.getCell(row, 1).value = framework.frameworkName;
        sheet.getCell(row, 2).value = control.controlId;
        sheet.getCell(row, 3).value = control.controlName;

        const statusCell = sheet.getCell(row, 4);
        statusCell.value = control.gapStatus.toUpperCase();
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: control.gapStatus === 'satisfied' ? 'FFD4EDDA'
              : control.gapStatus === 'partial' ? 'FFFFF3CD' : 'FFF8D7DA'
          },
        };

        sheet.getCell(row, 5).value = control.relatedRisks.length;

        if (control.relatedRisks.length > 0) {
          const maxSeverity = control.relatedRisks.reduce((max, r) => {
            const order = { critical: 0, high: 1, medium: 2, low: 3 };
            const current = order[r.severity as keyof typeof order] ?? 4;
            const maxVal = order[max as keyof typeof order] ?? 4;
            return current < maxVal ? r.severity : max;
          }, 'low');

          sheet.getCell(row, 6).value = maxSeverity;
          sheet.getCell(row, 7).value = control.relatedRisks.map(r => r.canonicalRiskTitle).join('; ');
        } else {
          sheet.getCell(row, 6).value = '-';
          sheet.getCell(row, 7).value = '-';
        }

        sheet.getCell(row, 8).value = control.relevance;
        row++;
      }
    }

    // Set column widths
    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 40;
    sheet.getColumn(4).width = 12;
    sheet.getColumn(5).width = 12;
    sheet.getColumn(6).width = 12;
    sheet.getColumn(7).width = 60;
    sheet.getColumn(8).width = 12;

    // Auto-filter
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: row - 1, column: 8 },
    };

    // Freeze header row
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }

  private addExcelRiskInventorySheet(workbook: ExcelJS.Workbook, data: ComplianceReportData): void {
    const sheet = workbook.addWorksheet('Risks');

    // Collect all unique risks
    const allRisks = new Map<string, {
      canonicalRiskId: string;
      canonicalRiskTitle: string;
      severity: string;
      threatTitle: string;
      threatId: string;
      mitigationStatus: string | null;
      affectedControls: Set<string>;
      affectedFrameworks: Set<string>;
    }>();

    for (const framework of data.frameworks) {
      for (const control of framework.controlDetails) {
        for (const risk of control.relatedRisks) {
          const existing = allRisks.get(risk.canonicalRiskId);
          if (existing) {
            existing.affectedControls.add(control.controlId);
            existing.affectedFrameworks.add(framework.frameworkName);
          } else {
            allRisks.set(risk.canonicalRiskId, {
              ...risk,
              affectedControls: new Set([control.controlId]),
              affectedFrameworks: new Set([framework.frameworkName]),
            });
          }
        }
      }
    }

    const headers = ['Risk ID', 'Risk Title', 'Severity', 'Threat', 'Mitigation Status', 'Affected Controls', 'Frameworks'];
    const headerRow = 1;

    headers.forEach((header, idx) => {
      const cell = sheet.getCell(headerRow, idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDC2626' },
      };
    });

    // Sort by severity
    const sortedRisks = Array.from(allRisks.values()).sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity as keyof typeof order] || 4) - (order[b.severity as keyof typeof order] || 4);
    });

    let row = 2;
    for (const risk of sortedRisks) {
      sheet.getCell(row, 1).value = risk.canonicalRiskId;
      sheet.getCell(row, 2).value = risk.canonicalRiskTitle;

      const sevCell = sheet.getCell(row, 3);
      sevCell.value = risk.severity.toUpperCase();
      sevCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: risk.severity === 'critical' ? 'FFC53030'
            : risk.severity === 'high' ? 'FFED8936'
            : risk.severity === 'medium' ? 'FFD69E2E' : 'FF38A169'
        },
      };
      sevCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };

      sheet.getCell(row, 4).value = risk.threatTitle;
      sheet.getCell(row, 5).value = risk.mitigationStatus || 'Not mitigated';
      sheet.getCell(row, 6).value = Array.from(risk.affectedControls).join(', ');
      sheet.getCell(row, 7).value = Array.from(risk.affectedFrameworks).join(', ');
      row++;
    }

    // Set column widths
    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 40;
    sheet.getColumn(3).width = 12;
    sheet.getColumn(4).width = 40;
    sheet.getColumn(5).width = 18;
    sheet.getColumn(6).width = 30;
    sheet.getColumn(7).width = 25;

    // Auto-filter and freeze
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: row - 1, column: 7 },
    };
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }

  private addExcelRemediationSheet(workbook: ExcelJS.Workbook, data: ComplianceReportData): void {
    const sheet = workbook.addWorksheet('Remediation');

    const headers = ['Priority', 'Framework', 'Control ID', 'Control Name', 'Status', 'Max Severity', 'Risk Count', 'Recommended Action'];
    const headerRow = 1;

    headers.forEach((header, idx) => {
      const cell = sheet.getCell(headerRow, idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF7C3AED' },
      };
    });

    // Collect and prioritize gaps
    const allGaps: Array<{
      control: ControlGap;
      framework: FrameworkScore;
      priority: number;
      maxSeverity: string;
    }> = [];

    for (const framework of data.frameworks) {
      for (const control of framework.controlDetails) {
        if (control.gapStatus === 'satisfied') continue;

        const maxSeverity = control.relatedRisks.length > 0
          ? control.relatedRisks.reduce((max, r) => {
              const order = { critical: 0, high: 1, medium: 2, low: 3 };
              const current = order[r.severity as keyof typeof order] ?? 4;
              const maxVal = order[max as keyof typeof order] ?? 4;
              return current < maxVal ? r.severity : max;
            }, 'low')
          : 'low';

        let priority: number;
        if (maxSeverity === 'critical' && control.gapStatus === 'gap') priority = 1;
        else if (maxSeverity === 'high' || (maxSeverity === 'critical' && control.gapStatus === 'partial')) priority = 2;
        else if (maxSeverity === 'medium' && control.gapStatus === 'gap') priority = 3;
        else priority = 4;

        allGaps.push({ control, framework, priority, maxSeverity });
      }
    }

    // Sort by priority
    allGaps.sort((a, b) => a.priority - b.priority);

    const priorityLabels: Record<number, string> = {
      1: 'P1 - Immediate',
      2: 'P2 - Short-term',
      3: 'P3 - Medium-term',
      4: 'P4 - Long-term',
    };

    const priorityColors: Record<number, string> = {
      1: 'FFC53030',
      2: 'FFED8936',
      3: 'FFD69E2E',
      4: 'FF38A169',
    };

    let row = 2;
    for (const gap of allGaps) {
      const prioCell = sheet.getCell(row, 1);
      prioCell.value = priorityLabels[gap.priority];
      prioCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: priorityColors[gap.priority] },
      };
      prioCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };

      sheet.getCell(row, 2).value = gap.framework.frameworkName;
      sheet.getCell(row, 3).value = gap.control.controlId;
      sheet.getCell(row, 4).value = gap.control.controlName;
      sheet.getCell(row, 5).value = gap.control.gapStatus.toUpperCase();
      sheet.getCell(row, 6).value = gap.maxSeverity.toUpperCase();
      sheet.getCell(row, 7).value = gap.control.relatedRisks.length;

      // Recommended action based on status
      const action = gap.control.gapStatus === 'gap'
        ? 'Implement control to address identified risks'
        : 'Complete partial implementation and verify effectiveness';
      sheet.getCell(row, 8).value = action;

      row++;
    }

    // Set column widths
    sheet.getColumn(1).width = 18;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 40;
    sheet.getColumn(5).width = 12;
    sheet.getColumn(6).width = 15;
    sheet.getColumn(7).width = 12;
    sheet.getColumn(8).width = 50;

    // Auto-filter and freeze
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: row - 1, column: 8 },
    };
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }
}
