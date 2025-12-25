'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface Technique {
  id: string;
  name: string;
  findingCount?: number;
}

interface Tactic {
  id: string;
  name: string;
  shortName: string;
  techniques: Technique[];
}

export default function AttackMatrixPage() {
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTactics();
  }, []);

  const fetchTactics = async () => {
    try {
      const res = await fetch('/api/vulndb/attack/tactics');
      if (res.ok) {
        const data = await res.json();
        setTactics(data);
      }
    } catch (error) {
      console.error('Failed to fetch tactics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHeatColor = (count: number = 0): string => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
    if (count <= 2) return 'bg-yellow-100 dark:bg-yellow-900';
    if (count <= 5) return 'bg-orange-100 dark:bg-orange-900';
    return 'bg-red-100 dark:bg-red-900';
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">MITRE ATT&CK Matrix</h1>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 70 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">MITRE ATT&CK Matrix</h1>
          <p className="text-gray-500">
            Visualize your security findings mapped to ATT&CK framework
          </p>
        </div>
        <div className="flex gap-2 items-center text-sm">
          <span>Findings:</span>
          <Badge variant="outline" className="bg-gray-100">0</Badge>
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">1-2</Badge>
          <Badge variant="outline" className="bg-orange-100 text-orange-800">3-5</Badge>
          <Badge variant="outline" className="bg-red-100 text-red-800">6+</Badge>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex gap-1 min-w-max">
          {tactics.map((tactic) => (
            <div key={tactic.id} className="w-44">
              <div className="bg-blue-600 text-white text-xs font-semibold p-2 rounded-t text-center">
                {tactic.name}
              </div>
              <div className="space-y-1 p-1 bg-gray-50 dark:bg-gray-900 rounded-b min-h-[400px]">
                {tactic.techniques?.map((tech) => (
                  <Link key={tech.id} href={`/dashboard/attack/technique/${tech.id}`}>
                    <div
                      className={`text-xs p-2 rounded cursor-pointer hover:ring-2 ring-blue-500 transition-all ${getHeatColor(tech.findingCount)}`}
                      title={`${tech.name} (${tech.id})`}
                    >
                      <div className="font-mono text-[10px] text-gray-500">{tech.id}</div>
                      <div className="truncate font-medium">{tech.name}</div>
                      {(tech.findingCount ?? 0) > 0 && (
                        <Badge variant="destructive" className="text-[10px] mt-1 h-4">
                          {tech.findingCount}
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Link href="/dashboard/attack/killchain">
              <div className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <h3 className="font-semibold">Kill Chain View</h3>
                <p className="text-sm text-gray-500">Lockheed Martin Cyber Kill Chain</p>
              </div>
            </Link>
            <Link href="/dashboard/attack/threats">
              <div className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <h3 className="font-semibold">Threat Actors</h3>
                <p className="text-sm text-gray-500">APT groups using your techniques</p>
              </div>
            </Link>
            <Link href="/dashboard/attack/surface">
              <div className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <h3 className="font-semibold">Attack Surface</h3>
                <p className="text-sm text-gray-500">Comprehensive exposure analysis</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
