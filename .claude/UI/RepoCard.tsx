'use client';

import { GitBranch, AlertTriangle } from 'lucide-react';

interface RepoCardProps {
  name: string;
  fullName?: string;
  healthScore: number | null;
  findings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  isExpanded?: boolean;
  onClick?: () => void;
}

export function RepoCard({
  name,
  fullName,
  healthScore,
  findings,
  isExpanded = false,
  onClick,
}: RepoCardProps) {
  // Health score color
  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-slate-600 text-slate-300';
    if (score >= 80) return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    if (score >= 50) return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
  };

  const totalFindings = findings.critical + findings.high + findings.medium + findings.low;

  return (
    <div
      onClick={onClick}
      className={`
        w-44 p-3 rounded-lg cursor-pointer transition-all duration-200
        bg-slate-800/80 border border-slate-700/50
        hover:border-indigo-500/50 hover:bg-slate-800
        ${isExpanded ? 'ring-2 ring-indigo-500/50' : ''}
      `}
    >
      {/* Header: Icon + Name */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-indigo-500/20">
          <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <span className="text-sm font-medium text-white truncate" title={fullName || name}>
          {name}
        </span>
      </div>

      {/* Health Score */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">Health</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${getHealthColor(healthScore)}`}>
          {healthScore !== null ? `${healthScore}%` : 'N/A'}
        </span>
      </div>

      {/* Findings Summary */}
      {totalFindings > 0 && (
        <div className="flex items-center gap-1 text-xs">
          <AlertTriangle className="w-3 h-3 text-slate-400" />
          <div className="flex gap-1.5">
            {findings.critical > 0 && (
              <span className="text-purple-400">{findings.critical}C</span>
            )}
            {findings.high > 0 && (
              <span className="text-rose-400">{findings.high}H</span>
            )}
            {findings.medium > 0 && (
              <span className="text-amber-400">{findings.medium}M</span>
            )}
            {findings.low > 0 && (
              <span className="text-yellow-400">{findings.low}L</span>
            )}
          </div>
        </div>
      )}

      {/* Expand indicator */}
      <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-center">
        <span className="text-[10px] text-slate-500">
          {isExpanded ? '▼ Collapse' : '▶ Expand'}
        </span>
      </div>
    </div>
  );
}
