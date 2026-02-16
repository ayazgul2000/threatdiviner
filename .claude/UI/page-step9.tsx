'use client';

import { useState, useEffect, useRef } from 'react';
import { GitBranch, AlertTriangle, ChevronRight, ChevronDown, GitMerge, Shield, Star, CheckCircle2, AlertCircle, XCircle, GitPullRequest, Clock, Package, Loader2 } from 'lucide-react';

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
        w-40 p-3 rounded-lg cursor-pointer transition-all duration-200
        bg-white border border-gray-200 shadow-sm
        hover:border-indigo-400 hover:shadow-md
        ${isExpanded ? 'ring-2 ring-indigo-500 border-indigo-400' : ''}
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-indigo-100">
          <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <span className="text-sm font-medium text-gray-900 truncate" title={fullName || name}>
          {name}
        </span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
        )}
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">Health</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getHealthColor(healthScore)}`}>
          {healthScore !== null ? `${healthScore}%` : 'N/A'}
        </span>
      </div>

      {totalFindings > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <AlertTriangle className="w-3 h-3 text-gray-400" />
          <div className="flex gap-1.5">
            {findings.critical > 0 && <span className="font-medium text-purple-600">{findings.critical}C</span>}
            {findings.high > 0 && <span className="font-medium text-rose-600">{findings.high}H</span>}
            {findings.medium > 0 && <span className="font-medium text-amber-600">{findings.medium}M</span>}
            {findings.low > 0 && <span className="font-medium text-yellow-600">{findings.low}L</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ BRANCH CARD ============
function BranchCard({ id, name, healthScore, isDefault = false, isProtected = false, lastActivity, isBuildSource = false }: any) {
  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  return (
    <div 
      data-branch-id={id}
      className={`w-36 p-2 rounded-lg border shadow-sm bg-white ${isBuildSource ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <GitMerge className="w-3.5 h-3.5 text-teal-600" />
        <span className="text-[11px] font-medium text-gray-900 truncate">{name}</span>
        {isDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500 ml-auto" />}
        {isProtected && <Shield className="w-3 h-3 text-blue-500 ml-auto" />}
      </div>
      
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getHealthColor(healthScore)}`}>
          {healthScore !== null ? `${healthScore}%` : 'N/A'}
        </span>
        {lastActivity && (
          <span className="text-[9px] text-gray-400">{lastActivity}</span>
        )}
      </div>
    </div>
  );
}

// ============ BUILD CARD ============
function BuildCard({ number, status, duration, trigger }: any) {
  const statusConfig: any = {
    success: { bg: 'bg-emerald-50', border: 'border-emerald-300', icon: CheckCircle2, iconColor: 'text-emerald-600' },
    failure: { bg: 'bg-rose-50', border: 'border-rose-300', icon: XCircle, iconColor: 'text-rose-600' },
    running: { bg: 'bg-blue-50', border: 'border-blue-300', icon: Loader2, iconColor: 'text-blue-600' },
    pending: { bg: 'bg-gray-50', border: 'border-gray-300', icon: Clock, iconColor: 'text-gray-500' },
  };

  const cfg = statusConfig[status];
  const Icon = cfg.icon;

  return (
    <div data-node="build" className={`w-24 p-2 rounded-lg ${cfg.bg} border ${cfg.border} shadow-sm`}>
      <div className="flex items-center gap-1 mb-1">
        <Package className="w-3 h-3 text-gray-500" />
        <span className="text-[10px] font-bold text-gray-700">#{number}</span>
      </div>
      <div className="flex items-center gap-1">
        <Icon className={`w-4 h-4 ${cfg.iconColor} ${status === 'running' ? 'animate-spin' : ''}`} strokeWidth={2.5} />
        <span className={`text-[9px] font-medium ${cfg.iconColor}`}>
          {status === 'success' ? 'Passed' : status === 'failure' ? 'Failed' : status === 'running' ? 'Running' : 'Pending'}
        </span>
      </div>
      {duration && <div className="mt-1 text-[9px] text-gray-400">{duration}</div>}
      {trigger && <div className="mt-0.5 text-[8px] text-gray-400">{trigger}</div>}
    </div>
  );
}

// ============ ENVIRONMENT CARD ============
function EnvCard({ type, status, version, healthScore }: any) {
  const typeConfig: any = {
    dev: { bg: 'bg-sky-50', border: 'border-sky-300', badge: 'bg-sky-200 text-sky-800' },
    staging: { bg: 'bg-amber-50', border: 'border-amber-300', badge: 'bg-amber-200 text-amber-800' },
    prod: { bg: 'bg-emerald-50', border: 'border-emerald-300', badge: 'bg-emerald-200 text-emerald-800' },
  };

  const statusIcons: any = {
    deployed: { icon: CheckCircle2, color: 'text-emerald-500' },
    deploying: { icon: Loader2, color: 'text-blue-500' },
    failed: { icon: XCircle, color: 'text-rose-500' },
    pending: { icon: Clock, color: 'text-gray-400' },
  };

  const tcfg = typeConfig[type];
  const scfg = statusIcons[status] || statusIcons.deployed;
  const StatusIcon = scfg.icon;

  return (
    <div className={`w-16 p-1.5 rounded-lg ${tcfg.bg} border ${tcfg.border} shadow-sm text-center`}>
      <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${tcfg.badge} uppercase`}>
        {type === 'staging' ? 'stg' : type}
      </span>
      <div className="flex justify-center mt-1">
        <StatusIcon className={`w-3.5 h-3.5 ${scfg.color} ${status === 'deploying' ? 'animate-spin' : ''}`} />
      </div>
      {version && <div className="text-[8px] text-gray-500 mt-0.5 truncate">{version}</div>}
    </div>
  );
}

// ============ ELBOW CONNECTOR SVG ============
function ElbowConnectors({ branches, containerRef }: { branches: any[]; containerRef: React.RefObject<HTMLDivElement> }) {
  const [paths, setPaths] = useState<any[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const calculatePaths = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newPaths: any[] = [];

      branches.forEach((branch) => {
        if (!branch.mergedTo) return;

        const sourceEl = container.querySelector(`[data-branch-id="${branch.id}"]`);
        const targetEl = container.querySelector(`[data-branch-id="${branch.mergedTo}"]`);

        if (sourceEl && targetEl) {
          const sourceRect = sourceEl.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();

          const x1 = sourceRect.right - containerRect.left;
          const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;
          const x2 = targetRect.left - containerRect.left;
          const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;

          // Elbow path: horizontal, then vertical, then horizontal
          const midX = x1 + 30;

          newPaths.push({
            d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
            type: branch.mergeType, // 'pr' or 'commit'
            prNumber: branch.prNumber,
            commitSha: branch.commitSha,
            labelX: midX + 5,
            labelY: (y1 + y2) / 2,
          });
        }
      });

      setPaths(newPaths);
    };

    setTimeout(calculatePaths, 50);
    window.addEventListener('resize', calculatePaths);
    return () => window.removeEventListener('resize', calculatePaths);
  }, [branches, containerRef]);

  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 5 }}>
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
        </marker>
        <marker id="arrow-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#22c55e" />
        </marker>
      </defs>
      {paths.map((path, i) => (
        <g key={i}>
          <path
            d={path.d}
            stroke={path.type === 'pr' ? '#22c55e' : '#94a3b8'}
            strokeWidth="2"
            strokeDasharray={path.type === 'pr' ? '6,3' : 'none'}
            fill="none"
            markerEnd={path.type === 'pr' ? 'url(#arrow-green)' : 'url(#arrow)'}
          />
          {/* Label badge */}
          {path.prNumber && (
            <g transform={`translate(${path.labelX}, ${path.labelY - 8})`}>
              <rect x="0" y="0" width="32" height="14" rx="3" fill="#dcfce7" stroke="#22c55e" strokeWidth="1" />
              <text x="16" y="10" textAnchor="middle" fontSize="8" fontWeight="600" fill="#166534">
                PR#{path.prNumber}
              </text>
            </g>
          )}
          {path.commitSha && (
            <g transform={`translate(${path.labelX}, ${path.labelY - 8})`}>
              <rect x="0" y="0" width="36" height="14" rx="3" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
              <text x="18" y="10" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#475569">
                {path.commitSha}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}

// ============ BUILD CONNECTOR ============
function BuildConnector({ sourceBranchId, containerRef }: { sourceBranchId: string; containerRef: React.RefObject<HTMLDivElement> }) {
  const [path, setPath] = useState<string>('');

  useEffect(() => {
    if (!containerRef.current) return;

    const calculate = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const sourceEl = container.querySelector(`[data-branch-id="${sourceBranchId}"]`);
      const buildEl = container.querySelector(`[data-node="build"]`);

      if (sourceEl && buildEl) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const buildRect = buildEl.getBoundingClientRect();

        const x1 = sourceRect.right - containerRect.left;
        const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;
        const x2 = buildRect.left - containerRect.left;
        const y2 = buildRect.top + buildRect.height / 2 - containerRect.top;

        setPath(`M ${x1} ${y1} H ${x1 + 20} V ${y2} H ${x2}`);
      }
    };

    setTimeout(calculate, 50);
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [sourceBranchId, containerRef]);

  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 4 }}>
      <defs>
        <marker id="arrow-indigo" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
        </marker>
      </defs>
      {path && (
        <path
          d={path}
          stroke="#6366f1"
          strokeWidth="2"
          fill="none"
          markerEnd="url(#arrow-indigo)"
        />
      )}
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
      { id: 'b1', name: 'feature/auth', healthScore: 72, lastActivity: '2h ago', mergedTo: 'b4', mergeType: 'pr', prNumber: 42 },
      { id: 'b2', name: 'feature/rate-limit', healthScore: 68, lastActivity: '5h ago', mergedTo: 'b4', mergeType: 'pr', prNumber: 43 },
      { id: 'b3', name: 'hotfix/sec-patch', healthScore: 90, lastActivity: '1h ago', mergedTo: 'b5', mergeType: 'pr', prNumber: 44 },
      { id: 'b4', name: 'develop', healthScore: 75, lastActivity: '30m ago', isProtected: true, mergedTo: 'b5', mergeType: 'pr', prNumber: 40 },
      { id: 'b5', name: 'main', healthScore: 88, lastActivity: '15m ago', isDefault: true, isProtected: true, isBuildSource: true },
    ],
    buildSourceBranch: 'b5',
    build: { number: 142, status: 'success', duration: '2m 34s', trigger: 'PR #40 merged' },
    envs: [
      { type: 'dev', status: 'deployed', version: 'v1.4.2' },
      { type: 'staging', status: 'deployed', version: 'v1.4.1' },
      { type: 'prod', status: 'deployed', version: 'v1.4.0' },
    ]
  },
  { 
    id: '2', 
    name: 'web-frontend', 
    fullName: 'acme/web-frontend', 
    healthScore: 62, 
    findings: { critical: 1, high: 4, medium: 12, low: 3 },
    branches: [
      { id: 'b6', name: 'feature/dashboard', healthScore: 58, lastActivity: '3h ago', mergedTo: 'b7', mergeType: 'commit', commitSha: 'a1b2c3d' },
      { id: 'b7', name: 'main', healthScore: 65, lastActivity: '1h ago', isDefault: true, isProtected: true, isBuildSource: true },
    ],
    buildSourceBranch: 'b7',
    build: { number: 89, status: 'failure', duration: '1m 12s', trigger: 'Push to main' },
    envs: [
      { type: 'dev', status: 'deployed', version: 'v2.1.0' },
      { type: 'staging', status: 'failed', version: 'v2.1.0' },
      { type: 'prod', status: 'deployed', version: 'v2.0.8' },
    ]
  },
];

// ============ MAIN PAGE ============
export default function PipelineView() {
  const [expandedId, setExpandedId] = useState<string | null>('1');
  const containerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-xl font-bold text-gray-800 mb-4">Pipeline View</h1>

      {/* Legend */}
      <div className="mb-6 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium">
          <span className="text-gray-500 uppercase tracking-wider">Health:</span>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={2.5} />
            <span className="text-emerald-700 font-bold">80+</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle className="w-4 h-4 text-amber-500" strokeWidth={2.5} />
            <span className="text-amber-700 font-bold">50-79</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-4 h-4 text-rose-500" strokeWidth={2.5} />
            <span className="text-rose-700 font-bold">&lt;50</span>
          </div>
          
          <div className="w-px h-4 bg-gray-300" />
          
          <span className="text-gray-500 uppercase tracking-wider">Merge:</span>
          <div className="flex items-center gap-1">
            <svg width="24" height="12"><line x1="0" y1="6" x2="24" y2="6" stroke="#22c55e" strokeWidth="2" strokeDasharray="6,3" /></svg>
            <span className="text-green-700">via PR</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="24" height="12"><line x1="0" y1="6" x2="24" y2="6" stroke="#94a3b8" strokeWidth="2" /></svg>
            <span className="text-gray-600">Direct commit</span>
          </div>

          <div className="w-px h-4 bg-gray-300" />

          <span className="text-gray-500 uppercase tracking-wider">Branch:</span>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-gray-700">Default</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="w-4 h-4 text-blue-500" strokeWidth={2.5} />
            <span className="text-gray-700">Protected</span>
          </div>

          <div className="w-px h-4 bg-gray-300" />

          <span className="text-gray-500 uppercase tracking-wider">Env:</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-200 text-sky-800">DEV</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-800">STG</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800">PROD</span>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[160px_180px_100px_220px] gap-8 mb-4 pb-2 border-b border-gray-200">
        <div className="text-xs font-semibold text-gray-500 uppercase">Repos</div>
        <div className="text-xs font-semibold text-gray-500 uppercase">Branches</div>
        <div className="text-xs font-semibold text-gray-500 uppercase">Build</div>
        <div className="text-xs font-semibold text-gray-500 uppercase">Environments</div>
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
              <div className="grid grid-cols-[160px_180px_100px_220px] gap-8 items-start">
                {/* Repo */}
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
                    {/* Branches - vertical stack */}
                    <div className="flex flex-col gap-2 relative" style={{ zIndex: 10 }}>
                      {repo.branches.map((branch) => (
                        <BranchCard key={branch.id} {...branch} />
                      ))}
                      
                      {/* Elbow connectors overlay */}
                      <ElbowConnectors 
                        branches={repo.branches} 
                        containerRef={{ current: containerRefs.current[repo.id] }} 
                      />
                    </div>
                    
                    {/* Build */}
                    <div className="pt-[calc((4*48px+3*8px)/2-24px)]" style={{ zIndex: 10 }}>
                      <BuildCard {...repo.build} />
                      <BuildConnector 
                        sourceBranchId={repo.buildSourceBranch} 
                        containerRef={{ current: containerRefs.current[repo.id] }} 
                      />
                    </div>
                    
                    {/* Environments */}
                    <div className="flex items-center gap-2 pt-[calc((4*48px+3*8px)/2-24px)]" style={{ zIndex: 10 }}>
                      {repo.envs.map((env, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <EnvCard {...env} />
                          {i < repo.envs.length - 1 && (
                            <span className="text-gray-300 text-sm">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="col-span-3 flex items-center h-20 text-gray-400 text-sm">
                    Click to expand pipeline
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
