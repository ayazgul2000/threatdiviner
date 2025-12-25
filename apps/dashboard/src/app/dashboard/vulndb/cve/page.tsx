'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Cve {
  id: string;
  cveId: string;
  description: string;
  severity: string;
  cvssScore: number | null;
  epssScore: number | null;
  isKev: boolean;
  publishedAt: string;
  cwes: string[];
}

interface CveSearchResult {
  items: Cve[];
  total: number;
}

export default function CveSearchPage() {
  const searchParams = useSearchParams();
  const [results, setResults] = useState<CveSearchResult>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [severity, setSeverity] = useState('');
  const [isKev, setIsKev] = useState(searchParams.get('kev') === 'true');
  const [minEpss, setMinEpss] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (isKev) {
      searchCves();
    }
  }, []);

  const searchCves = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.append('keyword', keyword);
      if (severity) params.append('severity', severity);
      if (isKev) params.append('isKev', 'true');
      if (minEpss) params.append('minEpss', minEpss);
      params.append('limit', limit.toString());
      params.append('offset', (page * limit).toString());

      const res = await fetch(`/api/vulndb/cve?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Failed to search CVEs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    searchCves();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CVE Search</h1>
        <p className="text-gray-500">
          Search the NVD CVE database with advanced filters
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Keyword</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Search CVE ID, description..."
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Min EPSS</label>
                <input
                  type="number"
                  value={minEpss}
                  onChange={(e) => setMinEpss(e.target.value)}
                  placeholder="0.0 - 1.0"
                  min="0"
                  max="1"
                  step="0.01"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isKev}
                  onChange={(e) => setIsKev(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">KEV Only (Known Exploited)</span>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Results ({results.total.toLocaleString()})</CardTitle>
            {results.total > limit && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPage(p => Math.max(0, p - 1)); searchCves(); }}
                  disabled={page === 0}
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm">
                  Page {page + 1} of {Math.ceil(results.total / limit)}
                </span>
                <button
                  onClick={() => { setPage(p => p + 1); searchCves(); }}
                  disabled={(page + 1) * limit >= results.total}
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CVE ID</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>CVSS</TableHead>
                <TableHead>EPSS</TableHead>
                <TableHead>KEV</TableHead>
                <TableHead>Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : results.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No CVEs found. Try adjusting your search criteria.
                  </TableCell>
                </TableRow>
              ) : (
                results.items.map((cve) => (
                  <TableRow key={cve.id}>
                    <TableCell className="font-mono text-sm">{cve.cveId}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate" title={cve.description}>
                        {cve.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(cve.severity)}>
                        {cve.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{cve.cvssScore?.toFixed(1) ?? '-'}</TableCell>
                    <TableCell>
                      {cve.epssScore !== null ? (
                        <span className={cve.epssScore > 0.5 ? 'text-red-500 font-medium' : ''}>
                          {(cve.epssScore * 100).toFixed(1)}%
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {cve.isKev && (
                        <Badge variant="destructive">KEV</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(cve.publishedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
