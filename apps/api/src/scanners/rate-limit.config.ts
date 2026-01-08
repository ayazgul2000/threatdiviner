/**
 * Rate Limit Presets for DAST Scanners
 *
 * Low: Safe for production environments
 * Medium: Suitable for staging/testing environments
 * High: For local development and isolated targets
 */

export type RateLimitPreset = 'low' | 'medium' | 'high';

export interface NucleiRateLimitConfig {
  rateLimit: number;
  bulkSize: number;
  concurrency: number;
}

export interface ZapRateLimitConfig {
  maxRequestsPerSecond: number;
  threadCount: number;
}

export interface NiktoRateLimitConfig {
  timeout: number;
  pause: number;
}

export interface SqlmapRateLimitConfig {
  delay: number;
  threads: number;
}

export interface RateLimitConfig {
  nuclei: NucleiRateLimitConfig;
  zap: ZapRateLimitConfig;
  nikto: NiktoRateLimitConfig;
  sqlmap: SqlmapRateLimitConfig;
  sslyze: Record<string, never>; // No rate limit needed
}

export const RATE_LIMIT_CONFIG: Record<RateLimitPreset, RateLimitConfig> = {
  low: {
    nuclei: { rateLimit: 50, bulkSize: 25, concurrency: 25 },
    zap: { maxRequestsPerSecond: 50, threadCount: 2 },
    nikto: { timeout: 10, pause: 0.02 },
    sqlmap: { delay: 0.02, threads: 1 },
    sslyze: {},
  },
  medium: {
    nuclei: { rateLimit: 150, bulkSize: 50, concurrency: 50 },
    zap: { maxRequestsPerSecond: 150, threadCount: 5 },
    nikto: { timeout: 5, pause: 0 },
    sqlmap: { delay: 0, threads: 3 },
    sslyze: {},
  },
  high: {
    nuclei: { rateLimit: 300, bulkSize: 100, concurrency: 100 },
    zap: { maxRequestsPerSecond: 300, threadCount: 10 },
    nikto: { timeout: 3, pause: 0 },
    sqlmap: { delay: 0, threads: 10 },
    sslyze: {},
  },
};

/**
 * Get rate limit arguments for a specific scanner based on preset
 */
export function getRateLimitArgs(scanner: string, preset: RateLimitPreset): string[] {
  const config = RATE_LIMIT_CONFIG[preset];

  switch (scanner) {
    case 'nuclei':
      return [
        '-rate-limit', String(config.nuclei.rateLimit),
        '-bulk-size', String(config.nuclei.bulkSize),
        '-concurrency', String(config.nuclei.concurrency),
      ];
    case 'nikto':
      return [
        '-timeout', String(config.nikto.timeout),
        ...(config.nikto.pause > 0 ? ['-Pause', String(config.nikto.pause)] : []),
      ];
    case 'sqlmap':
      return [
        '--delay', String(config.sqlmap.delay),
        '--threads', String(config.sqlmap.threads),
      ];
    case 'zap':
      // ZAP uses API config, not CLI args
      return [];
    case 'sslyze':
      // SSLyze doesn't need rate limiting
      return [];
    default:
      return [];
  }
}

/**
 * Get rate limit config object for a specific scanner
 */
export function getRateLimitConfig<T extends keyof RateLimitConfig>(
  scanner: T,
  preset: RateLimitPreset,
): RateLimitConfig[T] {
  return RATE_LIMIT_CONFIG[preset][scanner];
}

/**
 * Get human-readable description for a rate limit preset
 */
export function getRateLimitDescription(preset: RateLimitPreset): string {
  switch (preset) {
    case 'low':
      return 'Low (Production Safe - 50 RPS)';
    case 'medium':
      return 'Medium (Staging - 150 RPS)';
    case 'high':
      return 'High (Local Dev - 300 RPS)';
    default:
      return preset;
  }
}
