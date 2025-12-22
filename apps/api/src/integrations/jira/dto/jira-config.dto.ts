import { IsString, IsBoolean, IsOptional, IsArray, IsUrl } from 'class-validator';

export class UpdateJiraConfigDto {
  @IsOptional()
  @IsUrl()
  jiraUrl?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  apiToken?: string;

  @IsOptional()
  @IsString()
  projectKey?: string;

  @IsOptional()
  @IsString()
  issueType?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCreate?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  autoCreateSeverities?: string[];
}

export interface JiraConfigResponse {
  id: string;
  jiraUrl: string | null;
  email: string | null;
  projectKey: string | null;
  issueType: string;
  enabled: boolean;
  autoCreate: boolean;
  autoCreateSeverities: string[];
  // API token is never returned, only masked indicator
  hasApiToken: boolean;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
}
