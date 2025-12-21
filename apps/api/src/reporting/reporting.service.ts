import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PdfGenerator, ReportData } from './generators/pdf.generator';
import * as Minio from 'minio';
import * as crypto from 'crypto';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);
  private readonly minioClient: Minio.Client | null = null;
  private readonly bucketName: string;
  private readonly reportExpiry: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly pdfGenerator: PdfGenerator,
  ) {
    const minioEndpoint = this.configService.get('MINIO_ENDPOINT');
    const minioPort = this.configService.get('MINIO_PORT');
    const minioAccessKey = this.configService.get('MINIO_ACCESS_KEY');
    const minioSecretKey = this.configService.get('MINIO_SECRET_KEY');

    if (minioEndpoint && minioAccessKey && minioSecretKey) {
      this.minioClient = new Minio.Client({
        endPoint: minioEndpoint,
        port: parseInt(minioPort || '9000', 10),
        useSSL: this.configService.get('MINIO_USE_SSL', 'false') === 'true',
        accessKey: minioAccessKey,
        secretKey: minioSecretKey,
      });
      this.logger.log('MinIO client initialized');
    } else {
      this.logger.warn('MinIO not configured - reports will be served directly');
    }

    this.bucketName = this.configService.get('MINIO_BUCKET', 'threatdiviner-reports');
    this.reportExpiry = parseInt(this.configService.get('REPORT_EXPIRY_SECONDS', '86400'), 10); // 24h default
  }

  async generateScanReport(tenantId: string, scanId: string): Promise<{ url: string; buffer?: Buffer }> {
    const scan = await this.prisma.scan.findFirst({
      where: { id: scanId, tenantId },
      include: {
        repository: true,
        tenant: true,
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    const findings = await this.prisma.finding.findMany({
      where: { scanId, tenantId },
      orderBy: [
        { severity: 'asc' }, // critical first
        { createdAt: 'desc' },
      ],
    });

    const summary = this.calculateSummary(findings);

    const reportData: ReportData = {
      tenant: { name: scan.tenant.name },
      scan: { ...scan, repository: scan.repository },
      findings,
      summary,
      generatedAt: new Date(),
    };

    const pdfBuffer = await this.pdfGenerator.generateScanReport(reportData);

    // If MinIO is configured, upload and return presigned URL
    if (this.minioClient) {
      const objectName = `${tenantId}/scans/${scanId}/${Date.now()}.pdf`;
      await this.uploadToMinio(objectName, pdfBuffer);
      const url = await this.getPresignedUrl(objectName);
      return { url };
    }

    // Otherwise return inline data URL for direct download
    const base64 = pdfBuffer.toString('base64');
    return {
      url: `data:application/pdf;base64,${base64}`,
      buffer: pdfBuffer,
    };
  }

  async generateRepositoryReport(tenantId: string, repositoryId: string): Promise<{ url: string; buffer?: Buffer }> {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, tenantId },
      include: { tenant: true },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    const findings = await this.prisma.finding.findMany({
      where: { repositoryId, tenantId, status: { in: ['open', 'triaged'] } },
      orderBy: [
        { severity: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    const summary = this.calculateSummary(findings);

    const reportData: ReportData = {
      tenant: { name: repository.tenant.name },
      repository,
      findings,
      summary,
      generatedAt: new Date(),
    };

    const pdfBuffer = await this.pdfGenerator.generateScanReport(reportData);

    if (this.minioClient) {
      const objectName = `${tenantId}/repositories/${repositoryId}/${Date.now()}.pdf`;
      await this.uploadToMinio(objectName, pdfBuffer);
      const url = await this.getPresignedUrl(objectName);
      return { url };
    }

    const base64 = pdfBuffer.toString('base64');
    return {
      url: `data:application/pdf;base64,${base64}`,
      buffer: pdfBuffer,
    };
  }

  async generateTenantSummaryReport(tenantId: string): Promise<{ url: string; buffer?: Buffer }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const findings = await this.prisma.finding.findMany({
      where: { tenantId, status: { in: ['open', 'triaged'] } },
      orderBy: [
        { severity: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 100, // Limit for summary report
    });

    const summary = this.calculateSummary(findings);

    const reportData: ReportData = {
      tenant: { name: tenant.name },
      findings,
      summary,
      generatedAt: new Date(),
    };

    const pdfBuffer = await this.pdfGenerator.generateScanReport(reportData);

    if (this.minioClient) {
      const objectName = `${tenantId}/summary/${Date.now()}.pdf`;
      await this.uploadToMinio(objectName, pdfBuffer);
      const url = await this.getPresignedUrl(objectName);
      return { url };
    }

    const base64 = pdfBuffer.toString('base64');
    return {
      url: `data:application/pdf;base64,${base64}`,
      buffer: pdfBuffer,
    };
  }

  private calculateSummary(findings: { severity: string }[]) {
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: findings.length,
    };

    findings.forEach((f) => {
      if (f.severity in summary) {
        (summary as Record<string, number>)[f.severity]++;
      }
    });

    return summary;
  }

  private async uploadToMinio(objectName: string, buffer: Buffer): Promise<void> {
    if (!this.minioClient) return;

    try {
      // Ensure bucket exists
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
      }

      await this.minioClient.putObject(this.bucketName, objectName, buffer, buffer.length, {
        'Content-Type': 'application/pdf',
      });

      this.logger.log(`Report uploaded to MinIO: ${objectName}`);
    } catch (error) {
      this.logger.error(`Failed to upload report to MinIO: ${error}`);
      throw error;
    }
  }

  private async getPresignedUrl(objectName: string): Promise<string> {
    if (!this.minioClient) {
      throw new Error('MinIO not configured');
    }

    return this.minioClient.presignedGetObject(this.bucketName, objectName, this.reportExpiry);
  }
}
