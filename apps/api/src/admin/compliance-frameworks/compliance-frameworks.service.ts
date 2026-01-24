import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateComplianceFrameworkDto,
  UpdateComplianceFrameworkDto,
  CreateComplianceControlDto,
  UpdateComplianceControlDto,
  AddRiskMappingDto,
  ImportFrameworkDto,
  ComplianceFrameworkListQuery,
  ComplianceControlListQuery,
} from './dto/compliance-framework.dto';

export interface FrameworkResult {
  id: string;
  name: string;
  version: string;
  description: string;
  sourceUrl: string;
  lastUpdated: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { controls: number };
}

export interface ControlResult {
  id: string;
  frameworkId: string;
  controlId: string;
  parentId: string | null;
  category: string;
  name: string;
  description: string;
  guidance: string | null;
  level: number;
  createdAt: Date;
  updatedAt: Date;
  children?: ControlResult[];
  riskMappings?: RiskMappingResult[];
  _count?: { children: number; riskMappings: number };
}

export interface RiskMappingResult {
  id: string;
  canonicalRiskId: string;
  complianceControlId: string;
  relevance: string;
  aiConfidence: number | null;
  createdAt: Date;
  canonicalRisk?: {
    id: string;
    canonicalId: string;
    title: string;
    status: string;
  };
}

export interface ImportResult {
  frameworksImported: number;
  controlsImported: number;
  errors: Array<{ item: string; error: string }>;
}

@Injectable()
export class ComplianceFrameworksService {
  constructor(private readonly prisma: PrismaService) {}

  // Framework CRUD
  async listFrameworks(query: ComplianceFrameworkListQuery): Promise<{ frameworks: FrameworkResult[]; total: number }> {
    const { search, isActive, limit = '50', offset = '0' } = query;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [frameworks, total] = await Promise.all([
      this.prisma.complianceFramework.findMany({
        where,
        include: {
          _count: { select: { controls: true } },
        },
        orderBy: [{ name: 'asc' }],
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      this.prisma.complianceFramework.count({ where }),
    ]);

    return { frameworks, total };
  }

  async getFrameworkById(id: string): Promise<FrameworkResult & { controls: ControlResult[] }> {
    const framework = await this.prisma.complianceFramework.findUnique({
      where: { id },
      include: {
        controls: {
          where: { parentId: null },
          include: {
            children: {
              include: {
                children: true,
                _count: { select: { children: true, riskMappings: true } },
              },
            },
            _count: { select: { children: true, riskMappings: true } },
          },
          orderBy: { controlId: 'asc' },
        },
        _count: { select: { controls: true } },
      },
    });

    if (!framework) {
      throw new NotFoundException(`Framework with id ${id} not found`);
    }

    return framework;
  }

  async createFramework(dto: CreateComplianceFrameworkDto): Promise<FrameworkResult> {
    const existing = await this.prisma.complianceFramework.findUnique({
      where: { id: dto.id },
    });

    if (existing) {
      throw new ConflictException(`Framework with id "${dto.id}" already exists`);
    }

    const framework = await this.prisma.complianceFramework.create({
      data: {
        id: dto.id,
        name: dto.name,
        version: dto.version,
        description: dto.description || '',
        sourceUrl: dto.sourceUrl || '',
        lastUpdated: new Date(),
        isActive: dto.isActive ?? true,
      },
      include: {
        _count: { select: { controls: true } },
      },
    });

    return framework;
  }

  async updateFramework(id: string, dto: UpdateComplianceFrameworkDto): Promise<FrameworkResult> {
    const existing = await this.prisma.complianceFramework.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Framework with id ${id} not found`);
    }

    const framework = await this.prisma.complianceFramework.update({
      where: { id },
      data: {
        ...dto,
        lastUpdated: new Date(),
      },
      include: {
        _count: { select: { controls: true } },
      },
    });

    return framework;
  }

  async deleteFramework(id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.complianceFramework.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Framework with id ${id} not found`);
    }

    await this.prisma.complianceFramework.delete({ where: { id } });
    return { success: true };
  }

  // Control CRUD
  async listControls(frameworkId: string, query: ComplianceControlListQuery): Promise<{ controls: ControlResult[]; total: number }> {
    const { search, category, level, parentId, limit = '100', offset = '0' } = query;

    const framework = await this.prisma.complianceFramework.findUnique({ where: { id: frameworkId } });
    if (!framework) {
      throw new NotFoundException(`Framework with id ${frameworkId} not found`);
    }

    const where: Record<string, unknown> = { frameworkId };

    if (search) {
      where.OR = [
        { controlId: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (level) {
      where.level = parseInt(level);
    }

    if (parentId !== undefined) {
      where.parentId = parentId === '' ? null : parentId;
    }

    const [controls, total] = await Promise.all([
      this.prisma.complianceControl.findMany({
        where,
        include: {
          _count: { select: { children: true, riskMappings: true } },
        },
        orderBy: [{ controlId: 'asc' }],
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      this.prisma.complianceControl.count({ where }),
    ]);

    return { controls, total };
  }

  async getControlById(frameworkId: string, controlId: string): Promise<ControlResult> {
    const control = await this.prisma.complianceControl.findFirst({
      where: { frameworkId, id: controlId },
      include: {
        children: {
          include: {
            _count: { select: { children: true, riskMappings: true } },
          },
          orderBy: { controlId: 'asc' },
        },
        riskMappings: {
          include: {
            canonicalRisk: {
              select: { id: true, canonicalId: true, title: true, status: true },
            },
          },
        },
        _count: { select: { children: true, riskMappings: true } },
      },
    });

    if (!control) {
      throw new NotFoundException(`Control not found`);
    }

    return control;
  }

  async createControl(frameworkId: string, dto: CreateComplianceControlDto): Promise<ControlResult> {
    const framework = await this.prisma.complianceFramework.findUnique({ where: { id: frameworkId } });
    if (!framework) {
      throw new NotFoundException(`Framework with id ${frameworkId} not found`);
    }

    // Check for duplicate controlId in framework
    const existing = await this.prisma.complianceControl.findFirst({
      where: { frameworkId, controlId: dto.controlId },
    });

    if (existing) {
      throw new ConflictException(`Control "${dto.controlId}" already exists in this framework`);
    }

    // Validate parent if provided
    if (dto.parentId) {
      const parent = await this.prisma.complianceControl.findFirst({
        where: { frameworkId, id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent control not found`);
      }
    }

    const control = await this.prisma.complianceControl.create({
      data: {
        frameworkId,
        controlId: dto.controlId,
        parentId: dto.parentId || null,
        category: dto.category,
        name: dto.name,
        description: dto.description || '',
        guidance: dto.guidance,
        level: dto.level || 1,
      },
      include: {
        _count: { select: { children: true, riskMappings: true } },
      },
    });

    return control;
  }

  async updateControl(frameworkId: string, controlId: string, dto: UpdateComplianceControlDto): Promise<ControlResult> {
    const control = await this.prisma.complianceControl.findFirst({
      where: { frameworkId, id: controlId },
    });

    if (!control) {
      throw new NotFoundException(`Control not found`);
    }

    // Check for duplicate controlId if changing it
    if (dto.controlId && dto.controlId !== control.controlId) {
      const duplicate = await this.prisma.complianceControl.findFirst({
        where: { frameworkId, controlId: dto.controlId },
      });
      if (duplicate) {
        throw new ConflictException(`Control "${dto.controlId}" already exists in this framework`);
      }
    }

    // Validate new parent if provided
    if (dto.parentId !== undefined && dto.parentId !== null) {
      // Prevent self-referencing
      if (dto.parentId === controlId) {
        throw new ConflictException(`Control cannot be its own parent`);
      }
      const parent = await this.prisma.complianceControl.findFirst({
        where: { frameworkId, id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent control not found`);
      }
    }

    const updated = await this.prisma.complianceControl.update({
      where: { id: controlId },
      data: dto,
      include: {
        _count: { select: { children: true, riskMappings: true } },
      },
    });

    return updated;
  }

  async deleteControl(frameworkId: string, controlId: string): Promise<{ success: boolean }> {
    const control = await this.prisma.complianceControl.findFirst({
      where: { frameworkId, id: controlId },
    });

    if (!control) {
      throw new NotFoundException(`Control not found`);
    }

    await this.prisma.complianceControl.delete({ where: { id: controlId } });
    return { success: true };
  }

  // Risk-Control Mapping
  async addRiskMapping(controlId: string, dto: AddRiskMappingDto): Promise<RiskMappingResult> {
    const control = await this.prisma.complianceControl.findUnique({ where: { id: controlId } });
    if (!control) {
      throw new NotFoundException(`Control not found`);
    }

    const risk = await this.prisma.canonicalRisk.findUnique({ where: { id: dto.canonicalRiskId } });
    if (!risk) {
      throw new NotFoundException(`Canonical risk not found`);
    }

    // Check for existing mapping
    const existing = await this.prisma.riskControlMapping.findFirst({
      where: { canonicalRiskId: dto.canonicalRiskId, complianceControlId: controlId },
    });

    if (existing) {
      throw new ConflictException(`Risk mapping already exists`);
    }

    const mapping = await this.prisma.riskControlMapping.create({
      data: {
        canonicalRiskId: dto.canonicalRiskId,
        complianceControlId: controlId,
        relevance: dto.relevance || 'primary',
        aiConfidence: dto.aiConfidence,
      },
      include: {
        canonicalRisk: {
          select: { id: true, canonicalId: true, title: true, status: true },
        },
      },
    });

    return mapping;
  }

  async removeRiskMapping(controlId: string, mappingId: string): Promise<{ success: boolean }> {
    const mapping = await this.prisma.riskControlMapping.findFirst({
      where: { id: mappingId, complianceControlId: controlId },
    });

    if (!mapping) {
      throw new NotFoundException(`Risk mapping not found`);
    }

    await this.prisma.riskControlMapping.delete({ where: { id: mappingId } });
    return { success: true };
  }

  async getRiskMappings(controlId: string): Promise<RiskMappingResult[]> {
    const control = await this.prisma.complianceControl.findUnique({ where: { id: controlId } });
    if (!control) {
      throw new NotFoundException(`Control not found`);
    }

    return this.prisma.riskControlMapping.findMany({
      where: { complianceControlId: controlId },
      include: {
        canonicalRisk: {
          select: { id: true, canonicalId: true, title: true, status: true },
        },
      },
    });
  }

  // Bulk Import
  async bulkImport(data: ImportFrameworkDto): Promise<ImportResult> {
    let frameworksImported = 0;
    let controlsImported = 0;
    const errors: Array<{ item: string; error: string }> = [];

    try {
      // Check if framework exists
      const existing = await this.prisma.complianceFramework.findUnique({
        where: { id: data.id },
      });

      if (existing) {
        errors.push({ item: data.id, error: 'Framework already exists' });
        return { frameworksImported, controlsImported, errors };
      }

      // Create framework with controls in transaction
      await this.prisma.$transaction(async (tx) => {
        await tx.complianceFramework.create({
          data: {
            id: data.id,
            name: data.name,
            version: data.version,
            description: data.description || '',
            sourceUrl: data.sourceUrl || '',
            lastUpdated: new Date(),
            isActive: true,
          },
        });
        frameworksImported = 1;

        if (data.controls && data.controls.length > 0) {
          // First pass: Create all controls
          for (const control of data.controls) {
            try {
              await tx.complianceControl.create({
                data: {
                  frameworkId: data.id,
                  controlId: control.controlId,
                  parentId: null, // Set parent in second pass
                  category: control.category,
                  name: control.name,
                  description: control.description || '',
                  guidance: control.guidance,
                  level: control.level || 1,
                },
              });
              controlsImported++;
            } catch (err) {
              errors.push({
                item: control.controlId,
                error: err instanceof Error ? err.message : 'Unknown error',
              });
            }
          }

          // Second pass: Set parent relationships
          for (const control of data.controls) {
            if (control.parentControlId) {
              const childControl = await tx.complianceControl.findFirst({
                where: { frameworkId: data.id, controlId: control.controlId },
              });
              const parentControl = await tx.complianceControl.findFirst({
                where: { frameworkId: data.id, controlId: control.parentControlId },
              });

              if (childControl && parentControl) {
                await tx.complianceControl.update({
                  where: { id: childControl.id },
                  data: { parentId: parentControl.id },
                });
              }
            }
          }
        }
      });
    } catch (err) {
      errors.push({
        item: data.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      frameworksImported = 0;
      controlsImported = 0;
    }

    return { frameworksImported, controlsImported, errors };
  }

  // Helpers
  async getCategories(frameworkId: string): Promise<string[]> {
    const framework = await this.prisma.complianceFramework.findUnique({ where: { id: frameworkId } });
    if (!framework) {
      throw new NotFoundException(`Framework with id ${frameworkId} not found`);
    }

    const result = await this.prisma.complianceControl.groupBy({
      by: ['category'],
      where: { frameworkId },
      orderBy: { category: 'asc' },
    });
    return result.map((r: { category: string }) => r.category);
  }

  async getControlTree(frameworkId: string): Promise<ControlResult[]> {
    const framework = await this.prisma.complianceFramework.findUnique({ where: { id: frameworkId } });
    if (!framework) {
      throw new NotFoundException(`Framework with id ${frameworkId} not found`);
    }

    // Get root controls (no parent)
    const rootControls = await this.prisma.complianceControl.findMany({
      where: { frameworkId, parentId: null },
      include: {
        children: {
          include: {
            children: {
              include: {
                children: true,
                _count: { select: { children: true, riskMappings: true } },
              },
            },
            _count: { select: { children: true, riskMappings: true } },
          },
        },
        _count: { select: { children: true, riskMappings: true } },
      },
      orderBy: { controlId: 'asc' },
    });

    return rootControls;
  }

  async getMappingsCount(frameworkId: string): Promise<number> {
    return this.prisma.riskControlMapping.count({
      where: {
        control: { frameworkId },
      },
    });
  }
}
