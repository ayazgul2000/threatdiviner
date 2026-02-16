'use client';

import { useState, useEffect, useRef } from 'react';
import { GitBranch, AlertTriangle, ChevronRight, ChevronDown, GitMerge, Shield, Star, FileCode, Package, Key, Cloud, GitPullRequest, Upload, AlertOctagon, ScanSearch, CheckCircle2, X, User, Clock, GitCommit, CheckCircle, XCircle, MessageSquare } from 'lucide-react';

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
          <div>
            <h3 className="font-medium text-gray-900">{pr.title}</h3>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span>{pr.author}</span>
            </div>
            {pr.mergedAt && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{pr.mergedAt}</span>
              </div>
            )}
          </div>
          
          <div className="text-sm">
            <span className="text-gray-500">Merge: </span>
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{pr.sourceBranch}</code>
            <span className="mx-2 text-gray-400">→</span>
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{pr.targetBranch}</code>
          </div>
          
          {/* Reviewers */}
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Reviewers</div>
            <div className="space-y-1">
              {pr.reviewers.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {r.approved ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="text-gray-700">{r.name}</span>
                  <span className="text-xs text-gray-400">{r.approved ? 'Approved' : 'Pending'}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Checks */}
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Checks</div>
            <div className="space-y-1">
              {pr.checks.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {c.status === 'passed' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : c.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-rose-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="text-gray-700">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          {pr.mergedBy && (
            <div className="text-sm text-gray-600">
              <span className="text-gray-500">Merged by: </span>
              <span>{pr.mergedBy}</span>
            </div>
          )}
          
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <MessageSquare className="w-4 h-4" />
            <span>{pr.comments} comments</span>
          </div>
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
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                Bypass
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 space-y-3">
          <div>
            <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">{commit.sha}</code>
          </div>
          
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

// ============ REPO CARD ============
function RepoCard({ name, fullName, healthScore, findings, isExpanded = false, onClick }: any) {
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
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${getHealthColor(healthScore)}`}>
          {healthScore !== null ? `${healthScore}%` : 'N/A'}
        </span>
        {totalFindings > 0 && (
          <div className="flex gap-1.5 text-[10px] font-medium">
            {findings.critical > 0 && <span className="text-purple-600">{findings.critical}C</span>}
            {findings.high > 0 && <span className="text-rose-600">{findings.high}H</span>}
            {findings.medium > 0 && <span className="text-amber-600">{findings.medium}M</span>}
            {findings.low > 0 && <span className="text-yellow-600">{findings.low}L</span>}
          </div>
        )}
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

  // Auto-flag: direct push to protected branch = bypass
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
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <GitMerge className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
        <span className="text-xs font-medium text-gray-900 truncate flex-1">{name}</span>
        {isDefault && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" title="Default branch" />}
        {isProtected && <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" title="Protected branch" />}
      </div>
      
      {/* Health + Commit Source + Scan Status */}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getHealthColor(healthScore)}`}>
          {healthScore !== null ? `${healthScore}%` : 'N/A'}
        </span>
        
        {/* Commit source */}
        {commitCfg && (
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${commitCfg.bg}`} title={commitCfg.label}>
            <CommitIcon className={`w-3 h-3 ${commitCfg.color}`} />
          </div>
        )}

        {/* Scan status area */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Alert for no scan or bypass */}
          {showAlert && (
            <div 
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100" 
              title={!hasScan ? 'No security scan' : 'Policy bypass detected'}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            </div>
          )}

          {/* Scan indicator + types - ONLY if scanned */}
          {hasScan && (
            <div 
              className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5"
              onClick={(e) => { e.stopPropagation(); onScanClick?.(id); }}
              title="View scan details"
            >
              <ScanSearch className="w-3.5 h-3.5 text-indigo-600" />
              
              {scan.types.includes('sast') && (
                <FileCode className="w-3 h-3 text-violet-600" title="SAST" />
              )}
              {scan.types.includes('sca') && (
                <Package className="w-3 h-3 text-orange-600" title="SCA" />
              )}
              {scan.types.includes('secrets') && (
                <Key className="w-3 h-3 text-rose-600" title="Secrets" />
              )}
              {scan.types.includes('iac') && (
                <Cloud className="w-3 h-3 text-sky-600" title="IaC" />
              )}
              
              {scan.findingsCount > 0 && (
                <span className="text-[9px] font-semibold text-rose-600 ml-0.5">{scan.findingsCount}</span>
              )}
              {scan.findingsCount === 0 && (
                <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-0.5" title="No findings" />
              )}
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

        // Auto-detect bypass: direct push to protected branch
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
              clickArea: { x1, y1, x2: midX, y2 },
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
              clickArea: { x1, y1, x2, y2 },
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
            clickArea: { x1, y1, x2, y2 },
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
            {/* Invisible wider path for easier clicking */}
            <path
              d={line.path}
              stroke="transparent"
              strokeWidth="12"
              fill="none"
              className="pointer-events-auto cursor-pointer"
              onClick={() => onLineClick?.(line)}
            />
            {/* Visible path */}
            <path
              d={line.path}
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeDasharray={line.mergeType === 'pr' ? '5,3' : 'none'}
              fill="none"
              className="pointer-events-none"
              markerEnd={markerEnd}
            />
            {/* Clickable label */}
            {line.label && (
              <g 
                transform={`translate(${line.labelPos.x}, ${line.labelPos.y})`}
                className="pointer-events-auto cursor-pointer"
                onClick={() => onLineClick?.(line)}
              >
                <rect 
                  x="0" y="0" 
                  width={line.label.length * 5.5 + 6} height="10" rx="2" 
                  fill={line.mergeType === 'pr' ? '#dcfce7' : line.mergeType === 'bypass' ? '#ffe4e6' : '#dbeafe'} 
                  stroke={line.mergeType === 'pr' ? '#86efac' : line.mergeType === 'bypass' ? '#fda4af' : '#93c5fd'} 
                  strokeWidth="0.5"
                  className="hover:opacity-80"
                />
                <text 
                  x={(line.label.length * 5.5 + 6) / 2} y="7" 
                  textAnchor="middle" 
                  fontSize="7" 
                  fontWeight="600" 
                  fill={line.mergeType === 'pr' ? '#166534' : line.mergeType === 'bypass' ? '#be123c' : '#1e40af'}
                >
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

// ============ TEST DATA ============
const testRepos: Repo[] = [
  { 
    id: '1', 
    name: 'api-gateway', 
    fullName: 'acme/api-gateway', 
    healthScore: 85, 
    findings: { critical: 0, high: 2, medium: 5, low: 8 },
    branches: [
      { 
        id: 'b1', name: 'feature/auth', healthScore: 72, mergedTo: 'b4', mergeType: 'pr', prNumber: 42, commitSource: 'pr', 
        scan: { types: ['sast', 'secrets'], findingsCount: 0 },
        prDetail: {
          number: 42, title: 'Add OAuth2 authentication', author: 'john.doe', sourceBranch: 'feature/auth', targetBranch: 'develop',
          status: 'merged', reviewers: [{ name: 'jane.smith', approved: true }, { name: 'bob.wilson', approved: true }],
          checks: [{ name: 'ThreatDiviner SAST', status: 'passed' }, { name: 'ThreatDiviner Secrets', status: 'passed' }, { name: 'Unit Tests', status: 'passed' }],
          mergedAt: '2 hours ago', mergedBy: 'jane.smith', comments: 8
        }
      },
      { 
        id: 'b2', name: 'feature/rate-limit', healthScore: 68, mergedTo: 'b4', mergeType: 'pr', prNumber: 43, commitSource: 'direct', 
        scan: null,
        prDetail: {
          number: 43, title: 'Implement rate limiting', author: 'alice.dev', sourceBranch: 'feature/rate-limit', targetBranch: 'develop',
          status: 'merged', reviewers: [{ name: 'john.doe', approved: true }],
          checks: [{ name: 'Unit Tests', status: 'passed' }],
          mergedAt: '5 hours ago', mergedBy: 'john.doe', comments: 3
        }
      },
      { 
        id: 'b3', name: 'hotfix/sec-patch', healthScore: 90, mergedTo: 'b5', mergeType: 'pr', prNumber: 44, commitSource: 'pr', 
        scan: { types: ['sast', 'sca', 'secrets', 'iac'], findingsCount: 1 },
        prDetail: {
          number: 44, title: 'Fix SQL injection vulnerability', author: 'security.team', sourceBranch: 'hotfix/sec-patch', targetBranch: 'main',
          status: 'merged', reviewers: [{ name: 'jane.smith', approved: true }, { name: 'bob.wilson', approved: true }, { name: 'ciso', approved: true }],
          checks: [{ name: 'ThreatDiviner SAST', status: 'passed' }, { name: 'ThreatDiviner SCA', status: 'passed' }, { name: 'ThreatDiviner Secrets', status: 'passed' }, { name: 'ThreatDiviner IaC', status: 'passed' }],
          mergedAt: '1 hour ago', mergedBy: 'ciso', comments: 12
        }
      },
      { 
        id: 'b4', name: 'develop', healthScore: 75, isProtected: true, mergedTo: 'b5', mergeType: 'pr', prNumber: 40, commitSource: 'pr', 
        scan: { types: ['sast', 'sca'], findingsCount: 5 },
        prDetail: {
          number: 40, title: 'Release v1.4.0', author: 'release.bot', sourceBranch: 'develop', targetBranch: 'main',
          status: 'merged', reviewers: [{ name: 'tech.lead', approved: true }, { name: 'qa.lead', approved: true }],
          checks: [{ name: 'ThreatDiviner SAST', status: 'passed' }, { name: 'ThreatDiviner SCA', status: 'passed' }, { name: 'Integration Tests', status: 'passed' }, { name: 'E2E Tests', status: 'passed' }],
          mergedAt: '30 min ago', mergedBy: 'tech.lead', comments: 5
        }
      },
      { 
        id: 'b5', name: 'main', healthScore: 88, isDefault: true, isProtected: true, commitSource: 'pr', 
        scan: { types: ['sast', 'sca', 'secrets', 'iac'], findingsCount: 3 }
      },
    ],
  },
  { 
    id: '2', 
    name: 'web-frontend', 
    fullName: 'acme/web-frontend', 
    healthScore: 62, 
    findings: { critical: 1, high: 4, medium: 12, low: 3 },
    branches: [
      { 
        id: 'b6', name: 'feature/dashboard', healthScore: 58, mergedTo: 'b7', mergeType: 'direct', commitSource: 'direct', 
        scan: null,
        commitDetail: {
          sha: 'a1b2c3d4e5f6', message: 'WIP: Dashboard updates', author: 'intern.dev', timestamp: '3 hours ago', isBypass: true
        }
      },
      { 
        id: 'b7', name: 'main', healthScore: 65, isDefault: true, isProtected: true, commitSource: 'bypass', 
        scan: { types: ['sast', 'sca'], findingsCount: 17 },
        commitDetail: {
          sha: 'f6e5d4c3b2a1', message: 'Emergency hotfix - bypassed reviews', author: 'panicked.dev', timestamp: '1 hour ago', isBypass: true
        }
      },
    ],
  },
  { 
    id: '3', 
    name: 'auth-service', 
    fullName: 'acme/auth-service', 
    healthScore: null, 
    findings: { critical: 0, high: 0, medium: 0, low: 0 },
    branches: [
      { id: 'b8', name: 'main', healthScore: null, isDefault: true, isProtected: true, scan: null },
    ],
  },
];

// ============ MAIN PAGE ============
export default function RepoSecurityView() {
  const [expandedId, setExpandedId] = useState<string | null>('1');
  const [selectedPR, setSelectedPR] = useState<PRDetail | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<CommitDetail | null>(null);
  const containerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleBranchClick = (branchId: string) => {
    console.log('Branch clicked:', branchId);
  };

  const handleScanClick = (branchId: string) => {
    console.log('Scan clicked for branch:', branchId);
  };

  const handleLineClick = (line: any) => {
    if (line.prDetail) {
      setSelectedPR(line.prDetail);
    } else if (line.commitDetail) {
      setSelectedCommit(line.commitDetail);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">Repository Security</h1>

      {/* Legend */}
      <div className="mb-6 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          
          {/* Health */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Health:</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
              <span className="text-gray-600">80+</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-500"></span>
              <span className="text-gray-600">50-79</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-rose-500"></span>
              <span className="text-gray-600">&lt;50</span>
            </div>
          </div>
          
          <div className="w-px h-4 bg-gray-200" />
          
          {/* Branch */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Branch:</span>
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span className="text-gray-600">Default</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-gray-600">Protected</span>
            </div>
          </div>
          
          <div className="w-px h-4 bg-gray-200" />
          
          {/* Commit */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Commit:</span>
            <div className="flex items-center gap-1">
              <GitPullRequest className="w-3.5 h-3.5 text-green-600" />
              <span className="text-gray-600">PR</span>
            </div>
            <div className="flex items-center gap-1">
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-gray-600">Direct</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-gray-600">Bypass</span>
            </div>
          </div>

          <div className="w-px h-4 bg-gray-200" />

          {/* Scan Status */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Scan:</span>
            <div className="flex items-center gap-1">
              <ScanSearch className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-gray-600">Scanned</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-gray-600">Not Scanned</span>
            </div>
          </div>

          <div className="w-px h-4 bg-gray-200" />

          {/* Scan Types */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Types:</span>
            <div className="flex items-center gap-1">
              <FileCode className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-gray-600">SAST</span>
            </div>
            <div className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-gray-600">SCA</span>
            </div>
            <div className="flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-gray-600">Secrets</span>
            </div>
            <div className="flex items-center gap-1">
              <Cloud className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-gray-600">IaC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[192px_280px_60px_280px] gap-4 mb-3 pb-2 border-b border-gray-200">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Repositories</div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Feature Branches</div>
        <div></div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Protected Branches</div>
      </div>
      
      {/* Repos */}
      <div className="space-y-4">
        {testRepos.map((repo) => {
          const isExpanded = expandedId === repo.id;
          const featureBranches = repo.branches.filter(b => !b.isProtected && !b.isDefault);
          const protectedBranches = repo.branches.filter(b => b.isProtected || b.isDefault);
          
          return (
            <div 
              key={repo.id} 
              ref={(el) => { containerRefs.current[repo.id] = el; }}
              className="relative"
            >
              <div className="grid grid-cols-[192px_280px_60px_280px] gap-4 items-start">
                {/* Repo Card */}
                <RepoCard
                  name={repo.name}
                  fullName={repo.fullName}
                  healthScore={repo.healthScore}
                  findings={repo.findings}
                  isExpanded={isExpanded}
                  onClick={() => setExpandedId(isExpanded ? null : repo.id)}
                />
                
                {isExpanded ? (
                  <>
                    {/* Feature Branches */}
                    <div className="flex flex-col gap-2 relative z-10">
                      {featureBranches.length > 0 ? (
                        featureBranches.map((branch) => (
                          <BranchCard 
                            key={branch.id} 
                            {...branch} 
                            onBranchClick={handleBranchClick}
                            onScanClick={handleScanClick}
                          />
                        ))
                      ) : (
                        <div className="text-xs text-gray-400 py-2">No feature branches</div>
                      )}
                    </div>

                    <div></div>

                    {/* Protected Branches */}
                    <div className="flex flex-col gap-2 relative z-10">
                      {protectedBranches.map((branch) => (
                        <BranchCard 
                          key={branch.id} 
                          {...branch} 
                          onBranchClick={handleBranchClick}
                          onScanClick={handleScanClick}
                        />
                      ))}
                    </div>

                    <ConnectorLines 
                      featureBranches={featureBranches}
                      protectedBranches={protectedBranches}
                      containerRef={{ current: containerRefs.current[repo.id] }}
                      onLineClick={handleLineClick}
                    />
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

      {/* PR Detail Modal */}
      {selectedPR && (
        <PRDetailModal pr={selectedPR} onClose={() => setSelectedPR(null)} />
      )}

      {/* Commit Detail Modal */}
      {selectedCommit && (
        <CommitDetailModal commit={selectedCommit} onClose={() => setSelectedCommit(null)} />
      )}
    </div>
  );
}
