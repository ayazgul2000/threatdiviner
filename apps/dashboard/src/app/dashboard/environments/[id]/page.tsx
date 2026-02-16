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
  Form,
  FormField,
  Label,
  Input,
  Select,
} from '@/components/ui';
import { CardSkeleton } from '@/components/ui/skeletons';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Deployment {
  id: string;
  name: string;
  version?: string;
  image?: string;
  imageDigest?: string;
  replicas: number;
  status: string;
  vulnCount: number;
  criticalCount: number;
  hasIngress: boolean;
  ingressHosts: string[];
  exposedPorts: number[];
  deployedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Environment {
  id: string;
  name: string;
  type: string;
  description?: string;
  namespace?: string;
  cloudProvider?: string;
  cloudRegion?: string;
  isActive: boolean;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
  deployments: Deployment[];
}

const statusColors: Record<string, string> = {
  healthy: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  degraded: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  unhealthy: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  unknown: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const statusDots: Record<string, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  unhealthy: 'bg-red-500',
  unknown: 'bg-gray-400',
};

export default function EnvironmentDetailPage() {
  const params = useParams();
  const [env, setEnv] = useState<Environment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deployModal, setDeployModal] = useState(false);
  const [deployForm, setDeployForm] = useState({
    name: '',
    version: '',
    image: '',
    replicas: 1,
    status: 'unknown',
  });
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    fetchEnvironment();
  }, [params.id]);

  const fetchEnvironment = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/environments/${params.id}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch environment');

      const data = await res.json();
      setEnv(data);
    } catch (err) {
      console.error('Failed to fetch environment:', err);
      setError('Failed to load environment');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeployment = async () => {
    if (!deployForm.name.trim()) return;

    try {
      setDeploying(true);
      const res = await fetch(`${API_URL}/environments/${params.id}/deployments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deployForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create deployment');
      }

      await fetchEnvironment();
      setDeployModal(false);
      setDeployForm({
        name: '',
        version: '',
        image: '',
        replicas: 1,
        status: 'unknown',
      });
    } catch (err) {
      console.error('Failed to create deployment:', err);
      setError(err instanceof Error ? err.message : 'Failed to create deployment');
    } finally {
      setDeploying(false);
    }
  };

  const handleDeleteDeployment = async (id: string) => {
    if (!confirm('Delete this deployment?')) return;

    try {
      await fetch(`${API_URL}/environments/deployments/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await fetchEnvironment();
    } catch (err) {
      console.error('Failed to delete deployment:', err);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await fetch(`${API_URL}/environments/deployments/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await fetchEnvironment();
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

  if (error || !env) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
        {error || 'Environment not found'}
      </div>
    );
  }

  const stats = {
    healthy: env.deployments.filter((d) => d.status === 'healthy').length,
    degraded: env.deployments.filter((d) => d.status === 'degraded').length,
    unhealthy: env.deployments.filter((d) => d.status === 'unhealthy').length,
    unknown: env.deployments.filter((d) => d.status === 'unknown').length,
    totalVulns: env.deployments.reduce((sum, d) => sum + d.vulnCount, 0),
    criticalVulns: env.deployments.reduce((sum, d) => sum + d.criticalCount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/environments"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{env.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline">{env.type}</Badge>
              {env.namespace && <span className="text-sm text-gray-500">namespace: {env.namespace}</span>}
              {!env.isActive && <Badge variant="secondary">Inactive</Badge>}
            </div>
          </div>
        </div>
        <Button onClick={() => setDeployModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Deployment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-4">
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{env.deployments.length}</div>
            <div className="text-sm text-gray-500">Deployments</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-2xl font-bold text-green-600">{stats.healthy}</span>
            </div>
            <div className="text-sm text-gray-500">Healthy</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-2xl font-bold text-yellow-600">{stats.degraded}</span>
            </div>
            <div className="text-sm text-gray-500">Degraded</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-2xl font-bold text-red-600">{stats.unhealthy}</span>
            </div>
            <div className="text-sm text-gray-500">Unhealthy</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-orange-600">{stats.totalVulns}</div>
            <div className="text-sm text-gray-500">Vulnerabilities</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-red-600">{stats.criticalVulns}</div>
            <div className="text-sm text-gray-500">Critical</div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {env.description && (
        <Card variant="bordered">
          <CardContent className="py-4">
            <p className="text-gray-600 dark:text-gray-400">{env.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Deployments Table */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Deployments</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Replicas</TableHead>
              <TableHead>Security</TableHead>
              <TableHead>Deployed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {env.deployments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  No deployments in this environment. Add your first deployment to start tracking.
                </TableCell>
              </TableRow>
            ) : (
              env.deployments.map((deployment) => (
                <TableRow key={deployment.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900 dark:text-white">{deployment.name}</div>
                    {deployment.hasIngress && deployment.ingressHosts.length > 0 && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {deployment.ingressHosts.join(', ')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusDots[deployment.status]}`} />
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[deployment.status]}`}>
                        {deployment.status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-600 dark:text-gray-400">{deployment.version || '-'}</span>
                  </TableCell>
                  <TableCell>
                    {deployment.image ? (
                      <span className="text-xs font-mono text-gray-500 truncate max-w-[200px] block">
                        {deployment.image}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-600 dark:text-gray-400">{deployment.replicas}</span>
                  </TableCell>
                  <TableCell>
                    {deployment.vulnCount > 0 ? (
                      <div className="flex items-center gap-2">
                        <Badge variant={deployment.criticalCount > 0 ? 'danger' : 'warning'}>
                          {deployment.vulnCount} vulns
                        </Badge>
                        {deployment.criticalCount > 0 && (
                          <Badge variant="danger">{deployment.criticalCount} critical</Badge>
                        )}
                      </div>
                    ) : (
                      <Badge variant="success">Clean</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500">
                      {deployment.deployedAt
                        ? new Date(deployment.deployedAt).toLocaleDateString()
                        : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <select
                        value={deployment.status}
                        onChange={(e) => handleUpdateStatus(deployment.id, e.target.value)}
                        className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                      >
                        <option value="healthy">Healthy</option>
                        <option value="degraded">Degraded</option>
                        <option value="unhealthy">Unhealthy</option>
                        <option value="unknown">Unknown</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => handleDeleteDeployment(deployment.id)}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add Deployment Modal */}
      <Modal isOpen={deployModal} onClose={() => setDeployModal(false)} size="md">
        <ModalHeader>Add Deployment</ModalHeader>
        <ModalBody>
          <Form onSubmit={(e) => { e.preventDefault(); handleCreateDeployment(); }}>
            <FormField>
              <Label htmlFor="deploy-name" required>Name</Label>
              <Input
                id="deploy-name"
                value={deployForm.name}
                onChange={(e) => setDeployForm({ ...deployForm, name: e.target.value })}
                placeholder="e.g., api-server, web-frontend"
              />
            </FormField>
            <FormField>
              <Label htmlFor="deploy-version">Version</Label>
              <Input
                id="deploy-version"
                value={deployForm.version}
                onChange={(e) => setDeployForm({ ...deployForm, version: e.target.value })}
                placeholder="e.g., v1.2.3"
              />
            </FormField>
            <FormField>
              <Label htmlFor="deploy-image">Container Image</Label>
              <Input
                id="deploy-image"
                value={deployForm.image}
                onChange={(e) => setDeployForm({ ...deployForm, image: e.target.value })}
                placeholder="e.g., myapp/api:latest"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField>
                <Label htmlFor="deploy-replicas">Replicas</Label>
                <Input
                  id="deploy-replicas"
                  type="number"
                  min={1}
                  value={deployForm.replicas}
                  onChange={(e) => setDeployForm({ ...deployForm, replicas: parseInt(e.target.value) || 1 })}
                />
              </FormField>
              <FormField>
                <Label htmlFor="deploy-status">Initial Status</Label>
                <Select
                  id="deploy-status"
                  value={deployForm.status}
                  onChange={(e) => setDeployForm({ ...deployForm, status: e.target.value })}
                  options={[
                    { value: 'unknown', label: 'Unknown' },
                    { value: 'healthy', label: 'Healthy' },
                    { value: 'degraded', label: 'Degraded' },
                    { value: 'unhealthy', label: 'Unhealthy' },
                  ]}
                />
              </FormField>
            </div>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDeployModal(false)}>Cancel</Button>
          <Button onClick={handleCreateDeployment} loading={deploying} disabled={!deployForm.name.trim()}>
            Add Deployment
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
