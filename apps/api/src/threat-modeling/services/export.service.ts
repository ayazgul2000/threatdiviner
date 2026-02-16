import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

export interface ExportOptions {
  format: 'xlsx' | 'csv';
  includeComponents?: boolean;
  includeDataFlows?: boolean;
  includeMatrix?: boolean;
}

@Injectable()
export class ThreatModelExportService {
  constructor(private prisma: PrismaService) {}

  async exportToExcel(threatModelId: string, tenantId: string, options?: ExportOptions): Promise<Buffer> {
    const model = await this.prisma.threatModel.findFirst({
      where: { id: threatModelId, tenantId },
      include: {
        components: true,
        dataFlows: true,
        threats: {
          include: {
            components: true,
          },
        },
        project: true,
      },
    });

    if (!model) throw new Error('Threat model not found');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ThreatDiviner';
    workbook.created = new Date();

    // Main Threats Sheet (EMIA format)
    this.addThreatsSheet(workbook, model);

    // Components Sheet
    if (options?.includeComponents !== false) {
      this.addComponentsSheet(workbook, model);
    }

    // Data Flows Sheet
    if (options?.includeDataFlows !== false) {
      this.addDataFlowsSheet(workbook, model);
    }

    // STRIDE Matrix Sheet
    if (options?.includeMatrix !== false) {
      this.addStrideMatrixSheet(workbook, model);
    }

    // Summary Sheet
    this.addSummarySheet(workbook, model);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private addThreatsSheet(workbook: ExcelJS.Workbook, model: any) {
    const sheet = workbook.addWorksheet('Threats', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });

    // Define EMIA-format columns
    sheet.columns = [
      { header: 'Diagram ID', key: 'diagramId', width: 12 },
      { header: 'Component/System', key: 'component', width: 25 },
      { header: 'Threat Category', key: 'category', width: 20 },
      { header: 'STRIDE Category', key: 'strideCategory', width: 18 },
      { header: 'Threat Description', key: 'description', width: 40 },
      { header: 'Vulnerability', key: 'vulnerability', width: 30 },
      { header: 'Attack Vector', key: 'attackVector', width: 25 },
      { header: 'Threat Actor', key: 'threatActor', width: 18 },
      { header: 'Skills Required', key: 'skillsRequired', width: 15 },
      { header: 'Complexity', key: 'complexity', width: 12 },
      { header: 'Likelihood (Pre-Control)', key: 'likelihoodPre', width: 20 },
      { header: 'Impact (CIA)', key: 'impactCIA', width: 15 },
      { header: 'Existing Controls', key: 'existingControls', width: 35 },
      { header: 'Risk After Existing Controls', key: 'riskAfterExisting', width: 25 },
      { header: 'Gap/Recommendation', key: 'gapRecommendation', width: 40 },
      { header: 'Final Risk', key: 'finalRisk', width: 12 },
      { header: 'CWE', key: 'cweId', width: 10 },
      { header: 'ATT&CK', key: 'attackId', width: 15 },
      { header: 'Jira Card', key: 'jiraCard', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Comments', key: 'comments', width: 35 },
      { header: 'Commented By', key: 'commentedBy', width: 18 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;

    // Add threat data
    for (const threat of model.threats) {
      const componentNames = threat.components
        ?.map((tc: any) => {
          const comp = model.components.find((c: any) => c.id === tc.componentId);
          return comp?.name || 'Unknown';
        })
        .join(', ') || 'N/A';

      const row = sheet.addRow({
        diagramId: threat.diagramId || `T-${threat.id.substring(0, 6)}`,
        component: componentNames,
        category: threat.category || 'General',
        strideCategory: this.formatStrideCategory(threat.strideCategory),
        description: threat.description,
        vulnerability: threat.vulnerability || '',
        attackVector: threat.attackVector || '',
        threatActor: threat.threatActor || '',
        skillsRequired: threat.skillsRequired || '',
        complexity: threat.complexity || '',
        likelihoodPre: threat.likelihoodPre || threat.likelihood || '',
        impactCIA: threat.impactCIA || threat.impact || '',
        existingControls: threat.existingControls || '',
        riskAfterExisting: threat.riskAfterExisting || '',
        gapRecommendation: threat.gapRecommendation || threat.mitigation || '',
        finalRisk: threat.finalRisk || this.calculateRiskLevel(threat.likelihood, threat.impact),
        cweId: threat.cweId || '',
        attackId: threat.attackId || '',
        jiraCard: threat.jiraCard || '',
        status: threat.status || 'identified',
        comments: threat.comments || '',
        commentedBy: threat.commentedBy || '',
      });

      // Apply risk-based coloring to Final Risk column
      const finalRiskCell = row.getCell('finalRisk');
      this.applyRiskColor(finalRiskCell, threat.finalRisk || threat.likelihood);

      // Wrap text for long columns
      row.getCell('description').alignment = { wrapText: true, vertical: 'top' };
      row.getCell('gapRecommendation').alignment = { wrapText: true, vertical: 'top' };
      row.getCell('existingControls').alignment = { wrapText: true, vertical: 'top' };
    }

    // Auto-filter
    sheet.autoFilter = {
      from: 'A1',
      to: `V${model.threats.length + 1}`,
    };
  }

  private addComponentsSheet(workbook: ExcelJS.Workbook, model: any) {
    const sheet = workbook.addWorksheet('Components');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 12 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Description', key: 'description', width: 45 },
      { header: 'Technology', key: 'technology', width: 20 },
      { header: 'Trust Level', key: 'trustLevel', width: 12 },
      { header: 'Threat Count', key: 'threatCount', width: 12 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' },
    };

    for (const component of model.components) {
      const threatCount = model.threats.filter((t: any) =>
        t.components?.some((tc: any) => tc.componentId === component.id)
      ).length;

      sheet.addRow({
        id: component.id.substring(0, 8),
        name: component.name,
        type: component.type || 'process',
        description: component.description || '',
        technology: component.technology || '',
        trustLevel: component.trustLevel || 'internal',
        threatCount,
      });
    }
  }

  private addDataFlowsSheet(workbook: ExcelJS.Workbook, model: any) {
    const sheet = workbook.addWorksheet('Data Flows');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 12 },
      { header: 'Label', key: 'label', width: 25 },
      { header: 'Source', key: 'source', width: 25 },
      { header: 'Target', key: 'target', width: 25 },
      { header: 'Data Classification', key: 'dataClassification', width: 18 },
      { header: 'Protocol', key: 'protocol', width: 12 },
      { header: 'Encrypted', key: 'encrypted', width: 10 },
      { header: 'Crosses Trust Boundary', key: 'crossesTrust', width: 20 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF59E0B' },
    };

    for (const flow of model.dataFlows) {
      const source = model.components.find((c: any) => c.id === flow.sourceId);
      const target = model.components.find((c: any) => c.id === flow.targetId);

      sheet.addRow({
        id: flow.id.substring(0, 8),
        label: flow.label || 'data',
        source: source?.name || 'Unknown',
        target: target?.name || 'Unknown',
        dataClassification: flow.dataClassification || 'internal',
        protocol: flow.protocol || 'HTTPS',
        encrypted: flow.encryption ? 'Yes' : 'No',
        crossesTrust: flow.crossesTrustBoundary ? 'Yes' : 'No',
      });
    }
  }

  private addStrideMatrixSheet(workbook: ExcelJS.Workbook, model: any) {
    const sheet = workbook.addWorksheet('STRIDE Matrix');

    const strideCategories = ['spoofing', 'tampering', 'repudiation', 'information_disclosure', 'denial_of_service', 'elevation_of_privilege'];
    const strideLabels = ['Spoofing', 'Tampering', 'Repudiation', 'Info Disclosure', 'DoS', 'Elevation'];

    // Header row
    sheet.columns = [
      { header: 'Component', key: 'component', width: 30 },
      ...strideLabels.map((label, idx) => ({ header: label, key: strideCategories[idx], width: 15 })),
      { header: 'Total', key: 'total', width: 10 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' },
    };

    for (const component of model.components) {
      const rowData: any = { component: component.name };
      let total = 0;

      for (const category of strideCategories) {
        const count = model.threats.filter((t: any) =>
          t.strideCategory === category &&
          t.components?.some((tc: any) => tc.componentId === component.id)
        ).length;
        rowData[category] = count || '-';
        total += count;
      }
      rowData.total = total;

      const row = sheet.addRow(rowData);

      // Color cells based on count
      for (let i = 2; i <= 7; i++) {
        const cell = row.getCell(i);
        const count = typeof cell.value === 'number' ? cell.value : 0;
        if (count > 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: count >= 3 ? 'FFFECACA' : count >= 1 ? 'FFFEF3C7' : 'FFFFFFFF' },
          };
        }
      }
    }

    // Total row
    const totalRow: any = { component: 'TOTAL' };
    let grandTotal = 0;
    for (const category of strideCategories) {
      const count = model.threats.filter((t: any) => t.strideCategory === category).length;
      totalRow[category] = count;
      grandTotal += count;
    }
    totalRow.total = grandTotal;

    const summaryRow = sheet.addRow(totalRow);
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
  }

  private addSummarySheet(workbook: ExcelJS.Workbook, model: any) {
    const sheet = workbook.addWorksheet('Summary');

    // Title
    sheet.mergeCells('A1:D1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `Threat Model: ${model.name}`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };

    // Project info
    sheet.getCell('A3').value = 'Project:';
    sheet.getCell('B3').value = model.project?.name || 'N/A';
    sheet.getCell('A4').value = 'Created:';
    sheet.getCell('B4').value = model.createdAt ? new Date(model.createdAt).toLocaleDateString() : 'N/A';
    sheet.getCell('A5').value = 'Last Updated:';
    sheet.getCell('B5').value = model.updatedAt ? new Date(model.updatedAt).toLocaleDateString() : 'N/A';

    // Statistics
    sheet.getCell('A7').value = 'Statistics';
    sheet.getCell('A7').font = { bold: true, size: 14 };

    const stats = [
      ['Total Components', model.components.length],
      ['Total Data Flows', model.dataFlows.length],
      ['Total Threats', model.threats.length],
      ['Critical Threats', model.threats.filter((t: any) => t.finalRisk === 'critical' || t.likelihood === 'very_high').length],
      ['High Threats', model.threats.filter((t: any) => t.finalRisk === 'high' || t.likelihood === 'high').length],
      ['Medium Threats', model.threats.filter((t: any) => t.finalRisk === 'medium' || t.likelihood === 'medium').length],
      ['Low Threats', model.threats.filter((t: any) => t.finalRisk === 'low' || t.likelihood === 'low').length],
    ];

    let row = 8;
    for (const [label, value] of stats) {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`B${row}`).value = value;
      row++;
    }

    // STRIDE breakdown
    sheet.getCell('A16').value = 'STRIDE Breakdown';
    sheet.getCell('A16').font = { bold: true, size: 14 };

    const strideStats = [
      ['Spoofing', model.threats.filter((t: any) => t.strideCategory === 'spoofing').length],
      ['Tampering', model.threats.filter((t: any) => t.strideCategory === 'tampering').length],
      ['Repudiation', model.threats.filter((t: any) => t.strideCategory === 'repudiation').length],
      ['Information Disclosure', model.threats.filter((t: any) => t.strideCategory === 'information_disclosure').length],
      ['Denial of Service', model.threats.filter((t: any) => t.strideCategory === 'denial_of_service').length],
      ['Elevation of Privilege', model.threats.filter((t: any) => t.strideCategory === 'elevation_of_privilege').length],
    ];

    row = 17;
    for (const [label, value] of strideStats) {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`B${row}`).value = value;
      row++;
    }

    // Column widths
    sheet.getColumn('A').width = 25;
    sheet.getColumn('B').width = 20;
  }

  private formatStrideCategory(category: string): string {
    if (!category) return '';
    return category
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private calculateRiskLevel(likelihood: string, impact: string): string {
    const likelihoodScore: Record<string, number> = {
      very_high: 5, high: 4, medium: 3, low: 2, very_low: 1,
    };
    const impactScore: Record<string, number> = {
      very_high: 5, high: 4, medium: 3, low: 2, very_low: 1,
    };

    const l = likelihoodScore[likelihood] || 3;
    const i = impactScore[impact] || 3;
    const score = l * i;

    if (score >= 20) return 'critical';
    if (score >= 12) return 'high';
    if (score >= 6) return 'medium';
    return 'low';
  }

  private applyRiskColor(cell: ExcelJS.Cell, risk: string) {
    const colors: Record<string, string> = {
      critical: 'FFDC2626',
      high: 'FFF97316',
      medium: 'FFEAB308',
      low: 'FF22C55E',
      very_high: 'FFDC2626',
      very_low: 'FF22C55E',
    };

    const color = colors[risk?.toLowerCase()] || 'FFE5E7EB';
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: color },
    };
    cell.font = { bold: true, color: { argb: risk === 'critical' || risk === 'high' ? 'FFFFFFFF' : 'FF000000' } };
  }

  async exportToCsv(threatModelId: string, tenantId: string): Promise<string> {
    const model = await this.prisma.threatModel.findFirst({
      where: { id: threatModelId, tenantId },
      include: {
        components: true,
        threats: {
          include: {
            components: true,
          },
        },
      },
    });

    if (!model) throw new Error('Threat model not found');

    const headers = [
      'Diagram ID', 'Component', 'Category', 'STRIDE', 'Description', 'Vulnerability',
      'Attack Vector', 'Threat Actor', 'Skills', 'Complexity', 'Likelihood', 'Impact',
      'Existing Controls', 'Risk After Controls', 'Recommendation', 'Final Risk',
      'CWE', 'ATT&CK', 'Jira', 'Status', 'Comments', 'Commented By',
    ];

    const rows = model.threats.map((threat: any) => {
      const componentNames = threat.components
        ?.map((tc: any) => {
          const comp = model.components.find((c: any) => c.id === tc.componentId);
          return comp?.name || '';
        })
        .join('; ') || '';

      return [
        threat.diagramId || `T-${threat.id.substring(0, 6)}`,
        componentNames,
        threat.category || '',
        threat.strideCategory || '',
        this.escapeCsv(threat.description),
        this.escapeCsv(threat.vulnerability || ''),
        threat.attackVector || '',
        threat.threatActor || '',
        threat.skillsRequired || '',
        threat.complexity || '',
        threat.likelihoodPre || threat.likelihood || '',
        threat.impactCIA || threat.impact || '',
        this.escapeCsv(threat.existingControls || ''),
        threat.riskAfterExisting || '',
        this.escapeCsv(threat.gapRecommendation || threat.mitigation || ''),
        threat.finalRisk || '',
        threat.cweId || '',
        threat.attackId || '',
        threat.jiraCard || '',
        threat.status || '',
        this.escapeCsv(threat.comments || ''),
        threat.commentedBy || '',
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  private escapeCsv(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
