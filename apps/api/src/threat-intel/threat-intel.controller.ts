import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ThreatIntelService, ThreatReport } from './threat-intel.service';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';

export interface QueryIndicatorDto {
  indicator: string;
  type?: string;
}

export interface BulkQueryDto {
  indicators: string[];
}

@Controller('threat-intel')
@UseGuards(JwtAuthGuard)
export class ThreatIntelController {
  constructor(private readonly threatIntelService: ThreatIntelService) {}

  @Post('query')
  @HttpCode(HttpStatus.OK)
  async queryIndicator(@Body() dto: QueryIndicatorDto): Promise<ThreatReport> {
    return this.threatIntelService.queryIndicator(dto.indicator, dto.type);
  }

  @Get('query/:indicator')
  async queryIndicatorGet(@Param('indicator') indicator: string): Promise<ThreatReport> {
    return this.threatIntelService.queryIndicator(indicator);
  }

  @Post('cve')
  @HttpCode(HttpStatus.OK)
  async queryCVE(@Body() dto: { cveId: string }): Promise<ThreatReport> {
    return this.threatIntelService.queryCVE(dto.cveId);
  }

  @Get('cve/:cveId')
  async queryCVEGet(@Param('cveId') cveId: string): Promise<ThreatReport> {
    return this.threatIntelService.queryCVE(cveId);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  async bulkQuery(@Body() dto: BulkQueryDto): Promise<ThreatReport[]> {
    return this.threatIntelService.bulkQuery(dto.indicators);
  }

  @Get('sources')
  getSupportedSources(): any {
    return {
      openSources: [
        {
          name: 'ThreatFox',
          description: 'abuse.ch threat intelligence sharing platform',
          types: ['ip', 'domain', 'hash'],
          rateLimit: '100/hour',
        },
        {
          name: 'URLhaus',
          description: 'abuse.ch malicious URL database',
          types: ['url', 'domain', 'ip'],
          rateLimit: '100/hour',
        },
        {
          name: 'MalwareBazaar',
          description: 'abuse.ch malware sample sharing',
          types: ['hash'],
          rateLimit: '100/hour',
        },
        {
          name: 'NVD',
          description: 'NIST National Vulnerability Database',
          types: ['cve'],
          rateLimit: '5/30s without API key',
        },
        {
          name: 'CISA KEV',
          description: 'Known Exploited Vulnerabilities catalog',
          types: ['cve'],
          rateLimit: 'none',
        },
        {
          name: 'EPSS',
          description: 'Exploit Prediction Scoring System',
          types: ['cve'],
          rateLimit: 'none',
        },
      ],
      apiKeySources: [
        {
          name: 'AbuseIPDB',
          description: 'IP reputation database',
          types: ['ip'],
          configKey: 'ABUSEIPDB_API_KEY',
        },
        {
          name: 'VirusTotal',
          description: 'Multi-engine malware scanner',
          types: ['ip', 'domain', 'hash', 'url'],
          configKey: 'VIRUSTOTAL_API_KEY',
        },
        {
          name: 'OTX',
          description: 'AlienVault Open Threat Exchange',
          types: ['ip', 'domain', 'hash', 'url'],
          configKey: 'OTX_API_KEY',
        },
      ],
    };
  }
}
