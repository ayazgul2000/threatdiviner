'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { SkeletonTable } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { NoBaselinesEmpty } from '@/components/ui/empty-state';
import { useFetch, useMutation, API_URL } from '@/hooks';

interface Baseline {
  id: string;
  fingerprint: string;
  reason: string;
  repositoryId: string;
  expiresAt: string | null;
  createdAt: string;
  baselinedBy: string;
  repository?: {
    fullName: string;
  };
  matchingFindingsCount?: number;
}

interface BaselinesResponse {
  baselines: Baseline[];
  total: number;
}

export default function BaselinesPage() {
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    repositoryId: '',
    fingerprint: '',
    reason: '',
    expiresAt: '',
  });

  const {
    data,
    loading,
    error,
    refetch,
  } = useFetch<BaselinesResponse>(`/baselines?page=${page}&limit=20`);

  const { mutate: deleteBaseline, loading: deleting } = useMutation(
    '/baselines',
    'DELETE',
    {
      onSuccess: () => refetch(),
    },
  );

  const { mutate: createBaseline, loading: creating } = useMutation<Baseline>(
    '/baselines',
    'POST',
    {
      onSuccess: () => {
        setShowCreateModal(false);
        setFormData({ repositoryId: '', fingerprint: '', reason: '', expiresAt: '' });
        refetch();
      },
    },
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this baseline? Affected findings will be reopened.')) return;
    await fetch(`${API_URL}/baselines/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    refetch();
  };

  const handleCreate = () => {
    createBaseline({
      repositoryId: formData.repositoryId,
      fingerprint: formData.fingerprint,
      reason: formData.reason,
      expiresAt: formData.expiresAt || undefined,
    });
  };

  const isExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const daysUntil = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 30 && daysUntil > 0;
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  };

  const expiringCount = data?.baselines.filter(b => isExpiringSoon(b.expiresAt)).length || 0;

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 rounded mt-2 animate-pulse" />
        </div>
        <SkeletonTable rows={10} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <ApiError error={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Baseline Management"
        description="Manage suppressed findings, false positives, and accepted risks"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Baseline Rule
          </Button>
        }
      />

      {expiringCount > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-yellow-800 dark:text-yellow-200">
            {expiringCount} baseline(s) expiring within 30 days - review required
          </span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Fingerprint</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Repository</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Reason</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Expires</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Matches</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data?.baselines.map((baseline) => (
              <tr key={baseline.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3">
                  <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                    {baseline.fingerprint.substring(0, 16)}...
                  </code>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {baseline.repository?.fullName || baseline.repositoryId.substring(0, 8)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                  {baseline.reason}
                </td>
                <td className="px-4 py-3">
                  {baseline.expiresAt ? (
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                        isExpired(baseline.expiresAt)
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : isExpiringSoon(baseline.expiresAt)
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(baseline.expiresAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-sm">Never</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                    {baseline.matchingFindingsCount || 0} findings
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(baseline.id)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                    disabled={deleting}
                    title="Remove baseline"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data?.baselines.length === 0 && (
          <NoBaselinesEmpty onAdd={() => setShowCreateModal(true)} />
        )}

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 20 >= data.total}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg mx-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Add Baseline Rule
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Repository ID
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.repositoryId}
                  onChange={(e) => setFormData(prev => ({ ...prev, repositoryId: e.target.value }))}
                  placeholder="Repository UUID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fingerprint
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.fingerprint}
                  onChange={(e) => setFormData(prev => ({ ...prev, fingerprint: e.target.value }))}
                  placeholder="Finding fingerprint hash"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason
                </label>
                <textarea
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Why is this being baselined?"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expires At (Optional)
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !formData.repositoryId || !formData.reason}
              >
                {creating ? 'Creating...' : 'Create Baseline'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
