'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  SeverityBadge,
  StatusBadge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from '@/components/ui';
import { scansApi, findingsApi, reportsApi, type Scan, type Finding } from '@/lib/api';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type ScannerType = 'all' | 'sast' | 'sca' | 'secrets' | 'iac' | 'dast';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
  info: '#2563eb',
};

const SCANNER_LABELS: Record<string, string> = {
  semgrep: 'SAST (Semgrep)',
  trivy: 'SCA (Trivy)',
  gitleaks: 'Secrets (Gitleaks)',
  trufflehog: 'Secrets (TruffleHog)',
  checkov: 'IaC (Checkov)',
  nuclei: 'DAST (Nuclei)',
  zap: 'DAST (ZAP)',
};

const SCANNER_TO_TYPE: Record<string, ScannerType> = {
  semgrep: 'sast',
  trivy: 'sca',
  gitleaks: 'secrets',
  trufflehog: 'secrets',
  checkov: 'iac',
  nuclei: 'dast',
  zap: 'dast',
};

export default function ScanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const scanId = params.id as string;

  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ScannerType>('all');
  const [rerunning, setRerunning] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
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

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case 'push': return 'Push to branch';
      case 'pull_request': return 'Pull Request';
      case 'manual': return 'Manual trigger';
      case 'schedule': return 'Scheduled scan';
      default: return trigger;
    }
  };

  // Group findings by scanner type
  const findingsByScanner = findings.reduce((acc, finding) => {
    const scanner = finding.scanner.toLowerCase();
    if (!acc[scanner]) acc[scanner] = [];
    acc[scanner].push(finding);
    return acc;
  }, {} as Record<string, Finding[]>);

  // Filter findings by active tab
  const filteredFindings = activeTab === 'all'
    ? findings
    : findings.filter(f => SCANNER_TO_TYPE[f.scanner.toLowerCase()] === activeTab);

  // Severity data for pie chart
  const severityData = [
    { name: 'Critical', value: scan?.findingsCount?.critical || 0, color: SEVERITY_COLORS.critical },
    { name: 'High', value: scan?.findingsCount?.high || 0, color: SEVERITY_COLORS.high },
    { name: 'Medium', value: scan?.findingsCount?.medium || 0, color: SEVERITY_COLORS.medium },
    { name: 'Low', value: scan?.findingsCount?.low || 0, color: SEVERITY_COLORS.low },
    { name: 'Info', value: scan?.findingsCount?.info || 0, color: SEVERITY_COLORS.info },
  ].filter(d => d.value > 0);

  // Scanner data for bar chart
  const scannerData = Object.entries(findingsByScanner).map(([scanner, scannerFindings]) => ({
    name: SCANNER_LABELS[scanner] || scanner,
    count: scannerFindings.length,
    critical: scannerFindings.filter(f => f.severity === 'critical').length,
    high: scannerFindings.filter(f => f.severity === 'high').length,
    medium: scannerFindings.filter(f => f.severity === 'medium').length,
    low: scannerFindings.filter(f => f.severity === 'low').length,
  }));

  const handleRerunScan = async () => {
    if (!scan?.repositoryId) return;
    setRerunning(true);
    try {
      const newScan = await scansApi.trigger(scan.repositoryId, scan.branch);
      router.push(`/dashboard/scans/${newScan.id}`);
    } catch (err) {
      console.error('Failed to re-run scan:', err);
      setError('Failed to trigger scan');
    } finally {
      setRerunning(false);
    }
  };

  const handleDownloadReport = () => {
    window.open(reportsApi.getScanReport(scanId), '_blank');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/scans"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Scan Details
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {scan.repository?.fullName || 'Unknown repository'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleDownloadReport}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Report
          </Button>
          <Button onClick={handleRerunScan} disabled={rerunning}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {rerunning ? 'Starting...' : 'Re-run Scan'}
          </Button>
        </div>
      </div>

      {/* Metadata Card */}
      <Card variant="bordered">
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Repository</p>
              <Link
                href={`/dashboard/repositories/${scan.repositoryId}`}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
              >
                {scan.repository?.fullName || 'Unknown'}
              </Link>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Branch</p>
              <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {scan.branch || 'main'}
              </code>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Commit SHA</p>
              <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {scan.commitSha?.substring(0, 7) || '-'}
              </code>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
              <StatusBadge status={scan.status} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatDuration(scan.duration)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Triggered By</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {getTriggerLabel(scan.trigger)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Severity Summary */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Severity Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600"></span>
              <span className="text-gray-700 dark:text-gray-300">Critical</span>
              <span className="font-bold text-red-600">{scan.findingsCount?.critical || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span>
              <span className="text-gray-700 dark:text-gray-300">High</span>
              <span className="font-bold text-orange-500">{scan.findingsCount?.high || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span className="text-gray-700 dark:text-gray-300">Medium</span>
              <span className="font-bold text-yellow-500">{scan.findingsCount?.medium || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-gray-700 dark:text-gray-300">Low</span>
              <span className="font-bold text-green-500">{scan.findingsCount?.low || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-gray-700 dark:text-gray-300">Info</span>
              <span className="font-bold text-blue-500">{scan.findingsCount?.info || 0}</span>
            </div>
            <div className="ml-auto text-gray-500 dark:text-gray-400">
              Total: <span className="font-bold text-gray-900 dark:text-white">{scan.findingsCount?.total || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      {(severityData.length > 0 || scannerData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Severity Pie Chart */}
          {severityData.length > 0 && (
            <Card variant="bordered">
              <CardHeader>
                <CardTitle>Findings by Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {severityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scanner Bar Chart */}
          {scannerData.length > 0 && (
            <Card variant="bordered">
              <CardHeader>
                <CardTitle>Findings by Scanner</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scannerData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="critical" stackId="a" fill={SEVERITY_COLORS.critical} name="Critical" />
                      <Bar dataKey="high" stackId="a" fill={SEVERITY_COLORS.high} name="High" />
                      <Bar dataKey="medium" stackId="a" fill={SEVERITY_COLORS.medium} name="Medium" />
                      <Bar dataKey="low" stackId="a" fill={SEVERITY_COLORS.low} name="Low" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Scanner Tabs */}
      <Card variant="bordered">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Findings</CardTitle>
            <div className="flex items-center gap-2 overflow-x-auto">
              {(['all', 'sast', 'sca', 'secrets', 'iac', 'dast'] as ScannerType[]).map((tab) => {
                const count = tab === 'all'
                  ? findings.length
                  : findings.filter(f => SCANNER_TO_TYPE[f.scanner.toLowerCase()] === tab).length;
                const labels: Record<ScannerType, string> = {
                  all: 'All',
                  sast: 'SAST',
                  sca: 'SCA',
                  secrets: 'Secrets',
                  iac: 'IaC',
                  dast: 'DAST',
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                      activeTab === tab
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {labels[tab]} ({count})
                  </button>
                );
              })}
            </div>
          </div>
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
              {filteredFindings.length === 0 ? (
                <TableEmpty colSpan={5} message="No findings for this scanner type." />
              ) : (
                filteredFindings.map((finding) => (
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
                      <Badge variant="outline">
                        {SCANNER_LABELS[finding.scanner.toLowerCase()] || finding.scanner}
                      </Badge>
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
