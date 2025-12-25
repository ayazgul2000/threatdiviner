'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

interface TechniqueDetail {
  id: string;
  name: string;
  description: string;
  tacticId: string;
  tacticName: string;
  platforms: string[];
  detection: string;
  url: string;
  mitigations: { id: string; name: string; description: string }[];
  groups: { id: string; name: string }[];
  software: { id: string; name: string; type: string }[];
  findings: { id: string; title: string; severity: string; repository: string }[];
  capecMappings: { id: string; name: string }[];
  cweMappings: string[];
}

export default function TechniqueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [technique, setTechnique] = useState<TechniqueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('detection');

  useEffect(() => {
    if (params.id) {
      fetchTechnique();
    }
  }, [params.id]);

  const fetchTechnique = async () => {
    try {
      const res = await fetch(`/api/vulndb/attack/techniques/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setTechnique(data);
      }
    } catch (error) {
      console.error('Failed to fetch technique:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!technique) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-gray-500 mb-4">Technique not found</div>
        <button
          onClick={() => router.push('/dashboard/attack')}
          className="text-blue-500 hover:underline"
        >
          Back to Matrix
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'detection', label: 'Detection' },
    { id: 'mitigations', label: `Mitigations (${technique.mitigations?.length || 0})` },
    { id: 'groups', label: `Threat Groups (${technique.groups?.length || 0})` },
    { id: 'software', label: `Software (${technique.software?.length || 0})` },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/attack">
          <button className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Matrix
          </button>
        </Link>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="font-mono">{technique.id}</Badge>
            <Badge>{technique.tacticName}</Badge>
          </div>
          <h1 className="text-2xl font-bold">{technique.name}</h1>
        </div>
        {technique.url && (
          <a href={technique.url} target="_blank" rel="noopener noreferrer">
            <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              View on MITRE
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </a>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{technique.description}</p>
          {technique.platforms && technique.platforms.length > 0 && (
            <div className="flex gap-2 mt-4">
              <span className="text-sm font-medium">Platforms:</span>
              {technique.platforms.map(p => (
                <Badge key={p} variant="secondary">{p}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {technique.findings && technique.findings.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Your Findings ({technique.findings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {technique.findings.map((finding) => (
                  <TableRow key={finding.id}>
                    <TableCell>{finding.title}</TableCell>
                    <TableCell>
                      <Badge variant={
                        finding.severity === 'critical' || finding.severity === 'high' ? 'destructive' :
                        finding.severity === 'medium' ? 'default' : 'secondary'
                      }>
                        {finding.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{finding.repository}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/findings/${finding.id}`}>
                        <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                          View
                        </button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Card className="rounded-t-none border-t-0">
          <CardContent className="pt-6">
            {activeTab === 'detection' && (
              <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                {technique.detection || 'No detection guidance available.'}
              </p>
            )}

            {activeTab === 'mitigations' && (
              <div className="space-y-4">
                {technique.mitigations?.map(m => (
                  <div key={m.id} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span className="font-mono text-sm text-gray-500">{m.id}</span>
                      <span className="font-semibold">{m.name}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{m.description}</p>
                  </div>
                ))}
                {(!technique.mitigations || technique.mitigations.length === 0) && (
                  <p className="text-gray-500">No mitigations available.</p>
                )}
              </div>
            )}

            {activeTab === 'groups' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {technique.groups?.map(g => (
                  <div key={g.id} className="p-3 border rounded-lg flex items-center gap-2">
                    <svg className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <div>
                      <span className="font-mono text-xs text-gray-500">{g.id}</span>
                      <p className="font-medium text-sm">{g.name}</p>
                    </div>
                  </div>
                ))}
                {(!technique.groups || technique.groups.length === 0) && (
                  <p className="text-gray-500 col-span-4">No known threat groups use this technique.</p>
                )}
              </div>
            )}

            {activeTab === 'software' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technique.software?.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.id}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>
                        <Badge variant={s.type === 'malware' ? 'destructive' : 'secondary'}>
                          {s.type}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!technique.software || technique.software.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-gray-500">
                        No known software uses this technique.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
