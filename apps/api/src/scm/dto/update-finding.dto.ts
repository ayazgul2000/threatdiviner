import { IsString, IsOptional, IsIn, MaxLength, IsUUID, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFindingDto {
  @ApiPropertyOptional({
    description: 'Finding status',
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'FALSE_POSITIVE'],
  })
  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'FALSE_POSITIVE'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Reason for dismissal',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Dismiss reason must not exceed 1000 characters' })
  dismissReason?: string;

  @ApiPropertyOptional({
    description: 'Notes about the finding',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Notes must not exceed 5000 characters' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Assigned user ID',
  })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional({
    description: 'Tags for the finding',
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class BulkUpdateFindingsDto {
  @ApiPropertyOptional({
    description: 'Finding IDs to update',
    isArray: true,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  findingIds!: string[];

  @ApiPropertyOptional({
    description: 'New status for all findings',
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'FALSE_POSITIVE'],
  })
  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'FALSE_POSITIVE'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Reason for status change',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
