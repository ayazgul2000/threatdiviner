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

interface ScannerStatus {
  name: string;
  label: string;
  enabled: boolean;
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

      const newScan = await response.json();
      success('Scan triggered', `New scan started for ${scan.repository?.fullName || 'repository'}`);

      // Redirect to new scan page
      window.location.href = `/dashboard/scans/${newScan.id}`;
    } catch (err) {
      console.error('Failed to re-run scan:', err);
      showError('Failed to trigger scan', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRerunning(false);
    }
  };

  const getScannerBreakdown = (): ScannerStatus[] => {
    const scanners: ScannerStatus[] = [
      { name: 'sast', label: 'SAST', enabled: false },
      { name: 'sca', label: 'SCA', enabled: false },
      { name: 'secrets', label: 'Secrets', enabled: false },
      { name: 'iac', label: 'IaC', enabled: false },
      { name: 'dast', label: 'DAST', enabled: false },
    ];

    // Check which scanners ran based on findings
    const scannerTypes = new Set(
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

    return scanners.map((s) => ({
      ...s,
      enabled: scannerTypes.has(s.name) || findings.some((f) => f.scanner.toLowerCase().includes(s.name)),
    }));
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
              <div
                key={scanner.name}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
              >
                {scanner.enabled ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <span className={`font-medium ${scanner.enabled ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                  {scanner.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
