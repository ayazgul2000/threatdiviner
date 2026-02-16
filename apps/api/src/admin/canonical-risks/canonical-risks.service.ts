import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCanonicalRiskDto,
  UpdateCanonicalRiskDto,
  AddSourceMappingDto,
  ImportCanonicalRiskDto,
  CanonicalRiskListQuery,
} from './dto/canonical-risk.dto';

export interface CanonicalRiskResult {
  id: string;
  canonicalId: string;
  title: string;
  description: string | null;
  defaultSeverity: string;
  cweId: string | null;
  cweName: string | null;
  capecIds: string[];
  attackIds: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
  sources?: CanonicalRiskSourceResult[];
  _count?: { sources: number };
}

export interface CanonicalRiskSourceResult {
  id: string;
  source: string;
  sourceRuleId: string;
  sourceTitle: string | null;
  createdAt: Date;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ canonicalId: string; error: string }>;
}

@Injectable()
export class CanonicalRisksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CanonicalRiskListQuery): Promise<{ risks: CanonicalRiskResult[]; total: number }> {
    const { search, source, severity, status, limit = '50', offset = '0' } = query;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { canonicalId: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { cweId: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (source) {
      where.sources = { some: { source } };
    }

    if (severity) {
      where.defaultSeverity = severity;
    }

    if (status) {
      where.status = status;
    }

    const [risks, total] = await Promise.all([
      this.prisma.canonicalRisk.findMany({
        where,
        include: {
          sources: true,
          _count: { select: { sources: true } },
        },
        orderBy: [{ title: 'asc' }],
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      this.prisma.canonicalRisk.count({ where }),
    ]);

    return { risks, total };
  }

  async getById(id: string): Promise<CanonicalRiskResult> {
    const risk = await this.prisma.canonicalRisk.findUnique({
      where: { id },
      include: {
        sources: true,
        _count: { select: { sources: true } },
      },
    });
    if (!risk) {
      throw new NotFoundException(`Canonical risk with id ${id} not found`);
    }
    return risk;
  }

  async create(dto: CreateCanonicalRiskDto, tenantId: string): Promise<CanonicalRiskResult> {
    // Check for duplicate canonicalId
    const existing = await this.prisma.canonicalRisk.findUnique({
      where: { canonicalId: dto.canonicalId },
    });

    if (existing) {
      throw new ConflictException(`Canonical risk with ID "${dto.canonicalId}" already exists`);
    }

    const risk = await this.prisma.canonicalRisk.create({
      data: {
        tenantId,
        canonicalId: dto.canonicalId,
        title: dto.title,
        description: dto.description,
        defaultSeverity: dto.defaultSeverity || 'medium',
        cweId: dto.cweId,
        cweName: dto.cweName,
        capecIds: dto.capecIds || [],
        attackIds: dto.attackIds || [],
        status: 'pending',
      },
      include: {
        sources: true,
        _count: { select: { sources: true } },
      },
    });

    return risk;
  }

  async update(id: string, dto: UpdateCanonicalRiskDto): Promise<CanonicalRiskResult> {
    const existing = await this.prisma.canonicalRisk.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Canonical risk with id ${id} not found`);
    }

    // Check for duplicate canonicalId if changing it
    if (dto.canonicalId && dto.canonicalId !== existing.canonicalId) {
      const duplicate = await this.prisma.canonicalRisk.findUnique({
        where: { canonicalId: dto.canonicalId },
      });
      if (duplicate) {
        throw new ConflictException(`Canonical risk with ID "${dto.canonicalId}" already exists`);
      }
    }

    // When updating, reset status to pending
    const risk = await this.prisma.canonicalRisk.update({
      where: { id },
      data: {
        ...dto,
        status: 'pending',
      },
      include: {
        sources: true,
        _count: { select: { sources: true } },
      },
    });

    return risk;
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.canonicalRisk.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Canonical risk with id ${id} not found`);
    }

    await this.prisma.canonicalRisk.delete({ where: { id } });
    return { success: true };
  }

  async addSource(riskId: string, dto: AddSourceMappingDto): Promise<CanonicalRiskSourceResult> {
    const risk = await this.prisma.canonicalRisk.findUnique({ where: { id: riskId } });
    if (!risk) {
      throw new NotFoundException(`Canonical risk with id ${riskId} not found`);
    }

    // Check for duplicate source mapping
    const existing = await this.prisma.canonicalRiskSource.findFirst({
      where: {
        canonicalRiskId: riskId,
        source: dto.source,
        sourceRuleId: dto.sourceRuleId,
      },
    });

    if (existing) {
      throw new ConflictException(`Source mapping for ${dto.source}:${dto.sourceRuleId} already exists`);
    }

    const source = await this.prisma.canonicalRiskSource.create({
      data: {
        canonicalRiskId: riskId,
        source: dto.source,
        sourceRuleId: dto.sourceRuleId,
        sourceTitle: dto.sourceTitle,
      },
    });

    // Reset risk status to pending
    await this.prisma.canonicalRisk.update({
      where: { id: riskId },
      data: { status: 'pending' },
    });

    return source;
  }

  async removeSource(riskId: string, sourceId: string): Promise<{ success: boolean }> {
    const source = await this.prisma.canonicalRiskSource.findFirst({
      where: { id: sourceId, canonicalRiskId: riskId },
    });

    if (!source) {
      throw new NotFoundException(`Source mapping not found`);
    }

    await this.prisma.canonicalRiskSource.delete({ where: { id: sourceId } });

    // Reset risk status to pending
    await this.prisma.canonicalRisk.update({
      where: { id: riskId },
      data: { status: 'pending' },
    });

    return { success: true };
  }

  async submitForReview(id: string): Promise<CanonicalRiskResult> {
    const existing = await this.prisma.canonicalRisk.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Canonical risk with id ${id} not found`);
    }

    if (existing.status !== 'pending') {
      throw new ConflictException(`Only pending risks can be submitted for review`);
    }

    const risk = await this.prisma.canonicalRisk.update({
      where: { id },
      data: { status: 'review' },
      include: {
        sources: true,
        _count: { select: { sources: true } },
      },
    });

    return risk;
  }

  async approve(id: string, isSuperAdmin: boolean): Promise<CanonicalRiskResult> {
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only SuperAdmin can approve risks');
    }

    const existing = await this.prisma.canonicalRisk.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Canonical risk with id ${id} not found`);
    }

    if (existing.status !== 'review') {
      throw new ConflictException(`Only risks in review status can be approved`);
    }

    const risk = await this.prisma.canonicalRisk.update({
      where: { id },
      data: { status: 'live' },
      include: {
        sources: true,
        _count: { select: { sources: true } },
      },
    });

    return risk;
  }

  async bulkImport(risks: ImportCanonicalRiskDto[], tenantId: string): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;
    const errors: Array<{ canonicalId: string; error: string }> = [];

    for (const riskData of risks) {
      try {
        // Check for duplicate
        const existing = await this.prisma.canonicalRisk.findUnique({
          where: { canonicalId: riskData.canonicalId },
        });

        if (existing) {
          skipped++;
          errors.push({ canonicalId: riskData.canonicalId, error: 'Duplicate canonical ID' });
          continue;
        }

        // Create risk with sources
        await this.prisma.canonicalRisk.create({
          data: {
            tenantId,
            canonicalId: riskData.canonicalId,
            title: riskData.title,
            description: riskData.description,
            defaultSeverity: riskData.defaultSeverity || 'medium',
            cweId: riskData.cweId,
            cweName: riskData.cweName,
            capecIds: riskData.capecIds || [],
            attackIds: riskData.attackIds || [],
            status: 'pending',
            sources: riskData.sources
              ? {
                  create: riskData.sources.map((s) => ({
                    source: s.source,
                    sourceRuleId: s.sourceRuleId,
                    sourceTitle: s.sourceTitle,
                  })),
                }
              : undefined,
          },
        });
        imported++;
      } catch (err) {
        skipped++;
        errors.push({
          canonicalId: riskData.canonicalId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return { imported, skipped, errors };
  }

  async getSources(): Promise<string[]> {
    const result = await this.prisma.canonicalRiskSource.groupBy({
      by: ['source'],
      orderBy: { source: 'asc' },
    });
    return result.map((r: { source: string }) => r.source);
  }

  async getSeverities(): Promise<string[]> {
    return ['low', 'medium', 'high', 'critical'];
  }
}
