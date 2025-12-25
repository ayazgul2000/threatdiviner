'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui';
import { CardSkeleton } from '@/components/ui/skeletons';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Component {
  id: string;
  name: string;
  version?: string;
  type: string;
  purl?: string;
  license?: string;
  isDirect: boolean;
  depth: number;
  scope?: string;
  vulnerabilities: Array<{
    vulnerability: {
      id: string;
      cveId?: string;
      severity: string;
      title: string;
    };
  }>;
}

interface Vulnerability {
  id: string;
  cveId?: string;
  ghsaId?: string;
  severity: string;
  cvssScore?: number;
  title: string;
  description?: string;
  recommendation?: string;
  fixedVersion?: string;
  status: string;
  components: Array<{
    component: {
      id: string;
      name: string;
      version?: string;
    };
  }>;
}

interface Sbom {
  id: string;
  name: string;
  version: string;
  format: string;
  formatVersion: string;
  source: string;
  componentCount: number;
  vulnCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  createdAt: string;
  updatedAt: string;
  components: Component[];
  vulnerabilities: Vulnerability[];
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
};

const statusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  patched: 'bg-green-100 text-green-700',
  ignored: 'bg-gray-100 text-gray-700',
  accepted: 'bg-yellow-100 text-yellow-700',
};

export default function SbomDetailPage() {
  const params = useParams();
  const [sbom, setSbom] = useState<Sbom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [componentFilter, setComponentFilter] = useState('');
  const [vulnFilter, setVulnFilter] = useState('');

  useEffect(() => {
    fetchSbom();
  }, [params.id]);

  const fetchSbom = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/sbom/${params.id}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch SBOM');

      const data = await res.json();
      setSbom(data);
    } catch (err) {
      console.error('Failed to fetch SBOM:', err);
      setError('Failed to load SBOM');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateVulnStatus = async (vulnId: string, status: string) => {
    try {
      await fetch(`${API_URL}/sbom/vulnerabilities/${vulnId}/status`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await fetchSbom();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error || !sbom) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
        {error || 'SBOM not found'}
      </div>
    );
  }

  const filteredComponents = sbom.components.filter((c) =>
    c.name.toLowerCase().includes(componentFilter.toLowerCase()) ||
    c.purl?.toLowerCase().includes(componentFilter.toLowerCase())
  );

  const filteredVulns = sbom.vulnerabilities.filter((v) =>
    v.title.toLowerCase().includes(vulnFilter.toLowerCase()) ||
    v.cveId?.toLowerCase().includes(vulnFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/sbom"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{sbom.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline">{sbom.format.toUpperCase()} {sbom.formatVersion}</Badge>
              <span className="text-sm text-gray-500">v{sbom.version}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{sbom.componentCount}</div>
            <div className="text-sm text-gray-500">Components</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-red-600">{sbom.criticalCount}</div>
            <div className="text-sm text-gray-500">Critical</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-orange-600">{sbom.highCount}</div>
            <div className="text-sm text-gray-500">High</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-yellow-600">{sbom.mediumCount}</div>
            <div className="text-sm text-gray-500">Medium</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-blue-600">{sbom.lowCount}</div>
            <div className="text-sm text-gray-500">Low</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="components">Components ({sbom.components.length})</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities ({sbom.vulnerabilities.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-6">
            <Card variant="bordered">
              <CardHeader>
                <CardTitle>SBOM Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Format</dt>
                    <dd className="font-medium">{sbom.format.toUpperCase()} {sbom.formatVersion}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Source</dt>
                    <dd className="font-medium capitalize">{sbom.source}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Created</dt>
                    <dd className="font-medium">{new Date(sbom.createdAt).toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Updated</dt>
                    <dd className="font-medium">{new Date(sbom.updatedAt).toLocaleString()}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card variant="bordered">
              <CardHeader>
                <CardTitle>License Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const licenseCount = sbom.components.reduce((acc, c) => {
                    const license = c.license || 'Unknown';
                    acc[license] = (acc[license] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>);

                  const sorted = Object.entries(licenseCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

                  return (
                    <div className="space-y-2">
                      {sorted.map(([license, count]) => (
                        <div key={license} className="flex items-center justify-between">
                          <span className="text-sm truncate max-w-[200px]">{license}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Components Tab */}
        <TabsContent value="components">
          <Card variant="bordered">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Components</CardTitle>
              <input
                type="text"
                placeholder="Filter components..."
                value={componentFilter}
                onChange={(e) => setComponentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm w-64"
              />
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Vulnerabilities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComponents.slice(0, 50).map((component) => (
                  <TableRow key={component.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{component.name}</div>
                        {component.purl && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">{component.purl}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{component.version || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" size="sm">{component.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{component.license || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {component.isDirect ? 'Direct' : 'Transitive'}
                        {component.scope && ` (${component.scope})`}
                      </span>
                    </TableCell>
                    <TableCell>
                      {component.vulnerabilities.length > 0 ? (
                        <div className="flex items-center gap-1">
                          {component.vulnerabilities.slice(0, 3).map((v) => (
                            <span
                              key={v.vulnerability.id}
                              className={`px-1.5 py-0.5 rounded text-xs font-medium ${severityColors[v.vulnerability.severity]}`}
                            >
                              {v.vulnerability.severity.charAt(0).toUpperCase()}
                            </span>
                          ))}
                          {component.vulnerabilities.length > 3 && (
                            <span className="text-xs text-gray-500">+{component.vulnerabilities.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredComponents.length > 50 && (
              <div className="p-4 text-center text-sm text-gray-500">
                Showing 50 of {filteredComponents.length} components
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Vulnerabilities Tab */}
        <TabsContent value="vulnerabilities">
          <Card variant="bordered">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Vulnerabilities</CardTitle>
              <input
                type="text"
                placeholder="Filter vulnerabilities..."
                value={vulnFilter}
                onChange={(e) => setVulnFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm w-64"
              />
            </CardHeader>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredVulns.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No vulnerabilities found</div>
              ) : (
                filteredVulns.map((vuln) => (
                  <div key={vuln.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${severityColors[vuln.severity]}`}>
                            {vuln.severity.toUpperCase()}
                          </span>
                          {vuln.cvssScore && (
                            <span className="text-sm text-gray-500">CVSS: {vuln.cvssScore}</span>
                          )}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[vuln.status]}`}>
                            {vuln.status}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900 dark:text-white mt-2">{vuln.title}</h4>
                        {vuln.cveId && (
                          <a
                            href={`https://nvd.nist.gov/vuln/detail/${vuln.cveId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            {vuln.cveId}
                          </a>
                        )}
                        {vuln.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                            {vuln.description}
                          </p>
                        )}
                        {vuln.fixedVersion && (
                          <div className="mt-2 text-sm">
                            <span className="text-gray-500">Fixed in: </span>
                            <span className="text-green-600 font-medium">{vuln.fixedVersion}</span>
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {vuln.components.map((c) => (
                            <Badge key={c.component.id} variant="outline" size="sm">
                              {c.component.name}@{c.component.version}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {vuln.status === 'open' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdateVulnStatus(vuln.id, 'ignored')}
                            >
                              Ignore
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdateVulnStatus(vuln.id, 'accepted')}
                            >
                              Accept
                            </Button>
                          </>
                        )}
                        {vuln.status !== 'open' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateVulnStatus(vuln.id, 'open')}
                          >
                            Reopen
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
