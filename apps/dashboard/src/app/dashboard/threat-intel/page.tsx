'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageHeader,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ThreatReport {
  indicator: string;
  type: string;
  queriedAt: string;
  sources: SourceResult[];
  aggregatedScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'clean';
  tags: string[];
  recommendations: string[];
}

interface SourceResult {
  source: string;
  found: boolean;
  confidence?: number;
  severity?: string;
  details?: Record<string, unknown>;
  error?: string;
  queriedAt: string;
}

const riskColors: Record<string, string> = {
  critical: 'danger',
  high: 'warning',
  medium: 'secondary',
  low: 'outline',
  clean: 'success',
};

export default function ThreatIntelPage() {
  const [indicator, setIndicator] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ThreatReport | null>(null);
  const [history, setHistory] = useState<ThreatReport[]>([]);

  const handleQuery = async () => {
    if (!indicator.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/threat-intel/query`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indicator: indicator.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Query failed');
      }

      const data = await res.json();
      setReport(data);
      setHistory(prev => [data, ...prev.slice(0, 9)]);
    } catch (err) {
      console.error('Query failed:', err);
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCVEQuery = async () => {
    if (!indicator.trim() || !indicator.toUpperCase().startsWith('CVE-')) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/threat-intel/cve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cveId: indicator.trim().toUpperCase() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'CVE query failed');
      }

      const data = await res.json();
      setReport(data);
      setHistory(prev => [data, ...prev.slice(0, 9)]);
    } catch (err) {
      console.error('CVE query failed:', err);
      setError(err instanceof Error ? err.message : 'CVE query failed');
    } finally {
      setLoading(false);
    }
  };

  const detectType = (value: string): string => {
    if (/^CVE-\d{4}-\d+$/i.test(value)) return 'cve';
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return 'ip';
    if (/^https?:\/\//i.test(value)) return 'url';
    if (/^[a-fA-F0-9]{32}$/.test(value)) return 'md5';
    if (/^[a-fA-F0-9]{64}$/.test(value)) return 'sha256';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
    return 'domain';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Threat Intelligence"
        description="Query indicators of compromise against multiple threat intelligence sources"
        breadcrumbs={[{ label: 'Threat Intel' }]}
      />

      {/* Search */}
      <Card variant="bordered">
        <CardContent className="py-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={indicator}
                onChange={(e) => setIndicator(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                placeholder="Enter IP, domain, hash, URL, email, or CVE..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
              {indicator && (
                <p className="text-sm text-gray-500 mt-1">
                  Detected type: <Badge variant="outline">{detectType(indicator)}</Badge>
                </p>
              )}
            </div>
            <Button onClick={handleQuery} loading={loading}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Query
            </Button>
            {indicator.toUpperCase().startsWith('CVE-') && (
              <Button variant="secondary" onClick={handleCVEQuery} loading={loading}>
                CVE Lookup
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Results */}
      {report && (
        <div className="grid grid-cols-3 gap-6">
          {/* Main Result */}
          <div className="col-span-2 space-y-4">
            <Card variant="bordered">
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {report.indicator}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Type: {report.type} | Queried: {new Date(report.queriedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={riskColors[report.riskLevel] as 'danger' | 'warning' | 'secondary' | 'outline' | 'success'} className="text-lg px-4 py-2">
                      {report.riskLevel.toUpperCase()}
                    </Badge>
                    <p className="text-sm text-gray-500 mt-1">Score: {report.aggregatedScore}/100</p>
                  </div>
                </div>

                {report.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {report.tags.map((tag, i) => (
                      <Badge key={i} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                )}

                {/* Source Results */}
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Source Results</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.sources.map((source, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{source.source}</TableCell>
                        <TableCell>
                          {source.error ? (
                            <Badge variant="outline">Error</Badge>
                          ) : source.found ? (
                            <Badge variant="danger">Found</Badge>
                          ) : (
                            <Badge variant="success">Clean</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {source.confidence ? `${(source.confidence * 100).toFixed(0)}%` : '-'}
                        </TableCell>
                        <TableCell>
                          {source.severity ? (
                            <Badge variant={riskColors[source.severity] as 'danger' | 'warning' | 'secondary' | 'outline' | 'success'}>
                              {source.severity}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <Card variant="bordered">
                <CardContent className="py-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">Recommendations</h3>
                  <ul className="space-y-2">
                    {report.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                        <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick Stats */}
            <Card variant="bordered">
              <CardContent className="py-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Analysis Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sources Queried</span>
                    <span className="font-medium">{report.sources.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Positive Matches</span>
                    <span className="font-medium text-red-600">
                      {report.sources.filter(s => s.found).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Risk Score</span>
                    <span className="font-medium">{report.aggregatedScore}/100</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Query History */}
            {history.length > 1 && (
              <Card variant="bordered">
                <CardContent className="py-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">Recent Queries</h3>
                  <div className="space-y-2">
                    {history.slice(1).map((h, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setIndicator(h.indicator);
                          setReport(h);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">{h.indicator}</span>
                          <Badge variant={riskColors[h.riskLevel] as 'danger' | 'warning' | 'secondary' | 'outline' | 'success'} className="text-xs">
                            {h.riskLevel}
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500">{h.type}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Supported Sources Info */}
      {!report && (
        <Card variant="bordered">
          <CardContent className="py-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">Supported Indicator Types</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">IP Addresses</h4>
                <p className="text-sm text-gray-500">Query reputation from AbuseIPDB, ThreatFox, URLhaus</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">Domains & URLs</h4>
                <p className="text-sm text-gray-500">Check against ThreatFox, URLhaus for malicious indicators</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">File Hashes</h4>
                <p className="text-sm text-gray-500">MD5, SHA1, SHA256 lookup via MalwareBazaar, ThreatFox</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">CVE IDs</h4>
                <p className="text-sm text-gray-500">Query NVD, CISA KEV, and EPSS for vulnerability info</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">Email Addresses</h4>
                <p className="text-sm text-gray-500">Check for compromise indicators and spam sources</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">CISA KEV</h4>
                <p className="text-sm text-gray-500">Known Exploited Vulnerabilities catalog integration</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
