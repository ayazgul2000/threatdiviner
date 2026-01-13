'use client';

import { useState } from 'react';
import { GitBranch, AlertTriangle, ChevronRight, ChevronDown, GitMerge, Shield, Star, CheckCircle2, AlertCircle, XCircle, GitPullRequest, Clock, User, CircleDot, Ban } from 'lucide-react';

// ============ REPO CARD ============
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

// ============ BRANCH CARD ============
interface BranchCardProps {
  name: string;
  healthScore: number | null;
  isDefault?: boolean;
  isProtected?: boolean;
}

function BranchCard({ name, healthScore, isDefault = false, isProtected = false }: BranchCardProps) {
  const getHealthColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  return (
    <div className="w-36 p-2.5 rounded-lg bg-white border border-gray-200 shadow-sm">
      <div className="flex items-center gap-1.5 mb-2">
        <GitMerge className="w-3.5 h-3.5 text-teal-600" />
        <span className="text-xs font-medium text-gray-900 truncate">{name}</span>
      </div>
      
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getHealthColor(healthScore)}`}>
          {healthScore !== null ? `${healthScore}%` : 'N/A'}
        </span>
        {isDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
        {isProtected && <Shield className="w-3 h-3 text-blue-500" />}
      </div>
    </div>
  );
}

// ============ PR CARD ============
interface PRCardProps {
  number: number;
  title: string;
  author: string;
  state: 'open' | 'merged' | 'closed' | 'blocked';
  checksState?: 'success' | 'failure' | 'pending';
}

function PRCard({ number, title, author, state, checksState }: PRCardProps) {
  const stateConfig = {
    open: { bg: 'bg-green-50', border: 'border-green-300', icon: 'text-green-600', label: 'text-green-700' },
    merged: { bg: 'bg-purple-50', border: 'border-purple-300', icon: 'text-purple-600', label: 'text-purple-700' },
    closed: { bg: 'bg-gray-50', border: 'border-gray-300', icon: 'text-gray-500', label: 'text-gray-600' },
    blocked: { bg: 'bg-rose-50', border: 'border-rose-300', icon: 'text-rose-600', label: 'text-rose-700' },
  };

  const checksColors = {
    success: 'text-emerald-500',
    failure: 'text-rose-500',
    pending: 'text-amber-500',
  };

  const cfg = stateConfig[state];

  return (
    <div className={`w-36 p-2.5 rounded-lg ${cfg.bg} border ${cfg.border} shadow-sm`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <GitPullRequest className={`w-4 h-4 ${cfg.icon}`} strokeWidth={2.5} />
        <span className={`text-xs font-bold ${cfg.label}`}>#{number}</span>
        {checksState && (
          <CheckCircle2 className={`w-3.5 h-3.5 ml-auto ${checksColors[checksState]}`} />
        )}
      </div>
      <p className="text-[10px] text-gray-700 truncate mb-1.5" title={title}>{title}</p>
      <div className="flex items-center gap-1 text-[10px] text-gray-500">
        <User className="w-3 h-3" />
        <span className="truncate">{author}</span>
      </div>
    </div>
  );
}

// ============ COMMIT CARD ============
interface CommitCardProps {
  sha: string;
  message: string;
  author: string;
  time: string;
}

function CommitCard({ sha, message, author, time }: CommitCardProps) {
  return (
    <div className="w-36 p-2.5 rounded-lg bg-white border border-gray-200 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1.5">
        <CircleDot className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
        <code className="text-[10px] font-mono font-bold text-indigo-600">{sha.slice(0, 7)}</code>
      </div>
      <p className="text-[10px] text-gray-700 truncate mb-1.5" title={message}>{message}</p>
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="truncate">{author}</span>
        <span className="flex items-center gap-0.5 text-gray-400">
          <Clock className="w-3 h-3" />
          {time}
        </span>
      </div>
    </div>
  );
}

// ============ PLACEHOLDER NODE ============
function PlaceholderNode({ label, height = 'h-[76px]' }: { label: string; height?: string }) {
  return (
    <div className={`${height} rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center`}>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
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
      { name: 'main', healthScore: 88, isDefault: true, isProtected: true, activity: { type: 'commit', sha: 'a1b2c3d4', message: 'Fix auth middleware', author: 'alice', time: '2h' } },
      { name: 'develop', healthScore: 72, isDefault: false, isProtected: false, activity: { type: 'pr', number: 42, title: 'Add rate limiting', author: 'bob', state: 'open', checksState: 'success' } },
    ]
  },
  { 
    id: '2', 
    name: 'web-frontend', 
    fullName: 'acme/web-frontend', 
    healthScore: 62, 
    findings: { critical: 1, high: 4, medium: 12, low: 3 },
    branches: [
      { name: 'main', healthScore: 65, isDefault: true, isProtected: true, activity: { type: 'pr', number: 87, title: 'Security patch XSS', author: 'carol', state: 'blocked', checksState: 'failure' } },
      { name: 'feature/auth', healthScore: 45, isDefault: false, isProtected: false, activity: { type: 'commit', sha: 'e5f6g7h8', message: 'WIP: OAuth flow', author: 'dave', time: '30m' } },
    ]
  },
  { 
    id: '3', 
    name: 'auth-service', 
    fullName: 'acme/auth-service', 
    healthScore: 45, 
    findings: { critical: 3, high: 8, medium: 15, low: 2 },
    branches: [
      { name: 'main', healthScore: 45, isDefault: true, isProtected: true, activity: { type: 'pr', number: 23, title: 'Upgrade deps', author: 'eve', state: 'merged', checksState: 'success' } },
    ]
  },
  { 
    id: '4', 
    name: 'data-processor', 
    fullName: 'acme/data-processor', 
    healthScore: null, 
    findings: { critical: 0, high: 0, medium: 0, low: 0 },
    branches: []
  },
];

// ============ MAIN PAGE ============
export default function PipelineView() {
  const [expandedId, setExpandedId] = useState<string | null>('1');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-xl font-bold text-gray-800 mb-4">Pipeline View</h1>

      {/* Legend */}
      <div className="mb-6 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium">
          {/* Health */}
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
          
          {/* Branch */}
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
          
          {/* Activity - PR */}
          <span className="text-gray-500 uppercase tracking-wider">PR:</span>
          <div className="flex items-center gap-1">
            <GitPullRequest className="w-4 h-4 text-green-600" strokeWidth={2.5} />
            <span className="text-green-700 font-semibold">Open</span>
          </div>
          <div className="flex items-center gap-1">
            <GitPullRequest className="w-4 h-4 text-purple-600" strokeWidth={2.5} />
            <span className="text-purple-700 font-semibold">Merged</span>
          </div>
          <div className="flex items-center gap-1">
            <GitPullRequest className="w-4 h-4 text-gray-400" strokeWidth={2.5} />
            <span className="text-gray-600 font-semibold">Closed</span>
          </div>
          <div className="flex items-center gap-1">
            <Ban className="w-4 h-4 text-rose-500" strokeWidth={2.5} />
            <span className="text-rose-700 font-semibold">Blocked</span>
          </div>

          <div className="w-px h-4 bg-gray-300" />

          {/* Activity - Commit */}
          <span className="text-gray-500 uppercase tracking-wider">Commit:</span>
          <div className="flex items-center gap-1">
            <CircleDot className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
            <span className="text-gray-700">Push</span>
          </div>
        </div>
      </div>
      
      {/* Column Headers */}
      <div className="grid grid-cols-[176px_152px_152px_112px_180px] gap-4 mb-4 pb-2 border-b border-gray-200">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Repos</div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Branches</div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Activity</div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Builds</div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Environments</div>
      </div>
      
      {/* Rows */}
      <div className="space-y-3">
        {testRepos.map((repo) => {
          const isExpanded = expandedId === repo.id;
          const branches = isExpanded ? repo.branches : [];
          
          return (
            <div key={repo.id} className="grid grid-cols-[176px_152px_152px_112px_180px] gap-4 items-start">
              {/* Repo */}
              <RepoCard
                name={repo.name}
                fullName={repo.fullName}
                healthScore={repo.healthScore}
                findings={repo.findings}
                isExpanded={isExpanded}
                onClick={() => setExpandedId(isExpanded ? null : repo.id)}
              />
              
              {/* Branches */}
              <div className="flex flex-col gap-2">
                {branches.length > 0 ? (
                  branches.map((branch, idx) => (
                    <BranchCard
                      key={idx}
                      name={branch.name}
                      healthScore={branch.healthScore}
                      isDefault={branch.isDefault}
                      isProtected={branch.isProtected}
                    />
                  ))
                ) : (
                  <PlaceholderNode label="—" />
                )}
              </div>
              
              {/* Activity */}
              <div className="flex flex-col gap-2">
                {branches.length > 0 ? (
                  branches.map((branch, idx) => {
                    const act = branch.activity as any;
                    if (act.type === 'pr') {
                      return (
                        <PRCard
                          key={idx}
                          number={act.number}
                          title={act.title}
                          author={act.author}
                          state={act.state}
                          checksState={act.checksState}
                        />
                      );
                    } else {
                      return (
                        <CommitCard
                          key={idx}
                          sha={act.sha}
                          message={act.message}
                          author={act.author}
                          time={act.time}
                        />
                      );
                    }
                  })
                ) : (
                  <PlaceholderNode label="—" />
                )}
              </div>
              
              {/* Builds */}
              <div className="flex flex-col gap-2">
                {branches.length > 0 ? (
                  branches.map((_, idx) => (
                    <PlaceholderNode key={idx} label="Build" />
                  ))
                ) : (
                  <PlaceholderNode label="—" />
                )}
              </div>
              
              {/* Environments */}
              <div className="flex flex-col gap-2">
                {branches.length > 0 ? (
                  branches.map((_, idx) => (
                    <PlaceholderNode key={idx} label="DEV → PROD" />
                  ))
                ) : (
                  <PlaceholderNode label="—" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
