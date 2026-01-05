'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  Button,
  Badge,
  SeverityBadge,
  StatusBadge,
  useToast,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ScannerResult {
  scanner: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  findingsCount: number;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  progress?: number;
}

interface Finding {
  id: string;
  scanner: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  filePath: string;
  startLine?: number;
  cwe?: string[];
  cve?: string[];
  description?: string;
  remediation?: string;
  createdAt: string;
}

interface Scan {
  id: string;
  repositoryId: string;
  branch: string;
  commitSha: string;
  // Backend statuses: pending, queued, cloning, scanning, analyzing, storing, notifying, completed, failed, cancelled
  status: 'pending' | 'queued' | 'cloning' | 'scanning' | 'analyzing' | 'storing' | 'notifying' | 'running' | 'completed' | 'failed' | 'cancelled';
  triggeredBy: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  // findingsCount can be object (new format) or number (legacy)
  findingsCount?: { total: number; critical: number; high: number; medium: number; low: number; info: number } | number;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  infoCount?: number;
  scannerResults?: ScannerResult[];
  repository?: {
    id: string;
    name: string;
    fullName: string;
  };
}

// Scanner metadata
const SCANNER_INFO: Record<string, { name: string; icon: string; description: string }> = {
  semgrep: { name: 'Semgrep', icon: '🔍', description: 'Static code analysis' },
  trivy: { name: 'Trivy', icon: '🛡️', description: 'Dependency vulnerabilities' },
  gitleaks: { name: 'Gitleaks', icon: '🔑', description: 'Secret detection' },
  checkov: { name: 'Checkov', icon: '☁️', description: 'IaC security' },
  nuclei: { name: 'Nuclei', icon: '⚡', description: 'Dynamic testing' },
  zap: { name: 'OWASP ZAP', icon: '🕷️', description: 'Web app scanner' },
};

// Scanner status component with progress
function ScannerStatus({ scanner, isFirst }: { scanner: ScannerResult; isFirst: boolean }) {
  const info = SCANNER_INFO[scanner.scanner] || { name: scanner.scanner, icon: '📊', description: 'Scanner' };
  const isRunning = scanner.status === 'running';
  const isComplete = scanner.status === 'completed';
  const isFailed = scanner.status === 'failed';
  const isPending = scanner.status === 'pending';

  const statusColors = {
    pending: 'text-gray-400 bg-gray-100 dark:bg-gray-800',
    running: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30',
    completed: 'text-green-600 bg-green-50 dark:bg-green-900/30',
    failed: 'text-red-600 bg-red-50 dark:bg-red-900/30',
  };

  const progress = scanner.progress || (isComplete ? 100 : isPending ? 0 : 50);

  return (
    <div className={`border rounded-lg p-4 ${isRunning ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{info.icon}</span>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">{info.name}</div>
            <div className="text-xs text-gray-500">{info.description}</div>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[scanner.status]}`}>
          {isRunning && (
            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse" />
          )}
          {scanner.status.toUpperCase()}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full transition-all duration-500 ${
            isFailed ? 'bg-red-500' :
            isComplete ? 'bg-green-500' :
            isRunning ? 'bg-blue-500 animate-pulse' :
            'bg-gray-400'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Findings summary */}
      {scanner.findingsCount > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{scanner.findingsCount} findings:</span>
          <div className="flex gap-1">
            {(scanner.criticalCount || 0) > 0 && (
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                {scanner.criticalCount} Critical
              </span>
            )}
            {(scanner.highCount || 0) > 0 && (
              <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs">
                {scanner.highCount} High
              </span>
            )}
            {(scanner.mediumCount || 0) > 0 && (
              <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded text-xs">
                {scanner.mediumCount} Medium
              </span>
            )}
            {(scanner.lowCount || 0) > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                {scanner.lowCount} Low
              </span>
            )}
          </div>
        </div>
      )}
      {scanner.findingsCount === 0 && isComplete && (
        <div className="text-sm text-green-600 dark:text-green-400">No issues found</div>
      )}
    </div>
  );
}

// Finding card component
function FindingCard({ finding, isNew }: { finding: Finding; isNew: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const severityColors: Record<string, string> = {
    critical: 'border-l-red-500 bg-red-50 dark:bg-red-900/20',
    high: 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20',
    medium: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
    low: 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20',
    info: 'border-l-gray-500 bg-gray-50 dark:bg-gray-800',
  };

  // Handle case-insensitive severity lookup
  const severityKey = finding.severity?.toLowerCase() || 'info';
  const colorClass = severityColors[severityKey] || severityColors.info;

  return (
    <div
      className={`border-l-4 rounded-r-lg p-3 cursor-pointer transition-all ${colorClass} ${
        isNew ? 'ring-2 ring-blue-500/30 animate-pulse' : ''
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{finding.title}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {finding.filePath}{finding.startLine ? `:${finding.startLine}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" size="sm">{finding.scanner}</Badge>
          <SeverityBadge severity={finding.severity} />
        </div>
      </div>

      {expanded && finding.description && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-300">{finding.description}</p>
          {finding.remediation && (
            <div className="mt-2 text-xs text-gray-500">
              <strong>Fix:</strong> {finding.remediation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScanDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const repoId = params.id as string;
  const scanId = params.scanId as string;
  const { success, error: showError } = useToast();

  // Get requested scanners from URL query params (passed when scan was triggered)
  const requestedScannersParam = searchParams.get('scanners');
  const requestedScanners = requestedScannersParam
    ? decodeURIComponent(requestedScannersParam).split(',')
    : null;

  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [newFindingIds, setNewFindingIds] = useState<Set<string>>(new Set());

  const findingsRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchScan = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/scm/scans/${scanId}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to fetch scan');
      }

      const data = await res.json();
      const scanData = data.scan || data;
      setScan(scanData);

      // Fetch findings
      const findingsRes = await fetch(`${API_URL}/scm/findings?scanId=${scanId}&limit=100`, {
        credentials: 'include',
      });

      if (findingsRes.ok) {
        const findingsData = await findingsRes.json();
        const newFindings = findingsData.findings || findingsData || [];

        // Track new findings for animation
        const newIds = new Set<string>();
        newFindings.forEach((f: Finding) => {
          if (!findingsRef.current.has(f.id)) {
            newIds.add(f.id);
            findingsRef.current.add(f.id);
          }
        });

        if (newIds.size > 0) {
          setNewFindingIds(newIds);
          setTimeout(() => setNewFindingIds(new Set()), 2000);
        }

        setFindings(newFindings);
      }
    } catch (err) {
      console.error('Failed to fetch scan:', err);
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  // Initial fetch
  useEffect(() => {
    fetchScan();
  }, [fetchScan]);

  // Polling for running scans - more frequent updates
  useEffect(() => {
    // Always poll initially and while scan is in progress
    // Backend uses these statuses: pending, queued, cloning, scanning, analyzing, storing, notifying, completed, failed
    const inProgressStatuses = ['pending', 'queued', 'cloning', 'scanning', 'analyzing', 'storing', 'notifying', 'running'];
    const isInProgress = !scan || inProgressStatuses.includes(scan.status);

    if (isInProgress) {
      // Clear any existing interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      // Poll every 2 seconds for more responsive updates
      pollIntervalRef.current = setInterval(fetchScan, 2000);
    } else {
      // Scan complete, stop polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [scan?.status, fetchScan]);

  // Elapsed time counter
  useEffect(() => {
    if (!scan?.startedAt || scan.status === 'completed' || scan.status === 'failed') {
      if (scan?.duration) {
        setElapsedTime(Math.floor(scan.duration / 1000));
      }
      return;
    }

    const startTime = new Date(scan.startedAt).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      setElapsedTime(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [scan?.startedAt, scan?.status, scan?.duration]);

  const formatElapsedTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get scanner results with defaults for pending scanners
  const getScannerResults = (): ScannerResult[] => {
    if (scan?.scannerResults && scan.scannerResults.length > 0) {
      // Deduplicate by scanner name, keeping the most recent (last) entry for each scanner
      const scannerMap = new Map<string, ScannerResult>();
      for (const result of scan.scannerResults) {
        scannerMap.set(result.scanner, result);
      }
      return Array.from(scannerMap.values());
    }
    // Use scanners from URL params if available, otherwise show defaults
    const scannersToShow = requestedScanners || ['semgrep', 'trivy', 'gitleaks'];
    return scannersToShow.map(scanner => ({
      scanner,
      status: 'pending' as const,
      findingsCount: 0,
    }));
  };

  const scannerResults = getScannerResults();

  // Calculate totals from scanner results (more accurate during scan)
  const scannerFindingsTotal = scannerResults.reduce((sum, s) => sum + (s.findingsCount || 0), 0);
  const scannerCriticalTotal = scannerResults.reduce((sum, s) => sum + (s.criticalCount || 0), 0);
  const scannerHighTotal = scannerResults.reduce((sum, s) => sum + (s.highCount || 0), 0);
  const scannerMediumTotal = scannerResults.reduce((sum, s) => sum + (s.mediumCount || 0), 0);
  const scannerLowTotal = scannerResults.reduce((sum, s) => sum + (s.lowCount || 0), 0);

  // Handle both object format (findingsCount.total) and number format
  // Use scannerResults total as fallback since findings are stored at end of scan
  const totalFindings = scannerFindingsTotal > 0
    ? scannerFindingsTotal
    : (typeof scan?.findingsCount === 'object'
        ? scan.findingsCount.total
        : (scan?.findingsCount || findings.length));

  // Use scanner totals as fallback for severity counts
  const criticalCount = scannerCriticalTotal > 0 ? scannerCriticalTotal : (scan?.criticalCount || 0);
  const highCount = scannerHighTotal > 0 ? scannerHighTotal : (scan?.highCount || 0);
  const mediumCount = scannerMediumTotal > 0 ? scannerMediumTotal : (scan?.mediumCount || 0);
  const lowCount = scannerLowTotal > 0 ? scannerLowTotal : (scan?.lowCount || 0);
  // Backend uses these statuses: pending, queued, cloning, scanning, analyzing, storing, notifying, completed, failed
  const runningStatuses = ['pending', 'queued', 'cloning', 'scanning', 'analyzing', 'storing', 'notifying', 'running'];
  const isRunning = scan?.status ? runningStatuses.includes(scan.status) : false;
  const isCompleted = scan?.status === 'completed';
  const isFailed = scan?.status === 'failed';

  // Count scanners by status
  const completedScanners = scannerResults.filter(s => s.status === 'completed').length;
  const runningScanners = scannerResults.filter(s => s.status === 'running').length;
  const totalScanners = scannerResults.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-4">Loading scan...</p>
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Scan not found</p>
          <Link href={`/dashboard/repositories/${repoId}`}>
            <Button variant="outline" className="mt-4">Back to Repository</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/repositories/${repoId}`}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {scan.repository?.fullName || 'Scan Details'}
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{scan.branch}</code>
                <span className="font-mono text-xs">{scan.commitSha?.substring(0, 7)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Elapsed Time */}
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                {formatElapsedTime(elapsedTime)}
              </div>
              <div className="text-xs text-gray-500">
                {isRunning ? 'Elapsed' : 'Duration'}
              </div>
            </div>

            {/* Status Badge */}
            <StatusBadge status={scan.status} />
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      {isRunning && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {scan?.status === 'cloning' && 'Cloning repository...'}
              {scan?.status === 'scanning' && 'Running security scanners...'}
              {scan?.status === 'analyzing' && 'Analyzing results...'}
              {scan?.status === 'storing' && 'Storing findings...'}
              {scan?.status === 'notifying' && 'Sending notifications...'}
              {(scan?.status === 'pending' || scan?.status === 'queued' || scan?.status === 'running') && 'Scan in progress...'}
            </span>
            <span className="text-sm text-blue-600 dark:text-blue-300">
              {completedScanners}/{totalScanners} scanners complete
            </span>
          </div>
          <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(completedScanners / totalScanners) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Left: Scanner Checklist */}
        <div className="col-span-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Scanner Status
          </h2>

          <div className="space-y-3">
            {scannerResults.map((scanner, idx) => (
              <ScannerStatus key={scanner.scanner} scanner={scanner} isFirst={idx === 0} />
            ))}
          </div>

          {/* Summary Card */}
          <Card variant="bordered" className="mt-6">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                  {totalFindings}
                </div>
                <div className="text-sm text-gray-500 mb-4">Total Findings</div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-red-600">{criticalCount}</div>
                    <div className="text-xs text-gray-500">Critical</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-orange-500">{highCount}</div>
                    <div className="text-xs text-gray-500">High</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-yellow-500">{mediumCount}</div>
                    <div className="text-xs text-gray-500">Medium</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-500">{lowCount}</div>
                    <div className="text-xs text-gray-500">Low</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {!isRunning && (
            <div className="flex gap-3">
              <Link href={`/dashboard/scans/${scan.id}`} className="flex-1">
                <Button variant="primary" className="w-full">
                  View Full Report
                </Button>
              </Link>
              <Button variant="outline">
                Export SARIF
              </Button>
            </div>
          )}
        </div>

        {/* Right: Findings Stream */}
        <div className="col-span-7">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Findings
            </h2>
            {isRunning && (
              <span className="flex items-center gap-2 text-sm text-blue-600">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Live updates
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {findings.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {isRunning ? (
                  <>
                    <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto" />
                    <p className="mt-3">Scanning for vulnerabilities...</p>
                  </>
                ) : (
                  <p>No findings detected</p>
                )}
              </div>
            ) : (
              findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  isNew={newFindingIds.has(finding.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
