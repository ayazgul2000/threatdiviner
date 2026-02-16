import { IsString, IsOptional, IsUUID, IsArray, IsIn, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScanDto {
  @ApiProperty({
    description: 'Repository ID to scan',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  repositoryId!: string;

  @ApiPropertyOptional({
    description: 'Project ID to associate scan with',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Branch to scan',
    example: 'main',
  })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiPropertyOptional({
    description: 'Specific commit SHA to scan',
    example: 'abc123def456',
  })
  @IsOptional()
  @IsString()
  commitSha?: string;

  @ApiPropertyOptional({
    description: 'Scanners to run',
    enum: ['SEMGREP', 'BANDIT', 'GOSEC', 'TRIVY', 'GITLEAKS', 'TRUFFLEHOG', 'CHECKOV', 'NUCLEI', 'ZAP'],
    isArray: true,
    example: ['SEMGREP', 'TRIVY', 'GITLEAKS'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(
    ['SEMGREP', 'BANDIT', 'GOSEC', 'TRIVY', 'GITLEAKS', 'TRUFFLEHOG', 'CHECKOV', 'NUCLEI', 'ZAP'],
    { each: true }
  )
  scanners?: string[];

  @ApiPropertyOptional({
    description: 'Only scan PR diff (for PR-triggered scans)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  prDiffOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Pull request number (for PR-triggered scans)',
  })
  @IsOptional()
  @IsString()
  prNumber?: string;
}
