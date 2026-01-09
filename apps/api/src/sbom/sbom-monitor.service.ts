// apps/api/src/sbom/sbom-monitor.service.ts
// Zero-day vulnerability monitoring based on SBOM

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

interface PackageMatch {
  sbomId: string;
  componentId: string;
  componentName: string;
  componentVersion: string;
  purl: string;
  repositoryId: string | null;
  tenantId: string;
}

@Injectable()
export class SbomMonitorService {
  private readonly logger = new Logger(SbomMonitorService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async checkForNewVulnerabilities(): Promise<void> {
    this.logger.log('Starting vulnerability check...');
    try {
      const recentCves = await this.getRecentCves(24);
      const packages = await this.getAllPackages();
      for (const cve of recentCves) {
        const matches = this.matchCveToPackages(cve, packages);
        if (matches.length > 0) await this.createAlert(cve, matches);
      }
      this.logger.log('Vulnerability check completed');
    } catch (error) {
      this.logger.error('Vulnerability check failed', error);
    }
  }

  private async getRecentCves(hours: number): Promise<any[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);
    return this.prisma.cve.findMany({
      where: { publishedDate: { gte: since } },
      orderBy: { publishedDate: 'desc' },
      take: 500,
    });
  }

  private async getAllPackages(): Promise<PackageMatch[]> {
    const components = await this.prisma.sbomComponent.findMany({
      include: { sbom: true },
    });
    return components.map((c) => ({
      sbomId: c.sbomId,
      componentId: c.id,
      componentName: c.name,
      componentVersion: c.version || '',
      purl: c.purl || '',
      repositoryId: c.sbom?.repositoryId || null,
      tenantId: c.sbom?.tenantId || '',
    }));
  }

  private matchCveToPackages(cve: any, packages: PackageMatch[]): PackageMatch[] {
    const matches: PackageMatch[] = [];
    const affectedProducts = (cve.affectedProducts as any[]) || [];
    for (const product of affectedProducts) {
      const productName = (product.product || '').toLowerCase();
      for (const pkg of packages) {
        if (pkg.componentName.toLowerCase().includes(productName)) {
          if (this.isVersionAffected(pkg.componentVersion, product.versionStartIncluding, product.versionEndExcluding)) {
            matches.push(pkg);
          }
        }
      }
    }
    return matches;
  }

  private isVersionAffected(version: string, start?: string, end?: string): boolean {
    if (!version) return true;
    if (start && this.compareVersions(version, start) < 0) return false;
    if (end && this.compareVersions(version, end) >= 0) return false;
    return true;
  }

  private compareVersions(v1: string, v2: string): number {
    const p1 = v1.split('.').map(p => parseInt(p, 10) || 0);
    const p2 = v2.split('.').map(p => parseInt(p, 10) || 0);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      if ((p1[i] || 0) < (p2[i] || 0)) return -1;
      if ((p1[i] || 0) > (p2[i] || 0)) return 1;
    }
    return 0;
  }

  private async createAlert(cve: any, matches: PackageMatch[]): Promise<void> {
    const byTenant = new Map<string, PackageMatch[]>();
    for (const m of matches) {
      if (!m.tenantId) continue;
      byTenant.set(m.tenantId, [...(byTenant.get(m.tenantId) || []), m]);
    }

    for (const [tenantId, tenantMatches] of byTenant) {
      const existing = await this.prisma.vulnerabilityAlert.findFirst({
        where: { tenantId, cveId: cve.id },
      });
      if (existing) continue;

      const isZeroDay = cve.publishedDate
        ? (Date.now() - new Date(cve.publishedDate).getTime()) / 3600000 < 48
        : false;

      const packages = [...new Map(tenantMatches.map(m => [
        m.componentName + m.componentVersion,
        { name: m.componentName, version: m.componentVersion, purl: m.purl, sbomIds: [m.sbomId] }
      ])).values()];

      await this.prisma.vulnerabilityAlert.create({
        data: {
          tenantId, cveId: cve.id,
          title: `New vulnerability: ${cve.id}`,
          description: cve.description,
          severity: cve.cvssV3Severity || 'unknown',
          cvssScore: cve.cvssV3Score,
          epssScore: cve.epssScore,
          isKev: cve.isKev || false,
          isZeroDay,
          publishedDate: cve.publishedDate,
          affectedPackages: packages as any,
          status: 'open',
        },
      });
    }
  }

  async getAlerts(tenantId: string, filters?: { status?: string; severity?: string[]; isZeroDay?: boolean; isKev?: boolean; limit?: number; offset?: number }) {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.severity?.length) where.severity = { in: filters.severity };
    if (filters?.isZeroDay !== undefined) where.isZeroDay = filters.isZeroDay;
    if (filters?.isKev !== undefined) where.isKev = filters.isKev;

    const [alerts, total] = await Promise.all([
      this.prisma.vulnerabilityAlert.findMany({
        where, orderBy: [{ isZeroDay: 'desc' }, { isKev: 'desc' }, { createdAt: 'desc' }],
        take: filters?.limit || 50, skip: filters?.offset || 0,
      }),
      this.prisma.vulnerabilityAlert.count({ where }),
    ]);
    return { alerts, total };
  }

  async updateAlertStatus(tenantId: string, alertId: string, status: 'open' | 'acknowledged' | 'resolved' | 'suppressed') {
    const alert = await this.prisma.vulnerabilityAlert.findFirst({ where: { id: alertId, tenantId } });
    if (!alert) throw new Error('Alert not found');
    return this.prisma.vulnerabilityAlert.update({
      where: { id: alertId },
      data: { status, acknowledgedAt: status === 'acknowledged' ? new Date() : undefined, resolvedAt: status === 'resolved' ? new Date() : undefined },
    });
  }

  async getAlertStats(tenantId: string) {
    const alerts = await this.prisma.vulnerabilityAlert.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    const stats = { total: alerts.length, open: 0, zeroDays: 0, kev: 0, bySeverity: {} as Record<string, number>, recentAlerts: alerts.slice(0, 5) };
    for (const a of alerts) {
      if (a.status === 'open') stats.open++;
      if (a.isZeroDay) stats.zeroDays++;
      if (a.isKev) stats.kev++;
      stats.bySeverity[a.severity] = (stats.bySeverity[a.severity] || 0) + 1;
    }
    return stats;
  }

  async checkSbomVulnerabilities(tenantId: string, sbomId: string) {
    const sbom = await this.prisma.sbom.findFirst({ where: { id: sbomId, tenantId }, include: { components: true } });
    if (!sbom) throw new Error('SBOM not found');
    let newVulns = 0;
    for (const c of sbom.components) {
      if (!c.name) continue;
      const cves = await this.prisma.cve.findMany({ where: { description: { contains: c.name, mode: 'insensitive' } }, take: 50 });
      for (const cve of cves) {
        const exists = await this.prisma.sbomVulnerability.findFirst({ where: { sbomId, cveId: cve.id } });
        if (!exists) {
          await this.prisma.sbomVulnerability.create({ data: { sbomId, cveId: cve.id, severity: cve.cvssV3Severity || 'unknown', cvssScore: cve.cvssV3Score, title: cve.id, description: cve.description } });
          newVulns++;
        }
      }
    }
    return { checked: sbom.components.length, newVulnerabilities: newVulns };
  }

  async getPackagesAtRisk(tenantId: string) {
    const sboms = await this.prisma.sbom.findMany({ where: { tenantId }, include: { components: { include: { vulnerabilities: true } } } });
    const pkgMap = new Map<string, { name: string; version: string; vulnCount: number; critCount: number }>();
    for (const s of sboms) {
      for (const c of s.components) {
        if (!c.vulnerabilities?.length) continue;
        const key = `${c.name}@${c.version}`;
        const existing = pkgMap.get(key) || { name: c.name, version: c.version || '', vulnCount: 0, critCount: 0 };
        existing.vulnCount += c.vulnerabilities.length;
        pkgMap.set(key, existing);
      }
    }
    const packages = [...pkgMap.values()].sort((a, b) => b.vulnCount - a.vulnCount);
    return { packages, total: packages.length };
  }
}
