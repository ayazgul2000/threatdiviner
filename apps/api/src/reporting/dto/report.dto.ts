// apps/api/src/reporting/dto/report.dto.ts

import { IsString, IsOptional, IsEnum, IsObject, IsArray, IsBoolean } from 'class-validator';

export enum ReportType {
  SCAN = 'scan',
  PENTEST = 'pentest',
  REPOSITORY = 'repository',
  PROJECT = 'project',
  CLOUD = 'cloud',
  COMPLIANCE = 'compliance',
  EXECUTIVE = 'executive',
  THREAT_MODEL = 'threat_model',
  SBOM = 'sbom',
}

export enum ReportFormat {
  PDF = 'pdf',
  HTML = 'html',
  CSV = 'csv',
  JSON = 'json',
  XLSX = 'xlsx',
  SARIF = 'sarif',
}

export enum ComplianceFramework {
  SOC2 = 'soc2',
  PCI_DSS = 'pci_dss',
  HIPAA = 'hipaa',
  GDPR = 'gdpr',
  ISO27001 = 'iso27001',
  NIST_CSF = 'nist_csf',
  CIS = 'cis',
  OWASP = 'owasp',
  ESSENTIAL_EIGHT = 'essential_eight',
}

export class CreateReportDto {
  @IsString()
  name!: string;

  @IsEnum(ReportType)
  type!: ReportType;

  @IsEnum(ReportFormat)
  format!: ReportFormat;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  repositoryId?: string;

  @IsString()
  @IsOptional()
  scanId?: string;

  @IsString()
  @IsOptional()
  pentestId?: string;

  @IsString()
  @IsOptional()
  threatModelId?: string;

  @IsString()
  @IsOptional()
  cloudAccountId?: string;

  @IsArray()
  @IsOptional()
  complianceFrameworks?: ComplianceFramework[];

  @IsObject()
  @IsOptional()
  filters?: {
    severity?: string[];
    status?: string[];
    scanner?: string[];
    dateFrom?: string;
    dateTo?: string;
  };

  @IsBoolean()
  @IsOptional()
  includeRemediation?: boolean;

  @IsBoolean()
  @IsOptional()
  includeAiAnalysis?: boolean;

  @IsBoolean()
  @IsOptional()
  includeTrends?: boolean;
}

export class ReportResponseDto {
  id!: string;
  name!: string;
  type!: ReportType;
  format!: ReportFormat;
  status!: 'pending' | 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
  size?: number;
  createdBy!: string;
  createdAt!: Date;
  completedAt?: Date;
  parameters?: Record<string, unknown>;
  error?: string;
}
