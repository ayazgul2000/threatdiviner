import {
  IsString,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  IsBoolean,
  IsIn,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// Question DTOs
// ============================================

export class CreateQuestionDto {
  @IsString()
  @MaxLength(100)
  questionId!: string;

  @IsString()
  @MaxLength(1000)
  text!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  helpText?: string;

  @IsString()
  @IsIn(['single-select', 'multi-select', 'text', 'toggle'])
  type!: string;

  @IsInt()
  @Min(0)
  orderIndex!: number;

  @IsBoolean()
  @IsOptional()
  isEntryPoint?: boolean;

  @IsBoolean()
  @IsOptional()
  isTerminal?: boolean;

  @IsArray()
  @IsOptional()
  conditions?: ConditionDto[];
}

export class UpdateQuestionDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  questionId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  text?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  helpText?: string;

  @IsString()
  @IsOptional()
  @IsIn(['single-select', 'multi-select', 'text', 'toggle'])
  type?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  orderIndex?: number;

  @IsBoolean()
  @IsOptional()
  isEntryPoint?: boolean;

  @IsBoolean()
  @IsOptional()
  isTerminal?: boolean;

  @IsArray()
  @IsOptional()
  conditions?: ConditionDto[];

  @IsString()
  @IsOptional()
  @IsIn(['pending', 'review', 'live'])
  status?: string;
}

export class ConditionDto {
  @IsString()
  property!: string;

  @IsString()
  @IsIn(['equals', 'not_equals', 'in', 'not_in', 'contains'])
  operator!: string;

  @IsString()
  value!: string;
}

// ============================================
// Option DTOs
// ============================================

export class CreateOptionDto {
  @IsString()
  @MaxLength(100)
  value!: string;

  @IsString()
  @MaxLength(255)
  label!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  iconUrl?: string;

  @IsString()
  @IsOptional()
  nextQuestionId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TriggerDto)
  triggers?: TriggerDto;
}

export class UpdateOptionDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  value?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  label?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  iconUrl?: string;

  @IsString()
  @IsOptional()
  nextQuestionId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TriggerDto)
  triggers?: TriggerDto;
}

export class TriggerDto {
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TriggerNodeDto)
  addNodes?: TriggerNodeDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TriggerBoundaryDto)
  addBoundaries?: TriggerBoundaryDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TriggerLinkDto)
  addLinks?: TriggerLinkDto[];

  @IsOptional()
  setProperties?: Record<string, string>;
}

export class TriggerNodeDto {
  @IsString()
  name!: string;

  @IsString()
  ref!: string;

  @IsString()
  @IsOptional()
  technology?: string;

  @IsString()
  @IsOptional()
  machineType?: string;

  @IsString()
  @IsOptional()
  placementBoundary?: string;

  @IsBoolean()
  @IsOptional()
  internetFacing?: boolean;

  @IsBoolean()
  @IsOptional()
  multiTenant?: boolean;

  @IsString()
  @IsOptional()
  encryption?: string;

  @IsString()
  @IsOptional()
  authentication?: string;
}

export class TriggerBoundaryDto {
  @IsString()
  name!: string;

  @IsString()
  ref!: string;

  @IsString()
  type!: string;
}

export class TriggerLinkDto {
  @IsString()
  sourceRef!: string;

  @IsString()
  targetRef!: string;

  @IsString()
  @IsOptional()
  protocol?: string;

  @IsString()
  @IsOptional()
  authentication?: string;

  @IsString()
  @IsOptional()
  encryption?: string;
}

// ============================================
// Bulk Import DTO
// ============================================

export class BulkImportQuestionDto {
  @IsString()
  @MaxLength(100)
  questionId!: string;

  @IsString()
  @MaxLength(1000)
  text!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  helpText?: string;

  @IsString()
  @IsIn(['single-select', 'multi-select', 'text', 'toggle'])
  type!: string;

  @IsInt()
  @Min(0)
  orderIndex!: number;

  @IsBoolean()
  @IsOptional()
  isEntryPoint?: boolean;

  @IsBoolean()
  @IsOptional()
  isTerminal?: boolean;

  @IsArray()
  @IsOptional()
  conditions?: ConditionDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  options?: CreateOptionDto[];
}

export class BulkImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportQuestionDto)
  questions!: BulkImportQuestionDto[];
}

// ============================================
// Reorder DTO
// ============================================

export class ReorderQuestionsDto {
  @IsArray()
  @IsString({ each: true })
  questionIds!: string[];
}

// ============================================
// Test Flow DTOs
// ============================================

export class TestFlowAnswerDto {
  @IsString()
  questionId!: string;

  @IsString()
  selectedValue!: string;
}

export class TestFlowDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestFlowAnswerDto)
  answers!: TestFlowAnswerDto[];
}
