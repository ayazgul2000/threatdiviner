'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SyncStatus {
  id: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  recordCount: number;
  status: 'pending' | 'syncing' | 'success' | 'failed';
  errorMessage: string | null;
  nextSyncAt: string | null;
}

const sourceLabels: Record<string, string> = {
  nvd: 'NVD (CVEs)',
  cwe: 'MITRE CWE',
  epss: 'FIRST EPSS',
  kev: 'CISA KEV',
  owasp: 'OWASP Top 10',
  attack: 'MITRE ATT&CK',
  capec: 'MITRE CAPEC',
};

export default function SyncStatusPage() {
  const [statuses, setStatuses] = useState<SyncStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/vulndb/sync/status`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStatuses(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async (source: string) => {
    setSyncing(source);
    try {
      await fetch(`${API_URL}/vulndb/sync/${source}`, { method: 'POST', credentials: 'include' });
      // Wait a moment then refresh status
      setTimeout(() => {
        fetchStatus();
        setSyncing(null);
      }, 2000);
    } catch (error) {
      console.error(`Failed to trigger ${source} sync:`, error);
      setSyncing(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'syncing':
        return (
          <svg className="h-5 w-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Vulnerability Database Sync</h1>
          <p className="text-gray-500">
            Status of external data source synchronization
          </p>
        </div>
        <button
          onClick={() => triggerSync('all')}
          disabled={syncing !== null}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <svg className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync All
        </button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Records</TableHead>
              <TableHead>Last Sync</TableHead>
              <TableHead>Next Sync</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : statuses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No sync status data available. Run a sync to populate this data.
                </TableCell>
              </TableRow>
            ) : (
              statuses.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{sourceLabels[s.id] || s.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(s.status)}
                      <Badge variant={
                        s.status === 'success' ? 'default' :
                        s.status === 'failed' ? 'destructive' :
                        s.status === 'syncing' ? 'secondary' : 'outline'
                      }>
                        {s.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{s.recordCount.toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{formatDate(s.lastSuccessAt)}</TableCell>
                  <TableCell className="text-sm">{formatDate(s.nextSyncAt)}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => triggerSync(s.id)}
                      disabled={syncing !== null}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                    >
                      {syncing === s.id ? (
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        'Sync Now'
                      )}
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {statuses.some(s => s.errorMessage) && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Sync Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statuses.filter(s => s.errorMessage).map(s => (
              <div key={s.id} className="p-3 bg-red-50 dark:bg-red-950 rounded mb-2">
                <span className="font-medium">{sourceLabels[s.id]}:</span>{' '}
                <span className="text-red-700">{s.errorMessage}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
