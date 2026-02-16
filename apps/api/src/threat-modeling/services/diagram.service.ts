import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ThreatModelDiagramService {
  constructor(private prisma: PrismaService) {}

  async generateMermaidDiagram(threatModelId: string, tenantId: string): Promise<string> {
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
      },
    });

    if (!model) throw new Error('Threat model not found');

    const lines: string[] = ['flowchart TB'];

    // Add styling classes
    lines.push('');

    // Group components by type (simulate trust boundaries)
    const processes = model.components.filter((c) => c.type === 'process' || !c.type);
    const datastores = model.components.filter((c) => c.type === 'datastore' || c.type === 'database');
    const externals = model.components.filter((c) => c.type === 'external_entity' || c.type === 'external');

    // Create subgraph for internal systems
    if (processes.length > 0 || datastores.length > 0) {
      lines.push('  subgraph internal["Internal Systems"]');
      lines.push('    direction TB');
      for (const comp of processes) {
        lines.push(`    ${this.getComponentNode(comp)}`);
      }
      for (const comp of datastores) {
        lines.push(`    ${this.getComponentNode(comp)}`);
      }
      lines.push('  end');
    }

    // Create subgraph for external entities
    if (externals.length > 0) {
      lines.push('  subgraph external["External Entities"]');
      lines.push('    direction TB');
      for (const comp of externals) {
        lines.push(`    ${this.getComponentNode(comp)}`);
      }
      lines.push('  end');
    }

    // Add data flows with labels
    for (const flow of model.dataFlows) {
      const source = model.components.find((c) => c.id === flow.sourceId);
      const target = model.components.find((c) => c.id === flow.targetId);
      if (source && target) {
        const label = flow.encryption ? `${flow.label || 'data'} [encrypted]` : flow.label || 'data';
        const lineStyle = flow.encryption ? '-->' : '-.->';
        lines.push(`  ${this.getNodeId(source)} ${lineStyle}|"${label}"| ${this.getNodeId(target)}`);
      }
    }

    // Add threat indicators for components with threats
    const threatCounts = this.countThreatsByComponent(model.threats);
    for (const [compId, count] of Object.entries(threatCounts)) {
      if (count > 0) {
        const comp = model.components.find((c) => c.id === compId);
        if (comp) {
          const threatNodeId = `threat_${this.getNodeId(comp)}`;
          lines.push(`  ${this.getNodeId(comp)} -.- ${threatNodeId}[/"${count} threats"/]:::threat`);
        }
      }
    }

    // Add styling
    lines.push('');
    lines.push('  classDef process fill:#4F46E5,stroke:#3730A3,color:#fff');
    lines.push('  classDef datastore fill:#059669,stroke:#047857,color:#fff');
    lines.push('  classDef external fill:#F59E0B,stroke:#D97706,color:#fff');
    lines.push('  classDef threat fill:#FEE2E2,stroke:#DC2626,color:#991B1B');

    return lines.join('\n');
  }

  async generateThreatMatrix(threatModelId: string, tenantId: string): Promise<string> {
    const model = await this.prisma.threatModel.findFirst({
      where: { id: threatModelId, tenantId },
      include: {
        components: true,
        threats: true,
      },
    });

    if (!model) throw new Error('Threat model not found');

    // Create a matrix showing STRIDE categories vs components
    const strideCategories = ['SPOOFING', 'TAMPERING', 'REPUDIATION', 'INFORMATION_DISCLOSURE', 'DENIAL_OF_SERVICE', 'ELEVATION_OF_PRIVILEGE'];
    const shortNames = ['S', 'T', 'R', 'I', 'D', 'E'];

    const lines: string[] = ['```'];
    lines.push('STRIDE Threat Matrix');
    lines.push('=' .repeat(80));
    lines.push('');

    // Header
    const header = 'Component'.padEnd(30) + shortNames.map((n) => n.padStart(5)).join('');
    lines.push(header);
    lines.push('-'.repeat(header.length));

    // For each component
    for (const component of model.components) {
      const row = [component.name.substring(0, 28).padEnd(30)];

      for (const category of strideCategories) {
        const count = model.threats.filter(
          (t) => t.category === category || t.strideCategory === category.toLowerCase()
        ).length;
        row.push(count > 0 ? count.toString().padStart(5) : '-'.padStart(5));
      }

      lines.push(row.join(''));
    }

    lines.push('');
    lines.push('Legend: S=Spoofing, T=Tampering, R=Repudiation, I=Information Disclosure, D=DoS, E=Elevation');
    lines.push('```');

    return lines.join('\n');
  }

  async generateRiskHeatmap(threatModelId: string, tenantId: string): Promise<string> {
    const model = await this.prisma.threatModel.findFirst({
      where: { id: threatModelId, tenantId },
      include: {
        threats: true,
      },
    });

    if (!model) throw new Error('Threat model not found');

    const lines: string[] = ['```'];
    lines.push('Risk Heatmap (Likelihood vs Impact)');
    lines.push('=' .repeat(50));
    lines.push('');

    // Create 5x5 heatmap
    const likelihoodLevels = ['Very High', 'High', 'Medium', 'Low', 'Very Low'];
    const impactLevels = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];

    // Count threats in each cell
    const heatmap: number[][] = Array(5).fill(null).map(() => Array(5).fill(0));

    const likelihoodMap: Record<string, number> = {
      very_high: 0, high: 1, medium: 2, low: 3, very_low: 4,
    };
    const impactMap: Record<string, number> = {
      very_low: 0, low: 1, medium: 2, high: 3, very_high: 4,
    };

    for (const threat of model.threats) {
      const lIdx = likelihoodMap[threat.likelihood] ?? 2;
      const iIdx = impactMap[threat.impact] ?? 2;
      heatmap[lIdx][iIdx]++;
    }

    // Header
    lines.push('            ' + impactLevels.map((l) => l.substring(0, 6).padStart(8)).join(''));
    lines.push('Likelihood  ' + '-'.repeat(40));

    for (let l = 0; l < 5; l++) {
      const row = likelihoodLevels[l].padEnd(12);
      const cells = heatmap[l].map((count) => {
        if (count === 0) return '   .   ';
        return `  [${count.toString().padStart(2)}]  `;
      }).join('');
      lines.push(row + cells);
    }

    lines.push('');
    lines.push('Total threats: ' + model.threats.length);
    lines.push('```');

    return lines.join('\n');
  }

  private getComponentNode(comp: any): string {
    const id = this.getNodeId(comp);
    const name = comp.name.substring(0, 25);

    switch (comp.type) {
      case 'datastore':
      case 'database':
        return `${id}[("${name}")]:::datastore`;
      case 'external_entity':
      case 'external':
        return `${id}(("${name}")):::external`;
      case 'process':
      default:
        return `${id}["${name}"]:::process`;
    }
  }

  private getNodeId(comp: any): string {
    return comp.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  }

  private countThreatsByComponent(threats: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const threat of threats) {
      for (const mapping of threat.components || []) {
        const compId = mapping.componentId;
        counts[compId] = (counts[compId] || 0) + 1;
      }
    }
    return counts;
  }
}
