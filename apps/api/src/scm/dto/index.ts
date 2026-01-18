import { IsString, IsOptional, IsArray, IsBoolean, IsEnum } from 'class-validator';

export class InitiateOAuthDto {
  @IsEnum(['github', 'gitlab', 'bitbucket'])
  provider!: string;
}

export class OAuthCallbackDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  state?: string;

  // GitHub App installation callback parameters
  @IsOptional()
  @IsString()
  installation_id?: string;

  @IsOptional()
  @IsString()
  setup_action?: string;
}

export class ConnectWithPatDto {
  @IsEnum(['github', 'gitlab', 'bitbucket'])
  provider!: string;

  @IsString()
  token!: string;
}

export class AddRepositoryDto {
  @IsString()
  connectionId!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  externalId?: string;
}

export class UpdateScanConfigDto {
  // Individual enable toggles (legacy)
  @IsOptional()
  @IsBoolean()
  enableSast?: boolean;

  @IsOptional()
  @IsBoolean()
  enableSca?: boolean;

  @IsOptional()
  @IsBoolean()
  enableSecrets?: boolean;

  @IsOptional()
  @IsBoolean()
  enableIac?: boolean;

  @IsOptional()
  @IsBoolean()
  enableDast?: boolean;

  // Scanners array (new format from frontend)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scanners?: string[];

  // General enable toggle
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  // Scan triggers
  @IsOptional()
  @IsBoolean()
  scanOnPush?: boolean;

  @IsOptional()
  @IsBoolean()
  scanOnPr?: boolean;

  @IsOptional()
  @IsBoolean()
  scanOnSchedule?: boolean;

  @IsOptional()
  @IsString()
  schedulePattern?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branches?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skipPaths?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUrls?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  containerImages?: string[];

  // Write-back settings
  @IsOptional()
  @IsBoolean()
  checkRunEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  prCommentsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inlineAnnotations?: boolean;

  @IsOptional()
  @IsBoolean()
  sarifUploadEnabled?: boolean;

  @IsOptional()
  @IsString()
  blockPrOnSeverity?: string;
}

export class TriggerScanDto {
  @IsString()
  repositoryId!: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  pullRequestId?: string;
}
