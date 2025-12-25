import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { ComplianceScore } from '../../compliance/compliance.service';

export interface ComplianceReportData {
  tenant: {
    name: string;
  };
  framework: {
    id: string;
    name: string;
    version: string;
  };
  score: ComplianceScore;
  violations: {
    controlId: string;
    controlName: string;
    findings: {
      id: string;
      title: string;
      severity: string;
      filePath: string;
    }[];
  }[];
  generatedAt: Date;
}

@Injectable()
export class CompliancePdfGenerator {
  async generateComplianceReport(data: ComplianceReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `${data.framework.name} Compliance Report - ${data.tenant.name}`,
            Author: 'ThreatDiviner',
            Creator: 'ThreatDiviner Security Platform',
          },
        });

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        this.addHeader(doc, data);
        this.addComplianceSummary(doc, data);
        this.addScoreBreakdown(doc, data);
        this.addControlDetails(doc, data);
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private addHeader(doc: PDFKit.PDFDocument, data: ComplianceReportData): void {
    doc
      .fontSize(24)
      .fillColor('#1a365d')
      .text('ThreatDiviner', { align: 'center' })
      .fontSize(18)
      .fillColor('#4a5568')
      .text(`${data.framework.name} Compliance Report`, { align: 'center' })
      .fontSize(12)
      .text(`Version ${data.framework.version}`, { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(14)
      .fillColor('#2d3748')
      .text(data.tenant.name, { align: 'center' })
      .moveDown(1);

    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(1);
  }

  private addComplianceSummary(doc: PDFKit.PDFDocument, data: ComplianceReportData): void {
    doc
      .fontSize(18)
      .fillColor('#1a365d')
      .text('Compliance Score', { underline: true })
      .moveDown(0.5);

    const score = data.score.overallScore;
    const scoreColor = score >= 80 ? '#38a169' : score >= 60 ? '#d69e2e' : '#c53030';
    const scoreText = score >= 80 ? 'COMPLIANT' : score >= 60 ? 'PARTIALLY COMPLIANT' : 'NON-COMPLIANT';

    // Large score display
    doc
      .fontSize(48)
      .fillColor(scoreColor)
      .text(`${score}%`, { align: 'center' })
      .fontSize(16)
      .text(scoreText, { align: 'center' })
      .moveDown(1);

    // Summary stats
    const stats = [
      { label: 'Controls Passed', value: data.score.passedControls, color: '#38a169' },
      { label: 'Controls Failed', value: data.score.failedControls, color: '#c53030' },
      { label: 'Total Controls', value: data.score.totalControls, color: '#4a5568' },
    ];

    const boxWidth = 140;
    const startX = (595 - (boxWidth * 3 + 20 * 2)) / 2;
    let x = startX;
    const y = doc.y;

    stats.forEach((stat) => {
      doc
        .rect(x, y, boxWidth, 50)
        .fillColor('#f7fafc')
        .fill();

      doc
        .fontSize(24)
        .fillColor(stat.color)
        .text(String(stat.value), x, y + 8, { width: boxWidth, align: 'center' });

      doc
        .fontSize(10)
        .fillColor('#718096')
        .text(stat.label, x, y + 35, { width: boxWidth, align: 'center' });

      x += boxWidth + 20;
    });

    doc.y = y + 70;
    doc.moveDown(1);
  }

  private addScoreBreakdown(doc: PDFKit.PDFDocument, data: ComplianceReportData): void {
    doc
      .fontSize(16)
      .fillColor('#1a365d')
      .text('Control Status Breakdown', { underline: true })
      .moveDown(0.5);

    const statusCounts = {
      passed: data.score.controlStatus.filter(c => c.status === 'passed').length,
      warning: data.score.controlStatus.filter(c => c.status === 'warning').length,
      failed: data.score.controlStatus.filter(c => c.status === 'failed').length,
    };

    const barWidth = 400;
    const barHeight = 25;
    const startX = 100;
    let y = doc.y;

    const statuses = [
      { label: 'Passed', count: statusCounts.passed, color: '#38a169' },
      { label: 'Warning', count: statusCounts.warning, color: '#d69e2e' },
      { label: 'Failed', count: statusCounts.failed, color: '#c53030' },
    ];

    statuses.forEach((status) => {
      doc
        .fontSize(10)
        .fillColor('#4a5568')
        .text(status.label, 50, y + 7, { width: 45 });

      doc
        .rect(startX, y, barWidth, barHeight)
        .fillColor('#e2e8f0')
        .fill();

      if (status.count > 0 && data.score.totalControls > 0) {
        const fillWidth = (status.count / data.score.totalControls) * barWidth;
        doc
          .rect(startX, y, fillWidth, barHeight)
          .fillColor(status.color)
          .fill();
      }

      doc
        .fontSize(10)
        .fillColor('#2d3748')
        .text(String(status.count), startX + barWidth + 10, y + 7);

      y += barHeight + 8;
    });

    doc.y = y + 10;
    doc.moveDown(1);
  }

  private addControlDetails(doc: PDFKit.PDFDocument, data: ComplianceReportData): void {
    if (doc.y > 600) {
      doc.addPage();
    }

    doc
      .fontSize(16)
      .fillColor('#1a365d')
      .text('Control Details', { underline: true })
      .moveDown(0.5);

    // Group controls by status
    const failedControls = data.score.controlStatus.filter(c => c.status === 'failed');
    const warningControls = data.score.controlStatus.filter(c => c.status === 'warning');
    const passedControls = data.score.controlStatus.filter(c => c.status === 'passed');

    // Show failed controls first
    if (failedControls.length > 0) {
      doc
        .fontSize(12)
        .fillColor('#c53030')
        .font('Helvetica-Bold')
        .text('Failed Controls')
        .font('Helvetica')
        .moveDown(0.3);

      failedControls.forEach((control) => {
        if (doc.y > 720) {
          doc.addPage();
        }

        doc
          .fontSize(10)
          .fillColor('#c53030')
          .text(`❌ ${control.controlId}: ${control.controlName}`, { indent: 20 })
          .fontSize(9)
          .fillColor('#718096')
          .text(`   ${control.criticalFindings} critical, ${control.highFindings} high, ${control.findingsCount} total findings`, { indent: 20 });
      });

      doc.moveDown(0.5);
    }

    // Show warning controls
    if (warningControls.length > 0) {
      doc
        .fontSize(12)
        .fillColor('#d69e2e')
        .font('Helvetica-Bold')
        .text('Controls with Warnings')
        .font('Helvetica')
        .moveDown(0.3);

      warningControls.slice(0, 20).forEach((control) => {
        if (doc.y > 720) {
          doc.addPage();
        }

        doc
          .fontSize(10)
          .fillColor('#d69e2e')
          .text(`⚠️ ${control.controlId}: ${control.controlName}`, { indent: 20 })
          .fontSize(9)
          .fillColor('#718096')
          .text(`   ${control.findingsCount} findings`, { indent: 20 });
      });

      doc.moveDown(0.5);
    }

    // Show passed controls summary
    if (passedControls.length > 0) {
      doc
        .fontSize(12)
        .fillColor('#38a169')
        .font('Helvetica-Bold')
        .text(`✅ ${passedControls.length} Controls Passed`)
        .font('Helvetica')
        .moveDown(0.3);

      doc
        .fontSize(9)
        .fillColor('#718096')
        .text(passedControls.map(c => c.controlId).join(', '), { indent: 20 });
    }

    doc.moveDown(1);
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
}
