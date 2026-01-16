'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { GitBranch, AlertTriangle, ChevronRight, ChevronDown, GitMerge, Shield, Star, FileCode, Package, Key, Cloud, GitPullRequest, Upload, AlertOctagon, ScanSearch, CheckCircle2, X, User, Clock, GitCommit, CheckCircle, XCircle, Loader2, RefreshCw, LayoutGrid, List, ExternalLink, Calendar, Activity } from 'lucide-react';
import { useProject } from '@/contexts/project-context';

// ============ API FUNCTIONS ============
const API_BASE = 'http://localhost:3001';

async function fetchRepositories(projectId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/scm/repositories?projectId=${projectId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch repositories');
  const data = await res.json();
  return data.repositories || data || [];
}

async function fetchBranches(repositoryId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/scm/repositories/${repositoryId}/branches`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch branches');
  const data = await res.json();
  return data.branches || data || [];
}

async function fetchPullRequests(repositoryId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/scm/repositories/${repositoryId}/pulls?state=all&limit=100`, { credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.pulls || data || [];
}

async function fetchScans(projectId: string, repositoryId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/scm/scans?projectId=${projectId}&repositoryId=${repositoryId}&limit=50`, { credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.scans || data || [];
}

async function fetchFindings(projectId: string, repositoryId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/scm/findings?projectId=${projectId}&repositoryId=${repositoryId}&limit=100`, { credentials: 'include' });
  if (!res.ok) return { critical: 0, high: 0, medium: 0, low: 0 };
  const data = await res.json();
  if (data.findings && Array.isArray(data.findings)) {
    const summary = { critical: 0, high: 0, medium: 0, low: 0 };
    data.findings.forEach((f: any) => {
      const sev = (f.severity || '').toLowerCase();
      if (sev in summary) summary[sev as keyof typeof summary]++;
    });
    return summary;
  }
  return data.summary || { critical: 0, high: 0, medium: 0, low: 0 };
}

// ============ TYPES ============
interface Finding {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface Scan {
  types: string[];
  findingsCount: number;
  timestamp?: string;
}

interface PRDetail {
  number: number;
  title: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  status: 'open' | 'merged' | 'closed';
  reviewers: { name: string; approved: boolean }[];
  checks: { name: string; status: 'passed' | 'failed' | 'pending' }[];
  mergedAt?: string;
  mergedBy?: string;
  comments: number;
  url?: string;
}

interface CommitDetail {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  isBypass: boolean;
}

interface Branch {
  id: string;
  name: string;
  healthScore: number | null;
  isDefault?: boolean;
  isProtected?: boolean;
  mergedTo?: string;
  mergeType?: 'pr' | 'direct' | 'bypass';
  prNumber?: number;
  prDetail?: PRDetail;
  commitDetail?: CommitDetail;
  commitSource?: 'pr' | 'direct' | 'bypass';
  scan?: Scan | null;
}

interface Repo {
  id: string;
  name: string;
  fullName: string;
  healthScore: number | null;
  findings: Finding;
  branches: Branch[];
  isLoading?: boolean;
  lastScan?: string;
  branchCount?: number;
  provider?: string;
  url?: string;
}

// ============ HELPER: Transform API data to UI format ============
function transformBranches(apiBranches: any[], scans: any[], pulls: any[]): Branch[] {
  const scansByBranch: Record<string, any[]> = {};
  scans.forEach(scan => {
    const branch = scan.branch || 'main';
    if (!scansByBranch[branch]) scansByBranch[branch] = [];
    scansByBranch[branch].push(scan);
  });

  const prBySourceBranch: Record<string, any> = {};
  pulls
    .filter(pr => pr.state === 'merged')
    .sort((a, b) => new Date(b.mergedAt || b.updatedAt).getTime() - new Date(a.mergedAt || a.updatedAt).getTime())
    .forEach(pr => {
      const sourceBranch = pr.headBranch || pr.sourceBranch;
      if (sourceBranch && !prBySourceBranch[sourceBranch]) {
        prBySourceBranch[sourceBranch] = pr;
      }
    });

  return apiBranches.map((b, index) => {
    const branchName = typeof b === 'string' ? b : b.name;
    const branchScans = scansByBranch[branchName] || [];
    const latestScan = branchScans[0];
    const mergedPR = prBySourceBranch[branchName];
    
    const scanTypes: string[] = [];
    if (latestScan) {
      if (latestScan.sastEnabled || latestScan.scanners?.includes('semgrep')) scanTypes.push('sast');
      if (latestScan.scaEnabled || latestScan.scanners?.includes('trivy')) scanTypes.push('sca');
      if (latestScan.secretsEnabled || latestScan.scanners?.includes('gitleaks')) scanTypes.push('secrets');
      if (latestScan.iacEnabled || latestScan.scanners?.includes('checkov')) scanTypes.push('iac');
      if (scanTypes.length === 0 && latestScan.type) {
        scanTypes.push(latestScan.type.toLowerCase());
      }
      if (scanTypes.length === 0) scanTypes.push('sast');
    }

    const isDefaultBranch = branchName === 'main' || branchName === 'master';
    const isProtectedBranch = isDefaultBranch || branchName === 'develop' || branchName === 'development';

    let prDetail: PRDetail | undefined;
    if (mergedPR) {
      prDetail = {
        number: mergedPR.number,
        title: mergedPR.title,
        author: mergedPR.author,
        sourceBranch: mergedPR.headBranch || mergedPR.sourceBranch,
        targetBranch: mergedPR.baseBranch || mergedPR.targetBranch,
        status: mergedPR.state,
        reviewers: mergedPR.reviewers || [],
        checks: [],
        mergedAt: mergedPR.mergedAt,
        mergedBy: mergedPR.mergedBy,
        comments: 0,
        url: mergedPR.htmlUrl,
      };
    }

    let mergedTo: string | undefined;
    let mergeType: 'pr' | 'direct' | 'bypass' | undefined;
    
    if (mergedPR) {
      mergedTo = mergedPR.baseBranch || mergedPR.targetBranch;
      mergeType = 'pr';
    }

    return {
      id: branchName,
      name: branchName,
      healthScore: latestScan?.healthScore ?? null,
      isDefault: isDefaultBranch,
      isProtected: isProtectedBranch,
      mergedTo,
      mergeType,
      prNumber: mergedPR?.number,
      prDetail,
      scan: latestScan ? {
        types: scanTypes,
        findingsCount: latestScan.findingsCount || latestScan.findings?.total || 0,
        timestamp: latestScan.createdAt,
      } : null,
      commitSource: latestScan?.triggerEvent === 'pull_request' ? 'pr' : 
                    latestScan?.triggerEvent === 'push' ? 'direct' : 
                    mergedPR ? 'pr' : undefined,
    };
  });
}

function calculateHealthScore(findings: Finding): number | null {
  const total = findings.critical + findings.high + findings.medium + findings.low;
  if (total === 0) return 100;
  const deductions = findings.critical * 20 + findings.high * 10 + findings.medium * 5 + findings.low * 2;
  return Math.max(0, 100 - deductions);
}

// ============ PR DETAIL MODAL ============
function PRDetailModal({ pr, onClose }: { pr: PRDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-96 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-gray-900">PR #{pr.number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              pr.status === 'merged' ? 'bg-purple-100 text-purple-700' :
              pr.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {pr.status}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <h3 className="font-medium text-gray-900">{pr.title}</h3>
          
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span>{pr.author}</span>
            </div>
            {pr.mergedAt && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{new Date(pr.mergedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          
          <div className="text-sm">
            <span className="text-gray-500">Merge: </span>
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{pr.sourceBranch}</code>
            <span className="mx-2 text-gray-400">→</span>
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{pr.targetBranch}</code>
          </div>
          
          {pr.reviewers.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-2">Reviewers</div>
              <div className="space-y-1">
                {pr.reviewers.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {r.approved ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Clock className="w-4 h-4 text-amber-500" />}
                    <span className="text-gray-700">{r.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pr.mergedBy && (
            <div className="text-sm text-gray-600">
              <span className="text-gray-500">Merged by: </span>
              <span>{pr.mergedBy}</span>
            </div>
          )}

          {pr.url && (
            <a 
              href={pr.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
            >
              View on GitHub <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ COMMIT DETAIL MODAL ============
function CommitDetailModal({ commit, onClose }: { commit: CommitDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-96" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">Commit</span>
            {commit.isBypass && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Bypass</span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 space-y-3">
          <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">{commit.sha}</code>
          <p className="text-sm text-gray-900">{commit.message}</p>
          
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span>{commit.author}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{commit.timestamp}</span>
            </div>
          </div>
          
          {commit.isBypass && (
            <div className="flex items-center gap-2 p-2 bg-rose-50 rounded-lg text-sm text-rose-700">
              <AlertOctagon className="w-4 h-4" />
              <span>This commit bypassed branch protection rules</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ REPO CARD (Tree View) ============
function RepoCard({ name, fullName, healthScore, findings, isExpanded = false, isLoading = false, onClick, onViewClick }: any) {
  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  const totalFindings = findings.critical + findings.high + findings.medium + findings.low;

  return (
    <div
      onClick={onClick}
      className={`
        w-48 p-3 rounded-lg cursor-pointer transition-all duration-200
        bg-white border border-gray-200 shadow-sm
        hover:border-indigo-400 hover:shadow-md
        ${isExpanded ? 'ring-2 ring-indigo-500 border-indigo-400' : ''}
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-indigo-100">
          <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <span className="text-sm font-semibold text-gray-900 truncate flex-1" title={fullName || name}>
          {name}
        </span>
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        ) : isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${getHealthColor(healthScore)}`}>
          {healthScore !== null ? `${healthScore}%` : 'N/A'}
        </span>
        <div className="flex items-center gap-2">
          {totalFindings > 0 && (
            <div className="flex gap-1.5 text-[10px] font-medium">
              {findings.critical > 0 && <span className="text-purple-600">{findings.critical}C</span>}
              {findings.high > 0 && <span className="text-rose-600">{findings.high}H</span>}
              {findings.medium > 0 && <span className="text-amber-600">{findings.medium}M</span>}
              {findings.low > 0 && <span className="text-yellow-600">{findings.low}L</span>}
            </div>
          )}
          {isExpanded && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewClick?.(); }}
              className="p-1 hover:bg-indigo-100 rounded text-indigo-600"
              title="View details"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ BRANCH CARD ============
function BranchCard({ id, name, healthScore, isDefault = false, isProtected = false, scan, commitSource, onScanClick, onBranchClick }: any) {
  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  const effectiveCommitSource = (isProtected || isDefault) && commitSource === 'direct' ? 'bypass' : commitSource;

  const commitSourceConfig: any = {
    pr: { icon: GitPullRequest, color: 'text-green-600', bg: 'bg-green-50', label: 'PR merge' },
    direct: { icon: Upload, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Direct push' },
    bypass: { icon: AlertOctagon, color: 'text-rose-600', bg: 'bg-rose-50', label: 'Bypass/Force push' },
  };

  const hasScan = scan && scan.types && scan.types.length > 0;
  const isBypass = effectiveCommitSource === 'bypass';
  const showAlert = !hasScan || isBypass;

  const commitCfg = effectiveCommitSource ? commitSourceConfig[effectiveCommitSource] : null;
  const CommitIcon = commitCfg?.icon;

  return (
    <div 
      data-branch-id={id}
      className={`w-64 p-2.5 rounded-lg border shadow-sm bg-white cursor-pointer hover:border-indigo-300 transition-colors ${
        showAlert ? 'border-rose-200 bg-rose-50/30' : 'border-gray-200'
      }`}
      onClick={() => onBranchClick?.(id)}
    >
      <div className="flex items-center gap-2 mb-2">
        <GitMerge className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
        <span className="text-xs font-medium text-gray-900 truncate flex-1">{name}</span>
        {isDefault && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" title="Default branch" />}
        {isProtected && <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" title="Protected branch" />}
      </div>
      
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getHealthColor(healthScore)}`}>
          {healthScore !== null ? `${healthScore}%` : 'N/A'}
        </span>
        
        {commitCfg && (
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${commitCfg.bg}`} title={commitCfg.label}>
            <CommitIcon className={`w-3 h-3 ${commitCfg.color}`} />
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-auto">
          {showAlert && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100" title={!hasScan ? 'No security scan' : 'Policy bypass detected'}>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            </div>
          )}

          {hasScan && (
            <div 
              className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5"
              onClick={(e) => { e.stopPropagation(); onScanClick?.(id); }}
              title="View scan details"
            >
              <ScanSearch className="w-3.5 h-3.5 text-indigo-600" />
              {scan.types.includes('sast') && <FileCode className="w-3 h-3 text-violet-600" title="SAST" />}
              {scan.types.includes('sca') && <Package className="w-3 h-3 text-orange-600" title="SCA" />}
              {scan.types.includes('secrets') && <Key className="w-3 h-3 text-rose-600" title="Secrets" />}
              {scan.types.includes('iac') && <Cloud className="w-3 h-3 text-sky-600" title="IaC" />}
              
              {scan.findingsCount > 0 && <span className="text-[9px] font-semibold text-rose-600 ml-0.5">{scan.findingsCount}</span>}
              {scan.findingsCount === 0 && <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-0.5" title="No findings" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ CONNECTOR LINES ============
function ConnectorLines({ featureBranches, protectedBranches, containerRef, onLineClick }: any) {
  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    const calculate = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const newLines: any[] = [];
      const allBranches = [...featureBranches, ...protectedBranches];

      featureBranches.forEach((branch: any, index: number) => {
        if (!branch.mergedTo) return;

        const sourceEl = container.querySelector(`[data-branch-id="${branch.id}"]`);
        const targetEl = container.querySelector(`[data-branch-id="${branch.mergedTo}"]`);
        const targetBranch = allBranches.find((b: any) => b.id === branch.mergedTo);

        let effectiveMergeType = branch.mergeType;
        if ((targetBranch?.isProtected || targetBranch?.isDefault) && branch.mergeType === 'direct') {
          effectiveMergeType = 'bypass';
        }

        if (sourceEl && targetEl) {
          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();

          const x1 = sRect.right - rect.left;
          const y1 = sRect.top + sRect.height / 2 - rect.top;
          const x2 = tRect.left - rect.left;
          const y2 = tRect.top + tRect.height / 2 - rect.top;

          const isFeatureToFeature = targetBranch && !targetBranch.isProtected && !targetBranch.isDefault;

          if (isFeatureToFeature) {
            const midX = x1 + 15;
            newLines.push({
              branchId: branch.id,
              mergeType: effectiveMergeType,
              label: branch.prNumber ? `#${branch.prNumber}` : null,
              path: `M ${x1} ${y1} H ${midX} V ${y2} H ${x1 + 5}`,
              labelPos: { x: midX + 3, y: Math.min(y1, y2) + Math.abs(y2 - y1) / 2 - 5 },
              prDetail: branch.prDetail,
              commitDetail: branch.commitDetail,
            });
          } else {
            const midX = x1 + 25 + (index * 10);
            newLines.push({
              branchId: branch.id,
              mergeType: effectiveMergeType,
              label: branch.prNumber ? `#${branch.prNumber}` : null,
              path: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
              labelPos: { x: midX + 3, y: Math.min(y1, y2) + Math.abs(y2 - y1) / 2 - 5 },
              prDetail: branch.prDetail,
              commitDetail: branch.commitDetail,
            });
          }
        }
      });

      protectedBranches.forEach((branch: any) => {
        if (!branch.mergedTo) return;

        const sourceEl = container.querySelector(`[data-branch-id="${branch.id}"]`);
        const targetEl = container.querySelector(`[data-branch-id="${branch.mergedTo}"]`);

        if (sourceEl && targetEl) {
          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();

          const x1 = sRect.right - rect.left;
          const y1 = sRect.top + sRect.height / 2 - rect.top;
          const x2 = tRect.right - rect.left + 12;
          const y2 = tRect.top + tRect.height / 2 - rect.top;

          const midX = x1 + 15;
          newLines.push({
            branchId: branch.id,
            mergeType: branch.mergeType,
            label: branch.prNumber ? `#${branch.prNumber}` : null,
            path: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
            labelPos: { x: midX + 3, y: Math.min(y1, y2) + Math.abs(y2 - y1) / 2 - 5 },
            prDetail: branch.prDetail,
            commitDetail: branch.commitDetail,
          });
        }
      });

      setLines(newLines);
    };

    setTimeout(calculate, 100);
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [featureBranches, protectedBranches, containerRef]);

  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 1 }}>
      <defs>
        <marker id="arr-green" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
          <polygon points="0 0, 5 2, 0 4" fill="#22c55e" />
        </marker>
        <marker id="arr-blue" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
          <polygon points="0 0, 5 2, 0 4" fill="#3b82f6" />
        </marker>
        <marker id="arr-rose" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
          <polygon points="0 0, 5 2, 0 4" fill="#f43f5e" />
        </marker>
      </defs>

      {lines.map((line, i) => {
        const strokeColor = line.mergeType === 'pr' ? '#22c55e' : line.mergeType === 'bypass' ? '#f43f5e' : '#3b82f6';
        const markerEnd = line.mergeType === 'pr' ? 'url(#arr-green)' : line.mergeType === 'bypass' ? 'url(#arr-rose)' : 'url(#arr-blue)';
        
        return (
          <g key={i}>
            <path d={line.path} stroke="transparent" strokeWidth="12" fill="none" className="pointer-events-auto cursor-pointer" onClick={() => onLineClick?.(line)} />
            <path d={line.path} stroke={strokeColor} strokeWidth="1.5" strokeDasharray={line.mergeType === 'pr' ? '5,3' : 'none'} fill="none" className="pointer-events-none" markerEnd={markerEnd} />
            {line.label && (
              <g transform={`translate(${line.labelPos.x}, ${line.labelPos.y})`} className="pointer-events-auto cursor-pointer" onClick={() => onLineClick?.(line)}>
                <rect x="0" y="0" width={line.label.length * 5.5 + 6} height="10" rx="2" 
                  fill={line.mergeType === 'pr' ? '#dcfce7' : line.mergeType === 'bypass' ? '#ffe4e6' : '#dbeafe'} 
                  stroke={line.mergeType === 'pr' ? '#86efac' : line.mergeType === 'bypass' ? '#fda4af' : '#93c5fd'} 
                  strokeWidth="0.5" className="hover:opacity-80" />
                <text x={(line.label.length * 5.5 + 6) / 2} y="7" textAnchor="middle" fontSize="7" fontWeight="600" 
                  fill={line.mergeType === 'pr' ? '#166534' : line.mergeType === 'bypass' ? '#be123c' : '#1e40af'}>
                  {line.label}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ============ LIST VIEW ROW ============
function RepoListRow({ repo, onRowClick }: { repo: Repo; onRowClick: (id: string) => void }) {
  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  const totalFindings = repo.findings.critical + repo.findings.high + repo.findings.medium + repo.findings.low;

  return (
    <tr 
      className="hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={() => onRowClick(repo.id)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100">
            <GitBranch className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">{repo.name}</div>
            <div className="text-xs text-gray-500">{repo.fullName}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-bold px-2.5 py-1 rounded ${getHealthColor(repo.healthScore)}`}>
          {repo.healthScore !== null ? `${repo.healthScore}%` : 'N/A'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <GitMerge className="w-4 h-4" />
          <span>{repo.branches.length || '-'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {totalFindings > 0 ? (
          <div className="flex gap-2 text-xs font-medium">
            {repo.findings.critical > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">{repo.findings.critical} Critical</span>}
            {repo.findings.high > 0 && <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">{repo.findings.high} High</span>}
            {repo.findings.medium > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{repo.findings.medium} Med</span>}
            {repo.findings.low > 0 && <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">{repo.findings.low} Low</span>}
          </div>
        ) : (
          <span className="text-xs text-gray-400">No findings</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>{repo.lastScan ? new Date(repo.lastScan).toLocaleDateString() : 'Never'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <a 
          href={repo.url || `https://github.com/${repo.fullName}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-800"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </td>
    </tr>
  );
}

// ============ LIST VIEW ============
function ListView({ repos, onRowClick }: { repos: Repo[]; onRowClick: (id: string) => void }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Repository</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Health</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Branches</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Findings</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Scan</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-12"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {repos.map(repo => (
            <RepoListRow key={repo.id} repo={repo} onRowClick={onRowClick} />
          ))}
        </tbody>
      </table>
      {repos.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No repositories found.
        </div>
      )}
    </div>
  );
}

// ============ TREE VIEW ============
function TreeView({ repos, expandedId, onRepoClick, onViewClick, onLineClick, onBranchClick, containerRefs }: any) {
  return (
    <>
      {/* Column Headers */}
      <div className="grid grid-cols-[192px_280px_60px_280px] gap-4 mb-3 pb-2 border-b border-gray-200">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Repositories</div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Feature Branches</div>
        <div></div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Protected Branches</div>
      </div>
      
      {/* Repos */}
      <div className="space-y-4">
        {repos.map((repo: Repo) => {
          const isExpanded = expandedId === repo.id;
          const featureBranches = repo.branches.filter(b => !b.isProtected && !b.isDefault);
          const protectedBranches = repo.branches.filter(b => b.isProtected || b.isDefault);
          
          return (
            <div key={repo.id} ref={(el) => { containerRefs.current[repo.id] = el; }} className="relative">
              <div className="grid grid-cols-[192px_280px_60px_280px] gap-4 items-start">
                <RepoCard
                  name={repo.name}
                  fullName={repo.fullName}
                  healthScore={repo.healthScore}
                  findings={repo.findings}
                  isExpanded={isExpanded}
                  isLoading={repo.isLoading}
                  onClick={() => onRepoClick(repo.id)}
                  onViewClick={() => onViewClick(repo.id)}
                />
                
                {isExpanded ? (
                  <>
                    <div className="flex flex-col gap-2 relative z-10">
                      {repo.isLoading ? (
                        <div className="flex items-center gap-2 py-2 text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Loading branches...</span>
                        </div>
                      ) : featureBranches.length > 0 ? (
                        featureBranches.map((branch) => (
                          <BranchCard key={branch.id} {...branch} onBranchClick={(branchId: string) => onBranchClick(repo.id, branchId)} onScanClick={() => {}} />
                        ))
                      ) : (
                        <div className="text-xs text-gray-400 py-2">No feature branches</div>
                      )}
                    </div>
                    <div></div>
                    <div className="flex flex-col gap-2 relative z-10">
                      {!repo.isLoading && protectedBranches.map((branch) => (
                        <BranchCard key={branch.id} {...branch} onBranchClick={(branchId: string) => onBranchClick(repo.id, branchId)} onScanClick={() => {}} />
                      ))}
                    </div>
                    {!repo.isLoading && (
                      <ConnectorLines 
                        featureBranches={featureBranches}
                        protectedBranches={protectedBranches}
                        containerRef={{ current: containerRefs.current[repo.id] }}
                        onLineClick={onLineClick}
                      />
                    )}
                  </>
                ) : (
                  <div className="col-span-3 flex items-center text-gray-400 text-sm py-2">
                    Click to expand
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ============ MAIN PAGE ============
export default function RepoSecurityView() {
  const { currentProject } = useProject();
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedPR, setSelectedPR] = useState<PRDetail | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<CommitDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const containerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (currentProject?.id) {
      loadRepositories();
    }
  }, [currentProject?.id]);

  const loadRepositories = async () => {
    if (!currentProject?.id) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const apiRepos = await fetchRepositories(currentProject.id);
      const reposWithDefaults: Repo[] = apiRepos.map((r: any) => ({
        id: r.id,
        name: r.name,
        fullName: r.fullName,
        healthScore: r.healthScore ?? null,
        findings: r.findings || { critical: 0, high: 0, medium: 0, low: 0 },
        branches: [],
        isLoading: false,
        lastScan: r.lastScanAt,
        url: r.htmlUrl,
      }));
      setRepos(reposWithDefaults);
    } catch (err: any) {
      setError(err.message || 'Failed to load repositories');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBranchesForRepo = async (repoId: string) => {
    if (!currentProject?.id) return;
    
    setRepos(prev => prev.map(r => r.id === repoId ? { ...r, isLoading: true } : r));
    
    try {
      const [branches, pulls, scans, findings] = await Promise.all([
        fetchBranches(repoId),
        fetchPullRequests(repoId),
        fetchScans(currentProject.id, repoId),
        fetchFindings(currentProject.id, repoId),
      ]);
      
      const transformedBranches = transformBranches(branches, scans, pulls);
      const healthScore = calculateHealthScore(findings);
      
      setRepos(prev => prev.map(r => r.id === repoId ? { 
        ...r, 
        branches: transformedBranches,
        findings,
        healthScore,
        isLoading: false,
      } : r));
    } catch (err) {
      console.error('Failed to load branches:', err);
      setRepos(prev => prev.map(r => r.id === repoId ? { ...r, isLoading: false } : r));
    }
  };

  const handleRepoClick = (repoId: string) => {
    if (expandedId === repoId) {
      setExpandedId(null);
    } else {
      setExpandedId(repoId);
      const repo = repos.find(r => r.id === repoId);
      if (repo && repo.branches.length === 0) {
        loadBranchesForRepo(repoId);
      }
    }
  };

  const handleLineClick = (line: any) => {
    if (line.prDetail) {
      setSelectedPR(line.prDetail);
    } else if (line.commitDetail) {
      setSelectedCommit(line.commitDetail);
    }
  };

  const handleListRowClick = (repoId: string) => {
    router.push(`/dashboard/repos/${repoId}`);
  };

  const handleBranchClick = (repoId: string, branchId: string) => {
    router.push(`/dashboard/repos/${repoId}/branch/${encodeURIComponent(branchId)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Repository Security</h1>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'tree' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Tree
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>
          
          <button 
            onClick={loadRepositories}
            disabled={!currentProject}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Legend - only show in tree view */}
      {viewMode === 'tree' && (
        <div className="mb-6 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">Health:</span>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500"></span><span className="text-gray-600">80+</span></div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500"></span><span className="text-gray-600">50-79</span></div>
              <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500"></span><span className="text-gray-600">&lt;50</span></div>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">Branch:</span>
              <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /><span className="text-gray-600">Default</span></div>
              <div className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-blue-500" /><span className="text-gray-600">Protected</span></div>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">Commit:</span>
              <div className="flex items-center gap-1"><GitPullRequest className="w-3.5 h-3.5 text-green-600" /><span className="text-gray-600">PR</span></div>
              <div className="flex items-center gap-1"><Upload className="w-3.5 h-3.5 text-blue-600" /><span className="text-gray-600">Direct</span></div>
              <div className="flex items-center gap-1"><AlertOctagon className="w-3.5 h-3.5 text-rose-600" /><span className="text-gray-600">Bypass</span></div>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">Scan:</span>
              <div className="flex items-center gap-1"><ScanSearch className="w-3.5 h-3.5 text-indigo-600" /><span className="text-gray-600">Scanned</span></div>
              <div className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-rose-600" /><span className="text-gray-600">Not Scanned</span></div>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">Types:</span>
              <div className="flex items-center gap-1"><FileCode className="w-3.5 h-3.5 text-violet-600" /><span className="text-gray-600">SAST</span></div>
              <div className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-orange-600" /><span className="text-gray-600">SCA</span></div>
              <div className="flex items-center gap-1"><Key className="w-3.5 h-3.5 text-rose-600" /><span className="text-gray-600">Secrets</span></div>
              <div className="flex items-center gap-1"><Cloud className="w-3.5 h-3.5 text-sky-600" /><span className="text-gray-600">IaC</span></div>
            </div>
          </div>
        </div>
      )}

      {/* No Project Selected */}
      {!currentProject && (
        <div className="text-center py-12 text-gray-500">
          Please select a project to view repositories.
        </div>
      )}

      {/* Error State */}
      {error && currentProject && (
        <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && currentProject && repos.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="ml-3 text-gray-600">Loading repositories...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && currentProject && repos.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500">
          No repositories found. Connect a repository to get started.
        </div>
      )}

      {/* Content */}
      {currentProject && repos.length > 0 && (
        viewMode === 'tree' ? (
          <TreeView
            repos={repos}
            expandedId={expandedId}
            onRepoClick={handleRepoClick}
            onViewClick={(repoId: string) => router.push(`/dashboard/repos/${repoId}`)}
            onLineClick={handleLineClick}
            onBranchClick={handleBranchClick}
            containerRefs={containerRefs}
          />
        ) : (
          <ListView 
            repos={repos}
            onRowClick={handleListRowClick}
          />
        )
      )}

      {selectedPR && <PRDetailModal pr={selectedPR} onClose={() => setSelectedPR(null)} />}
      {selectedCommit && <CommitDetailModal commit={selectedCommit} onClose={() => setSelectedCommit(null)} />}
    </div>
  );
}
