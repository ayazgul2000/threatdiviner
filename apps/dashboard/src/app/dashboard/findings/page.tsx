'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useProject } from '@/contexts/project-context';
import {
  Button,
  Card,
  CardContent,
  Badge,
  SeverityBadge,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  NoFindingsEmpty,
  PageHeader,
  Checkbox,
  useToast,
} from '@/components/ui';
import { TableSkeleton } from '@/components/ui/skeletons';
import { findingsApi, aiApi, API_URL, type Finding } from '@/lib/api';

type SeverityFilter = '' | 'critical' | 'high' | 'medium' | 'low' | 'info';
type StatusFilter = '' | 'open' | 'fixed' | 'ignored' | 'false_positive';

export default function FindingsPage() {
  const { currentProject } = useProject();
  const searchParams = useSearchParams();
  const scanIdParam = searchParams.get('scanId');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanInfo, setScanInfo] = useState<{ repoName: string; branch: string; repoId: string; openCount: number; closedCount: number } | null>(null);
  const [total, setTotal] = useState(0);
  const [severityCounts, setSeverityCounts] = useState({ critical: 0, high: 0, medium: 0, low: 0, info: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [triaging, setTriaging] = useState(false);
  const [bulkTriaging, setBulkTriaging] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [filters, setFilters] = useState<{
    severity: SeverityFilter;
    status: StatusFilter;
    scanner: string;
  }>({
    severity: '',
    status: '',
    scanner: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const toastCtx = useToast();

  // Get unique scanners from findings
  const availableScanners = useMemo(() => {
    const scanners = new Set(findings.map(f => f.scanner));
    return Array.from(scanners).sort();
  }, [findings]);

  // Calculate open/closed counts
  const findingCounts = useMemo(() => {
    const open = findings.filter(f => f.status === 'open').length;
    const closed = findings.filter(f => ['fixed', 'ignored', 'false_positive'].includes(f.status)).length;
    return { open, closed, total: findings.length };
  }, [findings]);

  // Check if AI triage is available
  useEffect(() => {
    aiApi.getStatus()
      .then((status) => setAiAvailable(status.available))
      .catch(() => setAiAvailable(false));
  }, []);

  const fetchFindings = async () => {
    if (!currentProject) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const filterParams: Record<string, string | number> = {};
      if (filters.severity) filterParams.severity = filters.severity;
      if (filters.status) filterParams.status = filters.status;
      if (scanIdParam) filterParams.scanId = scanIdParam;
      filterParams.limit = pageSize;
      filterParams.offset = (page - 1) * pageSize;

      const data = await findingsApi.list({ ...filterParams, projectId: currentProject.id });
      setFindings(data.findings || []);
      setTotal(data.total || 0);
      setSeverityCounts(data.counts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 });
      setSelectedIds(new Set());

      // Fetch scan info if filtering by scanId (only on first load, not on filter changes)
      if (scanIdParam && !scanInfo) {
        try {
          const scanRes = await fetch(`${API_URL}/scm/scans/${scanIdParam}`, { credentials: 'include' });
          if (scanRes.ok) {
            const scanData = await scanRes.json();
            const scan = scanData.scan || scanData;
            if (scan.repositoryId) {
              const repoRes = await fetch(`${API_URL}/scm/repositories/${scan.repositoryId}`, { credentials: 'include' });
              if (repoRes.ok) {
                const repoData = await repoRes.json();
                const repo = repoData.repository || repoData;
                // Calculate total open/closed from all findings for this scan
                const allFindings = data.findings || [];
                const openCount = allFindings.filter((f: Finding) => f.status === 'open').length;
                const closedCount = allFindings.filter((f: Finding) => ['fixed', 'ignored', 'false_positive'].includes(f.status)).length;
                setScanInfo({
                  repoName: repo.fullName || repo.name,
                  branch: scan.branch || 'main',
                  repoId: scan.repositoryId,
                  openCount,
                  closedCount,
                });
              }
            }
          }
        } catch (e) { /* ignore */ }
      } else if (!scanIdParam) {
        setScanInfo(null);
      }
    } catch (err) {
      toastCtx.error('Error', 'Failed to load findings');
    } finally {
      setLoading(false);
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters.severity, filters.status, scanIdParam]);

  useEffect(() => {
    fetchFindings();
  }, [filters.severity, filters.status, currentProject, scanIdParam, page, pageSize]);

  // Filter by scanner client-side (API doesn't support it)
  const filteredFindings = useMemo(() => {
    if (!filters.scanner) return findings;
    return findings.filter(f => f.scanner === filters.scanner);
  }, [findings, filters.scanner]);

  const handleStatusChange = async (findingId: string, status: Finding['status']) => {
    try {
      const oldFinding = findings.find(f => f.id === findingId);
      await findingsApi.updateStatus(findingId, status);
      setFindings(findings.map(f =>
        f.id === findingId ? { ...f, status } : f
      ));
      if (selectedFinding?.id === findingId) {
        setSelectedFinding({ ...selectedFinding, status });
      }
      // Update scanInfo counts when status changes
      if (scanInfo && oldFinding) {
        const wasOpen = oldFinding.status === 'open';
        const wasClosed = ['fixed', 'ignored', 'false_positive'].includes(oldFinding.status);
        const isNowOpen = status === 'open';
        const isNowClosed = ['fixed', 'ignored', 'false_positive'].includes(status);

        let newOpenCount = scanInfo.openCount;
        let newClosedCount = scanInfo.closedCount;

        if (wasOpen && isNowClosed) {
          newOpenCount--;
          newClosedCount++;
        } else if (wasClosed && isNowOpen) {
          newOpenCount++;
          newClosedCount--;
        }

        setScanInfo({ ...scanInfo, openCount: newOpenCount, closedCount: newClosedCount });
      }
      toastCtx.success('Status Updated', `Finding marked as ${status.replace('_', ' ')}`);
    } catch (err) {
      toastCtx.error('Error', 'Failed to update status');
    }
  };

  const handleBulkStatusChange = async (status: Finding['status']) => {
    if (selectedIds.size === 0) return;

    try {
      // Calculate count changes before update
      let openDelta = 0;
      let closedDelta = 0;
      const isNowOpen = status === 'open';
      const isNowClosed = ['fixed', 'ignored', 'false_positive'].includes(status);

      findings.filter(f => selectedIds.has(f.id)).forEach(f => {
        const wasOpen = f.status === 'open';
        const wasClosed = ['fixed', 'ignored', 'false_positive'].includes(f.status);
        if (wasOpen && isNowClosed) { openDelta--; closedDelta++; }
        else if (wasClosed && isNowOpen) { openDelta++; closedDelta--; }
      });

      const promises = Array.from(selectedIds).map(id =>
        findingsApi.updateStatus(id, status)
      );
      await Promise.all(promises);

      setFindings(findings.map(f =>
        selectedIds.has(f.id) ? { ...f, status } : f
      ));
      setSelectedIds(new Set());

      // Update scanInfo counts
      if (scanInfo) {
        setScanInfo({
          ...scanInfo,
          openCount: scanInfo.openCount + openDelta,
          closedCount: scanInfo.closedCount + closedDelta,
        });
      }

      toastCtx.success('Bulk Update Complete', `${promises.length} findings marked as ${status.replace('_', ' ')}`);
    } catch (err) {
      toastCtx.error('Error', 'Some updates failed');
    }
  };

  const handleAiTriage = async (findingId: string) => {
    setTriaging(true);
    try {
      const result = await aiApi.triageFinding(findingId);
      const updatedFinding = {
        ...findings.find(f => f.id === findingId)!,
        aiAnalysis: result.aiAnalysis,
        aiConfidence: result.aiConfidence,
        aiSeverity: result.aiSeverity,
        aiFalsePositive: result.aiFalsePositive,
        aiExploitability: result.aiExploitability,
        aiRemediation: result.aiRemediation,
        aiTriagedAt: result.aiTriagedAt,
      };
      setFindings(findings.map(f => f.id === findingId ? updatedFinding : f));
      if (selectedFinding?.id === findingId) {
        setSelectedFinding(updatedFinding);
      }
      toastCtx.success('AI Triage Complete', 'Finding analyzed successfully');
    } catch (err) {
      toastCtx.error('Error', 'AI triage failed');
    } finally {
      setTriaging(false);
    }
  };

  const handleBulkAiTriage = async () => {
    if (selectedIds.size === 0) return;
    setBulkTriaging(true);
    try {
      const result = await aiApi.batchTriage(Array.from(selectedIds));
      toastCtx.success('Bulk AI Triage Complete', `Analyzed ${result.processed} findings`);
      fetchFindings();
    } catch (err) {
      toastCtx.error('Error', 'Bulk AI triage failed');
    } finally {
      setBulkTriaging(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredFindings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFindings.map(f => f.id)));
    }
  };

  const toggleSelectFinding = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // severityCounts comes from API response (all open findings, not just current page)

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getExploitabilityBadge = (exploitability: string | null | undefined) => {
    switch (exploitability) {
      case 'easy': return <Badge variant="danger">Easy</Badge>;
      case 'moderate': return <Badge variant="warning">Moderate</Badge>;
      case 'difficult': return <Badge variant="info">Difficult</Badge>;
      case 'unlikely': return <Badge variant="success">Unlikely</Badge>;
      default: return null;
    }
  };

  const getStatusColor = (status: string): 'danger' | 'success' | 'warning' | 'default' => {
    switch (status) {
      case 'open': return 'danger';
      case 'fixed': return 'success';
      case 'ignored': return 'warning';
      case 'false_positive': return 'default';
      default: return 'default';
    }
  };

  const getShortRuleId = (ruleId: string) => {
    const parts = ruleId.split('.');
    return parts[parts.length - 1] || ruleId;
  };

  const getRelativePath = (filePath: string) => {
    const patterns = [
      /^[A-Za-z]:\/tmp\/threatdiviner-scans\/[^/]+\//,
      /^\/tmp\/threatdiviner-scans\/[^/]+\//,
      /^C:\/tmp\/threatdiviner-scans\/[^/]+\//,
    ];
    let result = filePath;
    for (const pattern of patterns) {
      result = result.replace(pattern, '');
    }
    return result;
  };

  if (loading && findings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
        </div>
        <TableSkeleton rows={8} columns={7} />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <PageHeader title="Findings" breadcrumbs={[{ label: 'Findings' }]} />
        <Card variant="bordered">
          <CardContent className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No project selected</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Select a project from the sidebar to view findings
            </p>
            <Link href="/dashboard/projects">
              <Button>Go to Projects</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {scanInfo && (
          <Link
            href={`/dashboard/repos/${scanInfo.repoId}/branch/${encodeURIComponent(scanInfo.branch)}`}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
        )}
        <PageHeader
          title={scanInfo ? `Findings for ${scanInfo.repoName}` : 'Findings'}
          description={
            scanInfo
              ? `Branch: ${scanInfo.branch} • ${scanInfo.openCount} open, ${scanInfo.closedCount} resolved`
              : `${findingCounts.open} open, ${findingCounts.closed} resolved of ${findingCounts.total} total`
          }
          breadcrumbs={[{ label: 'Findings' }]}
        />
      </div>

      {/* Severity Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['critical', 'high', 'medium', 'low'] as const).map((severity) => (
          <button
            key={severity}
            onClick={() => setFilters({ ...filters, severity: filters.severity === severity ? '' : severity })}
            className={`p-4 rounded-lg border transition-all ${
              filters.severity === severity
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <SeverityBadge severity={severity} />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {severityCounts[severity]}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Filters & Bulk Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <div className="flex gap-1">
            {(['', 'open', 'fixed', 'ignored', 'false_positive'] as StatusFilter[]).map((status) => (
              <button
                key={status || 'all'}
                onClick={() => setFilters({ ...filters, status })}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filters.status === status
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                {status === '' ? 'All' : status === 'false_positive' ? 'False Positive' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {availableScanners.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Scanner:</span>
            <select
              value={filters.scanner}
              onChange={(e) => setFilters({ ...filters, scanner: e.target.value })}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
            >
              <option value="">All Scanners</option>
              {availableScanners.map(scanner => (
                <option key={scanner} value={scanner}>{scanner}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-1" />

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {selectedIds.size} selected
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" onClick={() => handleBulkStatusChange('fixed')}>
                Mark Fixed
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleBulkStatusChange('ignored')}>
                Ignore
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleBulkStatusChange('false_positive')}>
                False Positive
              </Button>
              {aiAvailable && (
                <Button size="sm" variant="primary" onClick={handleBulkAiTriage} loading={bulkTriaging}>
                  AI Triage
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        )}

        <span className="text-sm text-gray-500">
          {filteredFindings.length} findings
        </span>
      </div>

      {/* Findings Table */}
      {findings.length === 0 ? (
        <NoFindingsEmpty />
      ) : (
        <>
          <Card variant="bordered">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow hoverable={false}>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === filteredFindings.length && filteredFindings.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Scanner</TableHead>
                    <TableHead>AI</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFindings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No findings match your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFindings.map((finding) => (
                      <TableRow key={finding.id}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(finding.id)}
                            onChange={() => toggleSelectFinding(finding.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={finding.severity} />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/dashboard/findings/${finding.id}`}
                            className="font-medium text-gray-900 dark:text-white hover:text-blue-600 truncate max-w-md block"
                          >
                            {finding.title}
                          </Link>
                          <p className="text-xs text-gray-500 truncate max-w-md" title={finding.ruleId}>
                            {getShortRuleId(finding.ruleId)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded truncate max-w-xs block" title={finding.filePath}>
                            {getRelativePath(finding.filePath)}:{finding.startLine}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">{finding.scanner}</Badge>
                        </TableCell>
                        <TableCell>
                          {finding.aiTriagedAt ? (
                            <div className="flex items-center gap-1">
                              {finding.aiFalsePositive ? (
                                <Badge variant="warning" size="sm">FP</Badge>
                              ) : (
                                <Badge variant="success" size="sm">OK</Badge>
                              )}
                              <span className={`text-xs ${getConfidenceColor(finding.aiConfidence || 0)}`}>
                                {Math.round((finding.aiConfidence || 0) * 100)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(finding.status)}>
                            {finding.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedFinding(finding)}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination Controls */}
          {total > pageSize && (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  Showing {Math.min((page - 1) * pageSize + 1, total)} - {Math.min(page * pageSize, total)} of {total}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  First
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                  Page {page} of {Math.ceil(total / pageSize)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                  disabled={page >= Math.ceil(total / pageSize)}
                >
                  Next
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.ceil(total / pageSize))}
                  disabled={page >= Math.ceil(total / pageSize)}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Finding Detail Modal */}
      <Modal isOpen={!!selectedFinding} onClose={() => setSelectedFinding(null)} size="xl">
        {selectedFinding && (
          <>
            <ModalHeader onClose={() => setSelectedFinding(null)}>
              <div className="flex items-center gap-3">
                <SeverityBadge severity={selectedFinding.severity} />
                <span className="truncate">{selectedFinding.title}</span>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                  <p className="text-gray-600 dark:text-gray-400">{selectedFinding.message}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</h4>
                  <code className="block bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded text-sm" title={selectedFinding.filePath}>
                    {getRelativePath(selectedFinding.filePath)}:{selectedFinding.startLine}
                    {selectedFinding.endLine && selectedFinding.endLine !== selectedFinding.startLine && `-${selectedFinding.endLine}`}
                  </code>
                </div>

                {selectedFinding.snippet && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Code</h4>
                    <pre className="bg-gray-900 text-gray-100 px-4 py-3 rounded overflow-x-auto text-sm">
                      <code>{selectedFinding.snippet}</code>
                    </pre>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scanner</h4>
                    <Badge variant="default">{selectedFinding.scanner}</Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rule ID</h4>
                    <code className="text-sm" title={selectedFinding.ruleId}>{getShortRuleId(selectedFinding.ruleId)}</code>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CWE</h4>
                    {selectedFinding.cwe?.[0] ? (
                      <a
                        href={`https://cwe.mitre.org/data/definitions/${selectedFinding.cwe[0].replace(/\D/g, '')}.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        CWE-{selectedFinding.cwe[0].replace(/\D/g, '')}
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ) : (
                      <span className="text-gray-400 text-sm">Unknown</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</h4>
                    <Badge variant={getStatusColor(selectedFinding.status)}>
                      {selectedFinding.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                {/* Attack & Defense Chain - from stored enrichment data */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Attack & Defense Chain</h4>

                  {!selectedFinding.enrichedAt && !selectedFinding.cwe?.length && (
                    <p className="text-sm text-gray-500">No CWE classification available for this finding</p>
                  )}

                  {!selectedFinding.enrichedAt && selectedFinding.cwe?.length > 0 && (
                    <p className="text-sm text-gray-500">Finding not yet enriched. Run a new scan to populate enrichment data.</p>
                  )}

                  {selectedFinding.enrichedAt && (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        {/* CAPEC - Attack Pattern */}
                        {(() => {
                          const capecId = selectedFinding.capecPatterns?.[0] || selectedFinding.cweData?.capecIds?.[0];
                          if (capecId) {
                            const capecIdStr = typeof capecId === 'string' ? capecId : capecId.id || String(capecId);
                            return (
                              <a
                                href={`https://capec.mitre.org/data/definitions/${capecIdStr.replace('CAPEC-', '')}.html`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{capecIdStr}</span>
                                  <svg className="w-3 h-3 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </div>
                                <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">Attack Pattern</p>
                                <p className="text-xs text-rose-500 dark:text-rose-400 mt-1">CAPEC</p>
                              </a>
                            );
                          }
                          return (
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                              <p className="text-xs text-gray-500">No CAPEC mapping</p>
                            </div>
                          );
                        })()}

                        {/* ATT&CK - Technique */}
                        {selectedFinding.attackTechniques?.[0] ? (() => {
                          const technique = selectedFinding.attackTechniques[0];
                          const techniqueId = typeof technique === 'string' ? technique : technique.id;
                          const techniqueName = typeof technique === 'string' ? technique : technique.name;
                          return (
                            <a
                              href={`https://attack.mitre.org/techniques/${techniqueId.replace('.', '/')}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{techniqueId}</span>
                                <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </div>
                              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">{techniqueName}</p>
                              <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">ATT&CK Technique</p>
                            </a>
                          );
                        })() : (
                          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <p className="text-xs text-gray-500">No ATT&CK mapping</p>
                          </div>
                        )}

                        {/* OWASP Category */}
                        {selectedFinding.owaspCategory ? (
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{selectedFinding.owaspCategory}</span>
                            </div>
                            <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">OWASP Top 10</p>
                          </div>
                        ) : (
                          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <p className="text-xs text-gray-500">No OWASP mapping</p>
                          </div>
                        )}
                      </div>

                      {/* CWE Description */}
                      {selectedFinding.cweData?.description && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                              <h5 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">{selectedFinding.cweData.name}</h5>
                              <p className="text-xs text-blue-600 dark:text-blue-400 line-clamp-3">{selectedFinding.cweData.description}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Compliance Badges */}
                      {selectedFinding.complianceControls && selectedFinding.complianceControls.length > 0 && (
                        <div className="mt-3">
                          <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Compliance Mapping</h5>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedFinding.complianceControls.map((mapping) => (
                              <span
                                key={`${mapping.frameworkId}-${mapping.controlId}`}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                title={mapping.controlName}
                              >
                                {mapping.frameworkId}: {mapping.controlId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* AI Triage Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Triage</h4>
                    {aiAvailable && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAiTriage(selectedFinding.id)}
                        loading={triaging}
                      >
                        {selectedFinding.aiTriagedAt ? 'Re-analyze' : 'Run AI Triage'}
                      </Button>
                    )}
                  </div>

                  {selectedFinding.aiTriagedAt ? (
                    <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Confidence:</span>
                          <span className={`font-medium ${getConfidenceColor(selectedFinding.aiConfidence || 0)}`}>
                            {Math.round((selectedFinding.aiConfidence || 0) * 100)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">False Positive:</span>
                          {selectedFinding.aiFalsePositive ? (
                            <Badge variant="warning">Likely FP</Badge>
                          ) : (
                            <Badge variant="success">Likely True</Badge>
                          )}
                        </div>
                        {selectedFinding.aiSeverity && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Suggested:</span>
                            <SeverityBadge severity={selectedFinding.aiSeverity as any} />
                          </div>
                        )}
                        {selectedFinding.aiExploitability && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Exploitability:</span>
                            {getExploitabilityBadge(selectedFinding.aiExploitability)}
                          </div>
                        )}
                      </div>
                      {selectedFinding.aiAnalysis && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 mb-1">Analysis</h5>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{selectedFinding.aiAnalysis}</p>
                        </div>
                      )}
                      {selectedFinding.aiRemediation && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 mb-1">Suggested Fix</h5>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{selectedFinding.aiRemediation}</p>
                        </div>
                      )}
                      {selectedFinding.autoFix && (
                        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-medium text-gray-500">Auto-Fix Code</h5>
                            <div className="flex items-center gap-2">
                              {scanInfo?.repoName && (
                                <a
                                  href={`https://github.com/${scanInfo.repoName}/blob/${scanInfo.branch || 'main'}/${selectedFinding.filePath}#L${selectedFinding.startLine}${selectedFinding.endLine ? `-L${selectedFinding.endLine}` : ''}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                                  </svg>
                                  View on GitHub
                                </a>
                              )}
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(selectedFinding.autoFix || '');
                                  toastCtx?.showToast('Code copied to clipboard', 'success');
                                }}
                                className="text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                              </button>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mb-2">
                            Replace code at <span className="font-mono text-blue-600 dark:text-blue-400">{selectedFinding.filePath}</span> line {selectedFinding.startLine}{selectedFinding.endLine && selectedFinding.endLine !== selectedFinding.startLine ? `-${selectedFinding.endLine}` : ''}
                          </div>
                          <pre className="text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 overflow-x-auto">
                            <code className="text-green-800 dark:text-green-200">{selectedFinding.autoFix}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                      {aiAvailable === false
                        ? 'AI triage is not available. Configure ANTHROPIC_API_KEY to enable.'
                        : 'Click "Run AI Triage" to analyze this finding.'}
                    </div>
                  )}
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 mr-auto">Change status:</span>
                {(['fixed', 'ignored', 'false_positive', 'open'] as const).map((status) => (
                  selectedFinding.status !== status && (
                    <Button
                      key={status}
                      variant="secondary"
                      size="sm"
                      onClick={() => handleStatusChange(selectedFinding.id, status)}
                    >
                      {status === 'false_positive' ? 'False Positive' : status === 'open' ? 'Reopen' : `Mark ${status.charAt(0).toUpperCase() + status.slice(1)}`}
                    </Button>
                  )
                ))}
              </div>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}




