import { IsString, IsOptional, IsArray, MaxLength, IsIn } from 'class-validator';

export class CreateCanonicalRiskDto {
  @IsString()
  @MaxLength(100)
  canonicalId!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  defaultSeverity?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  cweId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  cweName?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  capecIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attackIds?: string[];
}

export class UpdateCanonicalRiskDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  canonicalId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  defaultSeverity?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  cweId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  cweName?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  capecIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attackIds?: string[];
}

export class AddSourceMappingDto {
  @IsString()
  @IsIn(['threagile', 'cis', 'prowler', 'trivy', 'semgrep'])
  source!: string;

  @IsString()
  @MaxLength(255)
  sourceRuleId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  sourceTitle?: string;
}

export interface ImportCanonicalRiskDto {
  canonicalId: string;
  title: string;
  description?: string;
  defaultSeverity?: string;
  cweId?: string;
  cweName?: string;
  capecIds?: string[];
  attackIds?: string[];
  sources?: Array<{
    source: string;
    sourceRuleId: string;
    sourceTitle?: string;
  }>;
}

export class BulkImportDto {
  risks!: ImportCanonicalRiskDto[];
}

export interface CanonicalRiskListQuery {
  search?: string;
  source?: string;
  severity?: string;
  status?: string;
  limit?: string;
  offset?: string;
}
