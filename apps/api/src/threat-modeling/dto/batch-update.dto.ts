import { IsString, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AssetUpdateDto {
  @IsString()
  id!: string;

  @IsObject()
  fields!: Record<string, any>;
}

export class LinkUpdateDto {
  @IsString()
  id!: string;

  @IsObject()
  fields!: Record<string, any>;
}

export class BoundaryUpdateDto {
  @IsString()
  id!: string;

  @IsObject()
  fields!: Record<string, any>;
}

export class BatchUpdateAssetsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssetUpdateDto)
  updates!: AssetUpdateDto[];
}

export class BatchUpdateLinksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkUpdateDto)
  updates!: LinkUpdateDto[];
}

export class BatchUpdateBoundariesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BoundaryUpdateDto)
  updates!: BoundaryUpdateDto[];
}

export class BatchUpdateResultDto {
  updated!: number;
  failed!: number;
  errors!: Array<{ id: string; error: string }>;
}
