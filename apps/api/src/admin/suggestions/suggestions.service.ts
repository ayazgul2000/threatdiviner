import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SuggestionListQuery,
  ApproveSuggestionDto,
  RejectSuggestionDto,
  EditSuggestionDto,
  BulkActionDto,
  PromotionListQuery,
  SubmitForReviewDto,
  ReviewDecisionDto,
  PromoteDto,
  RollbackDto,
  TestShapeMappingDto,
  TestDeduplicationDto,
  TestPlaybookDto,
  AuditLogQuery,
  ConfigType,
} from './dto/suggestion.dto';
import { Prisma } from '@prisma/client';

export interface AiSuggestion {
  id: string;
  type: string;
  source: string;
  sourceId: string | null;
  suggestedData: Record<string, unknown>;
  confidence: number;
  reason: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromotionItem {
  id: string;
  configType: string;
  configId: string;
  status: string;
  submittedBy: string;
  submittedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewFeedback: string | null;
  promotedBy: string | null;
  promotedAt: Date | null;
  promotionNotes: string | null;
  rollbackBy: string | null;
  rollbackAt: Date | null;
  rollbackReason: string | null;
  previousData: Record<string, unknown> | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfigAuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  userName: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // AI Suggestion Queue Operations
  // ============================================

  async listSuggestions(query: SuggestionListQuery): Promise<{ suggestions: AiSuggestion[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    } else {
      where.status = 'pending'; // Default to pending
    }

    if (query.minConfidence !== undefined) {
      where.confidence = { ...(where.confidence as object || {}), gte: query.minConfidence };
    }

    if (query.maxConfidence !== undefined) {
      where.confidence = { ...(where.confidence as object || {}), lte: query.maxConfidence };
    }

    if (query.source) {
      where.source = query.source;
    }

    const [suggestions, total] = await Promise.all([
      this.prisma.aiSuggestion.findMany({
        where,
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
        take: query.limit || 20,
        skip: query.offset || 0,
      }),
      this.prisma.aiSuggestion.count({ where }),
    ]);

    return {
      suggestions: suggestions.map(s => ({
        ...s,
        suggestedData: s.suggestedData as Record<string, unknown>,
      })),
      total,
    };
  }

  async getSuggestionById(id: string): Promise<AiSuggestion> {
    const suggestion = await this.prisma.aiSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      throw new NotFoundException(`Suggestion with ID "${id}" not found`);
    }

    return {
      ...suggestion,
      suggestedData: suggestion.suggestedData as Record<string, unknown>,
    };
  }

  async approveSuggestion(id: string, dto: ApproveSuggestionDto, userId: string): Promise<AiSuggestion> {
    const suggestion = await this.getSuggestionById(id);

    if (suggestion.status !== 'pending' && suggestion.status !== 'edited') {
      throw new BadRequestException(`Cannot approve suggestion with status "${suggestion.status}"`);
    }

    // Create the actual config based on suggestion type
    await this.createConfigFromSuggestion(suggestion);

    const updated = await this.prisma.aiSuggestion.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: dto.notes,
      },
    });

    // Log the action
    await this.logAction('suggestion', id, 'approve', userId, { notes: dto.notes });

    return {
      ...updated,
      suggestedData: updated.suggestedData as Record<string, unknown>,
    };
  }

  async rejectSuggestion(id: string, dto: RejectSuggestionDto, userId: string): Promise<AiSuggestion> {
    const suggestion = await this.getSuggestionById(id);

    if (suggestion.status !== 'pending' && suggestion.status !== 'edited') {
      throw new BadRequestException(`Cannot reject suggestion with status "${suggestion.status}"`);
    }

    const updated = await this.prisma.aiSuggestion.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: dto.reason,
      },
    });

    await this.logAction('suggestion', id, 'reject', userId, { reason: dto.reason });

    return {
      ...updated,
      suggestedData: updated.suggestedData as Record<string, unknown>,
    };
  }

  async editSuggestion(id: string, dto: EditSuggestionDto, userId: string): Promise<AiSuggestion> {
    const suggestion = await this.getSuggestionById(id);

    if (suggestion.status !== 'pending' && suggestion.status !== 'edited') {
      throw new BadRequestException(`Cannot edit suggestion with status "${suggestion.status}"`);
    }

    const updated = await this.prisma.aiSuggestion.update({
      where: { id },
      data: {
        status: 'edited',
        suggestedData: (dto.suggestedData || suggestion.suggestedData) as Prisma.InputJsonValue,
        reviewNotes: dto.editNotes,
      },
    });

    await this.logAction('suggestion', id, 'edit', userId, { editNotes: dto.editNotes });

    return {
      ...updated,
      suggestedData: updated.suggestedData as Record<string, unknown>,
    };
  }

  async bulkAction(dto: BulkActionDto, userId: string): Promise<{ processed: number; failed: string[] }> {
    const failed: string[] = [];
    let processed = 0;

    for (const id of dto.ids) {
      try {
        if (dto.action === 'approve') {
          await this.approveSuggestion(id, {}, userId);
        } else {
          await this.rejectSuggestion(id, { reason: dto.reason || 'Bulk rejected' }, userId);
        }
        processed++;
      } catch {
        failed.push(id);
      }
    }

    return { processed, failed };
  }

  async getSuggestionStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    byType: Record<string, number>;
    avgConfidence: number;
  }> {
    const [pending, approved, rejected, byType, avgResult] = await Promise.all([
      this.prisma.aiSuggestion.count({ where: { status: 'pending' } }),
      this.prisma.aiSuggestion.count({ where: { status: 'approved' } }),
      this.prisma.aiSuggestion.count({ where: { status: 'rejected' } }),
      this.prisma.aiSuggestion.groupBy({
        by: ['type'],
        where: { status: 'pending' },
        _count: true,
      }),
      this.prisma.aiSuggestion.aggregate({
        where: { status: 'pending' },
        _avg: { confidence: true },
      }),
    ]);

    const typeStats: Record<string, number> = {};
    for (const item of byType) {
      typeStats[item.type] = item._count;
    }

    return {
      pending,
      approved,
      rejected,
      byType: typeStats,
      avgConfidence: avgResult._avg.confidence || 0,
    };
  }

  // ============================================
  // Promotion Workflow Operations
  // ============================================

  async listPromotionItems(query: PromotionListQuery): Promise<{ items: PromotionItem[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.configType) {
      where.configType = query.configType;
    }

    const [items, total] = await Promise.all([
      this.prisma.promotionItem.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        take: query.limit || 20,
      }),
      this.prisma.promotionItem.count({ where }),
    ]);

    return {
      items: items.map(item => ({
        ...item,
        previousData: item.previousData as Record<string, unknown> | null,
      })),
      total,
    };
  }

  async getPromotionItemById(id: string): Promise<PromotionItem> {
    const item = await this.prisma.promotionItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException(`Promotion item with ID "${id}" not found`);
    }

    return {
      ...item,
      previousData: item.previousData as Record<string, unknown> | null,
    };
  }

  async submitForReview(dto: SubmitForReviewDto, userId: string): Promise<PromotionItem> {
    // Check if already submitted
    const existing = await this.prisma.promotionItem.findFirst({
      where: {
        configId: dto.configId,
        configType: dto.configType,
        status: { in: ['pending', 'review'] },
      },
    });

    if (existing) {
      throw new ConflictException('This item is already pending review');
    }

    // Get current config data for backup
    const currentData = await this.getConfigData(dto.configType, dto.configId);

    const item = await this.prisma.promotionItem.create({
      data: {
        configType: dto.configType,
        configId: dto.configId,
        status: 'review',
        submittedBy: userId,
        submittedAt: new Date(),
        description: dto.description,
        previousData: currentData as Prisma.InputJsonValue,
      },
    });

    await this.logAction('promotion', item.id, 'submit_for_review', userId, { configType: dto.configType });

    return {
      ...item,
      previousData: item.previousData as Record<string, unknown> | null,
    };
  }

  async reviewDecision(id: string, dto: ReviewDecisionDto, userId: string): Promise<PromotionItem> {
    const item = await this.getPromotionItemById(id);

    if (item.status !== 'review') {
      throw new BadRequestException(`Cannot review item with status "${item.status}"`);
    }

    let newStatus: string;
    switch (dto.decision) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'request_changes':
        newStatus = 'pending';
        break;
      case 'reject':
        newStatus = 'archived';
        break;
      default:
        throw new BadRequestException('Invalid decision');
    }

    const updated = await this.prisma.promotionItem.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewFeedback: dto.feedback,
      },
    });

    await this.logAction('promotion', id, `review_${dto.decision}`, userId, { feedback: dto.feedback });

    return {
      ...updated,
      previousData: updated.previousData as Record<string, unknown> | null,
    };
  }

  async promote(dto: PromoteDto, userId: string): Promise<{ promoted: number; failed: string[] }> {
    if (!dto.testedInSandbox || !dto.understandsImpact) {
      throw new BadRequestException('Must confirm testing and impact understanding');
    }

    const failed: string[] = [];
    let promoted = 0;

    for (const itemId of dto.itemIds) {
      try {
        const item = await this.getPromotionItemById(itemId);

        if (item.status !== 'approved') {
          failed.push(itemId);
          continue;
        }

        // Update the config status to 'live'
        await this.updateConfigStatus(item.configType as ConfigType, item.configId, 'live');

        // Update promotion item
        await this.prisma.promotionItem.update({
          where: { id: itemId },
          data: {
            status: 'live',
            promotedBy: userId,
            promotedAt: new Date(),
            promotionNotes: dto.notes,
          },
        });

        await this.logAction('promotion', itemId, 'promote_to_live', userId, { notes: dto.notes });
        promoted++;
      } catch {
        failed.push(itemId);
      }
    }

    return { promoted, failed };
  }

  async rollback(dto: RollbackDto, userId: string): Promise<PromotionItem> {
    const item = await this.getPromotionItemById(dto.promotionId);

    if (item.status !== 'live') {
      throw new BadRequestException('Can only rollback live items');
    }

    if (!item.previousData) {
      throw new BadRequestException('No previous data available for rollback');
    }

    // Restore previous config data
    await this.restoreConfigData(item.configType as ConfigType, item.configId, item.previousData);

    const updated = await this.prisma.promotionItem.update({
      where: { id: dto.promotionId },
      data: {
        status: 'archived',
        rollbackBy: userId,
        rollbackAt: new Date(),
        rollbackReason: dto.reason,
      },
    });

    await this.logAction('promotion', dto.promotionId, 'rollback', userId, { reason: dto.reason });

    return {
      ...updated,
      previousData: updated.previousData as Record<string, unknown> | null,
    };
  }

  async getPromotionStats(): Promise<{
    pending: number;
    review: number;
    approved: number;
    live: number;
    byType: Record<string, number>;
  }> {
    const [pending, review, approved, live, byType] = await Promise.all([
      this.prisma.promotionItem.count({ where: { status: 'pending' } }),
      this.prisma.promotionItem.count({ where: { status: 'review' } }),
      this.prisma.promotionItem.count({ where: { status: 'approved' } }),
      this.prisma.promotionItem.count({ where: { status: 'live' } }),
      this.prisma.promotionItem.groupBy({
        by: ['configType'],
        where: { status: { in: ['pending', 'review', 'approved'] } },
        _count: true,
      }),
    ]);

    const typeStats: Record<string, number> = {};
    for (const item of byType) {
      typeStats[item.configType] = item._count;
    }

    return { pending, review, approved, live, byType: typeStats };
  }

  // ============================================
  // Sandbox Testing Operations
  // ============================================

  async testShapeMappings(dto: TestShapeMappingDto): Promise<{
    results: Array<{
      style: string;
      mappedTo: string | null;
      status: 'live' | 'staging' | 'missing';
      mappingId: string | null;
    }>;
    summary: { total: number; mapped: number; unmapped: number };
  }> {
    // Parse XML to extract shape styles
    const styles = this.extractStylesFromXml(dto.diagramXml);

    const results: Array<{
      style: string;
      mappedTo: string | null;
      status: 'live' | 'staging' | 'missing';
      mappingId: string | null;
    }> = [];

    for (const style of styles) {
      // Check live mappings first
      const liveMapping = await this.prisma.shapeMapping.findFirst({
        where: { drawioStyle: style, status: 'live' },
      });

      if (liveMapping) {
        results.push({
          style,
          mappedTo: liveMapping.threagileType,
          status: 'live',
          mappingId: liveMapping.id,
        });
        continue;
      }

      // Check staging mappings
      const stagingMapping = await this.prisma.shapeMapping.findFirst({
        where: { drawioStyle: style, status: { in: ['pending', 'review'] } },
      });

      if (stagingMapping) {
        results.push({
          style,
          mappedTo: stagingMapping.threagileType,
          status: 'staging',
          mappingId: stagingMapping.id,
        });
        continue;
      }

      // No mapping found
      results.push({
        style,
        mappedTo: null,
        status: 'missing',
        mappingId: null,
      });
    }

    const mapped = results.filter(r => r.mappedTo !== null).length;

    return {
      results,
      summary: {
        total: results.length,
        mapped,
        unmapped: results.length - mapped,
      },
    };
  }

  async testDeduplication(dto: TestDeduplicationDto): Promise<{
    inputRisks: string[];
    canonicalRisk: { id: string; title: string } | null;
    sources: string[];
  }> {
    // Find canonical risk that maps to any of the input risk IDs
    const sources = await this.prisma.canonicalRiskSource.findMany({
      where: {
        sourceRuleId: { in: dto.riskIds },
      },
      include: {
        canonicalRisk: true,
      },
    });

    if (sources.length === 0) {
      return {
        inputRisks: dto.riskIds,
        canonicalRisk: null,
        sources: [],
      };
    }

    // All should map to same canonical risk
    const canonicalRisk = sources[0].canonicalRisk;

    return {
      inputRisks: dto.riskIds,
      canonicalRisk: {
        id: canonicalRisk.canonicalId,
        title: canonicalRisk.title,
      },
      sources: sources.map(s => s.source),
    };
  }

  async testPlaybook(dto: TestPlaybookDto): Promise<{
    playbook: {
      id: string;
      title: string;
      steps: Array<{ stepNumber: number; title: string; description: string }>;
    } | null;
    renderedSteps: Array<{ stepNumber: number; title: string; description: string }>;
  }> {
    const playbook = await this.prisma.remediationPlaybook.findUnique({
      where: { id: dto.playbookId },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
      },
    });

    if (!playbook) {
      return { playbook: null, renderedSteps: [] };
    }

    // Render steps with context substitution
    const renderedSteps = playbook.steps.map(step => ({
      stepNumber: step.stepNumber,
      title: this.substituteContext(step.title, dto.assetName, dto.technology),
      description: this.substituteContext(step.description, dto.assetName, dto.technology),
    }));

    return {
      playbook: {
        id: playbook.id,
        title: playbook.title,
        steps: playbook.steps.map(s => ({
          stepNumber: s.stepNumber,
          title: s.title,
          description: s.description,
        })),
      },
      renderedSteps,
    };
  }

  // ============================================
  // Audit Log Operations
  // ============================================

  async listAuditLogs(query: AuditLogQuery): Promise<{ logs: ConfigAuditLog[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.action) {
      where.action = query.action;
    }

    const [logs, total] = await Promise.all([
      this.prisma.configAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit || 50,
      }),
      this.prisma.configAuditLog.count({ where }),
    ]);

    return {
      logs: logs.map(log => ({
        ...log,
        changes: log.changes as Record<string, unknown> | null,
        metadata: log.metadata as Record<string, unknown> | null,
      })),
      total,
    };
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async createConfigFromSuggestion(suggestion: AiSuggestion): Promise<void> {
    const data = suggestion.suggestedData;

    switch (suggestion.type) {
      case 'shape_mapping':
        await this.prisma.shapeMapping.create({
          data: {
            drawioStyle: data.drawioStyle as string,
            threagileType: data.threagileType as string,
            machineType: (data.machineType as string) || 'virtual',
            displayName: (data.displayName as string) || data.drawioStyle as string,
            category: (data.category as string) || 'generic',
            status: 'pending',
            aiSuggested: true,
          },
        });
        break;

      case 'canonical_risk':
        await this.prisma.canonicalRisk.create({
          data: {
            tenantId: (data.tenantId as string) || 'default',
            canonicalId: data.canonicalId as string,
            title: data.title as string,
            description: data.description as string | undefined,
            defaultSeverity: (data.severity as string) || 'medium',
            cweId: data.cweId as string | undefined,
            status: 'pending',
          },
        });
        break;

      case 'risk_mapping':
        await this.prisma.canonicalRiskSource.create({
          data: {
            canonicalRiskId: data.canonicalRiskId as string,
            source: data.source as string,
            sourceRuleId: data.sourceRuleId as string,
            sourceTitle: data.sourceTitle as string | undefined,
          },
        });
        break;

      // Add more cases as needed
      default:
        break;
    }
  }

  private async getConfigData(configType: ConfigType, configId: string): Promise<Record<string, unknown>> {
    switch (configType) {
      case 'shape_mapping': {
        const mapping = await this.prisma.shapeMapping.findUnique({ where: { id: configId } });
        return mapping as unknown as Record<string, unknown>;
      }
      case 'canonical_risk': {
        const risk = await this.prisma.canonicalRisk.findUnique({ where: { id: configId } });
        return risk as unknown as Record<string, unknown>;
      }
      case 'playbook': {
        const playbook = await this.prisma.remediationPlaybook.findUnique({
          where: { id: configId },
          include: { steps: true },
        });
        return playbook as unknown as Record<string, unknown>;
      }
      default:
        return {};
    }
  }

  private async updateConfigStatus(configType: ConfigType, configId: string, status: string): Promise<void> {
    switch (configType) {
      case 'shape_mapping':
        await this.prisma.shapeMapping.update({
          where: { id: configId },
          data: { status },
        });
        break;
      case 'canonical_risk':
        await this.prisma.canonicalRisk.update({
          where: { id: configId },
          data: { status },
        });
        break;
      case 'playbook':
        await this.prisma.remediationPlaybook.update({
          where: { id: configId },
          data: { status },
        });
        break;
      case 'wizard_question':
        await this.prisma.wizardQuestion.update({
          where: { id: configId },
          data: { status },
        });
        break;
      default:
        break;
    }
  }

  private async restoreConfigData(
    configType: ConfigType,
    configId: string,
    previousData: Record<string, unknown>,
  ): Promise<void> {
    switch (configType) {
      case 'shape_mapping':
        await this.prisma.shapeMapping.update({
          where: { id: configId },
          data: {
            drawioStyle: previousData.drawioStyle as string,
            threagileType: previousData.threagileType as string,
            machineType: previousData.machineType as string,
            displayName: previousData.displayName as string,
            category: previousData.category as string,
            status: 'live',
          },
        });
        break;
      // Add more cases as needed
      default:
        break;
    }
  }

  private async logAction(
    entityType: string,
    entityId: string,
    action: string,
    userId: string,
    changes?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.configAuditLog.create({
      data: {
        entityType,
        entityId,
        action,
        userId,
        changes: (changes || {}) as Prisma.InputJsonValue,
      },
    });
  }

  private extractStylesFromXml(xml: string): string[] {
    // Simple regex to extract mxgraph styles from XML
    const styleRegex = /style="([^"]+)"/g;
    const styles = new Set<string>();

    let match;
    while ((match = styleRegex.exec(xml)) !== null) {
      const style = match[1];
      // Extract shape identifier from style string
      const shapeMatch = style.match(/shape=(mxgraph\.[^;]+)/);
      if (shapeMatch) {
        styles.add(shapeMatch[1]);
      }
    }

    return Array.from(styles);
  }

  private substituteContext(text: string, assetName?: string, technology?: string): string {
    let result = text;
    if (assetName) {
      result = result.replace(/\{asset\}/g, assetName);
    }
    if (technology) {
      result = result.replace(/\{technology\}/g, technology);
    }
    return result;
  }
}
