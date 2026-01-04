'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  Button,
  Badge,
  SeverityBadge,
  StatusBadge,
  PageHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
  useToast,
} from '@/components/ui';
import { useProject } from '@/contexts/project-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Repository {
  id: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  language: string | null;
  isPrivate: boolean;
  status?: string;
  connection: {
    provider: string;
    externalName: string;
  };
}

interface Scan {
  id: string;
  branch: string;
  commitSha: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  _count?: { findings: number };
  findingsCount?: number;
}

interface Finding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'fixed' | 'ignored' | 'false_positive';
  scanner: string;
  filePath?: string;
  createdAt: string;
}

interface Stats {
  totalScans: number;
  openFindings: number;
  criticalFindings: number;
  highFindings: number;
}

export default function RepositoryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { currentProject } = useProject();
  const { success, error: showError } = useToast();

  const [repository, setRepository] = useState<Repository | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalScans: 0,
    openFindings: 0,
    criticalFindings: 0,
    highFindings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('findings');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setNotFound(false);

        // Fetch repository details
        const repoRes = await fetch(`${API_URL}/scm/repositories/${id}`, {
          credentials: 'include',
        });

        if (!repoRes.ok) {
          if (repoRes.status === 404) {
            setNotFound(true);
            return;
          }
          throw new Error('Failed to fetch repository');
        }

        const repoData = await repoRes.json();
        setRepository(repoData.repository || repoData);

        // Fetch scans and findings in parallel
        const [scansRes, findingsRes] = await Promise.all([
          fetch(`${API_URL}/scm/scans?repositoryId=${id}&limit=10`, {
            credentials: 'include',
          }),
          fetch(`${API_URL}/scm/findings?repositoryId=${id}&status=open&limit=20`, {
            credentials: 'include',
          }),
        ]);

        if (scansRes.ok) {
          const scansData = await scansRes.json();
          const scansList = scansData.scans || scansData || [];
          setScans(scansList);
          setStats((prev) => ({ ...prev, totalScans: scansList.length }));
        }

        if (findingsRes.ok) {
          const findingsData = await findingsRes.json();
          const findingsList = findingsData.findings || findingsData || [];
          setFindings(findingsList);

          // Calculate stats from findings
          const openCount = findingsList.length;
          const criticalCount = findingsList.filter(
            (f: Finding) => f.severity === 'critical'
          ).length;
          const highCount = findingsList.filter(
            (f: Finding) => f.severity === 'high'
          ).length;

          setStats((prev) => ({
            ...prev,
            openFindings: openCount,
            criticalFindings: criticalCount,
            highFindings: highCount,
          }));
        }
      } catch (err) {
        console.error('Failed to fetch repository data:', err);
        showError('Error', 'Failed to load repository data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, showError]);

  const triggerScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${API_URL}/scm/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ repositoryId: id }),
      });

      if (!res.ok) {
        throw new Error('Failed to trigger scan');
      }

      const newScan = await res.json();
      setScans((prev) => [newScan.scan || newScan, ...prev]);
      setStats((prev) => ({ ...prev, totalScans: prev.totalScans + 1 }));
      success('Scan Started', 'A new scan has been queued for this repository');
    } catch (err) {
      console.error('Failed to trigger scan:', err);
      showError('Error', 'Failed to start scan');
    } finally {
      setScanning(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div>
                <Skeleton className="h-8 w-64 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} variant="bordered">
              <CardContent className="py-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs skeleton */}
        <div>
          <Skeleton className="h-10 w-64 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} variant="bordered">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (notFound || !repository) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400 mb-4">
          <svg
            className="w-16 h-16 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            Repository not found
          </p>
          <p className="text-sm mt-1">
            The repository you are looking for does not exist or has been removed.
          </p>
        </div>
        <Link href="/dashboard/repositories">
          <Button variant="outline">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Repositories
          </Button>
        </Link>
      </div>
    );
  }

  const repoStatus = repository.status || 'active';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={repository.fullName || repository.name}
        backHref="/dashboard/repositories"
        breadcrumbs={[
          { label: currentProject?.name || 'Project', href: '/dashboard' },
          { label: 'Repositories', href: '/dashboard/repositories' },
          { label: repository.name },
        ]}
        context={{
          type: 'repository',
          status: repoStatus,
          metadata: {
            Branch: repository.defaultBranch,
            Language: repository.language || 'Unknown',
            Provider: repository.connection?.provider || 'Unknown',
          },
        }}
        actions={
          <>
            <a
              href={repository.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                View Source
              </Button>
            </a>
            <Link href={`/dashboard/repositories/${id}/settings`}>
              <Button variant="outline">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </Button>
            </Link>
            <Button onClick={triggerScan} loading={scanning}>
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Run Scan
            </Button>
          </>
        }
      />

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total Scans
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {stats.totalScans}
            </div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Open Findings
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {stats.openFindings}
            </div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Critical
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {stats.criticalFindings}
            </div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">High</div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
              {stats.highFindings}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="findings">
            Findings ({findings.length})
          </TabsTrigger>
          <TabsTrigger value="scans">Scans ({scans.length})</TabsTrigger>
        </TabsList>

        {/* Findings Tab */}
        <TabsContent value="findings">
          {findings.length === 0 ? (
            <Card variant="bordered">
              <CardContent className="py-12 text-center">
                <svg
                  className="w-12 h-12 mx-auto text-gray-400 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">
                  No open findings found
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Run a scan to check for security issues
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {findings.map((finding) => (
                <Link
                  key={finding.id}
                  href={`/dashboard/findings/${finding.id}`}
                >
                  <Card
                    variant="bordered"
                    className="hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <SeverityBadge severity={finding.severity} />
                            <Badge variant="outline" size="sm">
                              {finding.scanner}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-gray-900 dark:text-white truncate">
                            {finding.title}
                          </h4>
                          {finding.filePath && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                              {finding.filePath}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {formatTime(finding.createdAt)}
                          </span>
                          <svg
                            className="w-5 h-5 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Scans Tab */}
        <TabsContent value="scans">
          {scans.length === 0 ? (
            <Card variant="bordered">
              <CardContent className="py-12 text-center">
                <svg
                  className="w-12 h-12 mx-auto text-gray-400 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">
                  No scans yet
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Run your first scan to see results here
                </p>
                <Button onClick={triggerScan} loading={scanning} className="mt-4">
                  Run Scan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {scans.map((scan) => (
                <Link key={scan.id} href={`/dashboard/scans/${scan.id}`}>
                  <Card
                    variant="bordered"
                    className="hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusBadge status={scan.status} />
                            <Badge variant="outline" size="sm">
                              {scan.branch}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                              {scan.commitSha?.substring(0, 7) || 'N/A'}
                            </code>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {scan._count?.findings ?? scan.findingsCount ?? 0}{' '}
                              findings
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {formatTime(scan.createdAt)}
                          </span>
                          <svg
                            className="w-5 h-5 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
