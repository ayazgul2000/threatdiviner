'use client';

import { useState } from 'react';
import { GitBranch, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';

// ============ REPO CARD (Light Mode) ============
interface RepoCardProps {
  name: string;
  fullName?: string;
  healthScore: number | null;
  findings: { critical: number; high: number; medium: number; low: number };
  isExpanded?: boolean;
  onClick?: () => void;
}

function RepoCard({ name, fullName, healthScore, findings, isExpanded = false, onClick }: RepoCardProps) {
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

// ============ PLACEHOLDER NODE ============
function PlaceholderNode({ label }: { label: string }) {
  return (
    <div className="h-[88px] rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

// ============ TEST DATA ============
const testRepos = [
  { id: '1', name: 'api-gateway', fullName: 'acme/api-gateway', healthScore: 85, findings: { critical: 0, high: 2, medium: 5, low: 8 } },
  { id: '2', name: 'web-frontend', fullName: 'acme/web-frontend', healthScore: 62, findings: { critical: 1, high: 4, medium: 12, low: 3 } },
  { id: '3', name: 'auth-service', fullName: 'acme/auth-service', healthScore: 45, findings: { critical: 3, high: 8, medium: 15, low: 2 } },
  { id: '4', name: 'data-processor', fullName: 'acme/data-processor', healthScore: null, findings: { critical: 0, high: 0, medium: 0, low: 0 } },
];

// ============ MAIN PAGE ============
export default function PipelineView() {
  const [expandedId, setExpandedId] = useState<string | null>('1');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-xl font-bold text-gray-800 mb-6">Pipeline View</h1>
      
      {/* Column Headers */}
      <div className="grid grid-cols-[176px_160px_160px_112px_176px] gap-4 mb-4 pb-2 border-b border-gray-200">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Repos</div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Branches</div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Activity</div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Builds</div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Environments</div>
      </div>
      
      {/* Rows - one per repo */}
      <div className="space-y-3">
        {testRepos.map((repo) => (
          <div key={repo.id} className="grid grid-cols-[176px_160px_160px_112px_176px] gap-4 items-start">
            {/* Repo */}
            <RepoCard
              name={repo.name}
              fullName={repo.fullName}
              healthScore={repo.healthScore}
              findings={repo.findings}
              isExpanded={expandedId === repo.id}
              onClick={() => setExpandedId(expandedId === repo.id ? null : repo.id)}
            />
            
            {/* Branches */}
            <PlaceholderNode label={expandedId === repo.id ? "main, develop" : "—"} />
            
            {/* Activity */}
            <PlaceholderNode label={expandedId === repo.id ? "PR #42" : "—"} />
            
            {/* Builds */}
            <PlaceholderNode label={expandedId === repo.id ? "Build #89" : "—"} />
            
            {/* Environments */}
            <PlaceholderNode label={expandedId === repo.id ? "DEV → PROD" : "—"} />
          </div>
        ))}
      </div>
    </div>
  );
}
