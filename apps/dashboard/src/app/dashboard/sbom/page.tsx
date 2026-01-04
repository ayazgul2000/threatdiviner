'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  PageHeader,
} from '@/components/ui';
import { useProject } from '@/contexts/project-context';
import { TableSkeleton } from '@/components/ui/skeletons';
import { NoSbomEmpty } from '@/components/ui/empty-state';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
}

const formatLabels: Record<string, string> = {
  spdx: 'SPDX',
  cyclonedx: 'CycloneDX',
};

const sourceLabels: Record<string, string> = {
  upload: 'Uploaded',
  scan: 'Scan',
  ci_cd: 'CI/CD',
};

export default function SbomListPage() {
  const { currentProject } = useProject();
  const [sboms, setSboms] = useState<Sbom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFormat, setUploadFormat] = useState<'spdx' | 'cyclonedx'>('cyclonedx');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadName, setUploadName] = useState('');

  useEffect(() => {
    if (!currentProject) {
      setLoading(false);
      return;
    }
    fetchSboms();
  }, [currentProject]);

  const fetchSboms = async () => {
    if (!currentProject) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/sbom?projectId=${currentProject.id}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch SBOMs');

      const data = await res.json();
      setSboms(data.sboms || []);
    } catch (err) {
      console.error('Failed to fetch SBOMs:', err);
      setError('Failed to load SBOMs');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadContent.trim()) return;

    try {
      setUploading(true);
      const res = await fetch(`${API_URL}/sbom/upload/${uploadFormat}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: uploadContent,
          name: uploadName || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to upload SBOM');
      }

      await fetchSboms();
      setUploadModal(false);
      setUploadContent('');
      setUploadName('');
    } catch (err) {
      console.error('Failed to upload:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload SBOM');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this SBOM?')) return;

    try {
      await fetch(`${API_URL}/sbom/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setSboms(sboms.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const getSeverityBadge = (sbom: Sbom) => {
    if (sbom.criticalCount > 0) return <Badge variant="danger">{sbom.criticalCount} Critical</Badge>;
    if (sbom.highCount > 0) return <Badge variant="warning">{sbom.highCount} High</Badge>;
    if (sbom.mediumCount > 0) return <Badge variant="secondary">{sbom.mediumCount} Medium</Badge>;
    if (sbom.lowCount > 0) return <Badge variant="outline">{sbom.lowCount} Low</Badge>;
    return <Badge variant="success">No Vulns</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-72 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <TableSkeleton rows={5} columns={7} />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <PageHeader title="SBOM" breadcrumbs={[{ label: 'SBOM' }]} />
        <Card variant="bordered">
          <CardContent className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No project selected</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Select a project from the sidebar to view SBOM data
            </p>
            <Link href="/dashboard/projects">
              <Button>Go to Projects</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Software Bill of Materials</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Track dependencies and vulnerabilities across your software components
          </p>
        </div>
        <Button onClick={() => setUploadModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload SBOM
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      {sboms.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card variant="bordered">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{sboms.length}</div>
              <div className="text-sm text-gray-500">Total SBOMs</div>
            </CardContent>
          </Card>
          <Card variant="bordered">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {sboms.reduce((sum, s) => sum + s.componentCount, 0)}
              </div>
              <div className="text-sm text-gray-500">Total Components</div>
            </CardContent>
          </Card>
          <Card variant="bordered">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-red-600">
                {sboms.reduce((sum, s) => sum + s.vulnCount, 0)}
              </div>
              <div className="text-sm text-gray-500">Total Vulnerabilities</div>
            </CardContent>
          </Card>
          <Card variant="bordered">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-red-600">
                {sboms.reduce((sum, s) => sum + s.criticalCount, 0)}
              </div>
              <div className="text-sm text-gray-500">Critical Vulnerabilities</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card variant="bordered">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Components</TableHead>
              <TableHead>Security Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sboms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <NoSbomEmpty />
                </TableCell>
              </TableRow>
            ) : (
              sboms.map((sbom) => (
                <TableRow key={sbom.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/sbom/${sbom.id}`}
                      className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {sbom.name}
                    </Link>
                    <p className="text-sm text-gray-500">v{sbom.version}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {formatLabels[sbom.format] || sbom.format} {sbom.formatVersion}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-600 dark:text-gray-400">
                      {sourceLabels[sbom.source] || sbom.source}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-600 dark:text-gray-400">{sbom.componentCount}</span>
                  </TableCell>
                  <TableCell>{getSeverityBadge(sbom)}</TableCell>
                  <TableCell>
                    <span className="text-gray-500 text-sm">
                      {new Date(sbom.updatedAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/sbom/${sbom.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => handleDelete(sbom.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Upload Modal */}
      <Modal isOpen={uploadModal} onClose={() => setUploadModal(false)} size="lg">
        <ModalHeader>Upload SBOM</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name (optional)
              </label>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="My Application SBOM"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Format
              </label>
              <select
                value={uploadFormat}
                onChange={(e) => setUploadFormat(e.target.value as 'spdx' | 'cyclonedx')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
              >
                <option value="cyclonedx">CycloneDX</option>
                <option value="spdx">SPDX</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SBOM Content (JSON)
              </label>
              <textarea
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
                placeholder="Paste your SBOM JSON content here..."
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 font-mono text-sm"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setUploadModal(false)}>Cancel</Button>
          <Button onClick={handleUpload} loading={uploading} disabled={!uploadContent.trim()}>
            Upload
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
