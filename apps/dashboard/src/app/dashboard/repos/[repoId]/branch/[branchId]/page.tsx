'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { GitBranch, GitMerge, Shield, Star, GitCommit, ArrowLeft, ExternalLink, RefreshCw, Loader2, FileCode, Package, Key, Cloud, Calendar, User, Clock, CheckCircle, XCircle, AlertTriangle, Play, GitPullRequest, Upload, Settings } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { scansApi, API_URL } from '@/lib/api';
import { useToast } from '@/components/ui';

// ============ API FUNCTIONS ============
async function fetchRepository(repositoryId: string): Promise<any> {
  const res = await fetch(`${API_URL}/scm/repositories/${repositoryId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch repository');
  return res.json();
}

async function fetchBranchScans(projectId: string, repositoryId: string, branch: string): Promise<any[]> {
  const encodedBranch = encodeURIComponent(branch);
  const res = await fetch(`${API_URL}/scm/scans?projectId=${projectId}&repositoryId=${repositoryId}&branch=${encodedBranch}&limit=100`, { credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.scans || data || [];
}

// NOTE: commits endpoint doesn't exist in API - removed fetchBranchCommits
// NOTE: settings endpoint doesn't exist in API - removed fetchRepoSettings

// ============ COMPONENTS ============
function SummaryCard({ label, value, icon: Icon, color = 'gray' }: any) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    rose: 'bg-rose-100 text-rose-600',
    amber: 'bg-amber-100 text-amber-600',
    purple: 'bg-purple-100 text-purple-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ScansTab({ scans, onScanClick }: { scans: any[]; onScanClick: (id: string) => void }) {
  if (scans.length === 0) {
    return <div className="text-center py-12 text-gray-500">No scans for this branch yet</div>;
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, label: 'Completed', class: 'bg-emerald-100 text-emerald-700' };
      case 'running':
        return { icon: Loader2, label: 'Scanning...', class: 'bg-blue-100 text-blue-700', animate: true };
      case 'pending':
      case 'queued':
        return { icon: Clock, label: 'Queued', class: 'bg-amber-100 text-amber-700' };
      case 'failed':
        return { icon: XCircle, label: 'Failed', class: 'bg-rose-100 text-rose-700' };
      default:
        return { icon: Clock, label: status, class: 'bg-gray-100 text-gray-700' };
    }
  };

  const getScannerIcons = (scan: any) => {
    const isRunning = scan.status === 'running' || scan.status === 'pending' || scan.status === 'queued';
    // Only use scanners stored directly on the scan record - don't infer from settings
    const scanners = scan.scanners || [];

    // If no scanners stored (old scan), show blank
    if (scanners.length === 0) {
      return <span className="text-xs text-gray-400">—</span>;
    }

    return (
      <div className="flex items-center gap-1">
        {scanners.includes('semgrep') && (
          <FileCode className={`w-4 h-4 text-violet-600 ${isRunning ? 'animate-pulse' : ''}`} title="SAST (Semgrep)" />
        )}
        {scanners.includes('trivy') && (
          <Package className={`w-4 h-4 text-orange-600 ${isRunning ? 'animate-pulse' : ''}`} title="SCA (Trivy)" />
        )}
        {scanners.includes('gitleaks') && (
          <Key className={`w-4 h-4 text-rose-600 ${isRunning ? 'animate-pulse' : ''}`} title="Secrets (Gitleaks)" />
        )}
        {scanners.includes('checkov') && (
          <Cloud className={`w-4 h-4 text-sky-600 ${isRunning ? 'animate-pulse' : ''}`} title="IaC (Checkov)" />
        )}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Scanners</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Findings</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Triggered By</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Duration</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {scans.map((scan) => {
            const statusInfo = getStatusDisplay(scan.status);
            const StatusIcon = statusInfo.icon;
            return (
              <tr key={scan.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onScanClick(scan.id)}>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${statusInfo.class}`}>
                    <StatusIcon className={`w-3 h-3 ${statusInfo.animate ? 'animate-spin' : ''}`} />
                    {statusInfo.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {getScannerIcons(scan)}
                </td>
                <td className="px-4 py-3">
                  {scan.status === 'running' || scan.status === 'pending' || scan.status === 'queued' ? (
                    <span className="text-sm text-gray-400">—</span>
                  ) : (
                    <span className={`text-sm font-medium ${(scan.findingsCount || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {scan.findingsCount || 0}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    {scan.triggeredBy === 'pull_request' && <GitPullRequest className="w-4 h-4 text-green-600" />}
                    {scan.triggeredBy === 'push' && <Upload className="w-4 h-4 text-blue-600" />}
                    {(scan.triggeredBy === 'manual' || !scan.triggeredBy) && <Play className="w-4 h-4 text-gray-600" />}
                    <span>{scan.triggeredBy || 'manual'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {scan.status === 'running' ? (
                    <span className="text-blue-600">In progress...</span>
                  ) : scan.duration ? (
                    `${Math.round(scan.duration)}s`
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {scan.createdAt ? new Date(scan.createdAt).toLocaleString() : '-'}
                </td>
                <td className="px-4 py-3">
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CommitsTab({ commits }: { commits: any[] }) {
  if (commits.length === 0) {
    return <div className="text-center py-12 text-gray-500">No commits found</div>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {commits.map((commit, idx) => (
        <div key={idx} className="px-4 py-3 hover:bg-gray-50">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 rounded-lg mt-0.5">
              <GitCommit className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{commit.message}</p>
              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {commit.author?.name || commit.authorName || 'Unknown'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {commit.date ? new Date(commit.date).toLocaleString() : '-'}
                </span>
                <code className="bg-gray-100 px-1.5 py-0.5 rounded">{(commit.sha || commit.id || '').substring(0, 7)}</code>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


// ============ MAIN PAGE ============
export default function BranchDetailPage() {
  const { currentProject } = useProject();
  const toastCtx = useToast();
  const router = useRouter();
  const params = useParams();
  const repoId = params?.repoId as string;
  const branchId = decodeURIComponent(params?.branchId as string || '');

  const [repo, setRepo] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [commits, setCommits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [triggeringScan, setTriggeringScan] = useState(false);
  const [activeTab, setActiveTab] = useState<'scans' | 'commits'>('scans');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const isProtected = branchId === 'main' || branchId === 'master' || branchId === 'develop';
  const isDefault = branchId === 'main' || branchId === 'master';

  const loadData = useCallback(async (showLoading = true) => {
    if (!repoId || !branchId || !currentProject?.id) return;
    if (showLoading) setIsLoading(true);
    try {
      const [repoData, scansData] = await Promise.all([
        fetchRepository(repoId),
        fetchBranchScans(currentProject.id, repoId, branchId),
      ]);
      setRepo(repoData);
      setScans(scansData);
      setCommits([]); // API doesn't exist yet
    } catch (err) {
      console.error('Failed to load branch data:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [repoId, branchId, currentProject?.id]);

  // Initial load
  useEffect(() => {
    if (repoId && branchId && currentProject?.id) {
      loadData(true);
    }
  }, [repoId, branchId, currentProject?.id, loadData]);

  // Auto-poll when there's a running/pending scan
  useEffect(() => {
    const hasRunningScan = scans.some(s => s.status === 'running' || s.status === 'pending' || s.status === 'queued');

    // Clear existing interval
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Start polling if there's a running scan
    if (hasRunningScan) {
      pollingRef.current = setInterval(() => {
        loadData(false); // Don't show loading spinner during poll
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [scans, loadData]);

  const handleScanClick = (scanId: string) => {
    router.push(`/dashboard/scans/${scanId}`);
  };

  const handleTriggerScan = async () => {
    if (!repoId) return;
    setTriggeringScan(true);
    try {
      await scansApi.trigger(repoId, branchId);
      toastCtx.success('Scan Started', `Security scan initiated for ${branchId}`);
      // Immediately reload to pick up the new scan (will trigger polling)
      await loadData(false);
    } catch (err) {
      console.error('Failed to trigger scan:', err);
      toastCtx.error('Error', 'Failed to trigger scan');
    } finally {
      setTriggeringScan(false);
    }
  };

  // Calculate summary stats
  const totalFindings = scans.reduce((sum, s) => sum + (s.findingsCount || 0), 0);
  const lastScan = scans[0];
  const healthScore = lastScan?.healthScore ?? (totalFindings === 0 ? 100 : Math.max(0, 100 - totalFindings * 5));

  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="ml-3 text-gray-600">Loading branch...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(`/dashboard/repos/${repoId}`)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100">
                <GitMerge className="w-5 h-5 text-teal-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">{branchId}</h1>
              {isDefault && <Star className="w-5 h-5 text-amber-500 fill-amber-500" title="Default branch" />}
              {isProtected && <Shield className="w-5 h-5 text-blue-500" title="Protected branch" />}
              <span className={`text-sm font-bold px-2.5 py-1 rounded ${getHealthColor(healthScore)}`}>
                {healthScore}%
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <GitBranch className="w-4 h-4" />
              <span>{repo?.fullName}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/dashboard/repos/${repoId}/settings?from=branch&branchId=${branchId}`)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={handleTriggerScan}
            disabled={triggeringScan}
            className="flex items-center gap-2 px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {triggeringScan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {triggeringScan ? 'Starting...' : 'Run Scan'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Scans" value={scans.length} icon={FileCode} color="indigo" />
        <SummaryCard label="Total Findings" value={totalFindings} icon={AlertTriangle} color={totalFindings > 0 ? 'rose' : 'emerald'} />
        <SummaryCard label="Commits" value={commits.length} icon={GitCommit} color="gray" />
        <SummaryCard 
          label="Last Scan" 
          value={lastScan ? new Date(lastScan.createdAt).toLocaleDateString() : 'Never'} 
          icon={Calendar} 
          color="gray" 
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('scans')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'scans' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Scans ({scans.length})
          </button>
          <button
            onClick={() => setActiveTab('commits')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'commits' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Commits ({commits.length})
          </button>
        </div>

        <div>
          {activeTab === 'scans' && <ScansTab scans={scans} onScanClick={handleScanClick} />}
          {activeTab === 'commits' && <CommitsTab commits={commits} />}
        </div>
      </div>
    </div>
  );
}
