'use client';

import { useState, useEffect, useRef } from 'react';
import { GitBranch, GitMerge, Shield, Star, GitPullRequest, Upload, AlertOctagon, ScanSearch, FileCode, Package, Key, Cloud, CheckCircle2, AlertTriangle, ArrowLeft, ExternalLink, Settings, Clock, User, CheckCircle, XCircle, Play, MoreVertical, Loader2, RefreshCw, Calendar, X } from 'lucide-react';
import { useProject } from '@/contexts/project-context';
import { useRouter, useParams } from 'next/navigation';

const API_BASE = 'http://localhost:3001';

// ============ API FUNCTIONS ============
async function fetchRepository(repositoryId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/scm/repositories/${repositoryId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch repository');
  return res.json();
}

async function fetchBranches(repositoryId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/scm/repositories/${repositoryId}/branches`, { credentials: 'include' });
  if (!res.ok) return [];
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
interface Branch {
  id: string;
  name: string;
  healthScore: number | null;
  isDefault?: boolean;
  isProtected?: boolean;
  mergedTo?: string;
  mergeType?: 'pr' | 'direct' | 'bypass';
  prNumber?: number;
  scan?: { types: string[]; findingsCount: number; timestamp?: string } | null;
  commitSource?: 'pr' | 'direct' | 'bypass';
}

// ============ TRANSFORM ============
function transformBranches(apiBranches: any[], scans: any[], pulls: any[]): Branch[] {
  const scansByBranch: Record<string, any[]> = {};
  scans.forEach(scan => {
    const branch = (scan.branch || 'main').toLowerCase();
    if (!scansByBranch[branch]) scansByBranch[branch] = [];
    scansByBranch[branch].push(scan);
  });

  const prBySourceBranch: Record<string, any> = {};
  pulls
    .filter(pr => pr.state === 'merged')
    .sort((a, b) => new Date(b.mergedAt || b.updatedAt).getTime() - new Date(a.mergedAt || a.updatedAt).getTime())
    .forEach(pr => {
      const sourceBranch = (pr.headBranch || pr.sourceBranch || '').toLowerCase();
      if (sourceBranch && !prBySourceBranch[sourceBranch]) {
        prBySourceBranch[sourceBranch] = pr;
      }
    });

  return apiBranches.map((b) => {
    const branchName = typeof b === 'string' ? b : b.name;
    const branchNameLower = branchName.toLowerCase();
    const branchScans = scansByBranch[branchNameLower] || [];
    const latestScan = branchScans[0];
    const mergedPR = prBySourceBranch[branchNameLower];
    
    const scanTypes: string[] = [];
    if (latestScan) {
      if (latestScan.sastEnabled || latestScan.scanners?.includes('semgrep')) scanTypes.push('sast');
      if (latestScan.scaEnabled || latestScan.scanners?.includes('trivy')) scanTypes.push('sca');
      if (latestScan.secretsEnabled || latestScan.scanners?.includes('gitleaks')) scanTypes.push('secrets');
      if (latestScan.iacEnabled || latestScan.scanners?.includes('checkov')) scanTypes.push('iac');
      if (scanTypes.length === 0) scanTypes.push('sast');
    }

    const isDefaultBranch = branchName === 'main' || branchName === 'master';
    const isProtectedBranch = isDefaultBranch || branchName === 'develop' || branchName === 'development';

    return {
      id: branchName,
      name: branchName,
      healthScore: latestScan?.healthScore ?? null,
      isDefault: isDefaultBranch,
      isProtected: isProtectedBranch,
      mergedTo: mergedPR ? (mergedPR.baseBranch || mergedPR.targetBranch) : undefined,
      mergeType: mergedPR ? 'pr' : undefined,
      prNumber: mergedPR?.number,
      scan: latestScan ? {
        types: scanTypes,
        findingsCount: latestScan.findingsCount || 0,
        timestamp: latestScan.createdAt,
      } : null,
      commitSource: latestScan?.triggerEvent === 'pull_request' ? 'pr' : 
                    latestScan?.triggerEvent === 'push' ? 'direct' : 
                    mergedPR ? 'pr' : undefined,
    };
  });
}

// ============ BRANCH CARD ============
function BranchCard({ branch, onClick }: { branch: Branch; onClick: () => void }) {
  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  const hasScan = branch.scan?.types?.length > 0;
  const showAlert = !hasScan;

  return (
    <div
      data-branch-id={branch.id}
      onClick={onClick}
      className={`w-56 p-2.5 rounded-lg border shadow-sm bg-white cursor-pointer hover:border-indigo-300 transition-colors relative z-10 ${
        showAlert ? 'border-rose-200 bg-rose-50/30' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <GitMerge className="w-3.5 h-3.5 text-teal-600" />
        <span className="text-xs font-medium text-gray-900 truncate flex-1">{branch.name}</span>
        {branch.isDefault && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
        {branch.isProtected && <Shield className="w-3.5 h-3.5 text-blue-500" />}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getHealthColor(branch.healthScore)}`}>
          {branch.healthScore !== null ? `${branch.healthScore}%` : 'N/A'}
        </span>
        {branch.commitSource === 'pr' && <GitPullRequest className="w-3 h-3 text-green-600" />}
        {branch.commitSource === 'direct' && <Upload className="w-3 h-3 text-blue-600" />}
        <div className="flex items-center gap-1 ml-auto">
          {showAlert && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
          {hasScan && (
            <>
              <ScanSearch className="w-3.5 h-3.5 text-indigo-600" />
              {branch.scan!.types.includes('sast') && <FileCode className="w-3 h-3 text-violet-600" />}
              {branch.scan!.types.includes('sca') && <Package className="w-3 h-3 text-orange-600" />}
              {branch.scan!.types.includes('secrets') && <Key className="w-3 h-3 text-rose-600" />}
              {branch.scan!.types.includes('iac') && <Cloud className="w-3 h-3 text-sky-600" />}
              {branch.scan!.findingsCount > 0 && <span className="text-[9px] font-semibold text-rose-600">{branch.scan!.findingsCount}</span>}
              {branch.scan!.findingsCount === 0 && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ CONNECTOR LINES ============
function ConnectorLines({ featureBranches, protectedBranches, containerRef }: any) {
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
        if (sourceEl && targetEl) {
          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();
          const x1 = sRect.right - rect.left;
          const y1 = sRect.top + sRect.height / 2 - rect.top;
          const x2 = tRect.left - rect.left;
          const y2 = tRect.top + tRect.height / 2 - rect.top;
          const midX = x1 + 25 + (index * 10);
          newLines.push({
            path: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
            label: branch.prNumber ? `#${branch.prNumber}` : null,
            labelPos: { x: midX + 3, y: Math.min(y1, y2) + Math.abs(y2 - y1) / 2 - 5 },
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
      </defs>
      {lines.map((line, i) => (
        <g key={i}>
          <path d={line.path} stroke="#22c55e" strokeWidth="1.5" strokeDasharray="5,3" fill="none" markerEnd="url(#arr-green)" />
          {line.label && (
            <g transform={`translate(${line.labelPos.x}, ${line.labelPos.y})`}>
              <rect x="0" y="0" width={line.label.length * 5.5 + 6} height="10" rx="2" fill="#dcfce7" stroke="#86efac" strokeWidth="0.5" />
              <text x={(line.label.length * 5.5 + 6) / 2} y="7" textAnchor="middle" fontSize="7" fontWeight="600" fill="#166534">{line.label}</text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

// ============ BRANCH SETTINGS MODAL ============
interface BranchSettings {
  disableInheritance: boolean;
  scanners: {
    sast: boolean;
    sca: boolean;
    secrets: boolean;
    iac: boolean;
  };
  scanOnPush: boolean;
  blockSeverity: string;
}

function BranchSettingsModal({
  branch,
  repoSettings,
  onClose,
  onSave
}: {
  branch: Branch;
  repoSettings: any;
  onClose: () => void;
  onSave: (branchId: string, settings: BranchSettings) => void;
}) {
  const [settings, setSettings] = useState<BranchSettings>({
    disableInheritance: false,
    scanners: {
      sast: true,
      sca: true,
      secrets: true,
      iac: false,
    },
    scanOnPush: true,
    blockSeverity: 'none',
  });

  const isProtected = branch.isProtected || branch.isDefault;

  // Get repo-level settings (these would come from API in production)
  const repoScanConfig = repoSettings?.scanConfig || {
    enableSast: true,
    enableSca: true,
    enableSecrets: true,
    enableIac: false,
    scanOnPr: true,
    scanOnPush: true,
    aiTriageEnabled: false,
  };

  const handleSave = () => {
    onSave(branch.id, settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-[500px] max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-gray-900">Branch Settings</span>
            <code className="ml-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded">{branch.name}</code>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Inherited Settings Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              Inherited from Repository
              <span className="text-xs font-normal text-gray-500">(read-only)</span>
            </h3>
            <div className={`bg-gray-50 rounded-lg p-4 space-y-3 ${settings.disableInheritance ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500 w-28">Scanners:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {repoScanConfig.enableSast && <span className="flex items-center gap-1 text-violet-600"><FileCode className="w-4 h-4" /> SAST</span>}
                  {repoScanConfig.enableSca && <span className="flex items-center gap-1 text-orange-600"><Package className="w-4 h-4" /> SCA</span>}
                  {repoScanConfig.enableSecrets && <span className="flex items-center gap-1 text-rose-600"><Key className="w-4 h-4" /> Secrets</span>}
                  {repoScanConfig.enableIac && <span className="flex items-center gap-1 text-sky-600"><Cloud className="w-4 h-4" /> IaC</span>}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500 w-28">Auto-scan:</span>
                <span className="text-gray-700">
                  {repoScanConfig.scanOnPr && 'PR'}{repoScanConfig.scanOnPr && repoScanConfig.scanOnPush && ', '}{repoScanConfig.scanOnPush && 'Push'}
                  {!repoScanConfig.scanOnPr && !repoScanConfig.scanOnPush && 'Manual only'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-500 w-28">AI Triage:</span>
                <span className="text-gray-700">{repoScanConfig.aiTriageEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>

          {/* Disable Inheritance Toggle */}
          <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div>
              <div className="text-sm font-medium text-amber-900">Disable Inheritance</div>
              <div className="text-xs text-amber-700">When enabled, this branch will not inherit future changes from repository settings</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.disableInheritance}
                onChange={(e) => setSettings({...settings, disableInheritance: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Branch Overrides */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Branch Overrides</h3>
            <div className={`rounded-lg p-4 space-y-4 border ${settings.disableInheritance ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-50 pointer-events-none'}`}>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Scanners</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.scanners.sast}
                      onChange={e => setSettings({...settings, scanners: {...settings.scanners, sast: e.target.checked}})}
                      className="rounded"
                      disabled={!settings.disableInheritance}
                    />
                    <FileCode className="w-4 h-4 text-violet-600" />
                    <span className="text-sm">SAST</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.scanners.sca}
                      onChange={e => setSettings({...settings, scanners: {...settings.scanners, sca: e.target.checked}})}
                      className="rounded"
                      disabled={!settings.disableInheritance}
                    />
                    <Package className="w-4 h-4 text-orange-600" />
                    <span className="text-sm">SCA</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.scanners.secrets}
                      onChange={e => setSettings({...settings, scanners: {...settings.scanners, secrets: e.target.checked}})}
                      className="rounded"
                      disabled={!settings.disableInheritance}
                    />
                    <Key className="w-4 h-4 text-rose-600" />
                    <span className="text-sm">Secrets</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.scanners.iac}
                      onChange={e => setSettings({...settings, scanners: {...settings.scanners, iac: e.target.checked}})}
                      className="rounded"
                      disabled={!settings.disableInheritance}
                    />
                    <Cloud className="w-4 h-4 text-sky-600" />
                    <span className="text-sm">IaC</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.scanOnPush}
                    onChange={(e) => setSettings({...settings, scanOnPush: e.target.checked})}
                    className="rounded"
                    disabled={!settings.disableInheritance}
                  />
                  <span className="text-sm text-gray-700">Scan on every push to this branch</span>
                </label>
              </div>

              {isProtected && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Block PR on Severity</label>
                  <select
                    value={settings.blockSeverity}
                    onChange={(e) => setSettings({...settings, blockSeverity: e.target.value})}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full"
                    disabled={!settings.disableInheritance}
                  >
                    <option value="none">None (Do not block)</option>
                    <option value="critical">Critical only</option>
                    <option value="high">High and above</option>
                    <option value="medium">Medium and above</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Override PR blocking rules for this protected branch</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ BRANCHES TAB ============
function BranchesTab({ branches, onBranchClick, onSettingsClick }: { branches: Branch[]; onBranchClick: (id: string) => void; onSettingsClick: (branch: Branch) => void }) {
  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  if (branches.length === 0) {
    return <div className="text-center py-8 text-gray-500">No branches found</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Branch</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Health</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Scan Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Activity</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-24">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {branches.map((branch) => (
            <tr 
              key={branch.id} 
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => onBranchClick(branch.id)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <GitMerge className="w-4 h-4 text-teal-600" />
                  <span className="font-medium text-gray-900">{branch.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  {branch.isDefault && <Star className="w-4 h-4 text-amber-500 fill-amber-500" title="Default" />}
                  {branch.isProtected && <Shield className="w-4 h-4 text-blue-500" title="Protected" />}
                  {!branch.isDefault && !branch.isProtected && <span className="text-xs text-gray-400">Feature</span>}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold px-2 py-1 rounded ${getHealthColor(branch.healthScore)}`}>
                  {branch.healthScore !== null ? `${branch.healthScore}%` : 'N/A'}
                </span>
              </td>
              <td className="px-4 py-3">
                {branch.scan ? (
                  <div className="flex items-center gap-1">
                    {branch.scan.types.includes('sast') && <FileCode className="w-4 h-4 text-violet-600" title="SAST" />}
                    {branch.scan.types.includes('sca') && <Package className="w-4 h-4 text-orange-600" title="SCA" />}
                    {branch.scan.types.includes('secrets') && <Key className="w-4 h-4 text-rose-600" title="Secrets" />}
                    {branch.scan.types.includes('iac') && <Cloud className="w-4 h-4 text-sky-600" title="IaC" />}
                    {branch.scan.findingsCount > 0 && (
                      <span className="text-xs font-medium text-rose-600 ml-1">{branch.scan.findingsCount} findings</span>
                    )}
                    {branch.scan.findingsCount === 0 && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-1" title="Clean" />
                    )}
                  </div>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-rose-600">
                    <AlertTriangle className="w-4 h-4" /> Not scanned
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {branch.scan?.timestamp ? new Date(branch.scan.timestamp).toLocaleDateString() : '-'}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSettingsClick(branch); }}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Branch settings"
                  >
                    <Settings className="w-4 h-4 text-gray-500 hover:text-indigo-600" />
                  </button>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScanHistoryTab({ scans }: { scans: any[] }) {
  if (scans.length === 0) {
    return <div className="text-center py-8 text-gray-500">No scans yet</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Branch</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Types</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Findings</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Triggered By</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {scans.map((scan, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{scan.branch || 'main'}</code>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  {(scan.sastEnabled || scan.scanners?.includes('semgrep')) && <FileCode className="w-3.5 h-3.5 text-violet-600" />}
                  {(scan.scaEnabled || scan.scanners?.includes('trivy')) && <Package className="w-3.5 h-3.5 text-orange-600" />}
                  {(scan.secretsEnabled || scan.scanners?.includes('gitleaks')) && <Key className="w-3.5 h-3.5 text-rose-600" />}
                  {(scan.iacEnabled || scan.scanners?.includes('checkov')) && <Cloud className="w-3.5 h-3.5 text-sky-600" />}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  scan.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                  scan.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {scan.status || 'completed'}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`text-sm font-medium ${(scan.findingsCount || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {scan.findingsCount || 0}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {scan.triggerEvent === 'pull_request' ? `PR #${scan.pullRequestId || '?'}` : scan.triggerEvent || 'Manual'}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {scan.createdAt ? new Date(scan.createdAt).toLocaleString() : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ PR ACTIVITY TAB ============
function PRActivityTab({ pulls }: { pulls: any[] }) {
  if (pulls.length === 0) {
    return <div className="text-center py-8 text-gray-500">No pull requests yet</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">PR</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Title</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Branch</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Author</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {pulls.map((pr, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <span className="font-medium text-gray-900">#{pr.number}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-900">{pr.title}</span>
              </td>
              <td className="px-4 py-3">
                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{pr.headBranch || pr.sourceBranch}</code>
                <span className="mx-1 text-gray-400">→</span>
                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{pr.baseBranch || pr.targetBranch}</code>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  pr.state === 'merged' ? 'bg-purple-100 text-purple-700' :
                  pr.state === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {pr.state}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{pr.author}</td>
              <td className="px-4 py-3">
                <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ SETTINGS TAB ============
function SettingsTab({ repo }: { repo: any }) {
  const [scanConfig, setScanConfig] = useState({
    sast: true,
    sca: true,
    secrets: true,
    iac: false,
  });
  const [autoScan, setAutoScan] = useState({
    onPR: true,
    onPush: true,
    scheduled: false,
  });

  return (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Scan Configuration</h3>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={scanConfig.sast} onChange={e => setScanConfig({...scanConfig, sast: e.target.checked})} className="rounded" />
            <FileCode className="w-4 h-4 text-violet-600" />
            <span className="text-sm">SAST</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={scanConfig.sca} onChange={e => setScanConfig({...scanConfig, sca: e.target.checked})} className="rounded" />
            <Package className="w-4 h-4 text-orange-600" />
            <span className="text-sm">SCA</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={scanConfig.secrets} onChange={e => setScanConfig({...scanConfig, secrets: e.target.checked})} className="rounded" />
            <Key className="w-4 h-4 text-rose-600" />
            <span className="text-sm">Secrets</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={scanConfig.iac} onChange={e => setScanConfig({...scanConfig, iac: e.target.checked})} className="rounded" />
            <Cloud className="w-4 h-4 text-sky-600" />
            <span className="text-sm">IaC</span>
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Auto-scan Triggers</h3>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoScan.onPR} onChange={e => setAutoScan({...autoScan, onPR: e.target.checked})} className="rounded" />
            <GitPullRequest className="w-4 h-4 text-green-600" />
            <span className="text-sm">On Pull Request</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoScan.onPush} onChange={e => setAutoScan({...autoScan, onPush: e.target.checked})} className="rounded" />
            <Upload className="w-4 h-4 text-blue-600" />
            <span className="text-sm">On Push to Protected</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoScan.scheduled} onChange={e => setAutoScan({...autoScan, scheduled: e.target.checked})} className="rounded" />
            <Calendar className="w-4 h-4 text-gray-600" />
            <span className="text-sm">Scheduled (Daily)</span>
          </label>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Play className="w-4 h-4" />
          Run Scan Now
        </button>
      </div>
    </div>
  );
}

// ============ MAIN PAGE ============
export default function RepoDetailPage() {
  const { currentProject } = useProject();
  const router = useRouter();
  const params = useParams();
  const repoId = params?.repoId as string;

  const [repo, setRepo] = useState<any>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [pulls, setPulls] = useState<any[]>([]);
  const [findings, setFindings] = useState({ critical: 0, high: 0, medium: 0, low: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'branches' | 'scans' | 'prs' | 'settings'>('branches');
  const [selectedBranchForSettings, setSelectedBranchForSettings] = useState<Branch | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (repoId && currentProject?.id) {
      loadRepoData();
    }
  }, [repoId, currentProject?.id]);

  const loadRepoData = async () => {
    if (!repoId || !currentProject?.id) return;
    setIsLoading(true);
    try {
      const [repoData, branchData, pullData, scanData, findingData] = await Promise.all([
        fetchRepository(repoId),
        fetchBranches(repoId),
        fetchPullRequests(repoId),
        fetchScans(currentProject.id, repoId),
        fetchFindings(currentProject.id, repoId),
      ]);
      setRepo(repoData);
      setBranches(transformBranches(branchData, scanData, pullData));
      setScans(scanData);
      setPulls(pullData);
      setFindings(findingData);
    } catch (err) {
      console.error('Failed to load repo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  const healthScore = findings ? Math.max(0, 100 - (findings.critical * 20 + findings.high * 10 + findings.medium * 5 + findings.low * 2)) : null;
  const featureBranches = branches.filter(b => !b.isProtected && !b.isDefault);
  const protectedBranches = branches.filter(b => b.isProtected || b.isDefault);

  const handleBranchClick = (branchId: string) => {
    router.push(`/dashboard/repos/${repoId}/branch/${encodeURIComponent(branchId)}`);
  };

  const handleBranchSettingsClick = (branch: Branch) => {
    setSelectedBranchForSettings(branch);
  };

  const handleSaveBranchSettings = (branchId: string, settings: any) => {
    // In production, this would save to the API
    console.log('Saving branch settings:', branchId, settings);
    // TODO: Call API to save branch-level settings
    setSelectedBranchForSettings(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="ml-3 text-gray-600">Loading repository...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/repos')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100">
                <GitBranch className="w-5 h-5 text-indigo-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">{repo?.name || 'Repository'}</h1>
              <span className={`text-sm font-bold px-2.5 py-1 rounded ${getHealthColor(healthScore)}`}>
                {healthScore !== null ? `${healthScore}%` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span>{repo?.fullName}</span>
              {(findings.critical + findings.high + findings.medium + findings.low) > 0 && (
                <div className="flex gap-2 text-xs font-medium">
                  {findings.critical > 0 && <span className="text-purple-600">{findings.critical}C</span>}
                  {findings.high > 0 && <span className="text-rose-600">{findings.high}H</span>}
                  {findings.medium > 0 && <span className="text-amber-600">{findings.medium}M</span>}
                  {findings.low > 0 && <span className="text-yellow-600">{findings.low}L</span>}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={repo?.htmlUrl || `https://github.com/${repo?.fullName}`} target="_blank" rel="noopener noreferrer" 
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            <ExternalLink className="w-4 h-4" /> View on GitHub
          </a>
          <button 
            onClick={() => router.push(`/dashboard/repos/${repoId}/settings`)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button onClick={loadRepoData} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Tree View */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6" ref={containerRef}>
        <div className="grid grid-cols-[240px_60px_240px] gap-4 items-start relative">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Feature Branches</div>
            <div className="flex flex-col gap-2">
              {featureBranches.length > 0 ? featureBranches.map(branch => (
                <BranchCard key={branch.id} branch={branch} onClick={() => handleBranchClick(branch.id)} />
              )) : (
                <div className="text-xs text-gray-400 py-2">No feature branches</div>
              )}
            </div>
          </div>
          <div></div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Protected Branches</div>
            <div className="flex flex-col gap-2">
              {protectedBranches.map(branch => (
                <BranchCard key={branch.id} branch={branch} onClick={() => handleBranchClick(branch.id)} />
              ))}
            </div>
          </div>
          <ConnectorLines featureBranches={featureBranches} protectedBranches={protectedBranches} containerRef={containerRef} />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('branches')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'branches' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Branches ({branches.length})
          </button>
          <button
            onClick={() => setActiveTab('scans')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'scans' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Scan History
          </button>
          <button
            onClick={() => setActiveTab('prs')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'prs' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            PR Activity
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
          {activeTab === 'branches' && <BranchesTab branches={branches} onBranchClick={handleBranchClick} onSettingsClick={handleBranchSettingsClick} />}
          {activeTab === 'scans' && <ScanHistoryTab scans={scans} />}
          {activeTab === 'prs' && <PRActivityTab pulls={pulls} />}
          {activeTab === 'settings' && <SettingsTab repo={repo} />}
        </div>
      </div>

      {/* Branch Settings Modal */}
      {selectedBranchForSettings && (
        <BranchSettingsModal
          branch={selectedBranchForSettings}
          repoSettings={repo}
          onClose={() => setSelectedBranchForSettings(null)}
          onSave={handleSaveBranchSettings}
        />
      )}
    </div>
  );
}
