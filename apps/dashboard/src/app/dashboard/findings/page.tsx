'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
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
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
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

  const toastCtx = useToast();

  // Get unique scanners from findings
  const availableScanners = useMemo(() => {
    const scanners = new Set(findings.map(f => f.scanner));
    return Array.from(scanners).sort();
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
      const filterParams: Record<string, string> = {};
      if (filters.severity) filterParams.severity = filters.severity;
      if (filters.status) filterParams.status = filters.status;

      const data = await findingsApi.list({ ...filterParams, projectId: currentProject.id });
      setFindings(data.findings || []);
      setTotal(data.total || 0);
      setSelectedIds(new Set());
    } catch (err) {
      toastCtx.error('Error', 'Failed to load findings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, [filters.severity, filters.status, currentProject]);

  // Filter by scanner client-side (API doesn't support it)
  const filteredFindings = useMemo(() => {
    if (!filters.scanner) return findings;
    return findings.filter(f => f.scanner === filters.scanner);
  }, [findings, filters.scanner]);

  const handleStatusChange = async (findingId: string, status: Finding['status']) => {
    try {
      await findingsApi.updateStatus(findingId, status);
      setFindings(findings.map(f =>
        f.id === findingId ? { ...f, status } : f
      ));
      if (selectedFinding?.id === findingId) {
        setSelectedFinding({ ...selectedFinding, status });
      }
      toastCtx.success('Status Updated', `Finding marked as ${status.replace('_', ' ')}`);
    } catch (err) {
      toastCtx.error('Error', 'Failed to update status');
    }
  };

  const handleBulkStatusChange = async (status: Finding['status']) => {
    if (selectedIds.size === 0) return;

    try {
      const promises = Array.from(selectedIds).map(id =>
        findingsApi.updateStatus(id, status)
      );
      await Promise.all(promises);

      setFindings(findings.map(f =>
        selectedIds.has(f.id) ? { ...f, status } : f
      ));
      setSelectedIds(new Set());
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

  const getSeverityCounts = () => {
    return {
      critical: findings.filter(f => f.severity === 'critical' && f.status === 'open').length,
      high: findings.filter(f => f.severity === 'high' && f.status === 'open').length,
      medium: findings.filter(f => f.severity === 'medium' && f.status === 'open').length,
      low: findings.filter(f => f.severity === 'low' && f.status === 'open').length,
    };
  };

  const severityCounts = getSeverityCounts();

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
      <PageHeader
        title="Findings"
        description={`${total} security findings across all repositories`}
        breadcrumbs={[{ label: 'Findings' }]}
      />

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
                  {selectedFinding.cwe?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CWE</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedFinding.cwe.map((cwe) => (
                          <Badge key={cwe} variant="info" size="sm">{cwe}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</h4>
                    <Badge variant={getStatusColor(selectedFinding.status)}>
                      {selectedFinding.status.replace('_', ' ')}
                    </Badge>
                  </div>
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
