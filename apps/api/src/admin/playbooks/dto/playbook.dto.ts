import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsIn,
  MaxLength,
  Min,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

// Playbook DTOs
export class CreatePlaybookDto {
  @IsString()
  canonicalRiskId!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  totalEffort?: string;
}

export class UpdatePlaybookDto {
  @IsString()
  @IsOptional()
  canonicalRiskId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  totalEffort?: string;
}

// Step DTOs
export class CreateStepDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(4000)
  description!: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  effort?: string;

  @IsString()
  @IsOptional()
  @IsIn(['developer', 'devops', 'security', 'architect'])
  role?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  estimatedMinutes?: number;

  @IsBoolean()
  @IsOptional()
  automatable?: boolean;
}

export class UpdateStepDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  effort?: string;

  @IsString()
  @IsOptional()
  @IsIn(['developer', 'devops', 'security', 'architect'])
  role?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  estimatedMinutes?: number;

  @IsBoolean()
  @IsOptional()
  automatable?: boolean;
}

export class ReorderStepsDto {
  @IsArray()
  @IsString({ each: true })
  stepIds!: string[];
}

// IaC Snippet DTOs
export class CreateIacSnippetDto {
  @IsString()
  @IsIn(['terraform', 'cloudformation', 'kubernetes', 'pulumi'])
  platform!: string;

  @IsString()
  @MaxLength(50000)
  code!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

export class UpdateIacSnippetDto {
  @IsString()
  @IsOptional()
  @MaxLength(50000)
  code?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

// Query DTOs
export class PlaybookListQuery {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  effort?: string;

  @IsString()
  @IsOptional()
  @IsIn(['true', 'false'])
  hasIac?: string;

  @IsString()
  @IsOptional()
  @IsIn(['pending', 'review', 'live'])
  status?: string;

  @IsString()
  @IsOptional()
  canonicalRiskId?: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number;
}

// Bulk Import DTOs
export class ImportStepDto {
  @IsInt()
  @Min(1)
  stepNumber!: number;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(4000)
  description!: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  effort?: string;

  @IsString()
  @IsOptional()
  @IsIn(['developer', 'devops', 'security', 'architect'])
  role?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  estimatedMinutes?: number;

  @IsBoolean()
  @IsOptional()
  automatable?: boolean;
}

export class ImportIacSnippetDto {
  @IsString()
  @IsIn(['terraform', 'cloudformation', 'kubernetes', 'pulumi'])
  platform!: string;

  @IsString()
  @MaxLength(50000)
  code!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

export class ImportPlaybookDto {
  @IsString()
  canonicalRiskId!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  totalEffort?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportStepDto)
  @IsOptional()
  steps?: ImportStepDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportIacSnippetDto)
  @IsOptional()
  iacSnippets?: ImportIacSnippetDto[];
}

export class BulkImportPlaybooksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportPlaybookDto)
  playbooks!: ImportPlaybookDto[];
}
