import { IsString, IsOptional, IsArray, IsBoolean, IsEnum } from 'class-validator';

export class InitiateOAuthDto {
  @IsEnum(['github', 'gitlab', 'bitbucket'])
  provider!: string;
}

export class OAuthCallbackDto {
  @IsString()
  code!: string;

  @IsString()
  state!: string;
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branches?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skipPaths?: string[];
}

export class TriggerScanDto {
  @IsString()
  repositoryId!: string;

  @IsOptional()
  @IsString()
  branch?: string;
}
