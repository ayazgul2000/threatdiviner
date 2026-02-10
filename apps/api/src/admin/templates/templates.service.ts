import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto, TemplateListQuery } from './dto/template.dto';

export interface TemplateResult {
  id: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  previewImageUrl: string | null;
  diagramXml: string;
  components: unknown[];
  dataFlows: unknown[];
  boundaries: unknown[];
  isPublic: boolean;
  tenantId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: TemplateListQuery): Promise<{ templates: TemplateResult[]; total: number }> {
    const { search, category, isPublic, tenantId, limit = '50', offset = '0' } = query;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (isPublic !== undefined) {
      where.isPublic = isPublic === 'true';
    }

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const [templates, total] = await Promise.all([
      this.prisma.threatModelTemplate.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      this.prisma.threatModelTemplate.count({ where }),
    ]);

    return { templates: templates as TemplateResult[], total };
  }

  async getById(id: string): Promise<TemplateResult> {
    const template = await this.prisma.threatModelTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template with id ${id} not found`);
    }
    return template as TemplateResult;
  }

  async create(dto: CreateTemplateDto, createdBy: string): Promise<TemplateResult> {
    // Check for duplicate name
    const existing = await this.prisma.threatModelTemplate.findFirst({
      where: { name: dto.name, isPublic: dto.isPublic !== false },
    });

    if (existing) {
      throw new ConflictException(`Template with name "${dto.name}" already exists`);
    }

    const template = await this.prisma.threatModelTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        tags: dto.tags || [],
        previewImageUrl: dto.previewImageUrl,
        diagramXml: dto.diagramXml,
        components: dto.components as unknown as object,
        dataFlows: dto.dataFlows as unknown as object || [],
        boundaries: dto.boundaries as unknown as object || [],
        isPublic: dto.isPublic !== false,
        tenantId: dto.tenantId,
        createdBy,
      },
    });

    return template as TemplateResult;
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<TemplateResult> {
    const existing = await this.prisma.threatModelTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Template with id ${id} not found`);
    }

    // Check for duplicate name if changing it
    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.threatModelTemplate.findFirst({
        where: {
          name: dto.name,
          isPublic: dto.isPublic ?? existing.isPublic,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new ConflictException(`Template with name "${dto.name}" already exists`);
      }
    }

    const template = await this.prisma.threatModelTemplate.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category && { category: dto.category }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.previewImageUrl !== undefined && { previewImageUrl: dto.previewImageUrl }),
        ...(dto.diagramXml && { diagramXml: dto.diagramXml }),
        ...(dto.components && { components: dto.components as unknown as object }),
        ...(dto.dataFlows && { dataFlows: dto.dataFlows as unknown as object }),
        ...(dto.boundaries && { boundaries: dto.boundaries as unknown as object }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      },
    });

    return template as TemplateResult;
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.threatModelTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Template with id ${id} not found`);
    }

    await this.prisma.threatModelTemplate.delete({ where: { id } });
    return { success: true };
  }

  async getCategories(): Promise<string[]> {
    const result = await this.prisma.threatModelTemplate.groupBy({
      by: ['category'],
      orderBy: { category: 'asc' },
    });
    return result.map((r: { category: string }) => r.category);
  }

  async duplicate(id: string, createdBy: string, newName?: string): Promise<TemplateResult> {
    const existing = await this.prisma.threatModelTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Template with id ${id} not found`);
    }

    const name = newName || `${existing.name} (Copy)`;

    const template = await this.prisma.threatModelTemplate.create({
      data: {
        name,
        description: existing.description,
        category: existing.category,
        tags: existing.tags,
        previewImageUrl: existing.previewImageUrl,
        diagramXml: existing.diagramXml,
        components: existing.components as object,
        dataFlows: existing.dataFlows as object,
        boundaries: existing.boundaries as object,
        isPublic: existing.isPublic,
        tenantId: existing.tenantId,
        createdBy,
      },
    });

    return template as TemplateResult;
  }
}
