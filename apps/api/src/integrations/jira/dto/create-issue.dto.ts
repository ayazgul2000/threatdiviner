import { IsString, IsOptional } from 'class-validator';

export class CreateJiraIssueDto {
  @IsString()
  findingId!: string;

  @IsOptional()
  @IsString()
  projectKey?: string;

  @IsOptional()
  @IsString()
  issueType?: string;

  @IsOptional()
  @IsString()
  additionalDescription?: string;
}

export class LinkJiraIssueDto {
  @IsString()
  findingId!: string;

  @IsString()
  issueKey!: string;
}

export interface JiraIssueResponse {
  id: string;
  key: string;
  self: string;
  url: string;
}
