'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  SeverityBadge,
  StatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useProject } from '@/contexts/project-context';
import { API_URL, scansApi, findingsApi, type Scan, type Finding } from '@/lib/api';

type ScanStatus = 'queued' | 'running' | 'completed' | 'failed';

interface ScannerResult {
  id: string;
  scanId: string;
  scanner: string;
  category: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  exitCode: number | null;
  duration: number | null;
  findingsCount: number;
  errorMessage: string | null;
  command: string | null;
  targetInfo: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface ScannerStatus {
  name: string;
  label: string;
  enabled: boolean;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  results?: ScannerResult[];
}

export default function ScanDetailPage() {
  const params = useParams();
  const scanId = params.id as string;
  const { currentProject } = useProject();
  const { success, error: showError } = useToast();

  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [selectedScanner, setSelectedScanner] = useState<ScannerStatus | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [scanData, findingsData] = await Promise.all([
          scansApi.get(scanId),
          findingsApi.list({ scanId }),
        ]);
        setScan(scanData);
        setFindings(findingsData.findings || []);
      } catch (err) {
        console.error('Failed to fetch scan data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load scan');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [scanId]);

  const formatDuration = (ms: number | null): string => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const getStatusForBadge = (status: string): 'pending' | 'running' | 'completed' | 'failed' => {
    const statusMap: Record<string, 'pending' | 'running' | 'completed' | 'failed'> = {
      queued: 'pending',
      pending: 'pending',
      running: 'running',
      completed: 'completed',
      failed: 'failed',
      cancelled: 'failed',
    };
    return statusMap[status.toLowerCase()] || 'pending';
  };

  const rerunScan = async () => {
    if (!scan?.repositoryId) return;

    setRerunning(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/scm/scans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ repositoryId: scan.repositoryId }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger scan');
      }

      const result = await response.json();
      const newScanId = result.scanId || result.id;

      success('Scan triggered', `New scan started for ${scan.repository?.fullName || 'repository'}`);

      // Redirect to new scan page
      if (newScanId) {
        window.location.href = `/dashboard/scans/${newScanId}`;
      }
    } catch (err) {
      console.error('Failed to re-run scan:', err);
      showError('Failed to trigger scan', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRerunning(false);
    }
  };

  const getScannerBreakdown = (): ScannerStatus[] => {
    // Get scan config and scanner results from the scan
    const scanConfig = (scan?.repository as any)?.scanConfig;
    const scannerResults: ScannerResult[] = (scan as any)?.scannerResults || [];

    // Group scanner results by category
    const resultsByCategory: Record<string, ScannerResult[]> = {};
    for (const result of scannerResults) {
      if (!resultsByCategory[result.category]) {
        resultsByCategory[result.category] = [];
      }
      resultsByCategory[result.category].push(result);
    }

    // Determine aggregate status for each category
    const getCategoryStatus = (results: ScannerResult[]): ScannerStatus['status'] => {
      if (!results || results.length === 0) return undefined;
      if (results.some(r => r.status === 'running')) return 'running';
      if (results.some(r => r.status === 'pending')) return 'pending';
      if (results.every(r => r.status === 'skipped')) return 'skipped';
      if (results.some(r => r.status === 'failed')) return 'failed';
      if (results.every(r => r.status === 'completed')) return 'completed';
      return 'completed';
    };

    const scanners: ScannerStatus[] = [
      {
        name: 'sast',
        label: 'SAST',
        enabled: scanConfig?.enableSast ?? false,
        status: getCategoryStatus(resultsByCategory['sast']),
        results: resultsByCategory['sast'],
      },
      {
        name: 'sca',
        label: 'SCA',
        enabled: scanConfig?.enableSca ?? false,
        status: getCategoryStatus(resultsByCategory['sca']),
        results: resultsByCategory['sca'],
      },
      {
        name: 'secrets',
        label: 'Secrets',
        enabled: scanConfig?.enableSecrets ?? false,
        status: getCategoryStatus(resultsByCategory['secrets']),
        results: resultsByCategory['secrets'],
      },
      {
        name: 'iac',
        label: 'IaC',
        enabled: scanConfig?.enableIac ?? false,
        status: getCategoryStatus(resultsByCategory['iac']),
        results: resultsByCategory['iac'],
      },
      {
        name: 'dast',
        label: 'DAST',
        enabled: scanConfig?.enableDast ?? false,
        status: getCategoryStatus(resultsByCategory['dast']),
        results: resultsByCategory['dast'],
      },
    ];

    // Also check findings to catch any scanners that produced results (for backward compatibility)
    const scannerTypesFromFindings = new Set(
      findings.map((f) => {
        const scanner = f.scanner.toLowerCase();
        if (scanner.includes('semgrep') || scanner.includes('bandit') || scanner.includes('gosec')) return 'sast';
        if (scanner.includes('trivy') || scanner.includes('dependency')) return 'sca';
        if (scanner.includes('gitleaks') || scanner.includes('secret')) return 'secrets';
        if (scanner.includes('checkov') || scanner.includes('terraform') || scanner.includes('cloudformation')) return 'iac';
        if (scanner.includes('nuclei') || scanner.includes('zap') || scanner.includes('nikto') || scanner.includes('sqlmap')) return 'dast';
        return scanner;
      })
    );

    // Enable if configured OR if there are findings/results from that scanner type
    return scanners.map((s) => ({
      ...s,
      enabled: !!(s.enabled || scannerTypesFromFindings.has(s.name) || (s.results && s.results.length > 0)),
    }));
  };

  const formatDurationMs = (ms: number | null): string => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const getStatusIcon = (status?: ScannerStatus['status']) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'running':
        return (
          <svg className="animate-spin w-5 h-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'skipped':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'pending':
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
    }
  };

  const getStatusLabel = (status?: ScannerStatus['status']): string => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'running': return 'Running';
      case 'failed': return 'Failed';
      case 'skipped': return 'Skipped';
      case 'pending': return 'Pending';
      default: return 'Not Run';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading scan details...</div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error || 'Scan not found'}
        </div>
        <Link href="/dashboard/scans" className="text-blue-600 hover:text-blue-700">
          Back to Scans
        </Link>
      </div>
    );
  }

  const totalFindings = scan.findingsCount?.total || 0;
  const criticalCount = scan.findingsCount?.critical || 0;
  const highCount = scan.findingsCount?.high || 0;
  const mediumCount = scan.findingsCount?.medium || 0;

  const scannerBreakdown = getScannerBreakdown();

  const breadcrumbs = [
    { label: currentProject?.name || 'Project', href: '/dashboard' },
    { label: 'Scans', href: '/dashboard/scans' },
    { label: scan.branch || 'main' },
  ];

  const metadata: Record<string, string> = {
    Repository: scan.repository?.fullName || 'Unknown',
    Branch: scan.branch || 'main',
    Commit: scan.commitSha?.substring(0, 7) || '-',
    Duration: formatDuration(scan.duration),
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`${scan.branch || 'main'} @ ${scan.commitSha?.substring(0, 7) || '-'}`}
        backHref="/dashboard/scans"
        breadcrumbs={breadcrumbs}
        context={{
          type: 'scan',
          status: scan.status,
          metadata,
        }}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (scan.repository?.connection) {
                  const provider = scan.repository.connection.provider;
                  const fullName = scan.repository.fullName;
                  let url = '';
                  if (provider === 'github') {
                    url = `https://github.com/${fullName}`;
                  } else if (provider === 'gitlab') {
                    url = `https://gitlab.com/${fullName}`;
                  } else if (provider === 'bitbucket') {
                    url = `https://bitbucket.org/${fullName}`;
                  }
                  if (url) window.open(url, '_blank');
                }
              }}
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Repository
            </Button>
            <Button onClick={rerunScan} disabled={rerunning} loading={rerunning}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {rerunning ? 'Starting...' : 'Re-run Scan'}
            </Button>
          </>
        }
      />

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="bordered">
          <CardContent>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total Findings</span>
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{totalFindings}</span>
            </div>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500 dark:text-gray-400">Critical</span>
              <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{criticalCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500 dark:text-gray-400">High</span>
              <span className="text-3xl font-bold text-red-600 dark:text-red-400">{highCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500 dark:text-gray-400">Medium</span>
              <span className="text-3xl font-bold text-orange-600 dark:text-orange-400">{mediumCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scanner Breakdown */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Scanner Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {scannerBreakdown.map((scanner) => (
              <button
                key={scanner.name}
                onClick={() => scanner.enabled && scanner.results?.length ? setSelectedScanner(scanner) : null}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  scanner.enabled && scanner.results?.length
                    ? 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
                    : 'bg-gray-50 dark:bg-gray-800 cursor-default'
                }`}
              >
                {getStatusIcon(scanner.status)}
                <div className="flex flex-col items-start">
                  <span className={`font-medium ${scanner.enabled ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                    {scanner.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    {getStatusLabel(scanner.status)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scanner Details Modal */}
      {selectedScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedScanner(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedScanner.label} Scanner Details
              </h3>
              <button
                onClick={() => setSelectedScanner(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
              {selectedScanner.results?.map((result) => (
                <div key={result.id} className="mb-4 last:mb-0 p-4 border dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span className="font-medium text-gray-900 dark:text-white capitalize">{result.scanner}</span>
                      <Badge variant={result.status === 'completed' ? 'success' : result.status === 'failed' ? 'danger' : 'default'}>
                        {result.status}
                      </Badge>
                    </div>
                    <span className="text-sm text-gray-500">
                      {result.findingsCount} finding{result.findingsCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Exit Code:</span>
                      <span className={`ml-2 font-mono ${result.exitCode === 0 ? 'text-green-600' : result.exitCode === 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {result.exitCode ?? '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Duration:</span>
                      <span className="ml-2 font-mono text-gray-900 dark:text-white">
                        {formatDurationMs(result.duration)}
                      </span>
                    </div>
                    {result.startedAt && (
                      <div>
                        <span className="text-gray-500">Started:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">
                          {new Date(result.startedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                    {result.completedAt && (
                      <div>
                        <span className="text-gray-500">Completed:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">
                          {new Date(result.completedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                  {result.targetInfo && (
                    <div className="mt-3">
                      <span className="text-sm text-gray-500">Target Info:</span>
                      <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                        {(() => {
                          try {
                            const parsed = JSON.parse(result.targetInfo);
                            return Array.isArray(parsed) ? parsed.join(', ') : result.targetInfo;
                          } catch {
                            return result.targetInfo;
                          }
                        })()}
                      </pre>
                    </div>
                  )}
                  {result.errorMessage && (
                    <div className="mt-3">
                      <span className="text-sm text-red-500">Error:</span>
                      <pre className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400 overflow-x-auto">
                        {result.errorMessage}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
              {(!selectedScanner.results || selectedScanner.results.length === 0) && (
                <div className="text-center text-gray-500 py-8">
                  No detailed results available for this scanner category.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Findings List */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Findings from this Scan</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Severity</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Scanner</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.length === 0 ? (
                <TableEmpty colSpan={5} message="No findings in this scan." />
              ) : (
                findings.map((finding) => (
                  <TableRow key={finding.id}>
                    <TableCell>
                      <SeverityBadge severity={finding.severity} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/findings/${finding.id}`}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                      >
                        {finding.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{finding.scanner}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-gray-600 dark:text-gray-400">
                        {finding.filePath}:{finding.startLine}
                      </code>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={finding.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
