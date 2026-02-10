'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Calendar, X } from 'lucide-react';
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
  const [repositories, setRepositories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [repoFilter, setRepoFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const toastCtx = useToast();

  useEffect(() => {
    if (!currentProject) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [scansRes, reposRes] = await Promise.all([
          fetch(`${API_URL}/scm/scans?projectId=${currentProject.id}`, { credentials: 'include' }),
          fetch(`${API_URL}/scm/repositories?projectId=${currentProject.id}`, { credentials: 'include' }),
        ]);
        
        const scansData = scansRes.ok ? await scansRes.json() : [];
        const reposData = reposRes.ok ? await reposRes.json() : [];
        
        setScans(Array.isArray(scansData) ? scansData : scansData.scans || []);
        setRepositories(Array.isArray(reposData) ? reposData : reposData.repositories || []);
      } catch (err) {
        toastCtx.error('Error', 'Failed to load scans');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [currentProject]);

  // Get unique branches from scans
  const availableBranches = useMemo(() => {
    const branches = new Set(scans.map(s => s.branch || 'main'));
    return Array.from(branches).sort();
  }, [scans]);

  // Filter scans
  const filteredScans = useMemo(() => {
    return scans.filter(scan => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const repoName = (scan.repository?.fullName || '').toLowerCase();
        const branch = (scan.branch || '').toLowerCase();
        const commit = (scan.commitSha || '').toLowerCase();
        if (!repoName.includes(query) && !branch.includes(query) && !commit.includes(query)) {
          return false;
        }
      }
      
      // Repo filter
      if (repoFilter !== 'all' && scan.repositoryId !== repoFilter) return false;
      
      // Branch filter
      if (branchFilter !== 'all' && (scan.branch || 'main') !== branchFilter) return false;
      
      // Status filter
      if (statusFilter !== 'all' && scan.status !== statusFilter) return false;
      
      // Trigger filter
      if (triggerFilter !== 'all') {
        const scanTrigger = (scan.trigger || scan.triggerEvent || '').toLowerCase();
        if (scanTrigger !== triggerFilter) return false;
      }
      
      // Date filter
      if (dateFrom) {
        const scanDate = new Date(scan.startedAt || scan.createdAt);
        if (scanDate < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const scanDate = new Date(scan.startedAt || scan.createdAt);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59);
        if (scanDate > toDate) return false;
      }
      
      return true;
    });
  }, [scans, searchQuery, repoFilter, branchFilter, statusFilter, triggerFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setSearchQuery('');
    setRepoFilter('all');
    setBranchFilter('all');
    setStatusFilter('all');
    setTriggerFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = searchQuery || repoFilter !== 'all' || branchFilter !== 'all' || 
    statusFilter !== 'all' || triggerFilter !== 'all' || dateFrom || dateTo;

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
        description={`${filteredScans.length} of ${scans.length} scans`}
        breadcrumbs={[{ label: 'Scans' }]}
      />

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search repo, branch, commit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Repository */}
          <select
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Repositories</option>
            {repositories.map(repo => (
              <option key={repo.id} value={repo.id}>{repo.fullName || repo.name}</option>
            ))}
          </select>

          {/* Branch */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Branches</option>
            {availableBranches.map(branch => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          {/* Trigger */}
          <select
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value as TriggerFilter)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Triggers</option>
            <option value="push">Push</option>
            <option value="pull_request">PR</option>
            <option value="manual">Manual</option>
            <option value="schedule">Schedule</option>
          </select>

          {/* Date From */}
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              placeholder="From"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              placeholder="To"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
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
                          {getTriggerIcon(scan.trigger || scan.triggerEvent || 'manual')}
                          <span className="capitalize text-sm">
                            {(scan.trigger || scan.triggerEvent || 'manual') === 'pull_request' ? 'PR' : (scan.trigger || scan.triggerEvent || 'manual')}
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
