import { IsString, IsOptional, IsBoolean, MaxLength, IsIn } from 'class-validator';

export class CreateShapeMappingDto {
  @IsString()
  @MaxLength(255)
  drawioStyle!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  stylePattern?: string;

  @IsString()
  @MaxLength(100)
  threagileType!: string;

  @IsString()
  @IsOptional()
  @IsIn(['physical', 'virtual', 'container', 'serverless'])
  machineType?: string;

  @IsBoolean()
  @IsOptional()
  defaultInternetFacing?: boolean;

  @IsString()
  @IsOptional()
  @IsIn(['none', 'transparent', 'data-with-symmetric-shared-key', 'data-with-asymmetric-shared-key', 'data-with-end-user-individual-key'])
  defaultEncryption?: string;

  @IsString()
  @IsOptional()
  @IsIn(['none', 'credentials', 'session-id', 'token', 'client-certificate', 'two-factor', 'externalized'])
  defaultAuthentication?: string;

  @IsBoolean()
  @IsOptional()
  defaultMultiTenant?: boolean;

  @IsString()
  @MaxLength(100)
  displayName!: string;

  @IsString()
  @IsIn(['aws', 'azure', 'gcp', 'generic', 'kubernetes', 'network'])
  category!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  iconUrl?: string;
}

export class UpdateShapeMappingDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  drawioStyle?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  stylePattern?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  threagileType?: string;

  @IsString()
  @IsOptional()
  @IsIn(['physical', 'virtual', 'container', 'serverless'])
  machineType?: string;

  @IsBoolean()
  @IsOptional()
  defaultInternetFacing?: boolean;

  @IsString()
  @IsOptional()
  @IsIn(['none', 'transparent', 'data-with-symmetric-shared-key', 'data-with-asymmetric-shared-key', 'data-with-end-user-individual-key'])
  defaultEncryption?: string;

  @IsString()
  @IsOptional()
  @IsIn(['none', 'credentials', 'session-id', 'token', 'client-certificate', 'two-factor', 'externalized'])
  defaultAuthentication?: string;

  @IsBoolean()
  @IsOptional()
  defaultMultiTenant?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  displayName?: string;

  @IsString()
  @IsOptional()
  @IsIn(['aws', 'azure', 'gcp', 'generic', 'kubernetes', 'network'])
  category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  iconUrl?: string;
}

export interface ImportShapeMappingDto {
  drawioStyle: string;
  stylePattern?: string;
  threagileType: string;
  machineType?: string;
  defaultInternetFacing?: boolean;
  defaultEncryption?: string;
  defaultAuthentication?: string;
  defaultMultiTenant?: boolean;
  displayName: string;
  category: string;
  iconUrl?: string;
}

export class BulkImportDto {
  mappings!: ImportShapeMappingDto[];
}

export interface ShapeMappingListQuery {
  search?: string;
  category?: string;
  status?: string;
  aiSuggested?: string;
  limit?: string;
  offset?: string;
}
