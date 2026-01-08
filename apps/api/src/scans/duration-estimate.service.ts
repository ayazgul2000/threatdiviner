import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface DurationEstimate {
  estimatedDuration: number | null; // milliseconds
  lastRunDuration: number | null;
  scanCount: number;
  perScanner: Record<string, number>;
}

@Injectable()
export class DurationEstimateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get estimated duration for a repo scan
   */
  async getRepoEstimate(repositoryId: string, scanners?: string[]): Promise<DurationEstimate> {
    // Get completed scans for this repository
    const completedScans = await this.prisma.scan.findMany({
      where: {
        repositoryId,
        status: 'completed',
        duration: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
      include: {
        scannerResults: {
          select: {
            scanner: true,
            duration: true,
          },
        },
      },
    });

    if (completedScans.length === 0) {
      return {
        estimatedDuration: null,
        lastRunDuration: null,
        scanCount: 0,
        perScanner: {},
      };
    }

    // Calculate average duration per scanner
    const scannerDurations: Record<string, number[]> = {};
    for (const scan of completedScans) {
      for (const result of scan.scannerResults) {
        if (result.duration) {
          if (!scannerDurations[result.scanner]) {
            scannerDurations[result.scanner] = [];
          }
          scannerDurations[result.scanner].push(result.duration);
        }
      }
    }

    const perScanner: Record<string, number> = {};
    for (const [scanner, durations] of Object.entries(scannerDurations)) {
      perScanner[scanner] = Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length
      );
    }

    // Calculate total estimated duration
    let estimatedDuration = 0;
    const selectedScanners = scanners || Object.keys(perScanner);

    for (const scanner of selectedScanners) {
      if (perScanner[scanner]) {
        estimatedDuration += perScanner[scanner];
      } else {
        // Default estimate for unknown scanners: 60 seconds
        estimatedDuration += 60000;
      }
    }

    return {
      estimatedDuration: estimatedDuration > 0 ? estimatedDuration : null,
      lastRunDuration: completedScans[0]?.duration || null,
      scanCount: completedScans.length,
      perScanner,
    };
  }

  /**
   * Get estimated duration for a pentest scan
   */
  async getPentestEstimate(targetId: string, scanners?: string[]): Promise<DurationEstimate> {
    // Get completed pentest scans for this target
    const completedScans = await this.prisma.penTestScan.findMany({
      where: {
        targetId,
        status: 'completed',
        duration: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    });

    if (completedScans.length === 0) {
      return {
        estimatedDuration: null,
        lastRunDuration: null,
        scanCount: 0,
        perScanner: {},
      };
    }

    // Calculate average duration
    const durations = completedScans.map(s => s.duration!).filter(Boolean);
    const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

    // Estimate per scanner based on typical proportions
    // These are rough estimates - actual tracking would require storing per-scanner durations
    const defaultProportions: Record<string, number> = {
      nuclei: 0.4,
      nikto: 0.25,
      sslyze: 0.1,
      sqlmap: 0.15,
      zap: 0.5,
    };

    const perScanner: Record<string, number> = {};
    const selectedScanners = scanners || Object.keys(defaultProportions);

    let totalProportion = 0;
    for (const scanner of selectedScanners) {
      totalProportion += defaultProportions[scanner] || 0.2;
    }

    for (const scanner of selectedScanners) {
      const proportion = (defaultProportions[scanner] || 0.2) / totalProportion;
      perScanner[scanner] = Math.round(avgDuration * proportion * 1000);
    }

    return {
      estimatedDuration: avgDuration * 1000, // Convert to milliseconds
      lastRunDuration: completedScans[0]?.duration ? completedScans[0].duration * 1000 : null,
      scanCount: completedScans.length,
      perScanner,
    };
  }

  /**
   * Get statistics for a repository's scan history
   */
  async getRepoScanStats(repositoryId: string) {
    const stats = await this.prisma.scan.aggregate({
      where: {
        repositoryId,
        status: 'completed',
        duration: { not: null },
      },
      _avg: { duration: true },
      _min: { duration: true },
      _max: { duration: true },
      _count: true,
    });

    return {
      averageDuration: stats._avg.duration,
      minDuration: stats._min.duration,
      maxDuration: stats._max.duration,
      totalScans: stats._count,
    };
  }

  /**
   * Get statistics for a target's pentest history
   */
  async getTargetScanStats(targetId: string) {
    const stats = await this.prisma.penTestScan.aggregate({
      where: {
        targetId,
        status: 'completed',
        duration: { not: null },
      },
      _avg: { duration: true },
      _min: { duration: true },
      _max: { duration: true },
      _count: true,
    });

    return {
      averageDuration: stats._avg.duration,
      minDuration: stats._min.duration,
      maxDuration: stats._max.duration,
      totalScans: stats._count,
    };
  }
}
