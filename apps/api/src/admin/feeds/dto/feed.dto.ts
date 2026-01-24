import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

// Feed Config DTOs
export class CreateFeedConfigDto {
  @IsString()
  @MaxLength(50)
  feedId!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @MaxLength(2048)
  sourceUrl!: string;

  @IsString()
  @IsOptional()
  @Matches(/^(\*|[0-5]?\d)\s+(\*|[01]?\d|2[0-3])\s+(\*|[1-9]|[12]\d|3[01])\s+(\*|[1-9]|1[0-2])\s+(\*|[0-6])$/, {
    message: 'schedule must be a valid cron expression',
  })
  schedule?: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

export class UpdateFeedConfigDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  sourceUrl?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(\*|[0-5]?\d)\s+(\*|[01]?\d|2[0-3])\s+(\*|[1-9]|[12]\d|3[01])\s+(\*|[1-9]|1[0-2])\s+(\*|[0-6])$/, {
    message: 'schedule must be a valid cron expression',
  })
  schedule?: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

// Query DTOs
export class FeedConfigListQuery {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  @IsIn(['true', 'false'])
  isEnabled?: string;
}

export class FeedSyncRunListQuery {
  @IsString()
  @IsOptional()
  @IsIn(['pending', 'running', 'completed', 'failed'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

// Schedule preset type
export type SchedulePreset = 'daily' | 'weekly' | 'monthly' | 'manual';

// Helper functions for cron expressions
export const SCHEDULE_PRESETS: Record<SchedulePreset, string | null> = {
  daily: '0 3 * * *',      // Daily at 3:00 AM
  weekly: '0 3 * * 0',     // Weekly on Sunday at 3:00 AM
  monthly: '0 3 1 * *',    // Monthly on 1st at 3:00 AM
  manual: null,            // No schedule
};

export class SetScheduleDto {
  @IsString()
  @IsIn(['daily', 'weekly', 'monthly', 'manual', 'custom'])
  preset!: string;

  @IsString()
  @IsOptional()
  @Matches(/^(\*|[0-5]?\d)\s+(\*|[01]?\d|2[0-3])\s+(\*|[1-9]|[12]\d|3[01])\s+(\*|[1-9]|1[0-2])\s+(\*|[0-6])$/, {
    message: 'customCron must be a valid cron expression',
  })
  customCron?: string;
}

export class TestConnectionDto {
  @IsString()
  @MaxLength(2048)
  url!: string;
}
