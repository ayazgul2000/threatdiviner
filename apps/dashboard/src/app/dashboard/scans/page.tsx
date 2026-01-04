'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  StatusBadge,
  SeverityBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  NoScansEmpty,
  PageHeader,
  Badge,
  Button,
  useToast,
} from '@/components/ui';
import { TableSkeleton } from '@/components/ui/skeletons';
import { scansApi, type Scan, API_URL } from '@/lib/api';
import { useProject } from '@/contexts/project-context';

type StatusFilter = 'all' | 'pending' | 'running' | 'completed' | 'failed';
type TriggerFilter = 'all' | 'push' | 'pull_request' | 'manual' | 'schedule';

export default function ScansPage() {
  const { currentProject } = useProject();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>('all');

  const toastCtx = useToast();

  useEffect(() => {
    if (!currentProject) {
      setLoading(false);
      return;
    }

    const fetchScans = async () => {
      try {
        const res = await fetch(`${API_URL}/scm/scans?projectId=${currentProject.id}`, { credentials: 'include' });
        const data = res.ok ? await res.json() : [];
        setScans(Array.isArray(data) ? data : []);
      } catch (err) {
        toastCtx.error('Error', 'Failed to load scans');
      } finally {
        setLoading(false);
      }
    };

    fetchScans();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchScans, 30000);
    return () => clearInterval(interval);
  }, [currentProject]);

  const filteredScans = scans.filter(scan => {
    if (statusFilter !== 'all' && scan.status !== statusFilter) return false;
    if (triggerFilter !== 'all' && scan.trigger !== triggerFilter) return false;
    return true;
  });

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

  const getStatusCounts = () => {
    return {
      all: scans.length,
      pending: scans.filter(s => s.status === 'pending').length,
      running: scans.filter(s => s.status === 'running').length,
      completed: scans.filter(s => s.status === 'completed').length,
      failed: scans.filter(s => s.status === 'failed').length,
    };
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
        </div>
        <TableSkeleton rows={8} columns={7} />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <PageHeader title="Scans" breadcrumbs={[{ label: 'Scans' }]} />
        <Card variant="bordered">
          <CardContent className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No project selected</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Select a project from the sidebar to view scans
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
        title="Scans"
        description="View and monitor security scan runs across all repositories"
        breadcrumbs={[{ label: 'Scans' }]}
      />

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(['all', 'running', 'pending', 'completed', 'failed'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`p-4 rounded-lg border transition-all ${
              statusFilter === status
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {statusCounts[status]}
            </div>
            <div className="text-sm text-gray-500 capitalize">{status === 'all' ? 'Total' : status}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Trigger:</span>
          <div className="flex gap-1">
            {(['all', 'push', 'pull_request', 'manual', 'schedule'] as TriggerFilter[]).map((trigger) => (
              <button
                key={trigger}
                onClick={() => setTriggerFilter(trigger)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  triggerFilter === trigger
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {trigger === 'all' ? 'All' : trigger === 'pull_request' ? 'PR' : trigger.charAt(0).toUpperCase() + trigger.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        <span className="text-sm text-gray-500">
          Showing {filteredScans.length} of {scans.length} scans
        </span>
      </div>

      {/* Scans Table */}
      {scans.length === 0 ? (
        <NoScansEmpty />
      ) : (
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No scans match the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredScans.map((scan) => (
                    <TableRow key={scan.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/repositories/${scan.repositoryId}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-blue-600"
                        >
                          {scan.repository?.fullName || 'Unknown'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {scan.branch || 'main'}
                          </code>
                          {scan.commitSha && (
                            <code className="text-xs text-gray-500 font-mono">
                              {scan.commitSha.substring(0, 7)}
                            </code>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                          {scan.trigger && getTriggerIcon(scan.trigger)}
                          <span className="capitalize text-sm">
                            {scan.trigger === 'pull_request' ? 'PR' : scan.trigger || 'manual'}
                          </span>
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
                              <Badge variant="success" size="sm">Clean</Badge>
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
                        <div className="text-sm">
                          <span className="text-gray-900 dark:text-white">
                            {scan.startedAt
                              ? new Date(scan.startedAt).toLocaleDateString()
                              : scan.createdAt
                                ? new Date(scan.createdAt).toLocaleDateString()
                                : '-'}
                          </span>
                          <span className="text-gray-500 block text-xs">
                            {scan.startedAt
                              ? new Date(scan.startedAt).toLocaleTimeString()
                              : scan.createdAt
                                ? new Date(scan.createdAt).toLocaleTimeString()
                                : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/scans/${scan.id}`}>
                          <Button variant="secondary" size="sm">
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
