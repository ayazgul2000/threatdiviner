'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  TableEmpty,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui';
import { TableSkeleton } from '@/components/ui/skeletons';
import { NoThreatModelsEmpty } from '@/components/ui/empty-state';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ThreatModel {
  id: string;
  name: string;
  description?: string;
  methodology: string;
  status: string;
  repositoryId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    components: number;
    dataFlows: number;
    threats: number;
    mitigations: number;
  };
}

const methodologyLabels: Record<string, string> = {
  stride: 'STRIDE',
  pasta: 'PASTA',
  linddun: 'LINDDUN',
  custom: 'Custom',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  archived: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
};

export default function ThreatModelingPage() {
  const router = useRouter();
  const [models, setModels] = useState<ThreatModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; model: ThreatModel | null }>({
    open: false,
    model: null,
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchModels();
  }, [statusFilter]);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`${API_URL}/threat-modeling?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch threat models');

      const data = await res.json();
      setModels(data.models || []);
    } catch (err) {
      console.error('Failed to fetch threat models:', err);
      setError('Failed to load threat models');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.model) return;

    try {
      setDeleting(true);
      const res = await fetch(`${API_URL}/threat-modeling/${deleteModal.model.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to delete');

      setModels(models.filter(m => m.id !== deleteModal.model?.id));
      setDeleteModal({ open: false, model: null });
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (model: ThreatModel) => {
    try {
      const res = await fetch(`${API_URL}/threat-modeling/${model.id}/duplicate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${model.name} (Copy)` }),
      });

      if (!res.ok) throw new Error('Failed to duplicate');

      const newModel = await res.json();
      router.push(`/dashboard/threat-modeling/${newModel.id}`);
    } catch (err) {
      console.error('Failed to duplicate:', err);
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
        <TableSkeleton rows={5} columns={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Threat Modeling</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Analyze and document security threats using STRIDE, PASTA, or LINDDUN
          </p>
        </div>
        <Link href="/dashboard/threat-modeling/new">
          <Button>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Threat Model
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      <Card variant="bordered">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Methodology</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Components</TableHead>
              <TableHead>Threats</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <NoThreatModelsEmpty />
                </TableCell>
              </TableRow>
            ) : (
              models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/threat-modeling/${model.id}`}
                      className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {model.name}
                    </Link>
                    {model.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                        {model.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {methodologyLabels[model.methodology] || model.methodology}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[model.status]}`}>
                      {model.status.replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-600 dark:text-gray-400">
                      {model._count.components} / {model._count.dataFlows}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-600 dark:text-gray-400">
                      {model._count.threats}
                      {model._count.mitigations > 0 && (
                        <span className="text-green-600 ml-1">
                          ({model._count.mitigations} mitigated)
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">
                      {new Date(model.updatedAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/threat-modeling/${model.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(model)}
                      >
                        Duplicate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteModal({ open: true, model })}
                        className="text-red-600 hover:text-red-700"
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

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, model: null })}
        size="sm"
      >
        <ModalHeader>Delete Threat Model</ModalHeader>
        <ModalBody>
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete <strong>{deleteModal.model?.name}</strong>?
            This will remove all components, data flows, threats, and mitigations.
            This action cannot be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setDeleteModal({ open: false, model: null })}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleting}
          >
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
