'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Calendar, X, Network, CheckCircle, AlertTriangle, Clock, Play } from 'lucide-react';
import {
  Card,
  CardContent,
  StatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageHeader,
  Badge,
  Button,
  useToast,
} from '@/components/ui';
import { TableSkeleton } from '@/components/ui/skeletons';
import { API_URL } from '@/lib/api';
import { useProject } from '@/contexts/project-context';
import { DeepAnalysisModal } from '@/components/scans/deep-analysis-modal';

type StatusFilter = 'all' | 'pending' | 'running' | 'completed' | 'failed';

interface DeepAnalysisScan {
  id: string;
  repositoryId: string;
  repository?: { fullName: string; name: string };
  branch: string;
  commitSha?: string;
  status: string;
  triggeredBy: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  duration?: number;
  deepAnalysisOptions?: {
    results?: any[];
    completedAt?: string;
    resultCount?: number;
  };
  findingsCount?: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export default function DeepAnalysisPage() {
  const { currentProject } = useProject();
  const [scans, setScans] = useState<DeepAnalysisScan[]>([]);
  const [repositories, setRepositories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewAnalysisModal, setShowNewAnalysisModal] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [repoFilter, setRepoFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const toastCtx = useToast();

  const fetchData = async () => {
    if (!currentProject) {
      setLoading(false);
      return;
    }

    try {
      const [scansRes, reposRes] = await Promise.all([
        fetch(`${API_URL}/scm/scans?projectId=${currentProject.id}`, { credentials: 'include' }),
        fetch(`${API_URL}/scm/repositories?projectId=${currentProject.id}`, { credentials: 'include' }),
      ]);

      const scansData = scansRes.ok ? await scansRes.json() : [];
      const reposData = reposRes.ok ? await reposRes.json() : [];

      const allScans = Array.isArray(scansData) ? scansData : scansData.scans || [];
      // Filter to only deep analysis scans
      const deepAnalysisScans = allScans.filter((s: any) => s.triggeredBy === 'deep_analysis');

      setScans(deepAnalysisScans);
      setRepositories(Array.isArray(reposData) ? reposData : reposData.repositories || []);
    } catch (err) {
      toastCtx.error('Error', 'Failed to load deep analysis scans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [currentProject]);

  // Filter scans
  const filteredScans = useMemo(() => {
    return scans.filter(scan => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const repoName = (scan.repository?.fullName || '').toLowerCase();
        const branch = (scan.branch || '').toLowerCase();
        if (!repoName.includes(query) && !branch.includes(query)) {
          return false;
        }
      }

      // Repo filter
      if (repoFilter !== 'all' && scan.repositoryId !== repoFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && scan.status !== statusFilter) return false;

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
  }, [scans, searchQuery, repoFilter, statusFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setSearchQuery('');
    setRepoFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = searchQuery || repoFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo;

  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getAnalysisResultCount = (scan: DeepAnalysisScan) => {
    if (scan.deepAnalysisOptions?.resultCount !== undefined) {
      return scan.deepAnalysisOptions.resultCount;
    }
    if (scan.deepAnalysisOptions?.results) {
      return scan.deepAnalysisOptions.results.length;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
        </div>
        <TableSkeleton rows={6} columns={6} />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deep Analysis" breadcrumbs={[{ label: 'Deep Analysis' }]} />
        <Card variant="bordered">
          <CardContent className="p-12 text-center">
            <Network className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No project selected</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Select a project from the sidebar to view deep analysis scans
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
        title="Deep Analysis"
        description={`${filteredScans.length} of ${scans.length} deep analysis scans`}
        breadcrumbs={[{ label: 'Deep Analysis' }]}
        actions={
          <Button onClick={() => setShowNewAnalysisModal(true)}>
            <Play className="w-4 h-4 mr-2" />
            New Analysis
          </Button>
        }
      />

      {/* Filters Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search repo, branch..."
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

          {/* Date Range */}
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
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

      {/* Analysis Table */}
      {scans.length === 0 ? (
        <Card variant="bordered">
          <CardContent className="p-12 text-center">
            <Network className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No deep analysis scans yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Deep analysis provides attack chains, call chain analysis, and security recommendations for your findings
            </p>
            <Button onClick={() => setShowNewAnalysisModal(true)}>
              <Play className="w-4 h-4 mr-2" />
              Start Deep Analysis
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card variant="bordered">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Repository</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Findings Analyzed</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No analysis scans match the selected filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredScans.map((scan) => {
                    const resultCount = getAnalysisResultCount(scan);
                    return (
                      <TableRow key={scan.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/repos/${scan.repositoryId}`}
                            className="font-medium text-gray-900 dark:text-white hover:text-blue-600"
                          >
                            {scan.repository?.fullName || 'Unknown'}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {scan.branch || 'main'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={(scan.status || 'pending') as 'pending' | 'running' | 'completed' | 'failed'} />
                        </TableCell>
                        <TableCell>
                          {scan.status === 'completed' && resultCount !== null ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-gray-900 dark:text-white font-medium">{resultCount}</span>
                              <span className="text-gray-500 text-sm">findings</span>
                            </div>
                          ) : scan.status === 'running' ? (
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
                              <span className="text-gray-500">Analyzing...</span>
                            </div>
                          ) : scan.status === 'failed' ? (
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              <span className="text-gray-500">Failed</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
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
                          <Link href={`/dashboard/deep-analysis/${scan.id}`}>
                            <Button variant="secondary" size="sm">
                              View Report
                            </Button>
                          </Link>
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

      {/* New Analysis Modal */}
      {showNewAnalysisModal && (
        <DeepAnalysisModal
          onClose={() => setShowNewAnalysisModal(false)}
          onSuccess={() => {
            setShowNewAnalysisModal(false);
            fetchData();
            toastCtx.success('Success', 'Deep analysis started');
          }}
          repositories={repositories}
        />
      )}
    </div>
  );
}
