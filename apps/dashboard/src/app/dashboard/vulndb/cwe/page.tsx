'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Cwe {
  id: string;
  cweId: string;
  name: string;
  description: string;
  abstraction: string;
  complianceControls: Array<{
    controlId: string;
    frameworkId: string;
    title: string;
  }>;
}

export default function CweBrowserPage() {
  const [results, setResults] = useState<Cwe[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedCwe, setSelectedCwe] = useState<Cwe | null>(null);

  const searchCwes = async () => {
    if (!keyword.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/vulndb/cwe?keyword=${encodeURIComponent(keyword)}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Failed to search CWEs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchCwes();
  };

  const getAbstractionColor = (abstraction: string) => {
    switch (abstraction?.toLowerCase()) {
      case 'pillar': return 'bg-purple-500';
      case 'class': return 'bg-blue-500';
      case 'base': return 'bg-green-500';
      case 'variant': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CWE Browser</h1>
        <p className="text-gray-500">
          Browse and search the Common Weakness Enumeration database
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search by CWE ID, name, or keyword (e.g., 'injection', 'CWE-79')..."
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !keyword.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Results ({results.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {results.length === 0 && !loading && keyword && (
                <p className="text-center text-gray-500 py-8">No CWEs found matching your search.</p>
              )}
              {results.length === 0 && !loading && !keyword && (
                <p className="text-center text-gray-500 py-8">Enter a search term to find CWEs.</p>
              )}
              {results.map((cwe) => (
                <div
                  key={cwe.id}
                  onClick={() => setSelectedCwe(cwe)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedCwe?.id === cwe.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-medium">{cwe.cweId}</span>
                    <Badge className={getAbstractionColor(cwe.abstraction)}>
                      {cwe.abstraction}
                    </Badge>
                  </div>
                  <h3 className="font-semibold mb-1">{cwe.name}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2">{cwe.description}</p>
                  {cwe.complianceControls?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cwe.complianceControls.slice(0, 3).map((control, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {control.frameworkId}: {control.controlId}
                        </Badge>
                      ))}
                      {cwe.complianceControls.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{cwe.complianceControls.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedCwe ? `${selectedCwe.cweId}: ${selectedCwe.name}` : 'CWE Details'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedCwe ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Description</h4>
                  <p className="text-sm">{selectedCwe.description}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Abstraction Level</h4>
                  <Badge className={getAbstractionColor(selectedCwe.abstraction)}>
                    {selectedCwe.abstraction}
                  </Badge>
                </div>

                {selectedCwe.complianceControls?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Compliance Mappings</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Framework</TableHead>
                          <TableHead>Control</TableHead>
                          <TableHead>Title</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCwe.complianceControls.map((control, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge variant="outline">{control.frameworkId}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{control.controlId}</TableCell>
                            <TableCell className="text-sm">{control.title}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <a
                    href={`https://cwe.mitre.org/data/definitions/${selectedCwe.cweId.replace('CWE-', '')}.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center gap-2"
                  >
                    View on MITRE CWE
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                Select a CWE from the list to view details
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
