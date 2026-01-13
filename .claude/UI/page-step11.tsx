'use client';

import { useState, useEffect, useRef } from 'react';
import { GitBranch, AlertTriangle, ChevronRight, ChevronDown, GitMerge, Shield, Star, CheckCircle2, AlertCircle, XCircle, FileCode, Package, Key, Cloud } from 'lucide-react';

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
        w-52 p-4 rounded-xl cursor-pointer transition-all duration-200
        bg-white border border-gray-200 shadow-sm
        hover:border-indigo-400 hover:shadow-md
        ${isExpanded ? 'ring-2 ring-indigo-500 border-indigo-400' : ''}
      `}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-indigo-100">
          <GitBranch className="w-4 h-4 text-indigo-600" />
        </div>
        <span className="text-sm font-semibold text-gray-900 truncate flex-1" title={fullName || name}>
          {name}
        </span>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">Health Score</span>
        <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${getHealthColor(healthScore)}`}>
          {healthScore !== null ? `${healthScore}%` : 'N/A'}
        </span>
      </div>

      {totalFindings > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />
          <div className="flex gap-2 text-xs font-medium">
            {findings.critical > 0 && <span className="text-purple-600">{findings.critical}C</span>}
            {findings.high > 0 && <span className="text-rose-600">{findings.high}H</span>}
            {findings.medium > 0 && <span className="text-amber-600">{findings.medium}M</span>}
            {findings.low > 0 && <span className="text-yellow-600">{findings.low}L</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ BRANCH CARD ============
function BranchCard({ id, name, healthScore, isDefault = false, isProtected = false, lastActivity, scans }: any) {
  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  const scanTypeConfig: any = {
    sast: { icon: FileCode, label: 'SAST' },
    sca: { icon: Package, label: 'SCA' },
    secrets: { icon: Key, label: 'Secrets' },
    iac: { icon: Cloud, label: 'IaC' },
  };

  const hasScan = scans && scans.length > 0;
  const latestScan = hasScan ? scans[0] : null;

  return (
    <div 
      data-branch-id={id}
      className="w-56 p-3.5 rounded-xl border shadow-sm bg-white border-gray-200"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <GitMerge className="w-4 h-4 text-teal-600" />
        <span className="text-sm font-medium text-gray-900 truncate flex-1">{name}</span>
        {isDefault && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
        {isProtected && !isDefault && <Shield className="w-4 h-4 text-blue-500" />}
      </div>
      
      {/* Health + Activity */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${getHealthColor(healthScore)}`}>
          {healthScore !== null ? `${healthScore}%` : 'N/A'}
        </span>
        {lastActivity && (
          <span className="text-xs text-gray-400">{lastActivity}</span>
        )}
      </div>

      {/* Scan Status */}
      {hasScan ? (
        <div className="pt-2.5 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">Last Scan</span>
            <div className="flex items-center gap-1">
              {latestScan.status === 'passed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : latestScan.status === 'failed' ? (
                <XCircle className="w-4 h-4 text-rose-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500" />
              )}
              <span className={`text-xs font-semibold ${
                latestScan.status === 'passed' ? 'text-emerald-600' : 
                latestScan.status === 'failed' ? 'text-rose-600' : 'text-amber-600'
              }`}>
                {latestScan.status === 'passed' ? 'Passed' : latestScan.status === 'failed' ? 'Failed' : 'Warning'}
              </span>
            </div>
          </div>
          
          {/* Scan Types */}
          <div className="flex items-center gap-1.5">
            {latestScan.types.map((type: string) => {
              const cfg = scanTypeConfig[type];
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <div 
                  key={type} 
                  className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600"
                  title={cfg.label}
                >
                  <Icon className="w-3 h-3" />
                  <span>{cfg.label}</span>
                </div>
              );
            })}
          </div>
          
          {latestScan.findingsCount > 0 && (
            <div className="mt-2 text-xs text-rose-600 font-medium">
              {latestScan.findingsCount} findings
            </div>
          )}
        </div>
      ) : (
        <div className="pt-2.5 border-t border-gray-100">
          <span className="text-[10px] text-gray-400">No scans yet</span>
        </div>
      )}
    </div>
  );
}

// ============ CONNECTOR LINES ============
function ConnectorLines({ branches, containerRef }: any) {
  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    const calculate = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const newLines: any[] = [];

      branches.forEach((branch: any, index: number) => {
        if (!branch.mergedTo) return;

        const sourceEl = container.querySelector(`[data-branch-id="${branch.id}"]`);
        const targetEl = container.querySelector(`[data-branch-id="${branch.mergedTo}"]`);

        if (sourceEl && targetEl) {
          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();

          const x1 = sRect.right - rect.left;
          const y1 = sRect.top + sRect.height / 2 - rect.top;
          const x2 = tRect.right - rect.left + 10;
          const y2 = tRect.top + tRect.height / 2 - rect.top;

          const midX = x1 + 16 + (index * 10);

          newLines.push({
            mergeType: branch.mergeType,
            label: branch.prNumber ? `#${branch.prNumber}` : branch.commitSha?.slice(0, 5),
            path: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
            labelPos: { x: midX + 3, y: Math.min(y1, y2) + Math.abs(y2 - y1) / 2 - 5 },
          });
        }
      });

      setLines(newLines);
    };

    setTimeout(calculate, 100);
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [branches, containerRef]);

  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 1 }}>
      <defs>
        <marker id="arr-gray" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <polygon points="0 0, 6 2.5, 0 5" fill="#9ca3af" />
        </marker>
        <marker id="arr-green" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <polygon points="0 0, 6 2.5, 0 5" fill="#22c55e" />
        </marker>
      </defs>

      {lines.map((line, i) => (
        <g key={i}>
          <path
            d={line.path}
            stroke={line.mergeType === 'pr' ? '#22c55e' : '#9ca3af'}
            strokeWidth="1.5"
            strokeDasharray={line.mergeType === 'pr' ? '5,3' : 'none'}
            fill="none"
            markerEnd={line.mergeType === 'pr' ? 'url(#arr-green)' : 'url(#arr-gray)'}
          />
          {line.label && (
            <g transform={`translate(${line.labelPos.x}, ${line.labelPos.y})`}>
              <rect 
                x="0" y="0" 
                width={line.label.length * 6 + 8} height="12" rx="3" 
                fill={line.mergeType === 'pr' ? '#dcfce7' : '#f3f4f6'} 
                stroke={line.mergeType === 'pr' ? '#86efac' : '#d1d5db'} 
                strokeWidth="0.5" 
              />
              <text 
                x={(line.label.length * 6 + 8) / 2} y="9" 
                textAnchor="middle" 
                fontSize="8" 
                fontWeight="600" 
                fill={line.mergeType === 'pr' ? '#166534' : '#4b5563'}
              >
                {line.label}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

// ============ TEST DATA ============
const testRepos = [
  { 
    id: '1', 
    name: 'api-gateway', 
    fullName: 'acme/api-gateway', 
    healthScore: 85, 
    findings: { critical: 0, high: 2, medium: 5, low: 8 },
    branches: [
      { id: 'b1', name: 'feature/auth', healthScore: 72, lastActivity: '2h ago', mergedTo: 'b4', mergeType: 'pr', prNumber: 42, scans: [{ status: 'passed', types: ['sast', 'secrets'], findingsCount: 0 }] },
      { id: 'b2', name: 'feature/rate-limit', healthScore: 68, lastActivity: '5h ago', mergedTo: 'b4', mergeType: 'pr', prNumber: 43, scans: [] },
      { id: 'b3', name: 'hotfix/sec-patch', healthScore: 90, lastActivity: '1h ago', mergedTo: 'b5', mergeType: 'pr', prNumber: 44, scans: [{ status: 'passed', types: ['sast', 'sca', 'secrets', 'iac'], findingsCount: 1 }] },
      { id: 'b4', name: 'develop', healthScore: 75, lastActivity: '30m ago', isProtected: true, mergedTo: 'b5', mergeType: 'pr', prNumber: 40, scans: [{ status: 'warning', types: ['sast', 'sca'], findingsCount: 5 }] },
      { id: 'b5', name: 'main', healthScore: 88, lastActivity: '15m ago', isDefault: true, isProtected: true, scans: [{ status: 'passed', types: ['sast', 'sca', 'secrets', 'iac'], findingsCount: 3 }] },
    ],
  },
  { 
    id: '2', 
    name: 'web-frontend', 
    fullName: 'acme/web-frontend', 
    healthScore: 62, 
    findings: { critical: 1, high: 4, medium: 12, low: 3 },
    branches: [
      { id: 'b6', name: 'feature/dashboard', healthScore: 58, lastActivity: '3h ago', mergedTo: 'b7', mergeType: 'commit', commitSha: 'e5f6g7h', scans: [] },
      { id: 'b7', name: 'main', healthScore: 65, lastActivity: '1h ago', isDefault: true, isProtected: true, scans: [{ status: 'failed', types: ['sast', 'sca'], findingsCount: 17 }] },
    ],
  },
  { 
    id: '3', 
    name: 'auth-service', 
    fullName: 'acme/auth-service', 
    healthScore: null, 
    findings: { critical: 0, high: 0, medium: 0, low: 0 },
    branches: [
      { id: 'b8', name: 'main', healthScore: null, lastActivity: '1d ago', isDefault: true, isProtected: true, scans: [] },
    ],
  },
];

// ============ MAIN PAGE ============
export default function RepoSecurityView() {
  const [expandedId, setExpandedId] = useState<string | null>('1');
  const containerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Repository Security</h1>

      {/* Legend */}
      <div className="mb-8 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <div className="flex items-center gap-4">
            <span className="text-gray-500 font-medium">Health:</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-700 font-semibold">80+</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-amber-700 font-semibold">50-79</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-500" />
              <span className="text-rose-700 font-semibold">&lt;50</span>
            </div>
          </div>
          
          <div className="w-px h-5 bg-gray-200" />
          
          <div className="flex items-center gap-4">
            <span className="text-gray-500 font-medium">Merge:</span>
            <div className="flex items-center gap-1.5">
              <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#22c55e" strokeWidth="2" strokeDasharray="5,3" /></svg>
              <span className="text-green-700">PR</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#9ca3af" strokeWidth="2" /></svg>
              <span className="text-gray-600">Commit</span>
            </div>
          </div>

          <div className="w-px h-5 bg-gray-200" />

          <div className="flex items-center gap-4">
            <span className="text-gray-500 font-medium">Scans:</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 rounded">
              <FileCode className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-gray-700 text-xs">SAST</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 rounded">
              <Package className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-gray-700 text-xs">SCA</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 rounded">
              <Key className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-gray-700 text-xs">Secrets</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 rounded">
              <Cloud className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-gray-700 text-xs">IaC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="flex gap-8 mb-4 pb-3 border-b border-gray-200">
        <div className="w-52 text-sm font-semibold text-gray-500 uppercase tracking-wide">Repositories</div>
        <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Branches</div>
      </div>
      
      {/* Repos */}
      <div className="space-y-6">
        {testRepos.map((repo) => {
          const isExpanded = expandedId === repo.id;
          
          return (
            <div 
              key={repo.id} 
              ref={(el) => { containerRefs.current[repo.id] = el; }}
              className="relative"
            >
              <div className="flex gap-8 items-start">
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
                  <div className="flex flex-col gap-3 relative z-10">
                    {repo.branches.map((branch) => (
                      <BranchCard key={branch.id} {...branch} />
                    ))}
                    <ConnectorLines 
                      branches={repo.branches} 
                      containerRef={{ current: containerRefs.current[repo.id] }} 
                    />
                  </div>
                ) : (
                  <div className="flex items-center h-28 text-gray-400 text-sm">
                    Click to expand branches
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
