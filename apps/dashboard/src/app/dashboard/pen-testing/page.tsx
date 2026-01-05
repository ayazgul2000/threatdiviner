'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  SeverityBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { API_URL } from '@/lib/api';

interface PenTestTarget {
  id: string;
  name: string;
  url: string;
  type: 'web' | 'api' | 'network';
  description?: string;
  isActive: boolean;
  lastScanAt?: string;
  scanCount: number;
  lastScan?: {
    id: string;
    status: string;
    findingsCount: number;
    criticalCount: number;
    highCount: number;
    completedAt?: string;
  } | null;
  createdAt: string;
}

interface PenTestScan {
  id: string;
  targetId: string;
  status: string;
  scanners: string[];
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  errorMessage?: string;
  target: {
    id: string;
    name: string;
    url: string;
    type: string;
  };
}

interface PenTestFinding {
  id: string;
  scanId: string;
  scanner: string;
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: string;
  title: string;
  description?: string;
  url?: string;
  parameter?: string;
  payload?: string;
  evidence?: string;
  cweIds: string[];
  cveIds: string[];
  owaspIds: string[];
  remediation?: string;
  status: string;
  scan?: {
    id: string;
    target: {
      id: string;
      name: string;
      url: string;
    };
  };
}

interface ScannerStatus {
  available: boolean;
  version: string | null;
}

const SCANNER_OPTIONS = [
  { id: 'sqlmap', name: 'SQLMap', description: 'SQL injection testing', type: 'web' },
  { id: 'sslyze', name: 'SSLyze', description: 'TLS/SSL configuration analysis', type: 'network' },
  { id: 'nikto', name: 'Nikto', description: 'Web server misconfiguration scanner', type: 'web' },
  { id: 'zap', name: 'OWASP ZAP', description: 'Full web application security scan', type: 'web' },
  { id: 'nuclei', name: 'Nuclei', description: 'Template-based vulnerability scanner', type: 'web' },
];

export default function PenTestingPage() {
  const { success, error: showError } = useToast();

  const [targets, setTargets] = useState<PenTestTarget[]>([]);
  const [scans, setScans] = useState<PenTestScan[]>([]);
  const [findings, setFindings] = useState<PenTestFinding[]>([]);
  const [scannerStatus, setScannerStatus] = useState<Record<string, ScannerStatus>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'targets' | 'scans' | 'findings'>('targets');

  // New target form
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [newTarget, setNewTarget] = useState<{ name: string; url: string; type: 'web' | 'api' | 'network'; description: string }>({ name: '', url: '', type: 'web', description: '' });
  const [saving, setSaving] = useState(false);

  // Scan modal
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<PenTestTarget | null>(null);
  const [selectedScanners, setSelectedScanners] = useState<string[]>(['sqlmap']);

  // Finding detail modal
  const [selectedFinding, setSelectedFinding] = useState<PenTestFinding | null>(null);

  const fetchTargets = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/pentest/targets`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch targets');
      const data = await res.json();
      setTargets(data);
    } catch (err) {
      console.error('Failed to fetch targets:', err);
    }
  }, []);

  const fetchScans = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/pentest/scans`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch scans');
      const data = await res.json();
      setScans(data);
    } catch (err) {
      console.error('Failed to fetch scans:', err);
    }
  }, []);

  const fetchFindings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/pentest/findings`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch findings');
      const data = await res.json();
      setFindings(data);
    } catch (err) {
      console.error('Failed to fetch findings:', err);
    }
  }, []);

  const fetchScannerStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/pentest/scanners/status`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch scanner status');
      const data = await res.json();
      setScannerStatus(data);
    } catch (err) {
      console.error('Failed to fetch scanner status:', err);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchTargets(), fetchScans(), fetchFindings(), fetchScannerStatus()]);
      setLoading(false);
    };
    fetchData();
  }, [fetchTargets, fetchScans, fetchFindings, fetchScannerStatus]);

  // Poll for scan updates when there are running scans
  useEffect(() => {
    const hasRunningScans = scans.some(s => s.status === 'pending' || s.status === 'running');
    if (!hasRunningScans) return;

    const interval = setInterval(() => {
      fetchScans();
      fetchFindings();
      fetchTargets();
    }, 5000);

    return () => clearInterval(interval);
  }, [scans, fetchScans, fetchFindings, fetchTargets]);

  const addTarget = async () => {
    if (!newTarget.name || !newTarget.url) {
      showError('Validation Error', 'Name and URL are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/pentest/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newTarget),
      });

      if (!res.ok) throw new Error('Failed to create target');

      const created = await res.json();
      setTargets([created, ...targets]);
      setNewTarget({ name: '', url: '', type: 'web', description: '' });
      setShowAddTarget(false);
      success('Target Added', `${created.name} has been added to your targets`);
    } catch (err) {
      showError('Error', 'Failed to add target');
    } finally {
      setSaving(false);
    }
  };

  const removeTarget = async (targetId: string) => {
    try {
      const res = await fetch(`${API_URL}/pentest/targets/${targetId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to delete target');

      setTargets(targets.filter(t => t.id !== targetId));
      success('Target Removed', 'Target has been removed');
    } catch (err) {
      showError('Error', 'Failed to remove target');
    }
  };

  const openScanModal = (target: PenTestTarget) => {
    setSelectedTarget(target);
    // Pre-select available scanners
    const availableScanners = Object.entries(scannerStatus)
      .filter(([, status]) => status.available)
      .map(([name]) => name);
    setSelectedScanners(availableScanners.length > 0 ? [availableScanners[0]] : []);
    setShowScanModal(true);
  };

  const runPenTest = async () => {
    if (!selectedTarget || selectedScanners.length === 0) return;

    try {
      const res = await fetch(`${API_URL}/pentest/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetId: selectedTarget.id,
          scanners: selectedScanners,
        }),
      });

      if (!res.ok) throw new Error('Failed to start scan');

      const scan = await res.json();
      setScans([scan, ...scans]);
      setShowScanModal(false);
      success('Pen Test Started', `Running ${selectedScanners.join(', ')} against ${selectedTarget.name}`);

      // Refresh targets to show scanning status
      fetchTargets();
    } catch (err) {
      showError('Error', 'Failed to start pen test');
    }
  };

  const toggleScanner = (scannerId: string) => {
    setSelectedScanners(prev =>
      prev.includes(scannerId)
        ? prev.filter(s => s !== scannerId)
        : [...prev, scannerId]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'running':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getTargetStatus = (target: PenTestTarget) => {
    // Check if there's a running scan for this target
    const runningScan = scans.find(s => s.targetId === target.id && (s.status === 'pending' || s.status === 'running'));
    if (runningScan) return 'scanning';
    if (target.lastScan?.status === 'completed') return 'completed';
    if (target.lastScan?.status === 'failed') return 'failed';
    return 'idle';
  };

  const breadcrumbs = [
    { label: 'Security Analysis', href: '/dashboard' },
    { label: 'Penetration Testing' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Penetration Testing"
        description="On-demand security testing for web applications and APIs"
        breadcrumbs={breadcrumbs}
        actions={
          <Button onClick={() => setShowAddTarget(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Target
          </Button>
        }
      />

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {(['targets', 'scans', 'findings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab}
              {tab === 'targets' && targets.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700">
                  {targets.length}
                </span>
              )}
              {tab === 'scans' && scans.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700">
                  {scans.length}
                </span>
              )}
              {tab === 'findings' && findings.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700">
                  {findings.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Targets Tab */}
      {activeTab === 'targets' && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Target Environments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Last Scan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.length === 0 ? (
                  <TableEmpty colSpan={6} message="No targets configured. Add a target to begin penetration testing." />
                ) : (
                  targets.map((target) => {
                    const status = getTargetStatus(target);
                    return (
                      <TableRow key={target.id}>
                        <TableCell className="font-medium">{target.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {target.url}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{target.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {target.lastScanAt ? new Date(target.lastScanAt).toLocaleDateString() : '-'}
                          {target.lastScan && target.lastScan.findingsCount > 0 && (
                            <span className="ml-2 text-xs text-gray-500">({target.lastScan.findingsCount} findings)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(status)}`}>
                            {status === 'scanning' && (
                              <svg className="inline w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            )}
                            {status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => openScanModal(target)}
                              disabled={status === 'scanning'}
                            >
                              Run Pen Test
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeTarget(target.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Scans Tab */}
      {activeTab === 'scans' && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Scan History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Target</TableHead>
                  <TableHead>Scanner(s)</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Findings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.length === 0 ? (
                  <TableEmpty colSpan={6} message="No scans yet. Run a pen test to see results here." />
                ) : (
                  scans.map((scan) => (
                    <TableRow key={scan.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{scan.target.name}</div>
                          <code className="text-xs text-gray-500">{scan.target.url}</code>
                        </div>
                      </TableCell>
                      <TableCell>{scan.scanners.join(', ')}</TableCell>
                      <TableCell>
                        {scan.startedAt ? new Date(scan.startedAt).toLocaleString() : 'Pending'}
                      </TableCell>
                      <TableCell>
                        {scan.duration ? `${scan.duration}s` : '-'}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(scan.status)}`}>
                          {(scan.status === 'pending' || scan.status === 'running') && (
                            <svg className="inline w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          )}
                          {scan.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {scan.criticalCount > 0 && (
                            <SeverityBadge severity="critical">{scan.criticalCount}</SeverityBadge>
                          )}
                          {scan.highCount > 0 && (
                            <SeverityBadge severity="high">{scan.highCount}</SeverityBadge>
                          )}
                          {scan.mediumCount > 0 && (
                            <SeverityBadge severity="medium">{scan.mediumCount}</SeverityBadge>
                          )}
                          {scan.lowCount > 0 && (
                            <SeverityBadge severity="low">{scan.lowCount}</SeverityBadge>
                          )}
                          {scan.findingsCount === 0 && scan.status === 'completed' && (
                            <span className="text-xs text-gray-500">No findings</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Findings Tab */}
      {activeTab === 'findings' && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Pen Test Findings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Severity</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Scanner</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {findings.length === 0 ? (
                  <TableEmpty colSpan={5} message="No findings yet. Run a pen test to discover vulnerabilities." />
                ) : (
                  findings.map((finding) => (
                    <TableRow
                      key={finding.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedFinding(finding)}
                    >
                      <TableCell>
                        <SeverityBadge severity={finding.severity} />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{finding.title}</div>
                          {finding.description && (
                            <div className="text-xs text-gray-500 truncate max-w-xs">{finding.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{finding.scanner}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{finding.url || '-'}</code>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                          finding.status === 'open' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                          finding.status === 'confirmed' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                          finding.status === 'false_positive' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
                          'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        }`}>
                          {finding.status.replace('_', ' ')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Target Modal */}
      {showAddTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Target Environment</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newTarget.name}
                  onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  placeholder="Staging API"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <input
                  type="url"
                  value={newTarget.url}
                  onChange={(e) => setNewTarget({ ...newTarget, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  placeholder="https://staging.example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={newTarget.type}
                  onChange={(e) => setNewTarget({ ...newTarget, type: e.target.value as 'web' | 'api' | 'network' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                >
                  <option value="web">Web Application</option>
                  <option value="api">API</option>
                  <option value="network">Network Service</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description (optional)</label>
                <textarea
                  value={newTarget.description}
                  onChange={(e) => setNewTarget({ ...newTarget, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  placeholder="Optional description..."
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowAddTarget(false)} disabled={saving}>Cancel</Button>
              <Button onClick={addTarget} disabled={saving}>
                {saving ? 'Adding...' : 'Add Target'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Run Scan Modal */}
      {showScanModal && selectedTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-2">Run Penetration Test</h3>
            <p className="text-sm text-gray-500 mb-4">
              Target: <span className="font-medium">{selectedTarget.name}</span> ({selectedTarget.url})
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Scanners</label>
              <div className="space-y-2">
                {SCANNER_OPTIONS.map((scanner) => {
                  const status = scannerStatus[scanner.id];
                  const isAvailable = status?.available;
                  return (
                    <label
                      key={scanner.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedScanners.includes(scanner.id)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedScanners.includes(scanner.id)}
                        onChange={() => toggleScanner(scanner.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="ml-3">
                        <div className="font-medium">
                          {scanner.name}
                          {!isAvailable && (
                            <span className="ml-2 text-xs text-orange-500">(not installed)</span>
                          )}
                          {isAvailable && status.version && (
                            <span className="ml-2 text-xs text-gray-400">v{status.version}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{scanner.description}</div>
                      </div>
                      <Badge variant="outline" className="ml-auto capitalize">{scanner.type}</Badge>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> Only run penetration tests against systems you have authorization to test.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowScanModal(false)}>Cancel</Button>
              <Button onClick={runPenTest} disabled={selectedScanners.length === 0}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Pen Test
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Finding Detail Modal */}
      {selectedFinding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={selectedFinding.severity} />
                  <Badge variant="outline">{selectedFinding.scanner}</Badge>
                  <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${
                    selectedFinding.status === 'open' ? 'bg-yellow-100 text-yellow-700' :
                    selectedFinding.status === 'confirmed' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedFinding.status.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="text-lg font-semibold">{selectedFinding.title}</h3>
              </div>
              <button
                onClick={() => setSelectedFinding(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* URL */}
              {selectedFinding.url && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Affected URL</h4>
                  <code className="block bg-gray-100 dark:bg-gray-900 p-2 rounded text-sm break-all">
                    {selectedFinding.url}
                  </code>
                </div>
              )}

              {/* Description */}
              {selectedFinding.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Description</h4>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap">{selectedFinding.description}</p>
                  </div>
                </div>
              )}

              {/* Parameter & Payload */}
              {(selectedFinding.parameter || selectedFinding.payload) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedFinding.parameter && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Vulnerable Parameter</h4>
                      <code className="block bg-gray-100 dark:bg-gray-900 p-2 rounded text-sm">
                        {selectedFinding.parameter}
                      </code>
                    </div>
                  )}
                  {selectedFinding.payload && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Attack Payload</h4>
                      <code className="block bg-gray-100 dark:bg-gray-900 p-2 rounded text-sm break-all">
                        {selectedFinding.payload}
                      </code>
                    </div>
                  )}
                </div>
              )}

              {/* Evidence */}
              {selectedFinding.evidence && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Evidence</h4>
                  <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs overflow-x-auto">
                    {selectedFinding.evidence}
                  </pre>
                </div>
              )}

              {/* Security References */}
              <div className="grid grid-cols-3 gap-4">
                {selectedFinding.cweIds.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">CWE</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedFinding.cweIds.map(cwe => (
                        <a
                          key={cwe}
                          href={`https://cwe.mitre.org/data/definitions/${cwe.replace('CWE-', '')}.html`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded hover:underline"
                        >
                          {cwe}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {selectedFinding.cveIds.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">CVE</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedFinding.cveIds.map(cve => (
                        <a
                          key={cve}
                          href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-2 py-0.5 rounded hover:underline"
                        >
                          {cve}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {selectedFinding.owaspIds.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">OWASP</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedFinding.owaspIds.map(owasp => (
                        <span
                          key={owasp}
                          className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-0.5 rounded"
                        >
                          {owasp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Remediation */}
              {selectedFinding.remediation && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Remediation
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">{selectedFinding.remediation}</p>
                </div>
              )}

              {/* Confidence */}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Confidence: <strong className="capitalize">{selectedFinding.confidence}</strong></span>
                <span>Rule ID: <code className="text-xs">{selectedFinding.ruleId}</code></span>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedFinding(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
