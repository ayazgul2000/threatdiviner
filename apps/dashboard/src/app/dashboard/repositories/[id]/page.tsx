'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  SeverityBadge,
  Button,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Branch {
  name: string;
  sha: string;
  isDefault: boolean;
  isProtected: boolean;
}

interface Repository {
  id: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  language: string | null;
  isPrivate: boolean;
  connection: {
    provider: string;
    externalName: string;
  };
  scanConfig: {
    enableSast: boolean;
    enableSca: boolean;
    enableSecrets: boolean;
    enableIac: boolean;
    enableDast: boolean;
  } | null;
  scans: Array<{
    id: string;
    branch: string;
    commitSha: string;
    status: string;
    createdAt: string;
    _count: { findings: number };
  }>;
}

// Language colors based on GitHub's linguist
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-green-500',
  Java: 'bg-orange-600',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-400',
  Ruby: 'bg-red-500',
  PHP: 'bg-purple-500',
  'C++': 'bg-pink-500',
  C: 'bg-gray-500',
  'C#': 'bg-green-600',
  Swift: 'bg-orange-500',
  Kotlin: 'bg-purple-600',
  Scala: 'bg-red-600',
  Shell: 'bg-green-400',
  HTML: 'bg-orange-500',
  CSS: 'bg-purple-400',
  SCSS: 'bg-pink-400',
  Vue: 'bg-emerald-500',
  Dockerfile: 'bg-blue-600',
  HCL: 'bg-purple-700',
  YAML: 'bg-red-400',
  JSON: 'bg-gray-600',
  Markdown: 'bg-blue-400',
};

export default function RepositoryDetailPage() {
  const params = useParams();
  const repositoryId = params.id as string;

  const [repository, setRepository] = useState<Repository | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [languages, setLanguages] = useState<Record<string, number>>({});
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [repoRes, branchesRes, langRes] = await Promise.all([
          fetch(`${API_URL}/scm/repositories/${repositoryId}`, { credentials: 'include' }),
          fetch(`${API_URL}/scm/repositories/${repositoryId}/branches`, { credentials: 'include' }),
          fetch(`${API_URL}/scm/repositories/${repositoryId}/languages`, { credentials: 'include' }),
        ]);

        if (repoRes.ok) {
          const data = await repoRes.json();
          setRepository(data.repository);
          setSelectedBranch(data.repository.defaultBranch);
        } else {
          setError('Failed to load repository');
        }

        if (branchesRes.ok) {
          const data = await branchesRes.json();
          setBranches(data.branches || []);
        }

        if (langRes.ok) {
          const data = await langRes.json();
          setLanguages(data.languages || {});
        }
      } catch (err) {
        console.error('Failed to fetch repository:', err);
        setError('Failed to load repository');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [repositoryId]);

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${API_URL}/scm/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          repositoryId,
          branch: selectedBranch,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Refresh repository to show new scan
        const repoRes = await fetch(`${API_URL}/scm/repositories/${repositoryId}`, { credentials: 'include' });
        if (repoRes.ok) {
          const repoData = await repoRes.json();
          setRepository(repoData.repository);
        }
      } else {
        setError('Failed to trigger scan');
      }
    } catch (err) {
      console.error('Failed to trigger scan:', err);
      setError('Failed to trigger scan');
    } finally {
      setScanning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'running':
        return <Badge variant="info">Running</Badge>;
      case 'queued':
        return <Badge variant="warning">Queued</Badge>;
      case 'failed':
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
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

  // Calculate language percentages
  const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);
  const languageList = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading repository...</div>
      </div>
    );
  }

  if (error || !repository) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error || 'Repository not found'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/repositories"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {repository.fullName}
                </h1>
                {repository.isPrivate ? (
                  <Badge variant="default">Private</Badge>
                ) : (
                  <Badge variant="info">Public</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="capitalize">{repository.connection.provider}</span>
                <span>•</span>
                <span>{repository.connection.externalName}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/repositories/${repositoryId}/settings`}>
            <Button variant="outline">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Button>
          </Link>
          <a
            href={repository.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>

      {/* Languages Bar */}
      {languageList.length > 0 && (
        <Card variant="bordered">
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Languages</h3>
              <span className="text-xs text-gray-500">{languageList.length} languages detected</span>
            </div>

            {/* Language bar */}
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mb-3">
              {languageList.map((lang) => (
                <div
                  key={lang.name}
                  className={`${LANGUAGE_COLORS[lang.name] || 'bg-gray-400'} transition-all`}
                  style={{ width: `${lang.percentage}%` }}
                  title={`${lang.name}: ${lang.percentage.toFixed(1)}%`}
                />
              ))}
            </div>

            {/* Language badges */}
            <div className="flex flex-wrap gap-2">
              {languageList.slice(0, 8).map((lang) => (
                <div
                  key={lang.name}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <span
                    className={`w-3 h-3 rounded-full ${LANGUAGE_COLORS[lang.name] || 'bg-gray-400'}`}
                  />
                  <span className="text-gray-700 dark:text-gray-300">{lang.name}</span>
                  <span className="text-gray-500">{lang.percentage.toFixed(1)}%</span>
                </div>
              ))}
              {languageList.length > 8 && (
                <span className="text-sm text-gray-500">+{languageList.length - 8} more</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Controls */}
      <Card variant="bordered">
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Branch Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Branch
                </label>
                <div className="relative">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="appearance-none w-64 px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  >
                    {branches.map((branch) => (
                      <option key={branch.name} value={branch.name}>
                        {branch.name}
                        {branch.isDefault ? ' (default)' : ''}
                        {branch.isProtected ? ' (protected)' : ''}
                      </option>
                    ))}
                    {branches.length === 0 && (
                      <option value={repository.defaultBranch}>{repository.defaultBranch}</option>
                    )}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Scanner Config Summary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Enabled Scanners
                </label>
                <div className="flex items-center gap-2">
                  {repository.scanConfig?.enableSast && (
                    <Badge variant="info">SAST</Badge>
                  )}
                  {repository.scanConfig?.enableSca && (
                    <Badge variant="success">SCA</Badge>
                  )}
                  {repository.scanConfig?.enableSecrets && (
                    <Badge variant="warning">Secrets</Badge>
                  )}
                  {repository.scanConfig?.enableIac && (
                    <Badge variant="default">IaC</Badge>
                  )}
                  {repository.scanConfig?.enableDast && (
                    <Badge variant="danger">DAST</Badge>
                  )}
                  {!repository.scanConfig && (
                    <span className="text-sm text-gray-500">Default configuration</span>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleTriggerScan}
              disabled={scanning}
            >
              {scanning ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Scanning...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Run Scan
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Scans */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
        </CardHeader>
        <CardContent>
          {repository.scans.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No scans yet. Run your first scan to see results here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Branch
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Commit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Findings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {repository.scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {scan.branch}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <code className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {scan.commitSha.substring(0, 7)}
                        </code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(scan.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {scan._count.findings}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatTime(scan.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <Link
                          href={`/dashboard/scans/${scan.id}`}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
