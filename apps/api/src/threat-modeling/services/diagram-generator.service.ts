// apps/api/src/threat-modeling/services/diagram-generator.service.ts
// Generates visual threat model diagrams from threat model data

import { Injectable, Logger } from '@nestjs/common';
import {
  COMPONENT_COLORS,
  TRUST_BOUNDARY_STYLES,
  DATA_FLOW_STYLES,
  DIAGRAM_ID_PREFIXES,
  RISK_COLORS,
  DiagramComponent,
  DiagramDataFlow,
  DiagramTrustBoundary,
  ThreatModelDiagram,
} from '../templates/diagram-format.templates';

@Injectable()
export class DiagramGeneratorService {
  private readonly logger = new Logger(DiagramGeneratorService.name);

  /**
   * Generate Mermaid diagram code from threat model
   */
  generateMermaidDiagram(diagram: ThreatModelDiagram): string {
    const lines: string[] = ['flowchart TB'];

    // Add title as comment
    lines.push(`    %% ${diagram.title} v${diagram.version}`);
    lines.push('');

    // Add trust boundaries as subgraphs
    for (const tb of diagram.trustBoundaries) {
      lines.push(`    subgraph ${this.sanitizeId(tb.id)}["${tb.name}"]`);
      lines.push(`        direction TB`);
      
      // Add components within this trust boundary
      const componentsInBoundary = diagram.components.filter(
        c => tb.componentIds.includes(c.diagramId)
      );
      
      for (const comp of componentsInBoundary) {
        const shape = this.getMermaidShape(comp.type);
        lines.push(`        ${this.sanitizeId(comp.diagramId)}${shape.open}"${comp.diagramId}<br/>${comp.name}"${shape.close}`);
      }
      
      lines.push('    end');
      lines.push('');
    }

    // Add components not in any trust boundary
    const boundaryComponentIds = diagram.trustBoundaries.flatMap(tb => tb.componentIds);
    const unboundedComponents = diagram.components.filter(
      c => !boundaryComponentIds.includes(c.diagramId)
    );
    
    for (const comp of unboundedComponents) {
      const shape = this.getMermaidShape(comp.type);
      lines.push(`    ${this.sanitizeId(comp.diagramId)}${shape.open}"${comp.diagramId}<br/>${comp.name}"${shape.close}`);
    }
    lines.push('');

    // Add data flows
    for (const flow of diagram.dataFlows) {
      const arrow = flow.encrypted ? '-->|🔒|' : flow.crossesTrustBoundary ? '-.->|⚠️|' : '-->';
      const label = flow.label ? `|${flow.label}|` : '';
      lines.push(`    ${this.sanitizeId(flow.sourceId)} ${arrow.replace('||', label || '||')} ${this.sanitizeId(flow.targetId)}`);
    }
    lines.push('');

    // Add styling
    lines.push('    %% Styling');
    for (const comp of diagram.components) {
      const color = this.getComponentColor(comp.type);
      lines.push(`    style ${this.sanitizeId(comp.diagramId)} fill:${color.bg},stroke:${color.border},color:${color.text}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate SVG diagram from threat model
   */
  generateSvgDiagram(diagram: ThreatModelDiagram): string {
    const width = 1400;
    const height = 900;
    const padding = 40;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#718096"/>
    </marker>
    <marker id="arrowhead-green" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#38A169"/>
    </marker>
    <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#E53E3E"/>
    </marker>
    <style>
      .component-label { font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; }
      .component-id { font-family: Arial, sans-serif; font-size: 9px; fill: #4A5568; }
      .flow-label { font-family: Arial, sans-serif; font-size: 10px; fill: #4A5568; }
      .boundary-label { font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; fill: #2D3748; }
      .title { font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; fill: #1A365D; }
      .legend-title { font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; fill: #2D3748; }
      .legend-item { font-family: Arial, sans-serif; font-size: 9px; fill: #4A5568; }
      .threat-actor { font-family: Arial, sans-serif; font-size: 10px; fill: #744210; }
    </style>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="#F7FAFC"/>
  
  <!-- Title -->
  <text x="${padding}" y="30" class="title">${this.escapeXml(diagram.title)}</text>
`;

    // Draw trust boundaries first (background)
    for (const tb of diagram.trustBoundaries) {
      const style = TRUST_BOUNDARY_STYLES[tb.type as keyof typeof TRUST_BOUNDARY_STYLES] || TRUST_BOUNDARY_STYLES.CLOUD_ACCOUNT;
      svg += `
  <!-- Trust Boundary: ${tb.name} -->
  <rect x="${tb.position.x}" y="${tb.position.y}" width="${tb.size.width}" height="${tb.size.height}" 
        fill="${style.fill}" stroke="${style.stroke}" stroke-width="2" stroke-dasharray="${style.strokeDasharray}" rx="8"/>
  <text x="${tb.position.x + 10}" y="${tb.position.y + 20}" class="boundary-label">${this.escapeXml(tb.name)}</text>
`;
    }

    // Draw components
    for (const comp of diagram.components) {
      const color = this.getComponentColor(comp.type);
      const cx = comp.position.x + comp.size.width / 2;
      const cy = comp.position.y + comp.size.height / 2;

      svg += `
  <!-- Component: ${comp.diagramId} - ${comp.name} -->
  <rect x="${comp.position.x}" y="${comp.position.y}" width="${comp.size.width}" height="${comp.size.height}" 
        fill="${color.bg}" stroke="${color.border}" stroke-width="2" rx="4"/>
  <text x="${cx}" y="${cy - 5}" text-anchor="middle" class="component-label" fill="${color.text}">${this.escapeXml(comp.name)}</text>
  <text x="${cx}" y="${cy + 12}" text-anchor="middle" class="component-id">[${comp.diagramId}]</text>
`;
    }

    // Draw data flows
    for (const flow of diagram.dataFlows) {
      const source = diagram.components.find(c => c.diagramId === flow.sourceId);
      const target = diagram.components.find(c => c.diagramId === flow.targetId);
      
      if (source && target) {
        const x1 = source.position.x + source.size.width / 2;
        const y1 = source.position.y + source.size.height;
        const x2 = target.position.x + target.size.width / 2;
        const y2 = target.position.y;
        
        const strokeColor = flow.encrypted ? '#38A169' : flow.crossesTrustBoundary ? '#D69E2E' : '#718096';
        const dashArray = flow.encrypted ? '' : flow.crossesTrustBoundary ? '5,3' : '';
        const marker = flow.encrypted ? 'arrowhead-green' : 'arrowhead';

        svg += `
  <!-- Data Flow: ${flow.sourceId} -> ${flow.targetId} -->
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2 - 5}" 
        stroke="${strokeColor}" stroke-width="2" ${dashArray ? `stroke-dasharray="${dashArray}"` : ''} marker-end="url(#${marker})"/>
`;
        if (flow.label) {
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          svg += `  <text x="${midX + 5}" y="${midY}" class="flow-label">${this.escapeXml(flow.label)}</text>\n`;
        }
      }
    }

    // Draw legend
    const legendX = width - 280;
    const legendY = height - 250;
    svg += `
  <!-- Diagram ID Mapping Legend -->
  <rect x="${legendX}" y="${legendY}" width="260" height="${30 + diagram.legend.length * 14}" fill="white" stroke="#CBD5E0" stroke-width="1" rx="4"/>
  <text x="${legendX + 10}" y="${legendY + 18}" class="legend-title">Diagram ID Mapping:</text>
`;
    
    diagram.legend.forEach((item, i) => {
      svg += `  <text x="${legendX + 10}" y="${legendY + 35 + i * 14}" class="legend-item">${item.diagramId}: ${this.escapeXml(item.description)}</text>\n`;
    });

    // Draw threat actors
    for (const actor of diagram.threatActors) {
      const isExternal = actor.toLowerCase().includes('external');
      const x = isExternal ? padding : width - 150;
      const y = 60;
      svg += `
  <!-- Threat Actor: ${actor} -->
  <text x="${x}" y="${y}" class="threat-actor">👤 Attacker: ${this.escapeXml(actor)}</text>
`;
    }

    svg += '</svg>';
    return svg;
  }

  /**
   * Generate PlantUML diagram
   */
  generatePlantUmlDiagram(diagram: ThreatModelDiagram): string {
    const lines: string[] = [
      '@startuml',
      `title ${diagram.title}`,
      '',
      'skinparam componentStyle rectangle',
      'skinparam backgroundColor #F7FAFC',
      '',
    ];

    // Define actors
    for (const actor of diagram.threatActors) {
      lines.push(`actor "${actor}" as ${this.sanitizeId(actor)}`);
    }
    lines.push('');

    // Define trust boundaries as packages
    for (const tb of diagram.trustBoundaries) {
      lines.push(`package "${tb.name}" {`);
      
      const componentsInBoundary = diagram.components.filter(
        c => tb.componentIds.includes(c.diagramId)
      );
      
      for (const comp of componentsInBoundary) {
        const stereotype = this.getPlantUmlStereotype(comp.type);
        lines.push(`  ${stereotype} "${comp.name}\\n[${comp.diagramId}]" as ${this.sanitizeId(comp.diagramId)}`);
      }
      
      lines.push('}');
      lines.push('');
    }

    // Components not in boundaries
    const boundaryComponentIds = diagram.trustBoundaries.flatMap(tb => tb.componentIds);
    const unboundedComponents = diagram.components.filter(
      c => !boundaryComponentIds.includes(c.diagramId)
    );
    
    for (const comp of unboundedComponents) {
      const stereotype = this.getPlantUmlStereotype(comp.type);
      lines.push(`${stereotype} "${comp.name}\\n[${comp.diagramId}]" as ${this.sanitizeId(comp.diagramId)}`);
    }
    lines.push('');

    // Data flows
    for (const flow of diagram.dataFlows) {
      const arrow = flow.encrypted ? '-->' : '..>';
      const label = flow.label || '';
      const note = flow.encrypted ? ' : 🔒' : flow.crossesTrustBoundary ? ' : ⚠️' : '';
      lines.push(`${this.sanitizeId(flow.sourceId)} ${arrow} ${this.sanitizeId(flow.targetId)} : ${label}${note}`);
    }

    lines.push('');
    lines.push('@enduml');

    return lines.join('\n');
  }

  // Helper methods

  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private getMermaidShape(type: string): { open: string; close: string } {
    const shapes: Record<string, { open: string; close: string }> = {
      DATABASE: { open: '[(', close: ')]' },
      STORAGE: { open: '[(', close: ')]' },
      USER: { open: '([', close: '])' },
      EXTERNAL_ENTITY: { open: '([', close: '])' },
      PROCESS: { open: '[', close: ']' },
      API: { open: '{{', close: '}}' },
      FUNCTION: { open: '>', close: ']' },
      default: { open: '[', close: ']' },
    };
    return shapes[type.toUpperCase()] || shapes.default;
  }

  private getComponentColor(type: string): { bg: string; border: string; text: string } {
    const normalizedType = type.toUpperCase();
    return COMPONENT_COLORS[normalizedType as keyof typeof COMPONENT_COLORS] || 
           { bg: '#E2E8F0', border: '#A0AEC0', text: '#000000' };
  }

  private getPlantUmlStereotype(type: string): string {
    const stereotypes: Record<string, string> = {
      DATABASE: 'database',
      STORAGE: 'storage',
      USER: 'actor',
      EXTERNAL_ENTITY: 'actor',
      QUEUE: 'queue',
      API: 'component',
      FUNCTION: 'component',
      default: 'component',
    };
    return stereotypes[type.toUpperCase()] || stereotypes.default;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Convert threat model from database to diagram format
   */
  convertToDiagram(threatModel: any): ThreatModelDiagram {
    const components: DiagramComponent[] = [];
    const dataFlows: DiagramDataFlow[] = [];
    const trustBoundaries: DiagramTrustBoundary[] = [];
    const legend: { diagramId: string; description: string }[] = [];

    // Auto-layout: simple grid positioning
    let row = 0;
    let col = 0;
    const colWidth = 180;
    const rowHeight = 100;
    const startX = 100;
    const startY = 100;

    // Convert components
    for (const comp of threatModel.components || []) {
      const diagramId = comp.diagramId || this.generateDiagramId(comp.type, components.length + 1);
      
      components.push({
        diagramId,
        name: comp.name,
        type: comp.type,
        technology: comp.technology,
        trustBoundary: comp.trustBoundary,
        criticality: comp.criticality || 'medium',
        dataClassification: comp.dataClassification,
        position: { x: startX + col * colWidth, y: startY + row * rowHeight },
        size: { width: 140, height: 60 },
      });

      legend.push({ diagramId, description: comp.name });

      col++;
      if (col > 5) {
        col = 0;
        row++;
      }
    }

    // Convert data flows
    for (const flow of threatModel.dataFlows || []) {
      dataFlows.push({
        id: flow.id,
        sourceId: flow.source?.diagramId || flow.sourceId,
        targetId: flow.target?.diagramId || flow.targetId,
        label: flow.label || flow.name,
        protocol: flow.protocol,
        encrypted: flow.encryption || false,
        authenticated: flow.authentication || false,
        crossesTrustBoundary: flow.crossesTrustBoundary || false,
        annotations: [],
      });
    }

    // Group components by trust boundary
    const boundaryGroups = new Map<string, string[]>();
    for (const comp of components) {
      if (comp.trustBoundary) {
        const existing = boundaryGroups.get(comp.trustBoundary) || [];
        existing.push(comp.diagramId);
        boundaryGroups.set(comp.trustBoundary, existing);
      }
    }

    // Create trust boundary objects
    let tbRow = 0;
    for (const [name, componentIds] of boundaryGroups) {
      trustBoundaries.push({
        id: `TB-${tbRow + 1}`,
        name,
        type: 'CLOUD_ACCOUNT',
        componentIds,
        position: { x: 50 + tbRow * 400, y: 70 },
        size: { width: 380, height: 300 },
      });
      tbRow++;
    }

    return {
      title: threatModel.name || 'Threat Model',
      version: threatModel.version || '1.0',
      components,
      dataFlows,
      trustBoundaries,
      threatActors: ['External Attacker', 'Malicious Insider'],
      legend,
    };
  }

  private generateDiagramId(type: string, index: number): string {
    const prefix = DIAGRAM_ID_PREFIXES[type?.toUpperCase()] || 'CMP';
    return `D-${prefix}${String(index).padStart(2, '0')}`;
  }
}
