import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShapeMappingDto, UpdateShapeMappingDto, ImportShapeMappingDto, ShapeMappingListQuery } from './dto/shape-mapping.dto';

export interface ShapeMappingResult {
  id: string;
  drawioStyle: string;
  stylePattern: string | null;
  threagileType: string;
  machineType: string;
  defaultInternetFacing: boolean;
  defaultEncryption: string;
  defaultAuthentication: string;
  defaultMultiTenant: boolean;
  displayName: string;
  category: string;
  iconUrl: string | null;
  status: string;
  aiSuggested: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ style: string; error: string }>;
}

@Injectable()
export class ShapeMappingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ShapeMappingListQuery): Promise<{ mappings: ShapeMappingResult[]; total: number }> {
    const { search, category, status, aiSuggested, limit = '50', offset = '0' } = query;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { drawioStyle: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { threagileType: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    if (aiSuggested !== undefined) {
      where.aiSuggested = aiSuggested === 'true';
    }

    const [mappings, total] = await Promise.all([
      this.prisma.shapeMapping.findMany({
        where,
        orderBy: [{ category: 'asc' }, { displayName: 'asc' }],
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      this.prisma.shapeMapping.count({ where }),
    ]);

    return { mappings, total };
  }

  async getById(id: string): Promise<ShapeMappingResult> {
    const mapping = await this.prisma.shapeMapping.findUnique({ where: { id } });
    if (!mapping) {
      throw new NotFoundException(`Shape mapping with id ${id} not found`);
    }
    return mapping;
  }

  async create(dto: CreateShapeMappingDto, createdBy: string): Promise<ShapeMappingResult> {
    // Check for duplicate drawioStyle
    const existing = await this.prisma.shapeMapping.findUnique({
      where: { drawioStyle: dto.drawioStyle },
    });

    if (existing) {
      throw new ConflictException(`Shape mapping with style "${dto.drawioStyle}" already exists`);
    }

    return this.prisma.shapeMapping.create({
      data: {
        drawioStyle: dto.drawioStyle,
        stylePattern: dto.stylePattern,
        threagileType: dto.threagileType,
        machineType: dto.machineType || 'virtual',
        defaultInternetFacing: dto.defaultInternetFacing || false,
        defaultEncryption: dto.defaultEncryption || 'none',
        defaultAuthentication: dto.defaultAuthentication || 'none',
        defaultMultiTenant: dto.defaultMultiTenant || false,
        displayName: dto.displayName,
        category: dto.category,
        iconUrl: dto.iconUrl,
        status: 'pending',
        aiSuggested: false,
        createdBy,
      },
    });
  }

  async update(id: string, dto: UpdateShapeMappingDto): Promise<ShapeMappingResult> {
    const existing = await this.prisma.shapeMapping.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Shape mapping with id ${id} not found`);
    }

    // Check for duplicate drawioStyle if changing it
    if (dto.drawioStyle && dto.drawioStyle !== existing.drawioStyle) {
      const duplicate = await this.prisma.shapeMapping.findUnique({
        where: { drawioStyle: dto.drawioStyle },
      });
      if (duplicate) {
        throw new ConflictException(`Shape mapping with style "${dto.drawioStyle}" already exists`);
      }
    }

    // When updating, reset status to pending
    return this.prisma.shapeMapping.update({
      where: { id },
      data: {
        ...dto,
        status: 'pending',
      },
    });
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.shapeMapping.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Shape mapping with id ${id} not found`);
    }

    await this.prisma.shapeMapping.delete({ where: { id } });
    return { success: true };
  }

  async submitForReview(id: string): Promise<ShapeMappingResult> {
    const existing = await this.prisma.shapeMapping.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Shape mapping with id ${id} not found`);
    }

    if (existing.status !== 'pending') {
      throw new ConflictException(`Only pending mappings can be submitted for review`);
    }

    return this.prisma.shapeMapping.update({
      where: { id },
      data: { status: 'review' },
    });
  }

  async approve(id: string, isSuperAdmin: boolean): Promise<ShapeMappingResult> {
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only SuperAdmin can approve mappings');
    }

    const existing = await this.prisma.shapeMapping.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Shape mapping with id ${id} not found`);
    }

    if (existing.status !== 'review') {
      throw new ConflictException(`Only mappings in review status can be approved`);
    }

    return this.prisma.shapeMapping.update({
      where: { id },
      data: { status: 'live' },
    });
  }

  async bulkImport(mappings: ImportShapeMappingDto[], createdBy: string): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;
    const errors: Array<{ style: string; error: string }> = [];

    for (const mapping of mappings) {
      try {
        // Check for duplicate
        const existing = await this.prisma.shapeMapping.findUnique({
          where: { drawioStyle: mapping.drawioStyle },
        });

        if (existing) {
          skipped++;
          errors.push({ style: mapping.drawioStyle, error: 'Duplicate style' });
          continue;
        }

        await this.prisma.shapeMapping.create({
          data: {
            drawioStyle: mapping.drawioStyle,
            stylePattern: mapping.stylePattern,
            threagileType: mapping.threagileType,
            machineType: mapping.machineType || 'virtual',
            defaultInternetFacing: mapping.defaultInternetFacing || false,
            defaultEncryption: mapping.defaultEncryption || 'none',
            defaultAuthentication: mapping.defaultAuthentication || 'none',
            defaultMultiTenant: mapping.defaultMultiTenant || false,
            displayName: mapping.displayName,
            category: mapping.category,
            iconUrl: mapping.iconUrl,
            status: 'pending',
            aiSuggested: false,
            createdBy,
          },
        });
        imported++;
      } catch (err) {
        skipped++;
        errors.push({
          style: mapping.drawioStyle,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return { imported, skipped, errors };
  }

  async getCategories(): Promise<string[]> {
    const result = await this.prisma.shapeMapping.groupBy({
      by: ['category'],
      orderBy: { category: 'asc' },
    });
    return result.map((r: { category: string }) => r.category);
  }
}
