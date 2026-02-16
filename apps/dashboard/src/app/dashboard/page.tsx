'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, SeverityBadge, StatusBadge, Button } from '@/components/ui';
import { StatsSkeleton, ListSkeleton, CardSkeleton } from '@/components/ui/skeletons';
import { useAuth } from '@/lib/auth-context';
import { useProject } from '@/contexts/project-context';
import type { DashboardStats, Scan, Finding } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function OverviewPage() {
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProject) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        const projectQuery = `projectId=${currentProject.id}`;
        // For now, fetch individual endpoints since /dashboard/stats may not exist yet
        const [reposRes, scansRes, findingsRes] = await Promise.all([
          fetch(`${API_URL}/scm/repositories?${projectQuery}`, { credentials: 'include' }),
          fetch(`${API_URL}/scm/scans?limit=5&${projectQuery}`, { credentials: 'include' }),
          fetch(`${API_URL}/scm/findings?limit=5&status=open&${projectQuery}`, { credentials: 'include' }),
        ]);

        const repos = reposRes.ok ? await reposRes.json() : [];
        const scans = scansRes.ok ? await scansRes.json() : [];
        const findings = findingsRes.ok ? await findingsRes.json() : { findings: [], total: 0 };

        // Calculate stats
        const findingsBySeverity = {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          total: findings.total || 0,
        };

        if (findings.findings) {
          findings.findings.forEach((f: Finding) => {
            if (f.severity in findingsBySeverity) {
              findingsBySeverity[f.severity as keyof typeof findingsBySeverity]++;
            }
          });
        }

        setStats({
          totalRepositories: Array.isArray(repos) ? repos.length : 0,
          activeConnections: 0, // Would need connections endpoint
          totalScans: Array.isArray(scans) ? scans.length : 0,
          openFindings: findings.total || 0,
          findingsBySeverity,
          recentScans: Array.isArray(scans) ? scans.slice(0, 5) : [],
          recentFindings: findings.findings?.slice(0, 5) || [],
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        // Set empty stats on error
        setStats({
          totalRepositories: 0,
          activeConnections: 0,
          totalScans: 0,
          openFindings: 0,
          findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
          recentScans: [],
          recentFindings: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [currentProject]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div>
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
        </div>

        {/* Stats skeleton */}
        <StatsSkeleton count={4} />

        {/* Severity breakdown skeleton */}
        <CardSkeleton showHeader contentLines={2} />

        {/* Recent activity skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton showHeader contentLines={5} />
          <CardSkeleton showHeader contentLines={5} />
        </div>

        {/* Quick actions skeleton */}
        <CardSkeleton showHeader contentLines={1} />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.name || user?.email}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Select a project to view your security posture
          </p>
        </div>

        <Card variant="bordered">
          <CardContent className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No project selected</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Select a project from the sidebar or create a new one to get started
            </p>
            <Link href="/dashboard/projects">
              <Button>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Go to Projects
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {currentProject.name}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Security overview for {currentProject.name}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="bordered">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Repositories</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.totalRepositories || 0}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Scans</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.totalScans || 0}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Open Findings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.openFindings || 0}
                </p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Critical/High</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {(stats?.findingsBySeverity?.critical || 0) + (stats?.findingsBySeverity?.high || 0)}
                </p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Severity Breakdown */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Findings by Severity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <SeverityBadge severity="critical" />
              <span className="text-lg font-semibold">{stats?.findingsBySeverity?.critical || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity="high" />
              <span className="text-lg font-semibold">{stats?.findingsBySeverity?.high || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity="medium" />
              <span className="text-lg font-semibold">{stats?.findingsBySeverity?.medium || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity="low" />
              <span className="text-lg font-semibold">{stats?.findingsBySeverity?.low || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity="info" />
              <span className="text-lg font-semibold">{stats?.findingsBySeverity?.info || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Scans */}
        <Card variant="bordered">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Scans</CardTitle>
              <Link href="/dashboard/scans" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.recentScans && stats.recentScans.length > 0 ? (
              <div className="space-y-3">
                {stats.recentScans.map((scan: Scan) => (
                  <div key={scan.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {scan.repository?.fullName || 'Unknown repo'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {scan.branch} • {scan.commitSha?.substring(0, 7)}
                      </p>
                    </div>
                    <StatusBadge status={scan.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No recent scans</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Findings */}
        <Card variant="bordered">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Findings</CardTitle>
              <Link href="/dashboard/findings" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.recentFindings && stats.recentFindings.length > 0 ? (
              <div className="space-y-3">
                {stats.recentFindings.map((finding: Finding) => (
                  <div key={finding.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {finding.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {finding.filePath}:{finding.startLine}
                      </p>
                    </div>
                    <SeverityBadge severity={finding.severity} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No recent findings</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/connections"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Connection
            </Link>
            <Link
              href="/dashboard/repositories"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Manage Repositories
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
