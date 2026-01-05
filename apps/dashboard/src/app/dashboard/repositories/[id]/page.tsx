'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  Button,
  Badge,
  SeverityBadge,
  StatusBadge,
  PageHeader,
  Skeleton,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useToast,
} from '@/components/ui';
import { useProject } from '@/contexts/project-context';
import { branchesApi, scansApi, type ScmBranch } from '@/lib/api';

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
  scanConfig?: {
    branches?: string[];
    // API returns scanners as array: ['semgrep', 'trivy', 'gitleaks', ...]
    scanners?: string[];
    // Legacy format (in case both are supported)
    enableSast?: boolean;
    enableSca?: boolean;
    enableSecrets?: boolean;
    enableIac?: boolean;
    enableDast?: boolean;
  };
}

interface Scan {
  id: string;
  branch: string;
  commitSha: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  triggeredBy: string;
  triggerEvent?: string;
  createdAt: string;
  completedAt?: string;
  duration?: number;
  _count?: { findings: number };
  findingsCount?: number;
  scannerResults?: Array<{
    scanner: string;
    status: string;
    findingsCount: number;
  }>;
}

// Available scanners
const AVAILABLE_SCANNERS = [
  { id: 'semgrep', name: 'Semgrep', category: 'SAST', description: 'Static code analysis' },
  { id: 'trivy', name: 'Trivy', category: 'SCA', description: 'Dependency vulnerabilities' },
  { id: 'gitleaks', name: 'Gitleaks', category: 'Secrets', description: 'Secret detection' },
  { id: 'checkov', name: 'Checkov', category: 'IaC', description: 'Infrastructure as Code' },
  { id: 'nuclei', name: 'Nuclei', category: 'DAST', description: 'Dynamic testing' },
];

// Trigger icon component
function TriggerIcon({ trigger }: { trigger: string }) {
  const icons: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    manual: {
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      label: 'Manual',
      color: 'text-blue-500',
    },
    webhook: {
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      label: 'Webhook',
      color: 'text-purple-500',
    },
    cli: {
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      label: 'CLI',
      color: 'text-green-500',
    },
    schedule: {
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'Scheduled',
      color: 'text-orange-500',
    },
    push: {
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      ),
      label: 'Push',
      color: 'text-purple-500',
    },
    pull_request: {
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      label: 'PR',
      color: 'text-cyan-500',
    },
  };

  const config = icons[trigger.toLowerCase()] || icons.manual;

  return (
    <span className={`flex items-center gap-1 ${config.color}`} title={config.label}>
      {config.icon}
      <span className="text-xs">{config.label}</span>
    </span>
  );
}

// Severity dots component
function SeverityDots({ scan }: { scan: Scan }) {
  const counts = scan.scannerResults?.reduce(
    (acc, r) => {
      // This is a simplified version - in reality, we'd get severity breakdown per scanner
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  ) || { critical: 0, high: 0, medium: 0, low: 0 };

  const total = scan._count?.findings ?? scan.findingsCount ?? 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{total}</span>
      {total > 0 && (
        <div className="flex gap-0.5">
          {counts.critical > 0 && <span className="w-2 h-2 rounded-full bg-red-500" title={`${counts.critical} Critical`} />}
          {counts.high > 0 && <span className="w-2 h-2 rounded-full bg-orange-500" title={`${counts.high} High`} />}
          {counts.medium > 0 && <span className="w-2 h-2 rounded-full bg-yellow-500" title={`${counts.medium} Medium`} />}
          {counts.low > 0 && <span className="w-2 h-2 rounded-full bg-blue-500" title={`${counts.low} Low`} />}
        </div>
      )}
    </div>
  );
}

export default function RepositoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { currentProject } = useProject();
  const { success, error: showError } = useToast();

  const [repository, setRepository] = useState<Repository | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [branches, setBranches] = useState<ScmBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Run Scan Modal state
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedScanners, setSelectedScanners] = useState<string[]>([]);
  const [scannersInitialized, setScannersInitialized] = useState(false);

  // Polling for running scans
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Load scanners from config when modal opens
  const loadScannersFromConfig = useCallback((scanConfig: Repository['scanConfig']) => {
    if (scanConfig) {
      // API returns scanners as array: ['semgrep', 'trivy', 'gitleaks', ...]
      if (scanConfig.scanners && scanConfig.scanners.length > 0) {
        setSelectedScanners(scanConfig.scanners);
        return;
      }
      // Fallback to legacy boolean format
      const defaults: string[] = [];
      if (scanConfig.enableSast !== false) defaults.push('semgrep');
      if (scanConfig.enableSca !== false) defaults.push('trivy');
      if (scanConfig.enableSecrets !== false) defaults.push('gitleaks');
      if (scanConfig.enableIac) defaults.push('checkov');
      if (scanConfig.enableDast) defaults.push('nuclei');
      setSelectedScanners(defaults.length > 0 ? defaults : ['semgrep', 'trivy', 'gitleaks']);
    } else {
      setSelectedScanners(['semgrep', 'trivy', 'gitleaks']);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
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
      const repo = repoData.repository || repoData;
      setRepository(repo);

      // Only initialize scanners once on first load
      if (!scannersInitialized) {
        loadScannersFromConfig(repo.scanConfig);
        setScannersInitialized(true);
      }

      // Fetch scans
      const scansRes = await fetch(`${API_URL}/scm/scans?repositoryId=${id}&limit=20`, {
        credentials: 'include',
      });

      if (scansRes.ok) {
        const scansData = await scansRes.json();
        const scansList = scansData.scans || scansData || [];
        setScans(scansList);
      }

      // Fetch branches
      try {
        const branchList = await branchesApi.list(id);
        setBranches(branchList);
        if (!selectedBranch && branchList.length > 0) {
          const defaultBr = branchList.find(b => b.isDefault) || branchList[0];
          setSelectedBranch(defaultBr.name);
        }
      } catch {
        // Use default branch if API fails
        if (!selectedBranch && repo.defaultBranch) {
          setSelectedBranch(repo.defaultBranch);
        }
      }
    } catch (err) {
      console.error('Failed to fetch repository data:', err);
      showError('Error', 'Failed to load repository data');
    } finally {
      setLoading(false);
    }
  }, [id, selectedBranch, scannersInitialized, loadScannersFromConfig, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for running scans
  useEffect(() => {
    const hasRunningScans = scans.some(s => s.status === 'pending' || s.status === 'running');

    if (hasRunningScans && !pollingInterval) {
      const interval = setInterval(() => {
        fetchData();
      }, 5000); // Poll every 5 seconds
      setPollingInterval(interval);
    } else if (!hasRunningScans && pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [scans, pollingInterval, fetchData]);

  // Open scan modal and reload settings from config
  const openScanModal = () => {
    // Reload scanners from saved config each time modal opens
    if (repository?.scanConfig) {
      loadScannersFromConfig(repository.scanConfig);
      // Also load the configured branch if available
      const configBranches = repository.scanConfig.branches;
      if (configBranches && configBranches.length > 0) {
        // Check if the configured branch exists in the available branches
        const configuredBranch = configBranches[0];
        // Ignore default values ["main", "master"] - use repository's actual default branch
        const isDefaultPlaceholder = configBranches.length <= 2 &&
          configBranches.every(b => b === 'main' || b === 'master');

        if (!isDefaultPlaceholder) {
          // User has configured a specific branch
          const branchExists = branches.some(b => b.name === configuredBranch);
          if (branchExists) {
            setSelectedBranch(configuredBranch);
          }
        }
      }
    }
    setShowScanModal(true);
  };

  const triggerScan = async () => {
    if (!selectedBranch) {
      showError('Error', 'Please select a branch');
      return;
    }

    if (selectedScanners.length === 0) {
      showError('Error', 'Please select at least one scanner');
      return;
    }

    setScanning(true);
    try {
      // Pass selected scanners to API
      const result = await scansApi.trigger(id, selectedBranch, selectedScanners);
      const scanId = result.scanId;

      // Close modal and navigate to scan dashboard
      setShowScanModal(false);
      success('Scan Started', 'Redirecting to scan dashboard...');

      // Navigate to the new scan dashboard with requested scanners as query param
      const scannersParam = encodeURIComponent(selectedScanners.join(','));
      router.push(`/dashboard/repositories/${id}/scans/${scanId}?scanners=${scannersParam}`);
    } catch (err) {
      console.error('Failed to trigger scan:', err);
      showError('Error', 'Failed to start scan');
    } finally {
      setScanning(false);
    }
  };

  const toggleScanner = (scannerId: string) => {
    setSelectedScanners(prev =>
      prev.includes(scannerId)
        ? prev.filter(s => s !== scannerId)
        : [...prev, scannerId]
    );
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
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
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div>
                <Skeleton className="h-8 w-64 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Not found state
  if (notFound || !repository) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium text-gray-900 dark:text-white">Repository not found</p>
          <p className="text-sm mt-1">The repository you are looking for does not exist or has been removed.</p>
        </div>
        <Link href="/dashboard/repositories">
          <Button variant="outline">Back to Repositories</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Provider Icon */}
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              {repository.connection?.provider === 'github' ? (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" />
                </svg>
              )}
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                {repository.fullName}
                <a
                  href={repository.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="View on GitHub"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                {repository.language && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    {repository.language}
                  </span>
                )}
                {repository.isPrivate && (
                  <Badge variant="default" size="sm">Private</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={openScanModal}
              className="gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Run Scan
            </Button>
            <Link href={`/dashboard/repositories/${id}/settings`}>
              <Button variant="outline" className="p-2" title="Settings">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Scans Table */}
      <Card variant="bordered">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Scans</h2>
          </div>

          {scans.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">No scans yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Run your first scan to see results here</p>
              <Button onClick={openScanModal} className="mt-4">
                Run Scan
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Trigger
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Findings
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <StatusBadge status={scan.status} />
                      </td>
                      <td className="px-4 py-3">
                        <TriggerIcon trigger={scan.triggeredBy} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                            {scan.branch}
                          </code>
                          <span className="text-xs text-gray-400 font-mono">
                            {scan.commitSha?.substring(0, 7)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {scan.duration ? formatDuration(scan.duration) : (
                          scan.status === 'running' ? (
                            <span className="flex items-center gap-1">
                              <span className="animate-pulse">Running...</span>
                            </span>
                          ) : '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityDots scan={scan} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/dashboard/repositories/${id}/scans/${scan.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
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

      {/* Run Scan Modal */}
      <Modal isOpen={showScanModal} onClose={() => setShowScanModal(false)} size="md">
        <ModalHeader onClose={() => setShowScanModal(false)}>Run Scan</ModalHeader>
        <ModalBody>
          <div className="space-y-6">
            {/* Branch Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Branch
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
              >
                {branches.length > 0 ? (
                  branches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name} {branch.isDefault && '(default)'}
                    </option>
                  ))
                ) : (
                  <option value={repository.defaultBranch}>{repository.defaultBranch}</option>
                )}
              </select>
            </div>

            {/* Scanner Toggles */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Scanners
              </label>
              <div className="space-y-2">
                {AVAILABLE_SCANNERS.map((scanner) => (
                  <label
                    key={scanner.id}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedScanners.includes(scanner.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedScanners.includes(scanner.id)}
                      onChange={() => toggleScanner(scanner.id)}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{scanner.name}</span>
                        <Badge variant="default" size="sm">{scanner.category}</Badge>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{scanner.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedScanners.includes(scanner.id)
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {selectedScanners.includes(scanner.id) && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                        </svg>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowScanModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={triggerScan}
            loading={scanning}
            disabled={selectedScanners.length === 0}
          >
            Start Scan
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
