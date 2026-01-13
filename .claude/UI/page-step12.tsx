'use client';

import { useState, useEffect, useRef } from 'react';
import { GitBranch, AlertTriangle, ChevronRight, ChevronDown, GitMerge, Shield, Star, CheckCircle2, AlertCircle, XCircle, FileCode, Package, Key, Cloud, GitPullRequest, Upload, AlertOctagon } from 'lucide-react';

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
function BranchCard({ id, name, healthScore, isDefault = false, isProtected = false, lastActivity, scans, commitSource }: any) {
  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  const commitSourceConfig: any = {
    pr: { icon: GitPullRequest, color: 'text-green-600', bg: 'bg-green-50', label: 'PR' },
    direct: { icon: Upload, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Direct' },
    bypass: { icon: AlertOctagon, color: 'text-rose-600', bg: 'bg-rose-50', label: 'Bypass' },
  };

  const hasScan = scans && scans.length > 0;
  const latestScan = hasScan ? scans[0] : null;
  const commitCfg = commitSource ? commitSourceConfig[commitSource] : null;
  const CommitIcon = commitCfg?.icon;

  return (
    <div 
      data-branch-id={id}
      className="w-64 p-2.5 rounded-lg border shadow-sm bg-white border-gray-200"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <GitMerge className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
        <span className="text-xs font-medium text-gray-900 truncate flex-1">{name}</span>
        {isDefault && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" title="Default branch" />}
        {isProtected && <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" title="Protected branch" />}
      </div>
      
      {/* Health + Commit Source + Activity */}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getHealthColor(healthScore)}`}>
          {healthScore !== null ? `${healthScore}%` : 'N/A'}
        </span>
        
        {commitCfg && (
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${commitCfg.bg}`} title={`Last commit via ${commitCfg.label}`}>
            <CommitIcon className={`w-3 h-3 ${commitCfg.color}`} />
          </div>
        )}

        {/* Scan icons */}
        {hasScan && (
          <div className="flex items-center gap-1 ml-auto">
            {latestScan.types.includes('sast') && (
              <FileCode className={`w-3.5 h-3.5 ${latestScan.status === 'passed' ? 'text-emerald-500' : latestScan.status === 'failed' ? 'text-rose-500' : 'text-amber-500'}`} title="SAST" />
            )}
            {latestScan.types.includes('sca') && (
              <Package className={`w-3.5 h-3.5 ${latestScan.status === 'passed' ? 'text-emerald-500' : latestScan.status === 'failed' ? 'text-rose-500' : 'text-amber-500'}`} title="SCA" />
            )}
            {latestScan.types.includes('secrets') && (
              <Key className={`w-3.5 h-3.5 ${latestScan.status === 'passed' ? 'text-emerald-500' : latestScan.status === 'failed' ? 'text-rose-500' : 'text-amber-500'}`} title="Secrets" />
            )}
            {latestScan.types.includes('iac') && (
              <Cloud className={`w-3.5 h-3.5 ${latestScan.status === 'passed' ? 'text-emerald-500' : latestScan.status === 'failed' ? 'text-rose-500' : 'text-amber-500'}`} title="IaC" />
            )}
            {latestScan.findingsCount > 0 && (
              <span className="text-[9px] font-medium text-rose-600 ml-1">{latestScan.findingsCount}</span>
            )}
          </div>
        )}

        {!hasScan && (
          <span className="text-[9px] text-gray-400 ml-auto">No scans</span>
        )}
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
      
      // Get all branches for lookup
      const allBranches = [...featureBranches, ...protectedBranches];

      // Feature to protected connections
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

          // Check if target is in same column (feature) or different column (protected)
          const targetBranch = allBranches.find((b: any) => b.id === branch.mergedTo);
          const isFeatureToFeature = targetBranch && !targetBranch.isProtected && !targetBranch.isDefault;

          if (isFeatureToFeature) {
            // Feature to feature: vertical elbow within left column
            const midX = x1 + 20;
            newLines.push({
              mergeType: branch.mergeType,
              label: branch.prNumber ? `#${branch.prNumber}` : null,
              path: `M ${x1} ${y1} H ${midX} V ${y2} H ${x1 + 5}`,
              labelPos: { x: midX + 3, y: Math.min(y1, y2) + Math.abs(y2 - y1) / 2 - 5 },
              isFeatureToFeature: true,
            });
          } else {
            // Feature to protected: horizontal elbow across columns
            const midX = x1 + 30 + (index * 12);
            newLines.push({
              mergeType: branch.mergeType,
              label: branch.prNumber ? `#${branch.prNumber}` : null,
              path: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
              labelPos: { x: midX + 3, y: Math.min(y1, y2) + Math.abs(y2 - y1) / 2 - 5 },
              isFeatureToFeature: false,
            });
          }
        }
      });

      // Protected to protected connections (e.g., develop → main)
      protectedBranches.forEach((branch: any, index: number) => {
        if (!branch.mergedTo) return;

        const sourceEl = container.querySelector(`[data-branch-id="${branch.id}"]`);
        const targetEl = container.querySelector(`[data-branch-id="${branch.mergedTo}"]`);

        if (sourceEl && targetEl) {
          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();

          const x1 = sRect.right - rect.left;
          const y1 = sRect.top + sRect.height / 2 - rect.top;
          const x2 = tRect.right - rect.left + 15;
          const y2 = tRect.top + tRect.height / 2 - rect.top;

          // Vertical elbow within right column
          const midX = x1 + 20;
          newLines.push({
            mergeType: branch.mergeType,
            label: branch.prNumber ? `#${branch.prNumber}` : null,
            path: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
            labelPos: { x: midX + 3, y: Math.min(y1, y2) + Math.abs(y2 - y1) / 2 - 5 },
            isProtectedToProtected: true,
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
            <path
              d={line.path}
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeDasharray={line.mergeType === 'pr' ? '5,3' : 'none'}
              fill="none"
              markerEnd={markerEnd}
            />
            {line.label && (
              <g transform={`translate(${line.labelPos.x}, ${line.labelPos.y})`}>
                <rect 
                  x="0" y="0" 
                  width={line.label.length * 6 + 6} height="11" rx="2" 
                  fill={line.mergeType === 'pr' ? '#dcfce7' : '#dbeafe'} 
                  stroke={line.mergeType === 'pr' ? '#86efac' : '#93c5fd'} 
                  strokeWidth="0.5" 
                />
                <text 
                  x={(line.label.length * 6 + 6) / 2} y="8" 
                  textAnchor="middle" 
                  fontSize="7" 
                  fontWeight="600" 
                  fill={line.mergeType === 'pr' ? '#166534' : '#1e40af'}
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
const testRepos = [
  { 
    id: '1', 
    name: 'api-gateway', 
    fullName: 'acme/api-gateway', 
    healthScore: 85, 
    findings: { critical: 0, high: 2, medium: 5, low: 8 },
    branches: [
      { id: 'b1', name: 'feature/auth', healthScore: 72, mergedTo: 'b4', mergeType: 'pr', prNumber: 42, commitSource: 'pr', scans: [{ status: 'passed', types: ['sast', 'secrets'], findingsCount: 0 }] },
      { id: 'b2', name: 'feature/rate-limit', healthScore: 68, mergedTo: 'b4', mergeType: 'pr', prNumber: 43, commitSource: 'direct', scans: [] },
      { id: 'b3', name: 'hotfix/sec-patch', healthScore: 90, mergedTo: 'b5', mergeType: 'pr', prNumber: 44, commitSource: 'pr', scans: [{ status: 'passed', types: ['sast', 'sca', 'secrets', 'iac'], findingsCount: 1 }] },
      { id: 'b4', name: 'develop', healthScore: 75, isProtected: true, mergedTo: 'b5', mergeType: 'pr', prNumber: 40, commitSource: 'pr', scans: [{ status: 'warning', types: ['sast', 'sca'], findingsCount: 5 }] },
      { id: 'b5', name: 'main', healthScore: 88, isDefault: true, isProtected: true, commitSource: 'pr', scans: [{ status: 'passed', types: ['sast', 'sca', 'secrets', 'iac'], findingsCount: 3 }] },
    ],
  },
  { 
    id: '2', 
    name: 'web-frontend', 
    fullName: 'acme/web-frontend', 
    healthScore: 62, 
    findings: { critical: 1, high: 4, medium: 12, low: 3 },
    branches: [
      { id: 'b6', name: 'feature/dashboard', healthScore: 58, mergedTo: 'b7', mergeType: 'direct', commitSource: 'direct', scans: [] },
      { id: 'b7', name: 'main', healthScore: 65, isDefault: true, isProtected: true, commitSource: 'bypass', scans: [{ status: 'failed', types: ['sast', 'sca'], findingsCount: 17 }] },
    ],
  },
  { 
    id: '3', 
    name: 'auth-service', 
    fullName: 'acme/auth-service', 
    healthScore: null, 
    findings: { critical: 0, high: 0, medium: 0, low: 0 },
    branches: [
      { id: 'b8', name: 'main', healthScore: null, isDefault: true, isProtected: true, scans: [] },
    ],
  },
];

// ============ MAIN PAGE ============
export default function RepoSecurityView() {
  const [expandedId, setExpandedId] = useState<string | null>('1');
  const containerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-4">Repository Security</h1>

      {/* Legend */}
      <div className="mb-6 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 font-medium">Health:</span>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-700 font-semibold">80+</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-700 font-semibold">50-79</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-rose-700 font-semibold">&lt;50</span>
            </div>
          </div>
          
          <div className="w-px h-4 bg-gray-200" />
          
          <div className="flex items-center gap-3">
            <span className="text-gray-500 font-medium">Commit:</span>
            <div className="flex items-center gap-1">
              <GitPullRequest className="w-3.5 h-3.5 text-green-600" />
              <span className="text-green-700">PR</span>
            </div>
            <div className="flex items-center gap-1">
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-blue-700">Direct</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-rose-700">Bypass</span>
            </div>
          </div>

          <div className="w-px h-4 bg-gray-200" />

          <div className="flex items-center gap-3">
            <span className="text-gray-500 font-medium">Scans:</span>
            <FileCode className="w-3.5 h-3.5 text-gray-500" title="SAST" />
            <Package className="w-3.5 h-3.5 text-gray-500" title="SCA" />
            <Key className="w-3.5 h-3.5 text-gray-500" title="Secrets" />
            <Cloud className="w-3.5 h-3.5 text-gray-500" title="IaC" />
            <span className="text-gray-400 text-[10px]">(green=pass, red=fail, amber=warn)</span>
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[192px_280px_80px_280px] gap-4 mb-3 pb-2 border-b border-gray-200">
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
              <div className="grid grid-cols-[192px_280px_80px_280px] gap-4 items-start">
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
                    {/* Feature Branches - Left Column */}
                    <div className="flex flex-col gap-2 relative z-10">
                      {featureBranches.length > 0 ? (
                        featureBranches.map((branch) => (
                          <BranchCard key={branch.id} {...branch} />
                        ))
                      ) : (
                        <div className="text-xs text-gray-400 py-2">No feature branches</div>
                      )}
                    </div>

                    {/* Spacer for connectors */}
                    <div></div>

                    {/* Protected Branches - Right Column */}
                    <div className="flex flex-col gap-2 relative z-10">
                      {protectedBranches.map((branch) => (
                        <BranchCard key={branch.id} {...branch} />
                      ))}
                    </div>

                    {/* Connector Lines */}
                    <ConnectorLines 
                      featureBranches={featureBranches}
                      protectedBranches={protectedBranches}
                      containerRef={{ current: containerRefs.current[repo.id] }} 
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
    </div>
  );
}
