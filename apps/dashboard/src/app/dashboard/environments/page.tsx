'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormField,
  Label,
  Input,
  Textarea,
  Select,
  PageHeader,
} from '@/components/ui';
import { useProject } from '@/contexts/project-context';
import { CardSkeleton } from '@/components/ui/skeletons';
import { NoProjectSelectedEmpty, NoEnvironmentsEmpty } from '@/components/ui/empty-state';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Deployment {
  id: string;
  name: string;
  status: string;
  vulnCount: number;
  criticalCount: number;
}

interface Environment {
  id: string;
  name: string;
  type: string;
  description?: string;
  isActive: boolean;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
  deploymentCount: number;
  deployments: Deployment[];
  healthySummary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  };
  securitySummary: {
    totalVulns: number;
    criticalVulns: number;
  };
}

const environmentTypes = [
  { value: 'kubernetes', label: 'Kubernetes' },
  { value: 'ecs', label: 'AWS ECS' },
  { value: 'cloud_run', label: 'Google Cloud Run' },
  { value: 'lambda', label: 'AWS Lambda' },
  { value: 'vm', label: 'Virtual Machines' },
];

const typeIcons: Record<string, React.ReactNode> = {
  kubernetes: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7l1.5 6L12 17l8.5-4L22 7l-10-5zm0 2.18l6.5 3.25-1.03 4.12L12 14.82l-5.47-3.27-1.03-4.12L12 4.18zM12 22l-8.5-4.5 1.5-6L12 17l7-5.5 1.5 6L12 22z"/>
    </svg>
  ),
  ecs: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  cloud_run: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  lambda: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  vm: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  ),
};

const statusColors: Record<string, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  unhealthy: 'bg-red-500',
  unknown: 'bg-gray-400',
};

export default function EnvironmentsPage() {
  const { currentProject } = useProject();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'kubernetes',
    description: '',
    namespace: '',
    cloudProvider: '',
    cloudRegion: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!currentProject) {
      setLoading(false);
      return;
    }
    fetchEnvironments();
  }, [currentProject]);

  const fetchEnvironments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/environments?projectId=${currentProject!.id}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch environments');

      const data = await res.json();
      setEnvironments(data);
    } catch (err) {
      console.error('Failed to fetch environments:', err);
      setError('Failed to load environments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    try {
      setCreating(true);
      const res = await fetch(`${API_URL}/environments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, projectId: currentProject?.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create environment');
      }

      await fetchEnvironments();
      setCreateModal(false);
      setFormData({
        name: '',
        type: 'kubernetes',
        description: '',
        namespace: '',
        cloudProvider: '',
        cloudRegion: '',
      });
    } catch (err) {
      console.error('Failed to create:', err);
      setError(err instanceof Error ? err.message : 'Failed to create environment');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this environment and all its deployments?')) return;

    try {
      await fetch(`${API_URL}/environments/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setEnvironments(environments.filter((e) => e.id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-72 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <PageHeader title="Environments" breadcrumbs={[{ label: 'Environments' }]} />
        <Card variant="bordered">
          <NoProjectSelectedEmpty />
        </Card>
      </div>
    );
  }

  const totalStats = environments.reduce(
    (acc, env) => ({
      deployments: acc.deployments + env.deploymentCount,
      healthy: acc.healthy + env.healthySummary.healthy,
      degraded: acc.degraded + env.healthySummary.degraded,
      unhealthy: acc.unhealthy + env.healthySummary.unhealthy,
      vulns: acc.vulns + env.securitySummary.totalVulns,
      criticalVulns: acc.criticalVulns + env.securitySummary.criticalVulns,
    }),
    { deployments: 0, healthy: 0, degraded: 0, unhealthy: 0, vulns: 0, criticalVulns: 0 },
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Environments</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Track deployments and security posture across environments
          </p>
        </div>
        <Button onClick={() => setCreateModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Environment
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats Overview */}
      {environments.length > 0 && (
        <div className="grid grid-cols-5 gap-4">
          <Card variant="bordered">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{environments.length}</div>
              <div className="text-sm text-gray-500">Environments</div>
            </CardContent>
          </Card>
          <Card variant="bordered">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalStats.deployments}</div>
              <div className="text-sm text-gray-500">Deployments</div>
            </CardContent>
          </Card>
          <Card variant="bordered">
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-2xl font-bold text-green-600">{totalStats.healthy}</span>
              </div>
              <div className="text-sm text-gray-500">Healthy</div>
            </CardContent>
          </Card>
          <Card variant="bordered">
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-2xl font-bold text-yellow-600">{totalStats.degraded}</span>
              </div>
              <div className="text-sm text-gray-500">Degraded</div>
            </CardContent>
          </Card>
          <Card variant="bordered">
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-red-600">{totalStats.criticalVulns}</div>
              <div className="text-sm text-gray-500">Critical Vulns</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Environment Cards */}
      {environments.length === 0 ? (
        <Card variant="bordered">
          <NoEnvironmentsEmpty onAdd={() => setCreateModal(true)} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {environments.map((env) => (
            <Card key={env.id} variant="bordered" className="hover:border-blue-300 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
                    {typeIcons[env.type] || typeIcons.vm}
                  </div>
                  <div>
                    <Link
                      href={`/dashboard/environments/${env.id}`}
                      className="font-semibold text-gray-900 dark:text-white hover:text-blue-600"
                    >
                      {env.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" size="sm">{env.type}</Badge>
                      {!env.isActive && <Badge variant="secondary" size="sm">Inactive</Badge>}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => handleDelete(env.id)}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              </CardHeader>
              <CardContent>
                {env.description && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{env.description}</p>
                )}

                {/* Health Indicators */}
                <div className="flex items-center gap-2 mb-4">
                  {Object.entries(env.healthySummary).map(([status, count]) =>
                    count > 0 ? (
                      <div key={status} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{count}</span>
                      </div>
                    ) : null,
                  )}
                  {env.deploymentCount === 0 && (
                    <span className="text-sm text-gray-400">No deployments</span>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">{env.deploymentCount}</div>
                    <div className="text-xs text-gray-500">Deployments</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">{env.securitySummary.totalVulns}</div>
                    <div className="text-xs text-gray-500">Vulns</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-red-600">{env.securitySummary.criticalVulns}</div>
                    <div className="text-xs text-gray-500">Critical</div>
                  </div>
                </div>

                {/* View Link */}
                <Link href={`/dashboard/environments/${env.id}`} className="block mt-4">
                  <Button variant="secondary" className="w-full">View Details</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} size="md">
        <ModalHeader>Add Environment</ModalHeader>
        <ModalBody>
          <Form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
            <FormField>
              <Label htmlFor="env-name" required>Name</Label>
              <Input
                id="env-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., production, staging"
              />
            </FormField>
            <FormField>
              <Label htmlFor="env-type">Type</Label>
              <Select
                id="env-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                options={environmentTypes}
              />
            </FormField>
            <FormField>
              <Label htmlFor="env-desc">Description</Label>
              <Textarea
                id="env-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Optional description..."
              />
            </FormField>
            {formData.type === 'kubernetes' && (
              <FormField>
                <Label htmlFor="env-ns">Namespace</Label>
                <Input
                  id="env-ns"
                  value={formData.namespace}
                  onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                  placeholder="e.g., default"
                />
              </FormField>
            )}
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
          <Button onClick={handleCreate} loading={creating} disabled={!formData.name.trim()}>
            Create
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
