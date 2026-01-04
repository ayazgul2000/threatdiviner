import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface ThreatIndicator {
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'cve';
  value: string;
  source: string;
  confidence: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  tags: string[];
  firstSeen?: string;
  lastSeen?: string;
  references: string[];
  additionalData?: Record<string, any>;
}

export interface ThreatReport {
  indicator: string;
  type: string;
  queriedAt: string;
  sources: SourceResult[];
  aggregatedScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'clean';
  tags: string[];
  recommendations: string[];
  relatedIndicators: ThreatIndicator[];
}

export interface SourceResult {
  source: string;
  found: boolean;
  confidence?: number;
  severity?: string;
  details?: any;
  error?: string;
  queriedAt: string;
}

export interface ThreatIntelConfig {
  virusTotalApiKey?: string;
  abuseIpDbApiKey?: string;
  shodanApiKey?: string;
  otxApiKey?: string;
  enableOpenSources?: boolean;
}

@Injectable()
export class ThreatIntelService {
  private readonly logger = new Logger(ThreatIntelService.name);
  private readonly config: ThreatIntelConfig;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.config = {
      virusTotalApiKey: this.configService.get('VIRUSTOTAL_API_KEY'),
      abuseIpDbApiKey: this.configService.get('ABUSEIPDB_API_KEY'),
      otxApiKey: this.configService.get('OTX_API_KEY'),
      enableOpenSources: true,
    };
  }

  async queryIndicator(indicator: string, type?: string): Promise<ThreatReport> {
    const detectedType = type || this.detectIndicatorType(indicator);
    const queriedAt = new Date().toISOString();
    const sources: SourceResult[] = [];
    const relatedIndicators: ThreatIndicator[] = [];
    const allTags = new Set<string>();

    // Query multiple sources in parallel
    const queries = this.getQueriesForType(detectedType, indicator);
    const results = await Promise.allSettled(queries.map(q => q.fn()));

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const queryInfo = queries[i];

      if (result.status === 'fulfilled') {
        sources.push({
          source: queryInfo.source,
          found: result.value.found,
          confidence: result.value.confidence,
          severity: result.value.severity,
          details: result.value.details,
          queriedAt,
        });

        if (result.value.tags) {
          result.value.tags.forEach((tag: string) => allTags.add(tag));
        }

        if (result.value.relatedIndicators) {
          relatedIndicators.push(...result.value.relatedIndicators);
        }
      } else {
        sources.push({
          source: queryInfo.source,
          found: false,
          error: result.reason?.message || 'Query failed',
          queriedAt,
        });
      }
    }

    // Calculate aggregated score
    const aggregatedScore = this.calculateAggregatedScore(sources);
    const riskLevel = this.getRiskLevel(aggregatedScore);
    const recommendations = this.generateRecommendations(detectedType, riskLevel, sources);

    return {
      indicator,
      type: detectedType,
      queriedAt,
      sources,
      aggregatedScore,
      riskLevel,
      tags: Array.from(allTags),
      recommendations,
      relatedIndicators: this.deduplicateIndicators(relatedIndicators),
    };
  }

  async queryCVE(cveId: string): Promise<ThreatReport> {
    const sources: SourceResult[] = [];
    const queriedAt = new Date().toISOString();
    const allTags = new Set<string>();

    // Query NVD (public)
    try {
      const nvdResult = await this.queryNVD(cveId);
      sources.push(nvdResult);
      if (nvdResult.details?.tags) {
        nvdResult.details.tags.forEach((t: string) => allTags.add(t));
      }
    } catch (error: any) {
      sources.push({
        source: 'NVD',
        found: false,
        error: error.message,
        queriedAt,
      });
    }

    // Query CISA KEV
    try {
      const kevResult = await this.queryCISAKEV(cveId);
      sources.push(kevResult);
      if (kevResult.found) {
        allTags.add('KEV');
        allTags.add('actively-exploited');
      }
    } catch (error: any) {
      sources.push({
        source: 'CISA KEV',
        found: false,
        error: error.message,
        queriedAt,
      });
    }

    // Query EPSS
    try {
      const epssResult = await this.queryEPSS(cveId);
      sources.push(epssResult);
    } catch (error: any) {
      sources.push({
        source: 'EPSS',
        found: false,
        error: error.message,
        queriedAt,
      });
    }

    const aggregatedScore = this.calculateCVEScore(sources);
    const riskLevel = this.getRiskLevel(aggregatedScore);

    return {
      indicator: cveId,
      type: 'cve',
      queriedAt,
      sources,
      aggregatedScore,
      riskLevel,
      tags: Array.from(allTags),
      recommendations: this.generateCVERecommendations(sources, riskLevel),
      relatedIndicators: [],
    };
  }

  async bulkQuery(indicators: string[]): Promise<ThreatReport[]> {
    // Process in batches to avoid rate limiting
    const batchSize = 10;
    const results: ThreatReport[] = [];

    for (let i = 0; i < indicators.length; i += batchSize) {
      const batch = indicators.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(indicator => this.queryIndicator(indicator))
      );
      results.push(...batchResults);

      // Rate limit delay between batches
      if (i + batchSize < indicators.length) {
        await this.delay(1000);
      }
    }

    return results;
  }

  private detectIndicatorType(indicator: string): string {
    // CVE pattern
    if (/^CVE-\d{4}-\d+$/i.test(indicator)) {
      return 'cve';
    }

    // IP address (v4)
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(indicator)) {
      return 'ip';
    }

    // IP address (v6)
    if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(indicator)) {
      return 'ip';
    }

    // URL
    if (/^https?:\/\//i.test(indicator)) {
      return 'url';
    }

    // Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(indicator)) {
      return 'email';
    }

    // MD5 hash
    if (/^[a-fA-F0-9]{32}$/.test(indicator)) {
      return 'hash';
    }

    // SHA1 hash
    if (/^[a-fA-F0-9]{40}$/.test(indicator)) {
      return 'hash';
    }

    // SHA256 hash
    if (/^[a-fA-F0-9]{64}$/.test(indicator)) {
      return 'hash';
    }

    // Domain (simple check)
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(indicator)) {
      return 'domain';
    }

    return 'unknown';
  }

  private getQueriesForType(type: string, indicator: string): Array<{ source: string; fn: () => Promise<any> }> {
    const queries: Array<{ source: string; fn: () => Promise<any> }> = [];

    switch (type) {
      case 'ip':
        if (this.config.abuseIpDbApiKey) {
          queries.push({ source: 'AbuseIPDB', fn: () => this.queryAbuseIPDB(indicator) });
        }
        queries.push({ source: 'ThreatFox', fn: () => this.queryThreatFox(indicator, 'ip') });
        queries.push({ source: 'URLhaus', fn: () => this.queryURLhaus(indicator, 'ip') });
        break;

      case 'domain':
        queries.push({ source: 'ThreatFox', fn: () => this.queryThreatFox(indicator, 'domain') });
        queries.push({ source: 'URLhaus', fn: () => this.queryURLhaus(indicator, 'domain') });
        break;

      case 'hash':
        queries.push({ source: 'MalwareBazaar', fn: () => this.queryMalwareBazaar(indicator) });
        queries.push({ source: 'ThreatFox', fn: () => this.queryThreatFox(indicator, 'hash') });
        break;

      case 'url':
        queries.push({ source: 'URLhaus', fn: () => this.queryURLhaus(indicator, 'url') });
        break;

      case 'cve':
        queries.push({ source: 'NVD', fn: () => this.queryNVD(indicator) });
        queries.push({ source: 'CISA KEV', fn: () => this.queryCISAKEV(indicator) });
        queries.push({ source: 'EPSS', fn: () => this.queryEPSS(indicator) });
        break;
    }

    return queries;
  }

  // AbuseIPDB Query
  private async queryAbuseIPDB(ip: string): Promise<any> {
    if (!this.config.abuseIpDbApiKey) {
      throw new Error('AbuseIPDB API key not configured');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://api.abuseipdb.com/api/v2/check`, {
          params: { ipAddress: ip, maxAgeInDays: 90 },
          headers: {
            'Key': this.config.abuseIpDbApiKey,
            'Accept': 'application/json',
          },
        })
      );

      const data = response.data.data;
      const abuseScore = data.abuseConfidenceScore || 0;

      return {
        found: abuseScore > 0,
        confidence: abuseScore / 100,
        severity: this.abuseScoreToSeverity(abuseScore),
        tags: data.usageType ? [data.usageType] : [],
        details: {
          countryCode: data.countryCode,
          isp: data.isp,
          domain: data.domain,
          totalReports: data.totalReports,
          lastReportedAt: data.lastReportedAt,
        },
      };
    } catch (error: any) {
      this.logger.error(`AbuseIPDB query failed: ${error.message}`);
      throw error;
    }
  }

  // ThreatFox Query (abuse.ch)
  private async queryThreatFox(indicator: string, _type: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post('https://threatfox-api.abuse.ch/api/v1/', {
          query: 'search_ioc',
          search_term: indicator,
        }, {
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const data = response.data;

      if (data.query_status === 'no_result') {
        return { found: false };
      }

      const iocs = data.data || [];
      if (iocs.length === 0) {
        return { found: false };
      }

      const firstIoc = iocs[0];
      return {
        found: true,
        confidence: firstIoc.confidence_level ? firstIoc.confidence_level / 100 : 0.7,
        severity: this.threatLevelToSeverity(firstIoc.threat_type),
        tags: [firstIoc.malware, firstIoc.malware_malpedia, firstIoc.threat_type].filter(Boolean),
        details: {
          malware: firstIoc.malware,
          threatType: firstIoc.threat_type,
          firstSeen: firstIoc.first_seen,
          lastSeen: firstIoc.last_seen,
          reporter: firstIoc.reporter,
        },
        relatedIndicators: iocs.slice(1).map((ioc: any) => ({
          type: this.iocTypeToIndicatorType(ioc.ioc_type),
          value: ioc.ioc,
          source: 'ThreatFox',
          confidence: 0.7,
          severity: 'medium',
          tags: [ioc.malware],
          references: [],
        })),
      };
    } catch (error: any) {
      this.logger.error(`ThreatFox query failed: ${error.message}`);
      throw error;
    }
  }

  // URLhaus Query (abuse.ch)
  private async queryURLhaus(indicator: string, type: string): Promise<any> {
    try {
      let endpoint = '';
      const payload: any = {};

      if (type === 'url') {
        endpoint = 'https://urlhaus-api.abuse.ch/v1/url/';
        payload.url = indicator;
      } else if (type === 'domain') {
        endpoint = 'https://urlhaus-api.abuse.ch/v1/host/';
        payload.host = indicator;
      } else if (type === 'ip') {
        endpoint = 'https://urlhaus-api.abuse.ch/v1/host/';
        payload.host = indicator;
      }

      const response = await firstValueFrom(
        this.httpService.post(endpoint, new URLSearchParams(payload).toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      const data = response.data;

      if (data.query_status === 'no_results') {
        return { found: false };
      }

      return {
        found: true,
        confidence: 0.8,
        severity: data.threat === 'malware_download' ? 'high' : 'medium',
        tags: data.tags || [],
        details: {
          threat: data.threat,
          urlStatus: data.url_status,
          dateAdded: data.date_added,
          urlCount: data.url_count,
        },
      };
    } catch (error: any) {
      this.logger.error(`URLhaus query failed: ${error.message}`);
      throw error;
    }
  }

  // MalwareBazaar Query (abuse.ch)
  private async queryMalwareBazaar(hash: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post('https://mb-api.abuse.ch/api/v1/',
          new URLSearchParams({ query: 'get_info', hash }).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        )
      );

      const data = response.data;

      if (data.query_status === 'hash_not_found') {
        return { found: false };
      }

      const sample = data.data?.[0];
      if (!sample) {
        return { found: false };
      }

      return {
        found: true,
        confidence: 0.95,
        severity: 'high',
        tags: sample.tags || [],
        details: {
          fileName: sample.file_name,
          fileType: sample.file_type,
          fileSize: sample.file_size,
          signature: sample.signature,
          firstSeen: sample.first_seen,
          deliveryMethod: sample.delivery_method,
        },
        relatedIndicators: (sample.intelligence?.downloads || []).map((d: any) => ({
          type: 'url',
          value: d.download_url,
          source: 'MalwareBazaar',
          confidence: 0.8,
          severity: 'high',
          tags: ['malware-delivery'],
          references: [],
        })),
      };
    } catch (error: any) {
      this.logger.error(`MalwareBazaar query failed: ${error.message}`);
      throw error;
    }
  }

  // NVD Query
  private async queryNVD(cveId: string): Promise<SourceResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://services.nvd.nist.gov/rest/json/cves/2.0`, {
          params: { cveId },
          headers: { 'Accept': 'application/json' },
        })
      );

      const vulnerabilities = response.data.vulnerabilities;
      if (!vulnerabilities || vulnerabilities.length === 0) {
        return { source: 'NVD', found: false, queriedAt: new Date().toISOString() };
      }

      const cve = vulnerabilities[0].cve;
      const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0];
      const cvssScore = metrics?.cvssData?.baseScore;
      const severity = metrics?.cvssData?.baseSeverity?.toLowerCase();

      return {
        source: 'NVD',
        found: true,
        confidence: 1.0,
        severity,
        details: {
          description: cve.descriptions?.find((d: any) => d.lang === 'en')?.value,
          cvssScore,
          cvssVector: metrics?.cvssData?.vectorString,
          publishedDate: cve.published,
          lastModifiedDate: cve.lastModified,
          references: cve.references?.map((r: any) => r.url),
          cweIds: cve.weaknesses?.flatMap((w: any) =>
            w.description?.map((d: any) => d.value)
          ),
          tags: severity ? [severity] : [],
        },
        queriedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`NVD query failed: ${error.message}`);
      throw error;
    }
  }

  // CISA KEV Query
  private async queryCISAKEV(cveId: string): Promise<SourceResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json')
      );

      const vulnerabilities = response.data.vulnerabilities || [];
      const kev = vulnerabilities.find((v: any) => v.cveID === cveId);

      if (!kev) {
        return { source: 'CISA KEV', found: false, queriedAt: new Date().toISOString() };
      }

      return {
        source: 'CISA KEV',
        found: true,
        confidence: 1.0,
        severity: 'critical',
        details: {
          vendorProject: kev.vendorProject,
          product: kev.product,
          vulnerabilityName: kev.vulnerabilityName,
          dateAdded: kev.dateAdded,
          dueDate: kev.dueDate,
          requiredAction: kev.requiredAction,
          knownRansomwareCampaignUse: kev.knownRansomwareCampaignUse,
          notes: kev.notes,
        },
        queriedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`CISA KEV query failed: ${error.message}`);
      throw error;
    }
  }

  // EPSS Query
  private async queryEPSS(cveId: string): Promise<SourceResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://api.first.org/data/v1/epss`, {
          params: { cve: cveId },
        })
      );

      const data = response.data.data?.[0];
      if (!data) {
        return { source: 'EPSS', found: false, queriedAt: new Date().toISOString() };
      }

      const epssScore = parseFloat(data.epss);
      const percentile = parseFloat(data.percentile);

      return {
        source: 'EPSS',
        found: true,
        confidence: 0.9,
        severity: this.epssToSeverity(epssScore),
        details: {
          epssScore,
          percentile,
          date: data.date,
          model_version: data.model_version,
        },
        queriedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`EPSS query failed: ${error.message}`);
      throw error;
    }
  }

  private calculateAggregatedScore(sources: SourceResult[]): number {
    const foundSources = sources.filter(s => s.found && s.confidence);
    if (foundSources.length === 0) return 0;

    // Weight by confidence
    let totalWeight = 0;
    let weightedSum = 0;

    for (const source of foundSources) {
      const severityScore = this.severityToScore(source.severity);
      const weight = source.confidence || 0.5;
      weightedSum += severityScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
  }

  private calculateCVEScore(sources: SourceResult[]): number {
    let score = 0;

    for (const source of sources) {
      if (!source.found) continue;

      if (source.source === 'NVD') {
        const cvss = source.details?.cvssScore || 0;
        score = Math.max(score, cvss * 10);
      }

      if (source.source === 'CISA KEV') {
        score = Math.max(score, 90); // KEV entries are high priority
      }

      if (source.source === 'EPSS') {
        const epss = source.details?.epssScore || 0;
        score = Math.max(score, epss * 100);
      }
    }

    return Math.round(score);
  }

  private getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' | 'clean' {
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    if (score > 0) return 'low';
    return 'clean';
  }

  private severityToScore(severity?: string): number {
    const map: Record<string, number> = {
      critical: 1.0,
      high: 0.8,
      medium: 0.5,
      low: 0.3,
      unknown: 0.2,
    };
    return map[severity?.toLowerCase() || 'unknown'] || 0.2;
  }

  private abuseScoreToSeverity(score: number): string {
    if (score >= 80) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    if (score > 0) return 'low';
    return 'unknown';
  }

  private threatLevelToSeverity(threatType?: string): string {
    const highThreats = ['botnet_cc', 'payload_delivery', 'c2'];
    const mediumThreats = ['payload', 'config'];

    if (highThreats.some(t => threatType?.toLowerCase().includes(t))) {
      return 'high';
    }
    if (mediumThreats.some(t => threatType?.toLowerCase().includes(t))) {
      return 'medium';
    }
    return 'low';
  }

  private epssToSeverity(epss: number): string {
    if (epss >= 0.9) return 'critical';
    if (epss >= 0.7) return 'high';
    if (epss >= 0.3) return 'medium';
    return 'low';
  }

  private iocTypeToIndicatorType(iocType: string): string {
    const map: Record<string, string> = {
      ip: 'ip',
      domain: 'domain',
      url: 'url',
      md5_hash: 'hash',
      sha256_hash: 'hash',
      sha1_hash: 'hash',
    };
    return map[iocType?.toLowerCase()] || 'unknown';
  }

  private generateRecommendations(type: string, riskLevel: string, _sources: SourceResult[]): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Block this indicator immediately');
      recommendations.push('Review all related activity in logs');
      recommendations.push('Consider incident response procedures');
    } else if (riskLevel === 'medium') {
      recommendations.push('Add to watchlist for monitoring');
      recommendations.push('Review associated traffic patterns');
    } else if (riskLevel === 'low') {
      recommendations.push('Continue monitoring');
    }

    // Type-specific recommendations
    if (type === 'ip') {
      recommendations.push('Check firewall logs for connections to/from this IP');
      if (riskLevel !== 'clean') {
        recommendations.push('Consider adding to blocklist');
      }
    }

    if (type === 'hash') {
      recommendations.push('Scan systems for this file hash');
      recommendations.push('Check endpoint detection logs');
    }

    if (type === 'domain' || type === 'url') {
      recommendations.push('Check DNS and proxy logs');
      recommendations.push('Consider DNS sinkholing');
    }

    return recommendations;
  }

  private generateCVERecommendations(sources: SourceResult[], riskLevel: string): string[] {
    const recommendations: string[] = [];
    const isKEV = sources.some(s => s.source === 'CISA KEV' && s.found);
    const epssSource = sources.find(s => s.source === 'EPSS' && s.found);

    if (isKEV) {
      recommendations.push('URGENT: This CVE is in CISA Known Exploited Vulnerabilities catalog');
      recommendations.push('Apply patches immediately - active exploitation observed');
      recommendations.push('Follow CISA remediation guidance');
    }

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Prioritize patching for this vulnerability');
      recommendations.push('Implement compensating controls if patch not immediately available');
      recommendations.push('Review exposure of affected systems');
    }

    if (epssSource && epssSource.details?.epssScore > 0.5) {
      recommendations.push(`High exploitation probability (${(epssSource.details.epssScore * 100).toFixed(1)}%) - expedite remediation`);
    }

    return recommendations;
  }

  private deduplicateIndicators(indicators: ThreatIndicator[]): ThreatIndicator[] {
    const seen = new Set<string>();
    return indicators.filter(ind => {
      const key = `${ind.type}:${ind.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
