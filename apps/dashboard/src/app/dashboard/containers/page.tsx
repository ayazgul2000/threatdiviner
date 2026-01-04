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

interface ImageInfo {
  registry: string;
  repository: string;
  tag: string;
  digest: string;
  created: string;
  architecture: string;
  os: string;
  size: number;
  layers: LayerInfo[];
}

interface LayerInfo {
  digest: string;
  size: number;
  mediaType: string;
}

interface ScanResult {
  imageRef: string;
  scannedAt: string;
  vulnerabilities: VulnerabilityResult[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

interface VulnerabilityResult {
  id: string;
  severity: string;
  package: string;
  version: string;
  fixedVersion?: string;
  description: string;
}

interface VerifyResult {
  verified: boolean;
  imageRef: string;
  actualDigest: string;
  expectedDigest?: string;
  message: string;
}

export default function ContainersPage() {
  const [imageRef, setImageRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'scan' | 'verify'>('info');

  const fetchImageInfo = async () => {
    if (!imageRef.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/containers/info`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageRef: imageRef.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to fetch image info');
      }

      const data = await res.json();
      setImageInfo(data);
      setActiveTab('info');
    } catch (err) {
      console.error('Failed to fetch image info:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch image info');
    } finally {
      setLoading(false);
    }
  };

  const scanImage = async () => {
    if (!imageRef.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/containers/scan`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageRef: imageRef.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Scan failed');
      }

      const data = await res.json();
      setScanResult(data);
      setActiveTab('scan');
    } catch (err) {
      console.error('Scan failed:', err);
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const verifyImage = async () => {
    if (!imageRef.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/containers/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageRef: imageRef.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Verification failed');
      }

      const data = await res.json();
      setVerifyResult(data);
      setActiveTab('verify');
    } catch (err) {
      console.error('Verification failed:', err);
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, 'danger' | 'warning' | 'secondary' | 'outline'> = {
      critical: 'danger',
      high: 'warning',
      medium: 'secondary',
      low: 'outline',
    };
    return <Badge variant={variants[severity.toLowerCase()] || 'outline'}>{severity}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Container Registry"
        description="Inspect, scan, and verify container images from any registry"
        breadcrumbs={[{ label: 'Containers' }]}
      />

      {/* Search */}
      <Card variant="bordered">
        <CardContent className="py-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={imageRef}
                onChange={(e) => setImageRef(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchImageInfo()}
                placeholder="Enter image reference (e.g., nginx:latest, ghcr.io/owner/repo:tag)"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
            <Button onClick={fetchImageInfo} loading={loading}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Get Info
            </Button>
            <Button variant="secondary" onClick={scanImage} loading={loading}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Scan
            </Button>
            <Button variant="outline" onClick={verifyImage} loading={loading}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Verify
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Results */}
      {(imageInfo || scanResult || verifyResult) && (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-2 -mb-px border-b-2 ${
                activeTab === 'info'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Image Info
            </button>
            <button
              onClick={() => setActiveTab('scan')}
              className={`px-4 py-2 -mb-px border-b-2 ${
                activeTab === 'scan'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Vulnerability Scan
            </button>
            <button
              onClick={() => setActiveTab('verify')}
              className={`px-4 py-2 -mb-px border-b-2 ${
                activeTab === 'verify'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Verification
            </button>
          </div>

          {/* Image Info Tab */}
          {activeTab === 'info' && imageInfo && (
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2">
                <Card variant="bordered">
                  <CardContent className="py-4">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-4">Image Details</h3>
                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm text-gray-500">Registry</dt>
                        <dd className="font-medium">{imageInfo.registry}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Repository</dt>
                        <dd className="font-medium">{imageInfo.repository}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Tag</dt>
                        <dd className="font-medium">{imageInfo.tag}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Size</dt>
                        <dd className="font-medium">{formatBytes(imageInfo.size)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Architecture</dt>
                        <dd className="font-medium">{imageInfo.architecture}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">OS</dt>
                        <dd className="font-medium">{imageInfo.os}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-sm text-gray-500">Digest</dt>
                        <dd className="font-mono text-sm break-all">{imageInfo.digest}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-sm text-gray-500">Created</dt>
                        <dd className="font-medium">{new Date(imageInfo.created).toLocaleString()}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                {/* Layers */}
                {imageInfo.layers && imageInfo.layers.length > 0 && (
                  <Card variant="bordered" className="mt-4">
                    <CardContent className="py-4">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                        Layers ({imageInfo.layers.length})
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Digest</TableHead>
                            <TableHead>Size</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {imageInfo.layers.map((layer, i) => (
                            <TableRow key={i}>
                              <TableCell>{i + 1}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {layer.digest.substring(0, 20)}...
                              </TableCell>
                              <TableCell>{formatBytes(layer.size)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div>
                <Card variant="bordered">
                  <CardContent className="py-4">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3">Quick Actions</h3>
                    <div className="space-y-2">
                      <Button variant="secondary" className="w-full" onClick={scanImage}>
                        Scan for Vulnerabilities
                      </Button>
                      <Button variant="outline" className="w-full" onClick={verifyImage}>
                        Verify Integrity
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Scan Results Tab */}
          {activeTab === 'scan' && scanResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-5 gap-4">
                <Card variant="bordered">
                  <CardContent className="py-4 text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {scanResult.summary.total}
                    </div>
                    <div className="text-sm text-gray-500">Total</div>
                  </CardContent>
                </Card>
                <Card variant="bordered">
                  <CardContent className="py-4 text-center">
                    <div className="text-3xl font-bold text-red-600">{scanResult.summary.critical}</div>
                    <div className="text-sm text-gray-500">Critical</div>
                  </CardContent>
                </Card>
                <Card variant="bordered">
                  <CardContent className="py-4 text-center">
                    <div className="text-3xl font-bold text-orange-500">{scanResult.summary.high}</div>
                    <div className="text-sm text-gray-500">High</div>
                  </CardContent>
                </Card>
                <Card variant="bordered">
                  <CardContent className="py-4 text-center">
                    <div className="text-3xl font-bold text-yellow-500">{scanResult.summary.medium}</div>
                    <div className="text-sm text-gray-500">Medium</div>
                  </CardContent>
                </Card>
                <Card variant="bordered">
                  <CardContent className="py-4 text-center">
                    <div className="text-3xl font-bold text-gray-500">{scanResult.summary.low}</div>
                    <div className="text-sm text-gray-500">Low</div>
                  </CardContent>
                </Card>
              </div>

              {/* Vulnerabilities Table */}
              <Card variant="bordered">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CVE ID</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Current Version</TableHead>
                      <TableHead>Fixed Version</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanResult.vulnerabilities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <div className="text-green-600">
                            <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            No vulnerabilities found
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      scanResult.vulnerabilities.map((vuln, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{vuln.id}</TableCell>
                          <TableCell>{getSeverityBadge(vuln.severity)}</TableCell>
                          <TableCell>{vuln.package}</TableCell>
                          <TableCell className="font-mono text-sm">{vuln.version}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {vuln.fixedVersion || (
                              <span className="text-gray-400">No fix available</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* Verify Tab */}
          {activeTab === 'verify' && verifyResult && (
            <Card variant="bordered">
              <CardContent className="py-6">
                <div className="text-center">
                  {verifyResult.verified ? (
                    <div className="text-green-600">
                      <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <h3 className="text-xl font-bold mb-2">Image Verified</h3>
                      <p className="text-gray-600 dark:text-gray-400">{verifyResult.message}</p>
                    </div>
                  ) : (
                    <div className="text-red-600">
                      <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <h3 className="text-xl font-bold mb-2">Verification Failed</h3>
                      <p className="text-gray-600 dark:text-gray-400">{verifyResult.message}</p>
                    </div>
                  )}

                  <div className="mt-6 text-left max-w-md mx-auto">
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-sm text-gray-500">Image Reference</dt>
                        <dd className="font-mono text-sm">{verifyResult.imageRef}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500">Actual Digest</dt>
                        <dd className="font-mono text-sm break-all">{verifyResult.actualDigest}</dd>
                      </div>
                      {verifyResult.expectedDigest && (
                        <div>
                          <dt className="text-sm text-gray-500">Expected Digest</dt>
                          <dd className="font-mono text-sm break-all">{verifyResult.expectedDigest}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Supported Registries Info */}
      {!imageInfo && !scanResult && !verifyResult && (
        <Card variant="bordered">
          <CardContent className="py-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">Supported Container Registries</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">Docker Hub</h4>
                <p className="text-sm text-gray-500">Public and private repositories</p>
                <code className="text-xs text-gray-400 mt-2 block">nginx:latest</code>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">GitHub Container Registry</h4>
                <p className="text-sm text-gray-500">ghcr.io hosted images</p>
                <code className="text-xs text-gray-400 mt-2 block">ghcr.io/owner/repo:tag</code>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">Google Container Registry</h4>
                <p className="text-sm text-gray-500">GCR and Artifact Registry</p>
                <code className="text-xs text-gray-400 mt-2 block">gcr.io/project/image:tag</code>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">Amazon ECR</h4>
                <p className="text-sm text-gray-500">AWS container registry</p>
                <code className="text-xs text-gray-400 mt-2 block">account.dkr.ecr.region.amazonaws.com/repo</code>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">Azure Container Registry</h4>
                <p className="text-sm text-gray-500">ACR hosted images</p>
                <code className="text-xs text-gray-400 mt-2 block">registry.azurecr.io/repo:tag</code>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">Quay.io</h4>
                <p className="text-sm text-gray-500">Red Hat container registry</p>
                <code className="text-xs text-gray-400 mt-2 block">quay.io/org/repo:tag</code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
