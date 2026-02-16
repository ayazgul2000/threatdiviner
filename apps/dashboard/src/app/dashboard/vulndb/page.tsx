'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatsSkeleton, CardSkeleton } from '@/components/ui/skeletons';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface VulnDbStats {
  cves: number;
  cwes: number;
  attackTechniques: number;
  kevCount: number;
  lastSync: string | null;
}

export default function VulnDbPage() {
  const [stats, setStats] = useState<VulnDbStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/vulndb/stats`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'CVEs', value: stats?.cves ?? 0, href: '/dashboard/vulndb/cve', color: 'bg-blue-500' },
    { label: 'CWEs', value: stats?.cwes ?? 0, href: '/dashboard/vulndb/cwe', color: 'bg-purple-500' },
    { label: 'ATT&CK Techniques', value: stats?.attackTechniques ?? 0, href: '/dashboard/attack', color: 'bg-orange-500' },
    { label: 'KEV Entries', value: stats?.kevCount ?? 0, href: '/dashboard/vulndb/cve?kev=true', color: 'bg-red-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Vulnerability Database</h1>
          <p className="text-gray-500">
            Centralized vulnerability intelligence from multiple sources
          </p>
        </div>
        <Link href="/dashboard/vulndb/sync">
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync Status
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-3xl font-bold mt-1">
                      {loading ? '-' : card.value.toLocaleString()}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-full ${card.color} flex items-center justify-center`}>
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Link href="/dashboard/vulndb/cve">
                <div className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">CVE Search</h3>
                    <p className="text-sm text-gray-500">Search NVD CVE database with filters</p>
                  </div>
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
              <Link href="/dashboard/vulndb/cwe">
                <div className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">CWE Browser</h3>
                    <p className="text-sm text-gray-500">Browse Common Weakness Enumeration</p>
                  </div>
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
              <Link href="/dashboard/vulndb/owasp">
                <div className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">OWASP Top 10</h3>
                    <p className="text-sm text-gray-500">View OWASP Top 10 with your findings</p>
                  </div>
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">NVD</span>
                  </div>
                  <span className="font-medium">NIST NVD</span>
                </div>
                <Badge variant="secondary">CVEs</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-red-600">CISA</span>
                  </div>
                  <span className="font-medium">CISA KEV</span>
                </div>
                <Badge variant="destructive">Exploited</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-purple-600">CWE</span>
                  </div>
                  <span className="font-medium">MITRE CWE</span>
                </div>
                <Badge variant="secondary">Weaknesses</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-orange-600">ATT</span>
                  </div>
                  <span className="font-medium">MITRE ATT&CK</span>
                </div>
                <Badge variant="secondary">Techniques</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-green-600">EPSS</span>
                  </div>
                  <span className="font-medium">FIRST EPSS</span>
                </div>
                <Badge variant="secondary">Probability</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
