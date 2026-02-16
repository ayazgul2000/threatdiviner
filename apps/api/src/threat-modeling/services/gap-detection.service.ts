import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GapDto, GapElementType, GapDetectionResultDto } from '../dto/gap-detection.dto';

interface ValidationRule {
  field: string;
  condition: (element: any) => boolean;
  requiredWhen?: (element: any) => boolean;
  message: string;
  suggestions?: string[];
}

@Injectable()
export class GapDetectionService {
  private readonly logger = new Logger(GapDetectionService.name);

  // Asset validation rules
  private readonly assetRules: ValidationRule[] = [
    {
      field: 'technology',
      condition: (asset) => !asset.technology || asset.technology.trim() === '',
      message: 'Technology type is required',
      suggestions: ['web-application', 'database', 'api-gateway', 'load-balancer', 'file-storage', 'message-queue'],
    },
    {
      field: 'type',
      condition: (asset) => !asset.type || asset.type.trim() === '',
      message: 'Component type is required',
      suggestions: ['server', 'database', 'external-service', 'client', 'process', 'datastore'],
    },
    {
      field: 'criticality',
      condition: (asset) => !asset.criticality || asset.criticality.trim() === '',
      message: 'Criticality level is recommended',
      suggestions: ['critical', 'high', 'medium', 'low'],
    },
  ];

  // Data flow (link) validation rules
  private readonly linkRules: ValidationRule[] = [
    {
      field: 'protocol',
      condition: (link) => !link.protocol || link.protocol.trim() === '',
      message: 'Protocol is required for connections',
      suggestions: ['https', 'http', 'grpc', 'jdbc', 'tcp', 'udp', 'amqp', 'mqtt', 'websocket'],
    },
    {
      field: 'dataType',
      condition: (link) => !link.dataType || link.dataType.trim() === '',
      message: 'Data type is recommended for data flows',
      suggestions: ['api-requests', 'api-responses', 'user-data', 'credentials', 'logs', 'configuration'],
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Detect gaps in a threat model before analysis
   */
  async detectGaps(tenantId: string, threatModelId: string): Promise<GapDetectionResultDto> {
    const gaps: GapDto[] = [];

    // Load threat model with all related data
    const threatModel = await this.prisma.threatModel.findFirst({
      where: { id: threatModelId, tenantId },
      include: {
        components: true,
        dataFlows: true,
      },
    });

    if (!threatModel) {
      throw new Error('Threat model not found');
    }

    // Validate components (assets)
    for (const component of threatModel.components) {
      const componentGaps = this.validateElement(
        component,
        this.assetRules,
        GapElementType.ASSET,
        component.name,
      );
      gaps.push(...componentGaps);
    }

    // Validate data flows (links)
    for (const dataFlow of threatModel.dataFlows) {
      const flowGaps = this.validateElement(
        dataFlow,
        this.linkRules,
        GapElementType.LINK,
        dataFlow.label || `Flow ${dataFlow.id.substring(0, 8)}`,
      );
      gaps.push(...flowGaps);
    }

    const result: GapDetectionResultDto = {
      valid: gaps.length === 0,
      gaps,
      summary: {
        totalGaps: gaps.length,
        assetGaps: gaps.filter(g => g.elementType === GapElementType.ASSET).length,
        linkGaps: gaps.filter(g => g.elementType === GapElementType.LINK).length,
        boundaryGaps: 0, // No trust boundaries in schema yet
      },
    };

    this.logger.log(`Gap detection for ${threatModelId}: ${result.summary.totalGaps} gaps found`);
    return result;
  }

  /**
   * Validate a single element against rules
   */
  private validateElement(
    element: any,
    rules: ValidationRule[],
    elementType: GapElementType,
    elementName: string,
  ): GapDto[] {
    const gaps: GapDto[] = [];

    for (const rule of rules) {
      // Check if rule applies (requiredWhen condition)
      if (rule.requiredWhen && !rule.requiredWhen(element)) {
        continue;
      }

      // Check if there's a gap
      if (rule.condition(element)) {
        gaps.push({
          elementType,
          elementId: element.id,
          elementName,
          field: rule.field,
          rule: this.getRuleName(rule),
          message: rule.message,
          currentValue: element[rule.field],
          suggestions: rule.suggestions,
        });
      }
    }

    return gaps;
  }

  private getRuleName(rule: ValidationRule): string {
    if (rule.requiredWhen) {
      return `${rule.field}_conditional`;
    }
    return `${rule.field}_required`;
  }

  /**
   * Batch update assets to fill gaps
   */
  async batchUpdateAssets(
    tenantId: string,
    threatModelId: string,
    updates: Array<{ id: string; fields: Record<string, any> }>,
  ): Promise<{ updated: number; failed: number; errors: Array<{ id: string; error: string }> }> {
    let updated = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const update of updates) {
      try {
        // Verify component belongs to threat model and tenant
        const component = await this.prisma.threatModelComponent.findFirst({
          where: {
            id: update.id,
            threatModelId,
            threatModel: { tenantId },
          },
        });

        if (!component) {
          errors.push({ id: update.id, error: 'Component not found or access denied' });
          failed++;
          continue;
        }

        // Update the component
        await this.prisma.threatModelComponent.update({
          where: { id: update.id },
          data: update.fields,
        });

        updated++;
      } catch (error) {
        errors.push({ id: update.id, error: error instanceof Error ? error.message : 'Unknown error' });
        failed++;
      }
    }

    this.logger.log(`Batch update assets: ${updated} updated, ${failed} failed`);
    return { updated, failed, errors };
  }

  /**
   * Batch update data flows to fill gaps
   */
  async batchUpdateDataFlows(
    tenantId: string,
    threatModelId: string,
    updates: Array<{ id: string; fields: Record<string, any> }>,
  ): Promise<{ updated: number; failed: number; errors: Array<{ id: string; error: string }> }> {
    let updated = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const update of updates) {
      try {
        const dataFlow = await this.prisma.threatModelDataFlow.findFirst({
          where: {
            id: update.id,
            threatModelId,
            threatModel: { tenantId },
          },
        });

        if (!dataFlow) {
          errors.push({ id: update.id, error: 'Data flow not found or access denied' });
          failed++;
          continue;
        }

        await this.prisma.threatModelDataFlow.update({
          where: { id: update.id },
          data: update.fields,
        });

        updated++;
      } catch (error) {
        errors.push({ id: update.id, error: error instanceof Error ? error.message : 'Unknown error' });
        failed++;
      }
    }

    this.logger.log(`Batch update data flows: ${updated} updated, ${failed} failed`);
    return { updated, failed, errors };
  }

  /**
   * Batch update trust boundaries to fill gaps (placeholder for future)
   */
  async batchUpdateBoundaries(
    _tenantId: string,
    _threatModelId: string,
    _updates: Array<{ id: string; fields: Record<string, any> }>,
  ): Promise<{ updated: number; failed: number; errors: Array<{ id: string; error: string }> }> {
    // Trust boundaries not implemented in schema yet
    this.logger.warn('Trust boundaries not yet implemented in schema');
    return { updated: 0, failed: 0, errors: [] };
  }

  /**
   * Combined batch update for all element types
   */
  async batchFillGaps(
    tenantId: string,
    threatModelId: string,
    assetUpdates: Array<{ id: string; fields: Record<string, any> }>,
    linkUpdates: Array<{ id: string; fields: Record<string, any> }>,
    boundaryUpdates: Array<{ id: string; fields: Record<string, any> }>,
  ): Promise<{
    assetsUpdated: number;
    linksUpdated: number;
    boundariesUpdated: number;
    totalErrors: number;
    gapResult: GapDetectionResultDto;
  }> {
    const assetResult = await this.batchUpdateAssets(tenantId, threatModelId, assetUpdates);
    const linkResult = await this.batchUpdateDataFlows(tenantId, threatModelId, linkUpdates);
    const boundaryResult = await this.batchUpdateBoundaries(tenantId, threatModelId, boundaryUpdates);

    // Re-validate after updates
    const gapResult = await this.detectGaps(tenantId, threatModelId);

    return {
      assetsUpdated: assetResult.updated,
      linksUpdated: linkResult.updated,
      boundariesUpdated: boundaryResult.updated,
      totalErrors: assetResult.failed + linkResult.failed + boundaryResult.failed,
      gapResult,
    };
  }
}
