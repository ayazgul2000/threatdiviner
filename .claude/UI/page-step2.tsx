'use client';

import { useState } from 'react';
import { RepoCard } from '@/components/flow/RepoCard';

// Test data - hardcoded for visual testing
const testRepos = [
  {
    id: '1',
    name: 'api-gateway',
    fullName: 'acme/api-gateway',
    healthScore: 85,
    findings: { critical: 0, high: 2, medium: 5, low: 8 },
  },
  {
    id: '2', 
    name: 'web-frontend',
    fullName: 'acme/web-frontend',
    healthScore: 62,
    findings: { critical: 1, high: 4, medium: 12, low: 3 },
  },
  {
    id: '3',
    name: 'auth-service',
    fullName: 'acme/auth-service',
    healthScore: 45,
    findings: { critical: 3, high: 8, medium: 15, low: 2 },
  },
  {
    id: '4',
    name: 'data-processor',
    fullName: 'acme/data-processor',
    healthScore: null,
    findings: { critical: 0, high: 0, medium: 0, low: 0 },
  },
];

export default function RepoCardTest() {
  const [expandedId, setExpandedId] = useState<string | null>('1');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-xl font-bold text-gray-800 mb-6">Pipeline View</h1>
      
      {/* Column Headers */}
      <div className="flex gap-6 mb-4 pb-2 border-b border-gray-200">
        <div className="w-44 text-xs font-semibold text-gray-500 uppercase tracking-wider">Repos</div>
        <div className="w-40 text-xs font-semibold text-gray-500 uppercase tracking-wider">Branches</div>
        <div className="w-40 text-xs font-semibold text-gray-500 uppercase tracking-wider">Activity</div>
        <div className="w-28 text-xs font-semibold text-gray-500 uppercase tracking-wider">Builds</div>
        <div className="w-44 text-xs font-semibold text-gray-500 uppercase tracking-wider">Environments</div>
      </div>
      
      {/* Content Area */}
      <div className="flex">
        {/* Repos Column */}
        <div className="w-44 flex flex-col gap-3">
          {testRepos.map((repo) => (
            <RepoCard
              key={repo.id}
              name={repo.name}
              fullName={repo.fullName}
              healthScore={repo.healthScore}
              findings={repo.findings}
              isExpanded={expandedId === repo.id}
              onClick={() => setExpandedId(expandedId === repo.id ? null : repo.id)}
            />
          ))}
        </div>

        {/* Branches Column - placeholder */}
        <div className="w-40 ml-6 flex flex-col gap-3">
          <div className="h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
            Branches here
          </div>
        </div>

        {/* Activity Column - placeholder */}
        <div className="w-40 ml-6 flex flex-col gap-3">
          <div className="h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
            PRs/Commits
          </div>
        </div>

        {/* Builds Column - placeholder */}
        <div className="w-28 ml-6 flex flex-col gap-3">
          <div className="h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
            Builds
          </div>
        </div>

        {/* Environments Column - placeholder */}
        <div className="w-44 ml-6 flex flex-col gap-3">
          <div className="h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
            DEV → STAGING → PROD
          </div>
        </div>
      </div>
    </div>
  );
}
