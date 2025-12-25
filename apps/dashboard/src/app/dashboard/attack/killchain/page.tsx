'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface KillChainStage {
  id: string;
  name: string;
  description: string;
  order: number;
  findingCount: number;
  status: 'secure' | 'at-risk' | 'compromised';
}

const defaultStages: KillChainStage[] = [
  { id: 'reconnaissance', name: 'Reconnaissance', description: 'Research, identification and selection of targets', order: 1, findingCount: 0, status: 'secure' },
  { id: 'weaponization', name: 'Weaponization', description: 'Pairing remote access malware with exploit', order: 2, findingCount: 0, status: 'secure' },
  { id: 'delivery', name: 'Delivery', description: 'Transmission of weapon to target', order: 3, findingCount: 0, status: 'secure' },
  { id: 'exploitation', name: 'Exploitation', description: 'Triggering the weapon code', order: 4, findingCount: 0, status: 'secure' },
  { id: 'installation', name: 'Installation', description: 'Installing backdoor for persistence', order: 5, findingCount: 0, status: 'secure' },
  { id: 'command-control', name: 'Command & Control', description: 'Hands on keyboard access', order: 6, findingCount: 0, status: 'secure' },
  { id: 'actions', name: 'Actions on Objectives', description: 'Accomplishing the mission', order: 7, findingCount: 0, status: 'secure' },
];

export default function KillChainPage() {
  const [stages, setStages] = useState<KillChainStage[]>(defaultStages);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKillChain();
  }, []);

  const fetchKillChain = async () => {
    try {
      const res = await fetch('/api/vulndb/attack/killchain');
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setStages(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch kill chain:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'secure':
        return (
          <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'at-risk':
        return (
          <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'compromised':
        return (
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'secure':
        return 'border-green-500 bg-green-50 dark:bg-green-950';
      case 'at-risk':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950';
      case 'compromised':
        return 'border-red-500 bg-red-50 dark:bg-red-950';
      default:
        return 'border-gray-300';
    }
  };

  const totalFindings = stages.reduce((sum, s) => sum + s.findingCount, 0);
  const secureStages = stages.filter(s => s.status === 'secure').length;
  const overallScore = stages.length > 0 ? Math.round((secureStages / stages.length) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Cyber Kill Chain</h1>
          <p className="text-gray-500">
            Lockheed Martin Cyber Kill Chain coverage analysis
          </p>
        </div>
        <Card className="w-48">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-3xl font-bold">{overallScore}%</div>
              <div className="text-sm text-gray-500">Security Score</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${overallScore > 70 ? 'bg-green-500' : overallScore > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${overallScore}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {stages.map((stage, index) => (
          <div key={stage.id} className="flex items-center">
            <Card className={`flex-1 border-2 ${getStatusColor(stage.status)}`}>
              <CardHeader className="p-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{stage.order}</Badge>
                  {getStatusIcon(stage.status)}
                </div>
                <CardTitle className="text-sm mt-2">{stage.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-xs text-gray-500 mb-2">{stage.description}</p>
                {stage.findingCount > 0 && (
                  <Badge variant="destructive">{stage.findingCount} findings</Badge>
                )}
              </CardContent>
            </Card>
            {index < stages.length - 1 && (
              <svg className="h-4 w-4 mx-1 text-gray-400 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kill Chain Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{secureStages}</div>
              <div className="text-sm text-gray-500">Secure Stages</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {stages.filter(s => s.status === 'at-risk').length}
              </div>
              <div className="text-sm text-gray-500">At Risk</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {stages.filter(s => s.status === 'compromised').length}
              </div>
              <div className="text-sm text-gray-500">Needs Attention</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
