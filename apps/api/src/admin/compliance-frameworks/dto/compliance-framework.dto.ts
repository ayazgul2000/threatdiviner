import { IsString, IsOptional, IsBoolean, IsInt, IsNumber, MaxLength, IsIn, Min, Max } from 'class-validator';

export class CreateComplianceFrameworkDto {
  @IsString()
  @MaxLength(100)
  id!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(50)
  version!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  sourceUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateComplianceFrameworkDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  version?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  sourceUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateComplianceControlDto {
  @IsString()
  @MaxLength(50)
  controlId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  parentId?: string;

  @IsString()
  @MaxLength(100)
  category!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  guidance?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  level?: number;
}

export class UpdateComplianceControlDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  controlId?: string;

  @IsString()
  @IsOptional()
  parentId?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  guidance?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  level?: number;
}

export class AddRiskMappingDto {
  @IsString()
  canonicalRiskId!: string;

  @IsString()
  @IsIn(['primary', 'secondary', 'related'])
  @IsOptional()
  relevance?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  aiConfidence?: number;
}

export interface ImportControlDto {
  controlId: string;
  parentControlId?: string;
  category: string;
  name: string;
  description?: string;
  guidance?: string;
  level?: number;
}

export interface ImportFrameworkDto {
  id: string;
  name: string;
  version: string;
  description?: string;
  sourceUrl?: string;
  controls?: ImportControlDto[];
}

export interface ComplianceFrameworkListQuery {
  search?: string;
  isActive?: string;
  limit?: string;
  offset?: string;
}

export interface ComplianceControlListQuery {
  search?: string;
  category?: string;
  level?: string;
  parentId?: string;
  limit?: string;
  offset?: string;
}
