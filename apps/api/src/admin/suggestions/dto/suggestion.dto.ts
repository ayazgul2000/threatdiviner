import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsArray,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// Suggestion Types
export type SuggestionType = 'shape_mapping' | 'canonical_risk' | 'risk_mapping' | 'playbook' | 'control_mapping';
export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'edited';

// AI Suggestion DTOs
export class SuggestionListQuery {
  @IsString()
  @IsOptional()
  @IsIn(['shape_mapping', 'canonical_risk', 'risk_mapping', 'playbook', 'control_mapping'])
  type?: SuggestionType;

  @IsString()
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'edited'])
  status?: SuggestionStatus;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  minConfidence?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  maxConfidence?: number;

  @IsString()
  @IsOptional()
  source?: string;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  offset?: number;
}

export class ApproveSuggestionDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

export class RejectSuggestionDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;
}

export class EditSuggestionDto {
  @IsOptional()
  suggestedData?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  editNotes?: string;
}

export class BulkActionDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsString()
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}

// Promotion DTOs
export type ConfigType = 'shape_mapping' | 'canonical_risk' | 'compliance_framework' | 'playbook' | 'wizard_question';
export type PromotionStatus = 'pending' | 'review' | 'approved' | 'live' | 'archived';

export class PromotionListQuery {
  @IsString()
  @IsOptional()
  @IsIn(['pending', 'review', 'approved', 'live', 'archived'])
  status?: PromotionStatus;

  @IsString()
  @IsOptional()
  @IsIn(['shape_mapping', 'canonical_risk', 'compliance_framework', 'playbook', 'wizard_question'])
  configType?: ConfigType;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export class SubmitForReviewDto {
  @IsString()
  configId!: string;

  @IsString()
  @IsIn(['shape_mapping', 'canonical_risk', 'compliance_framework', 'playbook', 'wizard_question'])
  configType!: ConfigType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class ReviewDecisionDto {
  @IsString()
  @IsIn(['approve', 'request_changes', 'reject'])
  decision!: 'approve' | 'request_changes' | 'reject';

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  feedback?: string;
}

export class PromoteDto {
  @IsArray()
  @IsString({ each: true })
  itemIds!: string[];

  @IsBoolean()
  testedInSandbox!: boolean;

  @IsBoolean()
  understandsImpact!: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

export class RollbackDto {
  @IsString()
  promotionId!: string;

  @IsString()
  @MaxLength(1000)
  reason!: string;
}

// Sandbox Testing DTOs
export class TestShapeMappingDto {
  @IsString()
  diagramXml!: string;
}

export class TestDeduplicationDto {
  @IsArray()
  @IsString({ each: true })
  riskIds!: string[];
}

export class TestPlaybookDto {
  @IsString()
  playbookId!: string;

  @IsString()
  @IsOptional()
  assetName?: string;

  @IsString()
  @IsOptional()
  technology?: string;
}

// Audit Log DTOs
export class AuditLogQuery {
  @IsString()
  @IsOptional()
  @IsIn(['shape_mapping', 'canonical_risk', 'compliance_framework', 'playbook', 'wizard_question', 'promotion', 'suggestion'])
  entityType?: string;

  @IsString()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  action?: string;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
