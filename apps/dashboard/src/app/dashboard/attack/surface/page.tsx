'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AttackSurface {
  overallScore: number;
  tacticCoverage: { tactic: string; count: number; percentage: number }[];
  topTechniques: { id: string; name: string; count: number }[];
  killChainCoverage: { stage: string; count: number }[];
}

const defaultData: AttackSurface = {
  overallScore: 0,
  tacticCoverage: [],
  topTechniques: [],
  killChainCoverage: [],
};

export default function AttackSurfacePage() {
  const [data, setData] = useState<AttackSurface>(defaultData);
  const [loading, setLoading] = useState(true);
  const [repository, setRepository] = useState<string>('all');
  const [repositories, setRepositories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchRepositories();
    fetchAttackSurface();
  }, [repository]);

  const fetchRepositories = async () => {
    try {
      const res = await fetch(`${API_URL}/repositories`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRepositories(data);
      }
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
    }
  };

  const fetchAttackSurface = async () => {
    setLoading(true);
    try {
      const url = repository === 'all'
        ? `${API_URL}/vulndb/attack/surface`
        : `${API_URL}/vulndb/attack/surface/${repository}`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setData(data);
      }
    } catch (error) {
      console.error('Failed to fetch attack surface:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score > 70) return 'text-red-500';
    if (score > 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getScoreLabel = (score: number) => {
    if (score > 70) return 'High Exposure';
    if (score > 40) return 'Moderate';
    return 'Low Exposure';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Attack Surface</h1>
          <p className="text-gray-500">
            Comprehensive view of your security exposure
          </p>
        </div>
        <select
          value={repository}
          onChange={(e) => setRepository(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
        >
          <option value="all">All Repositories</option>
          {repositories.map(repo => (
            <option key={repo.id} value={repo.id}>{repo.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Attack Surface Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    strokeWidth="12"
                    fill="none"
                    className="stroke-gray-200"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(data.overallScore / 100) * 352} 352`}
                    className={`${data.overallScore > 70 ? 'stroke-red-500' : data.overallScore > 40 ? 'stroke-yellow-500' : 'stroke-green-500'}`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${getScoreColor(data.overallScore)}`}>
                    {data.overallScore}
                  </span>
                </div>
              </div>
            </div>
            <p className={`text-center text-sm mt-2 ${getScoreColor(data.overallScore)}`}>
              {getScoreLabel(data.overallScore)}
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">Tactic Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.tacticCoverage.map((tactic) => (
                <div key={tactic.tactic} className="flex items-center gap-3">
                  <div className="w-32 text-sm truncate">{tactic.tactic}</div>
                  <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${tactic.percentage > 50 ? 'bg-red-500' : tactic.percentage > 25 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${tactic.percentage}%` }}
                    />
                  </div>
                  <div className="w-16 text-sm text-right">
                    {tactic.count} ({tactic.percentage}%)
                  </div>
                </div>
              ))}
              {data.tacticCoverage.length === 0 && !loading && (
                <div className="text-center text-gray-500 py-8">
                  No tactic coverage data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Vulnerable Techniques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topTechniques.slice(0, 10).map((tech, idx) => (
                <div key={tech.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">{idx + 1}</span>
                    <span className="text-sm font-medium">{tech.name}</span>
                    <Badge variant="outline" className="text-xs">{tech.id}</Badge>
                  </div>
                  <Badge variant="destructive">{tech.count}</Badge>
                </div>
              ))}
              {data.topTechniques.length === 0 && !loading && (
                <div className="text-center text-gray-500 py-8">
                  No technique data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Kill Chain Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.killChainCoverage.map((stage) => (
                <div key={stage.stage} className="flex items-center gap-3">
                  <div className="w-40 text-sm">{stage.stage}</div>
                  <div className="flex-1 h-6 bg-gray-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500 flex items-center justify-end pr-2"
                      style={{ width: `${Math.min(100, stage.count * 10)}%` }}
                    >
                      <span className="text-xs text-white font-medium">{stage.count}</span>
                    </div>
                  </div>
                </div>
              ))}
              {data.killChainCoverage.length === 0 && !loading && (
                <div className="text-center text-gray-500 py-8">
                  No kill chain data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
