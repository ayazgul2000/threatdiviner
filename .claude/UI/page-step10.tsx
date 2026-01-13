'use client';

import { useState, useEffect, useRef } from 'react';
import { GitBranch, AlertTriangle, ChevronRight, ChevronDown, GitMerge, Shield, Star, CheckCircle2, AlertCircle, XCircle, Clock, Loader2, Search, FileCode, Package, Key, Cloud, Server, Plus } from 'lucide-react';

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
        w-44 p-3 rounded-lg cursor-pointer transition-all duration-200
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
function BranchCard({ id, name, healthScore, isDefault = false, isProtected = false, lastActivity, mergedTo, mergeType, prNumber, commitSha }: any) {
  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  return (
    <div 
      data-branch-id={id}
      className="w-40 p-2.5 rounded-lg border shadow-sm bg-white border-gray-200"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <GitMerge className="w-3.5 h-3.5 text-teal-600" />
        <span className="text-[11px] font-medium text-gray-900 truncate flex-1">{name}</span>
        {isDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
        {isProtected && !isDefault && <Shield className="w-3 h-3 text-blue-500" />}
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

// ============ SCAN CARD ============
function ScanCard({ id, status, trigger, commitSha, scanTypes, duration, findingsCount }: any) {
  const statusConfig: any = {
    passed: { bg: 'bg-emerald-50', border: 'border-emerald-300', icon: CheckCircle2, iconColor: 'text-emerald-600', label: 'Passed' },
    failed: { bg: 'bg-rose-50', border: 'border-rose-300', icon: XCircle, iconColor: 'text-rose-600', label: 'Failed' },
    running: { bg: 'bg-blue-50', border: 'border-blue-300', icon: Loader2, iconColor: 'text-blue-600', label: 'Running' },
    pending: { bg: 'bg-gray-50', border: 'border-gray-300', icon: Clock, iconColor: 'text-gray-500', label: 'Pending' },
  };

  const scanTypeIcons: any = {
    sast: FileCode,
    sca: Package,
    secrets: Key,
    iac: Cloud,
  };

  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;

  return (
    <div data-scan-id={id} className={`w-32 p-2 rounded-lg ${cfg.bg} border ${cfg.border} shadow-sm`}>
      <div className="flex items-center gap-1 mb-1.5">
        <Search className="w-3 h-3 text-gray-500" />
        <StatusIcon className={`w-3.5 h-3.5 ${cfg.iconColor} ${status === 'running' ? 'animate-spin' : ''}`} strokeWidth={2.5} />
        <span className={`text-[9px] font-semibold ${cfg.iconColor}`}>{cfg.label}</span>
      </div>
      
      {/* Scan types */}
      <div className="flex gap-1 mb-1.5">
        {scanTypes.map((type: string) => {
          const TypeIcon = scanTypeIcons[type];
          return TypeIcon ? (
            <div key={type} className="p-0.5 bg-white rounded" title={type.toUpperCase()}>
              <TypeIcon className="w-3 h-3 text-gray-500" />
            </div>
          ) : null;
        })}
      </div>
      
      <div className="flex items-center justify-between text-[9px]">
        <code className="text-gray-500 font-mono">{commitSha?.slice(0, 7)}</code>
        {duration && <span className="text-gray-400">{duration}</span>}
      </div>
      
      {findingsCount > 0 && (
        <div className="mt-1 text-[9px] text-rose-600 font-medium">
          {findingsCount} findings
        </div>
      )}
    </div>
  );
}

// ============ ENVIRONMENT CARD ============
function EnvCard({ type, status, source, version }: any) {
  const typeConfig: any = {
    dev: { bg: 'bg-sky-50', border: 'border-sky-300', badge: 'bg-sky-200 text-sky-800' },
    staging: { bg: 'bg-amber-50', border: 'border-amber-300', badge: 'bg-amber-200 text-amber-800' },
    prod: { bg: 'bg-emerald-50', border: 'border-emerald-300', badge: 'bg-emerald-200 text-emerald-800' },
  };

  const statusIcons: any = {
    healthy: { icon: CheckCircle2, color: 'text-emerald-500' },
    warning: { icon: AlertCircle, color: 'text-amber-500' },
    critical: { icon: XCircle, color: 'text-rose-500' },
    unknown: { icon: Clock, color: 'text-gray-400' },
  };

  const tcfg = typeConfig[type] || typeConfig.dev;
  const scfg = statusIcons[status] || statusIcons.unknown;
  const StatusIcon = scfg.icon;

  return (
    <div className={`w-20 p-2 rounded-lg ${tcfg.bg} border ${tcfg.border} shadow-sm text-center`}>
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tcfg.badge} uppercase`}>
        {type === 'staging' ? 'stg' : type}
      </span>
      <div className="flex justify-center mt-1.5">
        <StatusIcon className={`w-4 h-4 ${scfg.color}`} strokeWidth={2} />
      </div>
      {source && <div className="text-[8px] text-gray-500 mt-1 truncate">{source}</div>}
    </div>
  );
}

// ============ EMPTY STATE ============
function EmptyState({ type, onAdd }: { type: 'scans' | 'environments'; onAdd?: () => void }) {
  const config = {
    scans: {
      icon: Search,
      title: 'No scans yet',
      subtitle: 'Run a scan manually or via pipeline',
    },
    environments: {
      icon: Server,
      title: 'No environments',
      subtitle: 'Connect CSPM or run pentest',
    },
  };

  const cfg = config[type];
  const Icon = cfg.icon;

  return (
    <div className="w-32 h-20 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-2">
      <Icon className="w-4 h-4 text-gray-300 mb-1" />
      <span className="text-[9px] text-gray-400">{cfg.title}</span>
      <span className="text-[8px] text-gray-300">{cfg.subtitle}</span>
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
          const x2 = tRect.right - rect.left + 8;
          const y2 = tRect.top + tRect.height / 2 - rect.top;

          // Stagger the vertical lines to avoid overlap
          const midX = x1 + 12 + (index * 8);

          newLines.push({
            mergeType: branch.mergeType,
            label: branch.prNumber ? `#${branch.prNumber}` : branch.commitSha?.slice(0, 5),
            path: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
            labelPos: { x: midX + 2, y: Math.min(y1, y2) + Math.abs(y2 - y1) / 2 - 4 },
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
        <marker id="arr-gray" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
          <polygon points="0 0, 5 2, 0 4" fill="#9ca3af" />
        </marker>
        <marker id="arr-green" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
          <polygon points="0 0, 5 2, 0 4" fill="#22c55e" />
        </marker>
      </defs>

      {lines.map((line, i) => (
        <g key={i}>
          <path
            d={line.path}
            stroke={line.mergeType === 'pr' ? '#22c55e' : '#9ca3af'}
            strokeWidth="1.5"
            strokeDasharray={line.mergeType === 'pr' ? '4,2' : 'none'}
            fill="none"
            markerEnd={line.mergeType === 'pr' ? 'url(#arr-green)' : 'url(#arr-gray)'}
          />
          {line.label && (
            <g transform={`translate(${line.labelPos.x}, ${line.labelPos.y})`}>
              <rect 
                x="0" y="0" 
                width={line.label.length * 5 + 6} height="10" rx="2" 
                fill={line.mergeType === 'pr' ? '#dcfce7' : '#f3f4f6'} 
                stroke={line.mergeType === 'pr' ? '#86efac' : '#d1d5db'} 
                strokeWidth="0.5" 
              />
              <text 
                x={(line.label.length * 5 + 6) / 2} y="7" 
                textAnchor="middle" 
                fontSize="6" 
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

// ============ SCAN CONNECTOR ============
function ScanConnector({ branchId, scanId, containerRef }: any) {
  const [path, setPath] = useState('');

  useEffect(() => {
    const calculate = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const branchEl = container.querySelector(`[data-branch-id="${branchId}"]`);
      const scanEl = container.querySelector(`[data-scan-id="${scanId}"]`);

      if (branchEl && scanEl) {
        const bRect = branchEl.getBoundingClientRect();
        const sRect = scanEl.getBoundingClientRect();

        const x1 = bRect.right - rect.left;
        const y1 = bRect.top + bRect.height / 2 - rect.top;
        const x2 = sRect.left - rect.left;
        const y2 = sRect.top + sRect.height / 2 - rect.top;

        setPath(`M ${x1} ${y1} H ${x2}`);
      }
    };

    setTimeout(calculate, 100);
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [branchId, scanId, containerRef]);

  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 0 }}>
      <defs>
        <marker id="arr-indigo" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
          <polygon points="0 0, 5 2, 0 4" fill="#6366f1" />
        </marker>
      </defs>
      {path && (
        <path
          d={path}
          stroke="#6366f1"
          strokeWidth="1.5"
          fill="none"
          markerEnd="url(#arr-indigo)"
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
      { id: 'b5', name: 'main', healthScore: 88, lastActivity: '15m ago', isDefault: true, isProtected: true },
    ],
    // Scans - populated when TD runs
    scans: [
      { id: 's1', branchId: 'b5', status: 'passed', trigger: 'PR #40', commitSha: 'a1b2c3d', scanTypes: ['sast', 'sca', 'secrets'], duration: '2m 34s', findingsCount: 3 },
    ],
    // Environments - populated when CSPM/Pentest links
    environments: [
      { type: 'prod', status: 'healthy', source: 'CSPM' },
    ],
  },
  { 
    id: '2', 
    name: 'web-frontend', 
    fullName: 'acme/web-frontend', 
    healthScore: 62, 
    findings: { critical: 1, high: 4, medium: 12, low: 3 },
    branches: [
      { id: 'b6', name: 'feature/dashboard', healthScore: 58, lastActivity: '3h ago', mergedTo: 'b7', mergeType: 'commit', commitSha: 'e5f6g7h' },
      { id: 'b7', name: 'main', healthScore: 65, lastActivity: '1h ago', isDefault: true, isProtected: true },
    ],
    scans: [], // No scans yet
    environments: [], // No environments yet
  },
  { 
    id: '3', 
    name: 'auth-service', 
    fullName: 'acme/auth-service', 
    healthScore: null, 
    findings: { critical: 0, high: 0, medium: 0, low: 0 },
    branches: [
      { id: 'b8', name: 'main', healthScore: null, lastActivity: '1d ago', isDefault: true, isProtected: true },
    ],
    scans: [], // No scans yet
    environments: [], // No environments yet
  },
];

// ============ MAIN PAGE ============
export default function PipelineView() {
  const [expandedId, setExpandedId] = useState<string | null>('1');
  const containerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-xl font-bold text-gray-800 mb-4">Repository Security View</h1>

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
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4,2" /></svg>
            <span className="text-green-700">PR</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#9ca3af" strokeWidth="1.5" /></svg>
            <span className="text-gray-600">Commit</span>
          </div>

          <div className="w-px h-4 bg-gray-300" />

          <span className="text-gray-500 uppercase tracking-wider">Scan:</span>
          <div className="flex items-center gap-1">
            <FileCode className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-600">SAST</span>
          </div>
          <div className="flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-600">SCA</span>
          </div>
          <div className="flex items-center gap-1">
            <Key className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-600">Secrets</span>
          </div>
          <div className="flex items-center gap-1">
            <Cloud className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-600">IaC</span>
          </div>

          <div className="w-px h-4 bg-gray-300" />

          <span className="text-gray-500 uppercase tracking-wider">Env:</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-200 text-sky-800">DEV</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-800">STG</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800">PROD</span>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[176px_200px_160px_200px] gap-4 mb-4 pb-2 border-b border-gray-200">
        <div className="text-xs font-semibold text-gray-500 uppercase">Repos</div>
        <div className="text-xs font-semibold text-gray-500 uppercase">Branches</div>
        <div className="text-xs font-semibold text-gray-500 uppercase">Scans</div>
        <div className="text-xs font-semibold text-gray-500 uppercase">Environments</div>
      </div>
      
      {/* Repos */}
      <div className="space-y-4">
        {testRepos.map((repo) => {
          const isExpanded = expandedId === repo.id;
          const mainBranch = repo.branches.find(b => b.isDefault);
          const latestScan = repo.scans[0];
          
          return (
            <div 
              key={repo.id} 
              ref={(el) => { containerRefs.current[repo.id] = el; }}
              className="relative"
            >
              <div className="grid grid-cols-[176px_200px_160px_200px] gap-4 items-start relative">
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
                    {/* Branches */}
                    <div className="flex flex-col gap-2 relative z-10">
                      {repo.branches.map((branch) => (
                        <BranchCard key={branch.id} {...branch} />
                      ))}
                      <ConnectorLines 
                        branches={repo.branches} 
                        containerRef={{ current: containerRefs.current[repo.id] }} 
                      />
                    </div>
                    
                    {/* Scans */}
                    <div className="flex flex-col gap-2 relative z-10" style={{ marginTop: mainBranch ? `${repo.branches.indexOf(mainBranch) * 52}px` : '0' }}>
                      {repo.scans.length > 0 ? (
                        repo.scans.map((scan) => (
                          <ScanCard key={scan.id} {...scan} />
                        ))
                      ) : (
                        <EmptyState type="scans" />
                      )}
                      {latestScan && mainBranch && (
                        <ScanConnector 
                          branchId={latestScan.branchId} 
                          scanId={latestScan.id}
                          containerRef={{ current: containerRefs.current[repo.id] }} 
                        />
                      )}
                    </div>
                    
                    {/* Environments */}
                    <div className="flex gap-2 relative z-10" style={{ marginTop: mainBranch ? `${repo.branches.indexOf(mainBranch) * 52}px` : '0' }}>
                      {repo.environments.length > 0 ? (
                        repo.environments.map((env, i) => (
                          <EnvCard key={i} {...env} />
                        ))
                      ) : (
                        <EmptyState type="environments" />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="col-span-3 flex items-center h-24 text-gray-400 text-sm">
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
