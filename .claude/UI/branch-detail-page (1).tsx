'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { GitBranch, GitMerge, Shield, Star, GitCommit, ArrowLeft, ExternalLink, RefreshCw, Loader2, FileCode, Package, Key, Cloud, Calendar, User, Clock, CheckCircle, XCircle, AlertTriangle, Play, GitPullRequest, Upload } from 'lucide-react';
import { useProject } from '@/contexts/project-context';

const API_BASE = 'http://localhost:3001';

// ============ API FUNCTIONS ============
async function fetchRepository(repositoryId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/scm/repositories/${repositoryId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch repository');
  return res.json();
}

async function fetchBranchScans(projectId: string, repositoryId: string, branch: string): Promise<any[]> {
  // Fetch all scans for repo, then filter by branch client-side (API may not support branch filter)
  const res = await fetch(`${API_BASE}/scm/scans?projectId=${projectId}&repositoryId=${repositoryId}&limit=100`, { credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  const allScans = data.scans || data || [];
  // Filter to only scans for this branch
  return allScans.filter((s: any) => {
    const scanBranch = s.branch || 'main';
    return scanBranch === branch || scanBranch === branch.replace('refs/heads/', '');
  });
}

async function fetchBranchCommits(repositoryId: string, branch: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/scm/repositories/${repositoryId}/commits?branch=${encodeURIComponent(branch)}&limit=20`, { credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.commits || data || [];
}

async function fetchRepoSettings(repositoryId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/scm/repositories/${repositoryId}/settings`, { credentials: 'include' });
  if (!res.ok) return null;
  return res.json();
}

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
          {scans.map((scan) => (
            <tr key={scan.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onScanClick(scan.id)}>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                  scan.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                  scan.status === 'running' ? 'bg-blue-100 text-blue-700' :
                  scan.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {scan.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                  {scan.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                  {scan.status === 'failed' && <XCircle className="w-3 h-3" />}
                  {scan.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  {(scan.sastEnabled || scan.scanners?.includes('semgrep')) && <FileCode className="w-4 h-4 text-violet-600" title="SAST" />}
                  {(scan.scaEnabled || scan.scanners?.includes('trivy')) && <Package className="w-4 h-4 text-orange-600" title="SCA" />}
                  {(scan.secretsEnabled || scan.scanners?.includes('gitleaks')) && <Key className="w-4 h-4 text-rose-600" title="Secrets" />}
                  {(scan.iacEnabled || scan.scanners?.includes('checkov')) && <Cloud className="w-4 h-4 text-sky-600" title="IaC" />}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`text-sm font-medium ${(scan.findingsCount || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {scan.findingsCount || 0}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  {scan.triggerEvent === 'pull_request' && <GitPullRequest className="w-4 h-4 text-green-600" />}
                  {scan.triggerEvent === 'push' && <Upload className="w-4 h-4 text-blue-600" />}
                  {scan.triggerEvent === 'manual' && <Play className="w-4 h-4 text-gray-600" />}
                  <span>{scan.triggerEvent || 'manual'}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {scan.duration ? `${Math.round(scan.duration / 1000)}s` : '-'}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {scan.createdAt ? new Date(scan.createdAt).toLocaleString() : '-'}
              </td>
              <td className="px-4 py-3">
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </td>
            </tr>
          ))}
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

function SettingsTab({ repoSettings, branchName }: { repoSettings: any; branchName: string }) {
  const isProtected = branchName === 'main' || branchName === 'master' || branchName === 'develop';
  
  const [overrides, setOverrides] = useState({
    enableOverride: false,
    scanners: {
      sast: true,
      sca: true,
      secrets: true,
      iac: false,
    },
    blockSeverity: 'none',
    scanOnPush: true,
  });

  const scannerConfig = repoSettings?.scanConfig || {};

  return (
    <div className="p-4 space-y-6">
      {/* Inherited Settings */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          Inherited from Repository
          <span className="text-xs font-normal text-gray-500">(read-only)</span>
        </h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500 w-32">Scanners:</span>
            <div className="flex items-center gap-2">
              {(scannerConfig.scanners?.includes('semgrep') ?? true) && <span className="flex items-center gap-1 text-violet-600"><FileCode className="w-4 h-4" /> SAST</span>}
              {(scannerConfig.scanners?.includes('trivy') ?? true) && <span className="flex items-center gap-1 text-orange-600"><Package className="w-4 h-4" /> SCA</span>}
              {(scannerConfig.scanners?.includes('gitleaks') ?? true) && <span className="flex items-center gap-1 text-rose-600"><Key className="w-4 h-4" /> Secrets</span>}
              {scannerConfig.scanners?.includes('checkov') && <span className="flex items-center gap-1 text-sky-600"><Cloud className="w-4 h-4" /> IaC</span>}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500 w-32">Auto-scan:</span>
            <span className="text-gray-700">
              {scannerConfig.scanOnPr && 'PR'} {scannerConfig.scanOnPush && 'Push'} {scannerConfig.scanOnSchedule && 'Scheduled'}
              {!scannerConfig.scanOnPr && !scannerConfig.scanOnPush && !scannerConfig.scanOnSchedule && 'Manual only'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500 w-32">AI Triage:</span>
            <span className="text-gray-700">{scannerConfig.aiTriageEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
      </div>

      {/* Branch Overrides */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Branch Overrides</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={overrides.enableOverride}
              onChange={(e) => setOverrides({...overrides, enableOverride: e.target.checked})}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Enable overrides for this branch</span>
          </label>
        </div>

        <div className={`rounded-lg p-4 space-y-4 ${overrides.enableOverride ? 'bg-white border border-gray-200' : 'bg-gray-50 opacity-50 pointer-events-none'}`}>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Scanners</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={overrides.scanners.sast} onChange={e => setOverrides({...overrides, scanners: {...overrides.scanners, sast: e.target.checked}})} className="rounded" />
                <FileCode className="w-4 h-4 text-violet-600" />
                <span className="text-sm">SAST</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={overrides.scanners.sca} onChange={e => setOverrides({...overrides, scanners: {...overrides.scanners, sca: e.target.checked}})} className="rounded" />
                <Package className="w-4 h-4 text-orange-600" />
                <span className="text-sm">SCA</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={overrides.scanners.secrets} onChange={e => setOverrides({...overrides, scanners: {...overrides.scanners, secrets: e.target.checked}})} className="rounded" />
                <Key className="w-4 h-4 text-rose-600" />
                <span className="text-sm">Secrets</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={overrides.scanners.iac} onChange={e => setOverrides({...overrides, scanners: {...overrides.scanners, iac: e.target.checked}})} className="rounded" />
                <Cloud className="w-4 h-4 text-sky-600" />
                <span className="text-sm">IaC</span>
              </label>
            </div>
          </div>

          {isProtected && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Block PR on Severity</label>
              <select 
                value={overrides.blockSeverity}
                onChange={(e) => setOverrides({...overrides, blockSeverity: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="none">None (Do not block)</option>
                <option value="critical">Critical only</option>
                <option value="high">High and above</option>
                <option value="medium">Medium and above</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Override PR blocking rules for this protected branch</p>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={overrides.scanOnPush}
                onChange={(e) => setOverrides({...overrides, scanOnPush: e.target.checked})}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Scan on every push to this branch</span>
            </label>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
              Save Branch Overrides
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN PAGE ============
export default function BranchDetailPage() {
  const { currentProject } = useProject();
  const router = useRouter();
  const params = useParams();
  const repoId = params?.repoId as string;
  const branchId = decodeURIComponent(params?.branchId as string || '');

  const [repo, setRepo] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [commits, setCommits] = useState<any[]>([]);
  const [repoSettings, setRepoSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scans' | 'commits' | 'settings'>('scans');

  const isProtected = branchId === 'main' || branchId === 'master' || branchId === 'develop';
  const isDefault = branchId === 'main' || branchId === 'master';

  useEffect(() => {
    if (repoId && branchId && currentProject?.id) {
      loadData();
    }
  }, [repoId, branchId, currentProject?.id]);

  const loadData = async () => {
    if (!repoId || !branchId || !currentProject?.id) return;
    setIsLoading(true);
    try {
      const [repoData, scansData, commitsData, settingsData] = await Promise.all([
        fetchRepository(repoId),
        fetchBranchScans(currentProject.id, repoId, branchId),
        fetchBranchCommits(repoId, branchId),
        fetchRepoSettings(repoId),
      ]);
      setRepo(repoData);
      setScans(scansData);
      setCommits(commitsData);
      setRepoSettings(settingsData);
    } catch (err) {
      console.error('Failed to load branch data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanClick = (scanId: string) => {
    router.push(`/dashboard/scans/${scanId}`);
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
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            <Play className="w-4 h-4" /> Run Scan
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
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Settings
          </button>
        </div>

        <div>
          {activeTab === 'scans' && <ScansTab scans={scans} onScanClick={handleScanClick} />}
          {activeTab === 'commits' && <CommitsTab commits={commits} />}
          {activeTab === 'settings' && <SettingsTab repoSettings={repoSettings} branchName={branchId} />}
        </div>
      </div>
    </div>
  );
}
