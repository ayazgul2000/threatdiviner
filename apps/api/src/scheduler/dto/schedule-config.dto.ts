import { IsBoolean, IsOptional, IsString, Matches, IsIn } from 'class-validator';

export class UpdateScheduleDto {
  @IsOptional()
  @IsBoolean()
  scheduleEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/, {
    message: 'Invalid cron expression',
  })
  scheduleCron?: string;

  @IsOptional()
  @IsString()
  scheduleTimezone?: string;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly', 'custom'])
  preset?: 'daily' | 'weekly' | 'monthly' | 'custom';
}

export interface ScheduleConfigResponse {
  scheduleEnabled: boolean;
  scheduleCron: string | null;
  scheduleTimezone: string;
  lastScheduledScan: Date | null;
  nextScheduledScan: Date | null;
  preset: 'daily' | 'weekly' | 'monthly' | 'custom' | null;
}

// Preset cron expressions
export const SCHEDULE_PRESETS = {
  daily: '0 2 * * *',     // 2am daily
  weekly: '0 2 * * 1',    // 2am every Monday
  monthly: '0 2 1 * *',   // 2am first of month
};

export function getPresetFromCron(cron: string | null): 'daily' | 'weekly' | 'monthly' | 'custom' | null {
  if (!cron) return null;
  if (cron === SCHEDULE_PRESETS.daily) return 'daily';
  if (cron === SCHEDULE_PRESETS.weekly) return 'weekly';
  if (cron === SCHEDULE_PRESETS.monthly) return 'monthly';
  return 'custom';
}
