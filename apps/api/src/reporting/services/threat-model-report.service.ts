// apps/api/src/reporting/services/threat-model-report.service.ts
// Enterprise threat model report generator with diagram-table correlation

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import {
  THREAT_TABLE_COLUMNS,
  RISK_COLORS,
  STATUS_COLORS,
  generateDiagramId,
  DIAGRAM_ID_PREFIXES,
} from '../../threat-modeling/templates/diagram-format.templates';
import { DiagramGeneratorService } from '../../threat-modeling/services/diagram-generator.service';

interface ThreatModelReportData {
  threatModel: any;
  components: any[];
  dataFlows: any[];
  threats: any[];
  mitigations: any[];
  stats: {
    totalThreats: number;
    byCategory: Record<string, number>;
    byRisk: Record<string, number>;
    mitigationCoverage: number;
  };
}

@Injectable()
export class ThreatModelReportService {
  private readonly logger = new Logger(ThreatModelReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly diagramGenerator: DiagramGeneratorService,
  ) {}

  async getThreatModelReportData(tenantId: string, threatModelId: string): Promise<ThreatModelReportData> {
    const threatModel = await this.prisma.threatModel.findFirst({
      where: { id: threatModelId, tenantId },
      include: {
        components: true,
        dataFlows: { include: { source: true, target: true } },
        threats: {
          include: {
            components: { include: { component: true } },
            dataFlows: { include: { dataFlow: true } },
            mitigations: { include: { mitigation: true } },
          },
        },
        mitigations: { include: { threats: { include: { threat: true } } } },
      },
    });

    if (!threatModel) throw new NotFoundException('Threat model not found');

    // Assign diagram IDs if not present
    this.assignDiagramIds(threatModel);

    const byCategory: Record<string, number> = {};
    const byRisk: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const t of threatModel.threats) {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      const risk = this.calculateRiskLevel(t.riskScore);
      byRisk[risk]++;
    }

    const mitigatedCount = threatModel.threats.filter((t: any) => t.status === 'mitigated').length;
    const mitigationCoverage = threatModel.threats.length > 0
      ? Math.round((mitigatedCount / threatModel.threats.length) * 100)
      : 100;

    return {
      threatModel,
      components: threatModel.components,
      dataFlows: threatModel.dataFlows,
      threats: threatModel.threats,
      mitigations: threatModel.mitigations,
      stats: { totalThreats: threatModel.threats.length, byCategory, byRisk, mitigationCoverage },
    };
  }

  /**
   * Assign diagram IDs to components that don't have them
   */
  private assignDiagramIds(threatModel: any): void {
    const usedIds = new Set<string>();
    const typeCounters: Record<string, number> = {};

    for (const comp of threatModel.components || []) {
      if (!comp.diagramId) {
        const type = comp.type?.toUpperCase() || 'CMP';
        typeCounters[type] = (typeCounters[type] || 0) + 1;
        comp.diagramId = generateDiagramId(type, typeCounters[type]);
      }
      usedIds.add(comp.diagramId);
    }

    // Assign threat IDs linked to component IDs
    for (const threat of threatModel.threats || []) {
      if (!threat.diagramId) {
        const linkedComp = threat.components?.[0]?.component;
        if (linkedComp?.diagramId) {
          threat.diagramId = linkedComp.diagramId;
        } else {
          threat.diagramId = `T-${threat.id.substring(0, 6).toUpperCase()}`;
        }
      }
    }
  }

  async generateExcelReport(tenantId: string, threatModelId: string): Promise<Buffer> {
    const data = await this.getThreatModelReportData(tenantId, threatModelId);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ThreatDiviner';
    workbook.created = new Date();

    // Add sheets
    this.addCoverSheet(workbook.addWorksheet('Cover'), data);
    this.addSummarySheet(workbook.addWorksheet('Summary'), data);
    this.addThreatsSheet(workbook.addWorksheet('Threat Analysis'), data);
    this.addComponentsSheet(workbook.addWorksheet('Components'), data);
    this.addDataFlowsSheet(workbook.addWorksheet('Data Flows'), data);
    this.addMitigationsSheet(workbook.addWorksheet('Mitigations'), data);
    this.addDiagramMappingSheet(workbook.addWorksheet('Diagram ID Mapping'), data);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private addCoverSheet(sheet: ExcelJS.Worksheet, data: ThreatModelReportData): void {
    sheet.columns = [{ width: 35 }, { width: 55 }];

    // Title
    sheet.mergeCells('A1:B1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Threat Model Report';
    titleCell.font = { bold: true, size: 24, color: { argb: 'FF1A365D' } };
    titleCell.alignment = { horizontal: 'center' };
    sheet.getRow(1).height = 40;

    sheet.addRow([]);

    // Model details
    const details = [
      ['Model Name:', data.threatModel.name],
      ['Methodology:', (data.threatModel.methodology || 'STRIDE').toUpperCase()],
      ['Status:', data.threatModel.status],
      ['Version:', data.threatModel.version || '1.0'],
      ['Created:', new Date(data.threatModel.createdAt).toLocaleDateString()],
      ['Last Updated:', new Date(data.threatModel.updatedAt).toLocaleDateString()],
      [''],
      ['Description:', data.threatModel.description || 'N/A'],
    ];

    for (const [label, value] of details) {
      const row = sheet.addRow([label, value]);
      if (label) row.getCell(1).font = { bold: true };
    }

    sheet.addRow([]);
    sheet.addRow([]);

    // Statistics section
    const statsHeader = sheet.addRow(['Statistics Summary']);
    statsHeader.font = { bold: true, size: 14 };
    sheet.addRow(['Total Components:', data.components.length]);
    sheet.addRow(['Total Data Flows:', data.dataFlows.length]);
    sheet.addRow(['Total Threats:', data.stats.totalThreats]);
    sheet.addRow(['Mitigation Coverage:', `${data.stats.mitigationCoverage}%`]);

    sheet.addRow([]);

    // Risk distribution
    const riskHeader = sheet.addRow(['Risk Distribution']);
    riskHeader.font = { bold: true, size: 14 };
    
    const riskData = [
      ['Critical', data.stats.byRisk.critical || 0, RISK_COLORS.critical],
      ['High', data.stats.byRisk.high || 0, RISK_COLORS.high],
      ['Medium', data.stats.byRisk.medium || 0, RISK_COLORS.medium],
      ['Low', data.stats.byRisk.low || 0, RISK_COLORS.low],
    ];

    for (const [level, count, color] of riskData) {
      const row = sheet.addRow([level, count]);
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (color as any).bg.replace('#', 'FF') } };
      row.getCell(1).font = { color: { argb: (color as any).text.replace('#', 'FF') }, bold: true };
    }
  }

  private addSummarySheet(sheet: ExcelJS.Worksheet, data: ThreatModelReportData): void {
    sheet.columns = [{ width: 28 }, { width: 12 }, { width: 55 }];

    // Header
    sheet.mergeCells('A1:C1');
    const header = sheet.getCell('A1');
    header.value = 'Executive Summary';
    header.font = { bold: true, size: 16 };
    sheet.addRow([]);

    // STRIDE breakdown
    const catHeaderRow = sheet.addRow(['STRIDE Category', 'Count', 'Description']);
    this.styleHeaderRow(catHeaderRow);

    const categoryDescriptions: Record<string, string> = {
      SPOOFING: 'Impersonating something or someone',
      TAMPERING: 'Modifying data or code',
      REPUDIATION: 'Denying having performed an action',
      INFORMATION_DISCLOSURE: 'Exposing information to unauthorized parties',
      DENIAL_OF_SERVICE: 'Denying or degrading service',
      ELEVATION_OF_PRIVILEGE: 'Gaining capabilities without authorization',
    };

    for (const [cat, desc] of Object.entries(categoryDescriptions)) {
      const count = data.stats.byCategory[cat] || 0;
      const row = sheet.addRow([cat, count, desc]);
      if (count > 0) {
        row.getCell(2).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: count > 5 ? 'FFFED7D7' : 'FFFFFBEB' },
        };
      }
    }

    sheet.addRow([]);

    // Top threats
    const topHeader = sheet.addRow(['Top Priority Threats']);
    topHeader.font = { bold: true, size: 14 };

    const criticalThreats = data.threats
      .filter((t: any) => this.calculateRiskLevel(t.riskScore) === 'critical')
      .slice(0, 5);

    if (criticalThreats.length > 0) {
      for (const threat of criticalThreats) {
        const title = threat.title || threat.description?.substring(0, 80);
        sheet.addRow([`• ${title}`]);
      }
    } else {
      sheet.addRow(['No critical threats identified']);
    }
  }

  private addThreatsSheet(sheet: ExcelJS.Worksheet, data: ThreatModelReportData): void {
    // Column headers matching diagram format
    sheet.columns = THREAT_TABLE_COLUMNS.map((h) => ({
      header: h,
      key: h.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      width: h.length < 12 ? 14 : h.length < 22 ? 22 : 32,
    }));

    // Style header
    const headerRow = sheet.getRow(1);
    this.styleHeaderRow(headerRow);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Add threat data
    for (const threat of data.threats) {
      const componentName = threat.components?.[0]?.component?.name || 'N/A';
      const diagramId = threat.diagramId || `T-${threat.id.substring(0, 6)}`;

      // Calculate risk levels
      const likelihoodPre = threat.likelihoodPre || threat.likelihood || 'Medium';
      const impactCIA = threat.impactCIA || this.formatImpactCIA(threat.impact || 'Medium');
      const riskAfterExisting = threat.riskAfterExisting || this.calculateRiskLevel(threat.riskScore);
      const finalRisk = threat.finalRisk || riskAfterExisting;

      const row = sheet.addRow([
        diagramId,
        componentName,
        threat.category,
        threat.description,
        threat.vulnerability || '',
        threat.attackVector || '',
        threat.threatActor || 'External Attacker',
        threat.skillsRequired || 'Medium',
        threat.complexity || 'Medium',
        likelihoodPre,
        impactCIA,
        threat.existingControls || '',
        riskAfterExisting,
        threat.gapRecommendation || '',
        finalRisk,
        threat.comments || '',
        threat.commentedBy || '',
        threat.jiraCard || '',
        (threat.cweIds || []).join(', '),
        (threat.attackTechniqueIds || []).join(', '),
        threat.status || 'identified',
      ]);

      // Color code risk columns (13 and 15)
      this.colorRiskCell(row.getCell(13), riskAfterExisting);
      this.colorRiskCell(row.getCell(15), finalRisk);
      this.colorStatusCell(row.getCell(21), threat.status);
    }

    // Auto-filter
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: data.threats.length + 1, column: THREAT_TABLE_COLUMNS.length },
    };
  }

  private addComponentsSheet(sheet: ExcelJS.Worksheet, data: ThreatModelReportData): void {
    sheet.columns = [
      { header: 'Diagram ID', key: 'diagramId', width: 14 },
      { header: 'Name', key: 'name', width: 32 },
      { header: 'Type', key: 'type', width: 16 },
      { header: 'Technology', key: 'technology', width: 22 },
      { header: 'Criticality', key: 'criticality', width: 12 },
      { header: 'Data Classification', key: 'dataClassification', width: 18 },
      { header: 'Trust Boundary', key: 'trustBoundary', width: 22 },
      { header: 'Description', key: 'description', width: 45 },
    ];

    this.styleHeaderRow(sheet.getRow(1));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const comp of data.components) {
      const row = sheet.addRow([
        comp.diagramId,
        comp.name,
        comp.type,
        comp.technology || '',
        comp.criticality || 'medium',
        comp.dataClassification || '',
        comp.trustBoundary || '',
        comp.description || '',
      ]);

      this.colorRiskCell(row.getCell(5), comp.criticality || 'medium');
    }
  }

  private addDataFlowsSheet(sheet: ExcelJS.Worksheet, data: ThreatModelReportData): void {
    sheet.columns = [
      { header: 'Flow ID', width: 12 },
      { header: 'Source (Diagram ID)', width: 18 },
      { header: 'Target (Diagram ID)', width: 18 },
      { header: 'Label', width: 28 },
      { header: 'Data Type', width: 18 },
      { header: 'Protocol', width: 12 },
      { header: 'Encrypted', width: 10 },
      { header: 'Authenticated', width: 12 },
      { header: 'Crosses Trust Boundary', width: 20 },
    ];

    this.styleHeaderRow(sheet.getRow(1));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const flow of data.dataFlows) {
      const row = sheet.addRow([
        flow.id?.substring(0, 8).toUpperCase() || '',
        flow.source?.diagramId || flow.sourceId,
        flow.target?.diagramId || flow.targetId,
        flow.label || flow.name || '',
        flow.dataType || '',
        flow.protocol || '',
        flow.encryption ? 'Yes' : 'No',
        flow.authentication ? 'Yes' : 'No',
        flow.crossesTrustBoundary ? 'Yes' : 'No',
      ]);

      // Highlight security concerns
      if (!flow.encryption) {
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7D7' } };
      }
      if (!flow.authentication) {
        row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7D7' } };
      }
      if (flow.crossesTrustBoundary) {
        row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
      }
    }
  }

  private addMitigationsSheet(sheet: ExcelJS.Worksheet, data: ThreatModelReportData): void {
    sheet.columns = [
      { header: 'ID', width: 12 },
      { header: 'Title', width: 38 },
      { header: 'Type', width: 16 },
      { header: 'Status', width: 14 },
      { header: 'Priority', width: 10 },
      { header: 'Effort', width: 10 },
      { header: 'Owner', width: 18 },
      { header: 'Due Date', width: 12 },
      { header: 'Threats Addressed', width: 38 },
      { header: 'Description', width: 45 },
    ];

    this.styleHeaderRow(sheet.getRow(1));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const mit of data.mitigations) {
      const threatTitles = mit.threats
        ?.map((t: any) => t.threat?.title || t.threat?.description?.substring(0, 25))
        .filter(Boolean)
        .join('; ') || '';

      const row = sheet.addRow([
        mit.id?.substring(0, 8).toUpperCase() || '',
        mit.title,
        mit.type,
        mit.implementationStatus,
        mit.priority || '',
        mit.effort || '',
        mit.owner || '',
        mit.dueDate ? new Date(mit.dueDate).toLocaleDateString() : '',
        threatTitles,
        mit.description || '',
      ]);

      this.colorStatusCell(row.getCell(4), mit.implementationStatus);
    }
  }

  private addDiagramMappingSheet(sheet: ExcelJS.Worksheet, data: ThreatModelReportData): void {
    sheet.columns = [
      { header: 'Diagram ID', width: 14 },
      { header: 'Component Name', width: 38 },
      { header: 'Type', width: 18 },
      { header: 'Description', width: 55 },
    ];

    this.styleHeaderRow(sheet.getRow(1));

    // Title row
    sheet.addRow([]);
    const noteRow = sheet.addRow(['This mapping corresponds to the visual threat model diagram']);
    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF718096' } };
    sheet.mergeCells(`A${noteRow.number}:D${noteRow.number}`);
    sheet.addRow([]);

    // Add all components with their diagram IDs
    for (const comp of data.components) {
      sheet.addRow([
        comp.diagramId,
        comp.name,
        comp.type,
        comp.description || '',
      ]);
    }
  }

  // Helper methods

  private styleHeaderRow(row: ExcelJS.Row): void {
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } };
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.height = 22;
  }

  private colorRiskCell(cell: ExcelJS.Cell, risk: string): void {
    const riskLower = (risk || '').toLowerCase();
    const color = RISK_COLORS[riskLower as keyof typeof RISK_COLORS];
    if (color) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.bg.replace('#', 'FF') } };
      cell.font = { bold: true, color: { argb: color.text.replace('#', 'FF') } };
    }
  }

  private colorStatusCell(cell: ExcelJS.Cell, status: string): void {
    const statusLower = (status || '').toLowerCase();
    const color = STATUS_COLORS[statusLower as keyof typeof STATUS_COLORS];
    if (color) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.bg.replace('#', 'FF') } };
      cell.font = { color: { argb: color.text.replace('#', 'FF') } };
    }
  }

  private calculateRiskLevel(riskScore: number | null): string {
    if (!riskScore) return 'low';
    if (riskScore >= 16) return 'critical';
    if (riskScore >= 9) return 'high';
    if (riskScore >= 4) return 'medium';
    return 'low';
  }

  private formatImpactCIA(impact: string): string {
    return `C:${impact}, I:${impact}, A:Medium`;
  }

  async generateCsvReport(tenantId: string, threatModelId: string): Promise<Buffer> {
    const data = await this.getThreatModelReportData(tenantId, threatModelId);

    const rows = data.threats.map((t: any) => [
      t.diagramId || `T-${t.id.substring(0, 6)}`,
      t.components?.[0]?.component?.name || '',
      t.category,
      t.description,
      t.vulnerability || '',
      t.attackVector || '',
      t.threatActor || '',
      t.skillsRequired || '',
      t.complexity || '',
      t.likelihoodPre || t.likelihood || '',
      t.impactCIA || t.impact || '',
      t.existingControls || '',
      t.riskAfterExisting || '',
      t.gapRecommendation || '',
      t.finalRisk || '',
      (t.cweIds || []).join(';'),
      (t.attackTechniqueIds || []).join(';'),
      t.status,
    ]);

    const escape = (v: any) => `"${String(v || '').replace(/"/g, '""')}"`;
    const csv = [
      THREAT_TABLE_COLUMNS.slice(0, -3).map(escape).join(','),
      ...rows.map((r: any) => r.map(escape).join(',')),
    ].join('\n');

    return Buffer.from(csv);
  }

  /**
   * Generate Mermaid diagram for the threat model
   */
  async generateDiagram(tenantId: string, threatModelId: string, format: 'mermaid' | 'svg' | 'plantuml' = 'mermaid'): Promise<string> {
    const data = await this.getThreatModelReportData(tenantId, threatModelId);
    const diagram = this.diagramGenerator.convertToDiagram(data.threatModel);

    switch (format) {
      case 'svg':
        return this.diagramGenerator.generateSvgDiagram(diagram);
      case 'plantuml':
        return this.diagramGenerator.generatePlantUmlDiagram(diagram);
      case 'mermaid':
      default:
        return this.diagramGenerator.generateMermaidDiagram(diagram);
    }
  }
}
