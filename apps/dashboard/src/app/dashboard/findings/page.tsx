'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent, Badge, SeverityBadge, Modal, ModalHeader, ModalBody, ModalFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui';
import { findingsApi, type Finding } from '@/lib/api';

export default function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [filters, setFilters] = useState({
    severity: '',
    status: '',
  });

  const fetchFindings = async () => {
    setLoading(true);
    try {
      const filterParams: Record<string, string> = {};
      if (filters.severity) filterParams.severity = filters.severity;
      if (filters.status) filterParams.status = filters.status;

      const data = await findingsApi.list(filterParams);
      setFindings(data.findings || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch findings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load findings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, [filters]);

  const handleStatusChange = async (findingId: string, status: Finding['status']) => {
    try {
      await findingsApi.updateStatus(findingId, status);
      setFindings(findings.map(f =>
        f.id === findingId ? { ...f, status } : f
      ));
      if (selectedFinding?.id === findingId) {
        setSelectedFinding({ ...selectedFinding, status });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'danger';
      case 'fixed':
        return 'success';
      case 'ignored':
        return 'warning';
      case 'false_positive':
        return 'default';
      default:
        return 'default';
    }
  };

  // Extract short rule ID from full path (e.g., "C.Dev.threatdiviner...sql-injection" -> "sql-injection")
  const getShortRuleId = (ruleId: string) => {
    // Split by dots and take the last segment
    const parts = ruleId.split('.');
    return parts[parts.length - 1] || ruleId;
  };

  // Extract relative path from full file path (strip temp dir prefix)
  const getRelativePath = (filePath: string) => {
    // Remove common temp/scan prefixes
    const patterns = [
      /^[A-Za-z]:\/tmp\/threatdiviner-scans\/[^/]+\//,  // Windows temp
      /^\/tmp\/threatdiviner-scans\/[^/]+\//,           // Unix temp
      /^C:\/tmp\/threatdiviner-scans\/[^/]+\//,         // Windows C: drive
    ];
    let result = filePath;
    for (const pattern of patterns) {
      result = result.replace(pattern, '');
    }
    return result;
  };

  if (loading && findings.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading findings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Findings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {total} security findings across all repositories
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Severity
          </label>
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="fixed">Fixed</option>
            <option value="ignored">Ignored</option>
            <option value="false_positive">False Positive</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Findings Table */}
      <Card variant="bordered">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Severity</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Scanner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>First Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.length === 0 ? (
                <TableEmpty colSpan={6} message="No findings match your filters." />
              ) : (
                findings.map((finding) => (
                  <TableRow
                    key={finding.id}
                    onClick={() => setSelectedFinding(finding)}
                  >
                    <TableCell>
                      <SeverityBadge severity={finding.severity} />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-gray-900 dark:text-white truncate max-w-md">
                        {finding.title}
                      </p>
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
                      <Badge variant={getStatusColor(finding.status) as any}>
                        {finding.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600 dark:text-gray-400 text-sm">
                        {finding.firstSeenAt || finding.createdAt
                          ? new Date(finding.firstSeenAt || finding.createdAt).toLocaleDateString()
                          : '-'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                {/* Description */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                  <p className="text-gray-600 dark:text-gray-400">{selectedFinding.message}</p>
                </div>

                {/* Location */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</h4>
                  <code className="block bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded text-sm" title={selectedFinding.filePath}>
                    {getRelativePath(selectedFinding.filePath)}:{selectedFinding.startLine}
                    {selectedFinding.endLine && selectedFinding.endLine !== selectedFinding.startLine && `-${selectedFinding.endLine}`}
                  </code>
                </div>

                {/* Code Snippet */}
                {selectedFinding.snippet && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Code</h4>
                    <pre className="bg-gray-900 text-gray-100 px-4 py-3 rounded overflow-x-auto text-sm">
                      <code>{selectedFinding.snippet}</code>
                    </pre>
                  </div>
                )}

                {/* Metadata */}
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
                    <Badge variant={getStatusColor(selectedFinding.status) as any}>
                      {selectedFinding.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 mr-auto">Change status:</span>
                {selectedFinding.status !== 'fixed' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStatusChange(selectedFinding.id, 'fixed')}
                  >
                    Mark Fixed
                  </Button>
                )}
                {selectedFinding.status !== 'ignored' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStatusChange(selectedFinding.id, 'ignored')}
                  >
                    Ignore
                  </Button>
                )}
                {selectedFinding.status !== 'false_positive' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStatusChange(selectedFinding.id, 'false_positive')}
                  >
                    False Positive
                  </Button>
                )}
                {selectedFinding.status !== 'open' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStatusChange(selectedFinding.id, 'open')}
                  >
                    Reopen
                  </Button>
                )}
              </div>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
