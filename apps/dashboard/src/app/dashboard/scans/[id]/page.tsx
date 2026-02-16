'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Loader2, FileCode, Package, Key, Cloud, Calendar, Clock, GitBranch, GitCommit, GitPullRequest, Upload, Play, CheckCircle, XCircle, AlertTriangle, ExternalLink, User } from 'lucide-react';
import { API_URL } from '@/lib/api';

async function fetchScan(scanId: string): Promise<any> {
  const res = await fetch(`${API_URL}/scm/scans/${scanId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch scan');
  const data = await res.json();
  return data.scan || data;
}

async function fetchRepository(repositoryId: string): Promise<any> {
  const res = await fetch(`${API_URL}/scm/repositories/${repositoryId}`, { credentials: 'include' });
  if (!res.ok) return null;
  const data = await res.json();
  return data.repository || data;
}

async function fetchScanFindings(scanId: string): Promise<any> {
  const res = await fetch(`${API_URL}/scm/findings?scanId=${scanId}&limit=100`, { credentials: 'include' });
  if (!res.ok) return { findings: [], total: 0 };
  const data = await res.json();
  const findings = data.findings || data || [];
  const total = data.total || findings.length;

  return { findings, total, scanId };
}

function ScannerCard({ name, icon: Icon, color, findings, duration, status }: any) {
  const colorClasses: Record<string, string> = {
    violet: 'bg-violet-100 text-violet-600 border-violet-200',
    orange: 'bg-orange-100 text-orange-600 border-orange-200',
    rose: 'bg-rose-100 text-rose-600 border-rose-200',
    sky: 'bg-sky-100 text-sky-600 border-sky-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${status === 'completed' ? colorClasses[color] : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center gap-3 mb-3">
        <Icon className="w-5 h-5" />
        <span className="font-medium">{name}</span>
        {status === 'completed' && <CheckCircle className="w-4 h-4 ml-auto text-emerald-600" />}
        {status === 'failed' && <XCircle className="w-4 h-4 ml-auto text-rose-600" />}
        {status === 'running' && <Loader2 className="w-4 h-4 ml-auto animate-spin" />}
        {status === 'skipped' && <span className="text-xs text-gray-500 ml-auto">Skipped</span>}
      </div>
      {status === 'completed' && (
        <div className="flex items-center justify-between text-sm">
          <span className={findings > 0 ? 'text-rose-700 font-medium' : 'text-emerald-700'}>
            {findings} findings
          </span>
          {duration && <span className="text-gray-500">{duration}</span>}
        </div>
      )}
    </div>
  );
}

function FindingsSummary({ scan, scanId }: { scan: any; scanId: string }) {
  // Use API-provided severity stats for accurate counts
  const stats = scan?.severityStats || { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
  const total = stats.total || (stats.critical + stats.high + stats.medium + stats.low);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Findings Summary</h3>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center p-3 rounded-lg bg-purple-50">
          <div className="text-2xl font-bold text-purple-700">{stats.critical}</div>
          <div className="text-xs text-purple-600">Critical</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-rose-50">
          <div className="text-2xl font-bold text-rose-700">{stats.high}</div>
          <div className="text-xs text-rose-600">High</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-amber-50">
          <div className="text-2xl font-bold text-amber-700">{stats.medium}</div>
          <div className="text-xs text-amber-600">Medium</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-yellow-50">
          <div className="text-2xl font-bold text-yellow-700">{stats.low}</div>
          <div className="text-xs text-yellow-600">Low</div>
        </div>
      </div>

      {total > 0 && (
        <a
          href={`/dashboard/findings?scanId=${scanId}`}
          className="flex items-center justify-center gap-2 w-full py-2 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          View all {total} findings <ExternalLink className="w-4 h-4" />
        </a>
      )}

      {total === 0 && (
        <div className="text-center py-2 text-sm text-emerald-600">
          <CheckCircle className="w-5 h-5 mx-auto mb-1" />
          No security issues found
        </div>
      )}
    </div>
  );
}

export default function ScanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const scanId = params?.id as string;

  const [scan, setScan] = useState<any>(null);
  const [repo, setRepo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (scanId) {
      loadData();
    }
  }, [scanId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const scanData = await fetchScan(scanId);
      setScan(scanData);

      // Fetch repo info if we have repositoryId
      if (scanData?.repositoryId) {
        const repoData = await fetchRepository(scanData.repositoryId);
        setRepo(repoData);
      }
    } catch (err) {
      console.error('Failed to load scan:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const getTriggerIcon = (trigger: string) => {
    switch (trigger) {
      case 'pull_request': return GitPullRequest;
      case 'push': return Upload;
      case 'schedule': return Clock;
      default: return Play;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="ml-3 text-gray-600">Loading scan...</span>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="text-center py-12 text-gray-500">Scan not found</div>
      </div>
    );
  }

  const TriggerIcon = getTriggerIcon(scan.triggerEvent || scan.trigger);
  const scanners = scan.scanners || [];
  const hasSast = scan.sastEnabled || scanners.includes('semgrep');
  const hasSca = scan.scaEnabled || scanners.includes('trivy');
  const hasSecrets = scan.secretsEnabled || scanners.includes('gitleaks');
  const hasIac = scan.iacEnabled || scanners.includes('checkov');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">Scan Details</h1>
              <span className={`inline-flex items-center gap-1 text-sm px-2.5 py-1 rounded-full ${
                scan.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                scan.status === 'running' ? 'bg-blue-100 text-blue-700' :
                scan.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {scan.status === 'completed' && <CheckCircle className="w-4 h-4" />}
                {scan.status === 'running' && <Loader2 className="w-4 h-4 animate-spin" />}
                {scan.status === 'failed' && <XCircle className="w-4 h-4" />}
                {scan.status}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <GitBranch className="w-4 h-4" />
                {repo?.fullName || scan.repository?.fullName || 'Unknown repo'}
              </span>
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{scan.branch || scan.defaultBranch || 'main'}</code>
            </div>
          </div>
        </div>
        <button 
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Scan Info */}
        <div className="col-span-2 space-y-6">
          {/* Meta Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Scan Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <TriggerIcon className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Triggered By</div>
                  <div className="text-sm font-medium text-gray-900 capitalize">{scan.triggerEvent || scan.trigger || 'Manual'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Duration</div>
                  <div className="text-sm font-medium text-gray-900">{formatDuration(scan.duration)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Calendar className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Started</div>
                  <div className="text-sm font-medium text-gray-900">
                    {scan.startedAt ? new Date(scan.startedAt).toLocaleString() : scan.createdAt ? new Date(scan.createdAt).toLocaleString() : '-'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <GitCommit className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Commit</div>
                  <code className="text-sm font-mono text-gray-900">{(scan.commitSha || scan.commitHash || '-').substring(0, 7)}</code>
                </div>
              </div>
            </div>
          </div>

          {/* Scanner Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Scanner Breakdown</h3>
            <div className="grid grid-cols-2 gap-4">
              <ScannerCard 
                name="SAST (Semgrep)" 
                icon={FileCode} 
                color="violet"
                findings={scan.findingsCount?.sast || 0}
                duration={scan.scannerDurations?.semgrep ? formatDuration(scan.scannerDurations.semgrep) : null}
                status={hasSast ? 'completed' : 'skipped'}
              />
              <ScannerCard 
                name="SCA (Trivy)" 
                icon={Package} 
                color="orange"
                findings={scan.findingsCount?.sca || 0}
                duration={scan.scannerDurations?.trivy ? formatDuration(scan.scannerDurations.trivy) : null}
                status={hasSca ? 'completed' : 'skipped'}
              />
              <ScannerCard 
                name="Secrets (Gitleaks)" 
                icon={Key} 
                color="rose"
                findings={scan.findingsCount?.secrets || 0}
                duration={scan.scannerDurations?.gitleaks ? formatDuration(scan.scannerDurations.gitleaks) : null}
                status={hasSecrets ? 'completed' : 'skipped'}
              />
              <ScannerCard 
                name="IaC (Checkov)" 
                icon={Cloud} 
                color="sky"
                findings={scan.findingsCount?.iac || 0}
                duration={scan.scannerDurations?.checkov ? formatDuration(scan.scannerDurations.checkov) : null}
                status={hasIac ? 'completed' : 'skipped'}
              />
            </div>
          </div>

          {/* Error Message */}
          {scan.status === 'failed' && scan.errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-rose-700 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-semibold">Scan Failed</h3>
              </div>
              <pre className="text-sm text-rose-600 whitespace-pre-wrap">{scan.errorMessage}</pre>
            </div>
          )}
        </div>

        {/* Right Column - Findings */}
        <div>
          <FindingsSummary scan={scan} scanId={scanId} />
        </div>
      </div>
    </div>
  );
}
