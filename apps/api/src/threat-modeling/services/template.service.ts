import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ThreatModelingService } from '../threat-modeling.service';

export interface TemplateComponent {
  name: string;
  type: string;
  technology?: string;
  description?: string;
  criticality?: string;
  dataClassification?: string;
  positionX?: number;
  positionY?: number;
}

export interface TemplateDataFlow {
  sourceName: string;
  targetName: string;
  label?: string;
  protocol?: string;
  dataType?: string;
  authentication?: boolean;
  encryption?: boolean;
}

export interface TemplateBoundary {
  name: string;
  type: string;
  description?: string;
  componentNames: string[];
}

export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  previewImageUrl: string | null;
  componentCount: number;
  dataFlowCount: number;
  isPublic: boolean;
}

export interface TemplateDetails extends TemplateListItem {
  diagramXml: string;
  components: TemplateComponent[];
  dataFlows: TemplateDataFlow[];
  boundaries: TemplateBoundary[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateCreateResult {
  threatModel: { id: string; name: string };
  componentsCreated: number;
  dataFlowsCreated: number;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly threatModelingService: ThreatModelingService,
  ) {}

  /**
   * List available templates for a tenant
   * Returns public templates + tenant-specific templates
   */
  async listTemplates(
    tenantId: string,
    options?: {
      category?: string;
      search?: string;
    },
  ): Promise<TemplateListItem[]> {
    const where: Record<string, unknown> = {
      OR: [{ isPublic: true }, { tenantId }],
    };

    if (options?.category) {
      where.category = options.category;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
        { tags: { has: options.search } },
      ];
      // Combine with visibility filter
      where.AND = [
        { OR: [{ isPublic: true }, { tenantId }] },
        { OR: where.OR },
      ];
      delete where.OR;
    }

    const templates = await this.prisma.threatModelTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        tags: true,
        previewImageUrl: true,
        components: true,
        dataFlows: true,
        isPublic: true,
      },
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      tags: t.tags,
      previewImageUrl: t.previewImageUrl,
      componentCount: Array.isArray(t.components)
        ? (t.components as unknown[]).length
        : 0,
      dataFlowCount: Array.isArray(t.dataFlows)
        ? (t.dataFlows as unknown[]).length
        : 0,
      isPublic: t.isPublic,
    }));
  }

  /**
   * Get template details by ID
   */
  async getTemplate(
    tenantId: string,
    templateId: string,
  ): Promise<TemplateDetails> {
    const template = await this.prisma.threatModelTemplate.findFirst({
      where: {
        id: templateId,
        OR: [{ isPublic: true }, { tenantId }],
      },
    });

    if (!template) {
      throw new NotFoundException(`Template not found: ${templateId}`);
    }

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      tags: template.tags,
      previewImageUrl: template.previewImageUrl,
      diagramXml: template.diagramXml,
      components: (template.components as unknown as TemplateComponent[]) || [],
      dataFlows: (template.dataFlows as unknown as TemplateDataFlow[]) || [],
      boundaries: (template.boundaries as unknown as TemplateBoundary[]) || [],
      componentCount: Array.isArray(template.components)
        ? (template.components as unknown[]).length
        : 0,
      dataFlowCount: Array.isArray(template.dataFlows)
        ? (template.dataFlows as unknown[]).length
        : 0,
      isPublic: template.isPublic,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  /**
   * Create a threat model from a template
   */
  async createFromTemplate(
    tenantId: string,
    userId: string,
    templateId: string,
    data: {
      projectId: string;
      name: string;
      description?: string;
      methodology?: string;
    },
  ): Promise<TemplateCreateResult> {
    // Get the template
    const template = await this.getTemplate(tenantId, templateId);

    // Create the threat model
    const threatModel = await this.threatModelingService.createThreatModel(
      tenantId,
      userId,
      {
        name: data.name,
        projectId: data.projectId,
        description: data.description || template.description || undefined,
        methodology: data.methodology || 'stride',
      },
    );

    // Update with diagram XML if available
    if (template.diagramXml) {
      await this.prisma.threatModel.update({
        where: { id: threatModel.id },
        data: { diagramXml: template.diagramXml },
      });
    }

    // Build name to ID map for linking data flows
    const nameToComponentId = new Map<string, string>();

    // Create components
    for (const comp of template.components) {
      const created = await this.threatModelingService.addComponent(
        tenantId,
        threatModel.id,
        {
          name: comp.name,
          type: comp.type,
          technology: comp.technology,
          description: comp.description,
          dataClassification: comp.dataClassification,
          criticality: comp.criticality,
          positionX: comp.positionX,
          positionY: comp.positionY,
        },
      );
      nameToComponentId.set(comp.name, created.id);
    }

    // Create data flows
    let dataFlowsCreated = 0;
    for (const flow of template.dataFlows) {
      const sourceId = nameToComponentId.get(flow.sourceName);
      const targetId = nameToComponentId.get(flow.targetName);

      if (sourceId && targetId) {
        await this.threatModelingService.addDataFlow(tenantId, threatModel.id, {
          sourceId,
          targetId,
          label: flow.label,
          protocol: flow.protocol,
          dataType: flow.dataType,
          authentication: flow.authentication ?? false,
          encryption: flow.encryption ?? false,
        });
        dataFlowsCreated++;
      } else {
        this.logger.warn(
          `Skipping data flow: ${flow.sourceName} → ${flow.targetName} (component not found)`,
        );
      }
    }

    this.logger.log(
      `Created threat model ${threatModel.id} from template ${templateId}: ${template.components.length} components, ${dataFlowsCreated} data flows`,
    );

    return {
      threatModel: {
        id: threatModel.id,
        name: threatModel.name,
      },
      componentsCreated: template.components.length,
      dataFlowsCreated,
    };
  }

  /**
   * Get list of available categories
   */
  async getCategories(): Promise<string[]> {
    const templates = await this.prisma.threatModelTemplate.findMany({
      where: { isPublic: true },
      select: { category: true },
      distinct: ['category'],
    });

    return templates.map((t) => t.category).sort();
  }
}
