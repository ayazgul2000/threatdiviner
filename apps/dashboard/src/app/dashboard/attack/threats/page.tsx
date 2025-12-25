'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ThreatActor {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  url: string;
  techniques: string[];
  matchingTechniques: number;
  relevanceScore: number;
}

export default function ThreatActorsPage() {
  const [actors, setActors] = useState<ThreatActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchActors();
  }, []);

  const fetchActors = async () => {
    try {
      const res = await fetch('/api/vulndb/attack/groups/relevant');
      if (res.ok) {
        const data = await res.json();
        setActors(data);
      }
    } catch (error) {
      console.error('Failed to fetch threat actors:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredActors = actors.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.aliases?.some(alias => alias.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Threat Actors</h1>
        <p className="text-gray-500">
          APT groups using techniques found in your environment
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <svg className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <CardTitle>Relevant Threat Actors</CardTitle>
              <p className="text-sm text-gray-500">
                {actors.length} threat groups use techniques matching your vulnerabilities
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="relative">
        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search threat actors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Aliases</TableHead>
              <TableHead>Matching Techniques</TableHead>
              <TableHead>Relevance</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : filteredActors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No threat actors found matching your criteria
                </TableCell>
              </TableRow>
            ) : (
              filteredActors.map((actor) => (
                <TableRow key={actor.id}>
                  <TableCell className="font-mono text-sm">{actor.id}</TableCell>
                  <TableCell className="font-semibold">{actor.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {actor.aliases?.slice(0, 3).map((alias, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {alias}
                        </Badge>
                      ))}
                      {(actor.aliases?.length ?? 0) > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{actor.aliases.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">{actor.matchingTechniques}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500"
                          style={{ width: `${actor.relevanceScore}%` }}
                        />
                      </div>
                      <span className="text-sm">{actor.relevanceScore}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {actor.url && (
                      <a
                        href={actor.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
