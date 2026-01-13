'use client';

import { useState } from 'react';
import { RepoCard } from './RepoCard';

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
    <div className="min-h-screen bg-slate-900 p-8">
      <h1 className="text-xl font-bold text-white mb-6">Phase 1 Step 1: RepoCard Test</h1>
      
      <div className="flex flex-col gap-3">
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

      <div className="mt-8 p-4 bg-slate-800 rounded-lg">
        <h2 className="text-sm font-medium text-white mb-2">Checklist:</h2>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>✓ Card shows repo name</li>
          <li>✓ Health score with color coding (green 80+, amber 50-79, red &lt;50, gray N/A)</li>
          <li>✓ Findings count with severity colors</li>
          <li>✓ Click toggles expand state</li>
          <li>✓ Expanded card has ring highlight</li>
        </ul>
      </div>
    </div>
  );
}
