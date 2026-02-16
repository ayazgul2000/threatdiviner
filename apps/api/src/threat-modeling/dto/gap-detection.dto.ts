import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';

export enum GapElementType {
  ASSET = 'asset',
  LINK = 'link',
  BOUNDARY = 'boundary',
}

export class GapDto {
  @IsEnum(GapElementType)
  elementType!: GapElementType;

  @IsString()
  elementId!: string;

  @IsString()
  elementName!: string;

  @IsString()
  field!: string;

  @IsString()
  rule!: string;

  @IsString()
  message!: string;

  @IsOptional()
  currentValue?: any;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suggestions?: string[];
}

export class GapDetectionResultDto {
  valid!: boolean;
  gaps!: GapDto[];
  summary!: {
    totalGaps: number;
    assetGaps: number;
    linkGaps: number;
    boundaryGaps: number;
  };
}

export class ValidationRuleDto {
  field!: string;
  condition!: string;
  message!: string;
  suggestions?: string[];
}
