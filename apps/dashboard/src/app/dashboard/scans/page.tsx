'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, StatusBadge, SeverityBadge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui';
import { scansApi, type Scan } from '@/lib/api';

export default function ScansPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScans = async () => {
      try {
        const data = await scansApi.list();
        setScans(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch scans:', err);
        setError(err instanceof Error ? err.message : 'Failed to load scans');
      } finally {
        setLoading(false);
      }
    };

    fetchScans();
  }, []);

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getTriggerIcon = (trigger: string) => {
    switch (trigger) {
      case 'push':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        );
      case 'pull_request':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'manual':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        );
      case 'schedule':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading scans...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scans</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          View all security scan runs
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Scans Table */}
      <Card variant="bordered">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Repository</TableHead>
                <TableHead>Branch / Commit</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.length === 0 ? (
                <TableEmpty colSpan={7} message="No scans yet. Trigger a scan from the Repositories page." />
              ) : (
                scans.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/repositories/${scan.repositoryId}`}
                        className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        {scan.repository?.fullName || 'Unknown'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <code className="text-sm bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {scan.branch || '-'}
                        </code>
                        <span className="text-gray-400 mx-1">/</span>
                        <code className="text-xs text-gray-500">
                          {scan.commitSha?.substring(0, 7) || '-'}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                        {scan.trigger && getTriggerIcon(scan.trigger)}
                        <span className="capitalize text-sm">{scan.trigger?.replace('_', ' ') || 'unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={scan.status || 'pending'} />
                    </TableCell>
                    <TableCell>
                      {scan.findingsCount ? (
                        <div className="flex items-center gap-1">
                          {scan.findingsCount.critical > 0 && (
                            <SeverityBadge severity="critical">{scan.findingsCount.critical}</SeverityBadge>
                          )}
                          {scan.findingsCount.high > 0 && (
                            <SeverityBadge severity="high">{scan.findingsCount.high}</SeverityBadge>
                          )}
                          {scan.findingsCount.medium > 0 && (
                            <SeverityBadge severity="medium">{scan.findingsCount.medium}</SeverityBadge>
                          )}
                          {scan.findingsCount.low > 0 && (
                            <SeverityBadge severity="low">{scan.findingsCount.low}</SeverityBadge>
                          )}
                          {scan.findingsCount.total === 0 && (
                            <span className="text-gray-400 text-sm">None</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600 dark:text-gray-400">
                        {formatDuration(scan.duration)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600 dark:text-gray-400 text-sm">
                        {scan.startedAt
                          ? new Date(scan.startedAt).toLocaleString()
                          : scan.createdAt
                            ? new Date(scan.createdAt).toLocaleString()
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
    </div>
  );
}
