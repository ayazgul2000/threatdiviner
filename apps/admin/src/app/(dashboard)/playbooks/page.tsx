'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  playbooksApi,
  canonicalRisksApi,
  RemediationPlaybook,
  PlaybookStep,
  PlaybookIacSnippet,
  CanonicalRisk,
  CreatePlaybookData,
  CreateStepData,
  CreateIacSnippetData,
  PlaybookStats,
} from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  review: 'bg-blue-100 text-blue-800',
  live: 'bg-green-100 text-green-800',
};

const EFFORT_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const ROLE_LABELS: Record<string, string> = {
  developer: 'Developer',
  devops: 'DevOps',
  security: 'Security',
  architect: 'Architect',
};

const PLATFORM_LABELS: Record<string, string> = {
  terraform: 'Terraform',
  cloudformation: 'CloudFormation',
  kubernetes: 'Kubernetes',
  pulumi: 'Pulumi',
};

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<RemediationPlaybook[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [effortFilter, setEffortFilter] = useState('');
  const [hasIacFilter, setHasIacFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Canonical risks for dropdown
  const [canonicalRisks, setCanonicalRisks] = useState<CanonicalRisk[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<RemediationPlaybook | null>(null);
  const [formData, setFormData] = useState<CreatePlaybookData>({
    canonicalRiskId: '',
    title: '',
    description: '',
    totalEffort: '',
  });

  // Steps state
  const [steps, setSteps] = useState<PlaybookStep[]>([]);
  const [editingStep, setEditingStep] = useState<PlaybookStep | null>(null);
  const [showStepModal, setShowStepModal] = useState(false);
  const [stepFormData, setStepFormData] = useState<CreateStepData>({
    title: '',
    description: '',
    effort: '',
    role: '',
    estimatedMinutes: undefined,
    automatable: false,
  });

  // IaC Snippets state
  const [iacSnippets, setIacSnippets] = useState<PlaybookIacSnippet[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('terraform');
  const [showIacModal, setShowIacModal] = useState(false);
  const [iacFormData, setIacFormData] = useState<CreateIacSnippetData>({
    platform: 'terraform',
    code: '',
    description: '',
  });

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewPlaybook, setPreviewPlaybook] = useState<RemediationPlaybook | null>(null);
  const [previewStats, setPreviewStats] = useState<PlaybookStats | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPlaybooks = useCallback(async () => {
    try {
      setLoading(true);
      const result = await playbooksApi.list({
        search: search || undefined,
        effort: effortFilter || undefined,
        hasIac: hasIacFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: 25,
      });
      setPlaybooks(result.playbooks);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playbooks');
    } finally {
      setLoading(false);
    }
  }, [search, effortFilter, hasIacFilter, statusFilter, page]);

  const fetchCanonicalRisks = useCallback(async () => {
    try {
      const result = await canonicalRisksApi.list({ status: 'live', limit: 500 });
      setCanonicalRisks(result.risks);
    } catch {
      // Silently fail - risks dropdown will be empty
    }
  }, []);

  useEffect(() => {
    fetchPlaybooks();
    fetchCanonicalRisks();
  }, [fetchPlaybooks, fetchCanonicalRisks]);

  const handleCreate = () => {
    setEditingPlaybook(null);
    setFormData({
      canonicalRiskId: '',
      title: '',
      description: '',
      totalEffort: '',
    });
    setSteps([]);
    setIacSnippets([]);
    setShowModal(true);
  };

  const handleEdit = async (playbook: RemediationPlaybook) => {
    try {
      const result = await playbooksApi.get(playbook.id);
      setEditingPlaybook(result.playbook);
      setFormData({
        canonicalRiskId: result.playbook.canonicalRiskId,
        title: result.playbook.title,
        description: result.playbook.description || '',
        totalEffort: result.playbook.totalEffort || '',
      });
      setSteps(result.playbook.steps || []);
      setIacSnippets(result.playbook.iacSnippets || []);
      setShowModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playbook');
    }
  };

  const handleSave = async () => {
    try {
      if (editingPlaybook) {
        await playbooksApi.update(editingPlaybook.id, formData);
      } else {
        const result = await playbooksApi.create(formData);
        setEditingPlaybook(result.playbook);
      }
      setShowModal(false);
      fetchPlaybooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save playbook');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await playbooksApi.delete(id);
      setDeletingId(null);
      fetchPlaybooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete playbook');
    }
  };

  const handleSubmitForReview = async (id: string) => {
    try {
      await playbooksApi.submitForReview(id);
      fetchPlaybooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit for review');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await playbooksApi.approve(id);
      fetchPlaybooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  // Step handlers
  const handleAddStep = () => {
    setEditingStep(null);
    setStepFormData({
      title: '',
      description: '',
      effort: '',
      role: '',
      estimatedMinutes: undefined,
      automatable: false,
    });
    setShowStepModal(true);
  };

  const handleEditStep = (step: PlaybookStep) => {
    setEditingStep(step);
    setStepFormData({
      title: step.title,
      description: step.description,
      effort: step.effort || '',
      role: step.role || '',
      estimatedMinutes: step.estimatedMinutes || undefined,
      automatable: step.automatable,
    });
    setShowStepModal(true);
  };

  const handleSaveStep = async () => {
    if (!editingPlaybook) return;

    try {
      if (editingStep) {
        const result = await playbooksApi.updateStep(editingPlaybook.id, editingStep.id, stepFormData);
        setSteps(steps.map((s) => (s.id === editingStep.id ? result.step : s)));
      } else {
        const result = await playbooksApi.createStep(editingPlaybook.id, stepFormData);
        setSteps([...steps, result.step]);
      }
      setShowStepModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save step');
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!editingPlaybook) return;

    try {
      await playbooksApi.deleteStep(editingPlaybook.id, stepId);
      setSteps(steps.filter((s) => s.id !== stepId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete step');
    }
  };

  const handleMoveStep = async (stepId: string, direction: 'up' | 'down') => {
    if (!editingPlaybook) return;

    const index = steps.findIndex((s) => s.id === stepId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === steps.length - 1) return;

    const newSteps = [...steps];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];

    try {
      const result = await playbooksApi.reorderSteps(
        editingPlaybook.id,
        newSteps.map((s) => s.id),
      );
      setSteps(result.steps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder steps');
    }
  };

  // IaC Snippet handlers
  const handleAddIacSnippet = () => {
    const existingPlatforms = iacSnippets.map((s) => s.platform);
    const availablePlatforms = ['terraform', 'cloudformation', 'kubernetes', 'pulumi'].filter(
      (p) => !existingPlatforms.includes(p),
    );
    if (availablePlatforms.length === 0) {
      setError('All platforms already have snippets');
      return;
    }
    setIacFormData({
      platform: availablePlatforms[0],
      code: '',
      description: '',
    });
    setShowIacModal(true);
  };

  const handleSaveIacSnippet = async () => {
    if (!editingPlaybook) return;

    try {
      const existingSnippet = iacSnippets.find((s) => s.platform === iacFormData.platform);
      if (existingSnippet) {
        const result = await playbooksApi.updateIacSnippet(editingPlaybook.id, existingSnippet.id, {
          code: iacFormData.code,
          description: iacFormData.description,
        });
        setIacSnippets(iacSnippets.map((s) => (s.id === existingSnippet.id ? result.snippet : s)));
      } else {
        const result = await playbooksApi.createIacSnippet(editingPlaybook.id, iacFormData);
        setIacSnippets([...iacSnippets, result.snippet]);
      }
      setShowIacModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save IaC snippet');
    }
  };

  const handleDeleteIacSnippet = async (snippetId: string) => {
    if (!editingPlaybook) return;

    try {
      await playbooksApi.deleteIacSnippet(editingPlaybook.id, snippetId);
      setIacSnippets(iacSnippets.filter((s) => s.id !== snippetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete IaC snippet');
    }
  };

  const handleEditIacSnippet = (snippet: PlaybookIacSnippet) => {
    setIacFormData({
      platform: snippet.platform,
      code: snippet.code,
      description: snippet.description || '',
    });
    setShowIacModal(true);
  };

  // Preview handler
  const handlePreview = async (playbook: RemediationPlaybook) => {
    try {
      const [playbookResult, statsResult] = await Promise.all([
        playbooksApi.get(playbook.id),
        playbooksApi.getStats(playbook.id),
      ]);
      setPreviewPlaybook(playbookResult.playbook);
      setPreviewStats(statsResult.stats);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Remediation Playbooks</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage step-by-step remediation instructions with IaC snippets
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          + Add Playbook
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-800">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <input
            type="text"
            placeholder="Search playbooks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <select
            value={effortFilter}
            onChange={(e) => setEffortFilter(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">All Efforts</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select
            value={hasIacFilter}
            onChange={(e) => setHasIacFilter(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Any IaC</option>
            <option value="true">Has IaC</option>
            <option value="false">No IaC</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="review">Review</option>
            <option value="live">Live</option>
          </select>
          <div className="text-sm text-gray-500 self-center">
            Showing {playbooks.length} of {total}
          </div>
        </div>
      </div>

      {/* Playbooks Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : playbooks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No playbooks found. Click &quot;+ Add Playbook&quot; to create one.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Canonical Risk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Steps
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IaC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Effort
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {playbooks.map((playbook) => (
                <tr key={playbook.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {playbook.canonicalRisk?.canonicalId || '-'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {playbook.canonicalRisk?.title || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{playbook.title}</div>
                    {playbook.description && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {playbook.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {playbook._count?.steps || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {(playbook._count?.iacSnippets || 0) > 0 ? (
                      <span className="text-green-600">&#10003;</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {playbook.totalEffort ? EFFORT_LABELS[playbook.totalEffort] : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[playbook.status]}`}
                    >
                      {playbook.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {deletingId === playbook.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-red-600 text-xs">Delete?</span>
                        <button
                          onClick={() => handleDelete(playbook.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handlePreview(playbook)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Preview"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => handleEdit(playbook)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Edit
                        </button>
                        {playbook.status === 'pending' && (
                          <button
                            onClick={() => handleSubmitForReview(playbook.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Submit
                          </button>
                        )}
                        {playbook.status === 'review' && (
                          <button
                            onClick={() => handleApprove(playbook.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => setDeletingId(playbook.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > 25 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={playbooks.length < 25}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Playbook Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingPlaybook ? 'Edit Playbook' : 'Create Playbook'}
                </h3>
              </div>

              <div className="px-6 py-4 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Canonical Risk *
                    </label>
                    <select
                      value={formData.canonicalRiskId}
                      onChange={(e) => setFormData({ ...formData, canonicalRiskId: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    >
                      <option value="">Select a canonical risk...</option>
                      {canonicalRisks.map((risk) => (
                        <option key={risk.id} value={risk.id}>
                          {risk.canonicalId} - {risk.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Effort</label>
                    <select
                      value={formData.totalEffort}
                      onChange={(e) => setFormData({ ...formData, totalEffort: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Select effort...</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                {/* Steps Section (only if editing) */}
                {editingPlaybook && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-medium text-gray-900">Remediation Steps</h4>
                      <button
                        onClick={handleAddStep}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-indigo-600 bg-indigo-100 hover:bg-indigo-200"
                      >
                        + Add Step
                      </button>
                    </div>

                    {steps.length === 0 ? (
                      <p className="text-sm text-gray-500">No steps yet. Add steps to define the remediation process.</p>
                    ) : (
                      <div className="space-y-2">
                        {steps.map((step, index) => (
                          <div
                            key={step.id}
                            className="flex items-start gap-3 p-3 bg-gray-50 rounded-md"
                          >
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleMoveStep(step.id, 'up')}
                                disabled={index === 0}
                                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                              >
                                &#9650;
                              </button>
                              <button
                                onClick={() => handleMoveStep(step.id, 'down')}
                                disabled={index === steps.length - 1}
                                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                              >
                                &#9660;
                              </button>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  Step {step.stepNumber}: {step.title}
                                </span>
                                {step.automatable && (
                                  <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                                    Automatable
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 truncate">{step.description}</p>
                              <div className="flex gap-4 mt-1 text-xs text-gray-500">
                                {step.effort && <span>Effort: {EFFORT_LABELS[step.effort]}</span>}
                                {step.role && <span>Role: {ROLE_LABELS[step.role]}</span>}
                                {step.estimatedMinutes && <span>{step.estimatedMinutes} min</span>}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditStep(step)}
                                className="text-indigo-600 hover:text-indigo-900 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteStep(step.id)}
                                className="text-red-600 hover:text-red-900 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* IaC Snippets Section (only if editing) */}
                {editingPlaybook && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-medium text-gray-900">IaC Snippets</h4>
                      <button
                        onClick={handleAddIacSnippet}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-indigo-600 bg-indigo-100 hover:bg-indigo-200"
                      >
                        + Add Snippet
                      </button>
                    </div>

                    {iacSnippets.length === 0 ? (
                      <p className="text-sm text-gray-500">No IaC snippets yet. Add snippets for Terraform, CloudFormation, etc.</p>
                    ) : (
                      <div className="border rounded-md overflow-hidden">
                        <div className="flex border-b">
                          {iacSnippets.map((snippet) => (
                            <button
                              key={snippet.id}
                              onClick={() => setSelectedPlatform(snippet.platform)}
                              className={`px-4 py-2 text-sm font-medium ${
                                selectedPlatform === snippet.platform
                                  ? 'bg-indigo-100 text-indigo-700 border-b-2 border-indigo-500'
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              {PLATFORM_LABELS[snippet.platform]}
                            </button>
                          ))}
                        </div>
                        {iacSnippets.map((snippet) => (
                          <div
                            key={snippet.id}
                            className={`${selectedPlatform === snippet.platform ? 'block' : 'hidden'}`}
                          >
                            <div className="p-2 bg-gray-800 text-gray-100 text-sm font-mono overflow-x-auto">
                              <pre className="whitespace-pre-wrap">{snippet.code}</pre>
                            </div>
                            <div className="flex justify-end gap-2 p-2 bg-gray-50">
                              <button
                                onClick={() => handleEditIacSnippet(snippet)}
                                className="text-sm text-indigo-600 hover:text-indigo-900"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteIacSnippet(snippet.id)}
                                className="text-sm text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.canonicalRiskId || !formData.title}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save Playbook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step Modal */}
      {showStepModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowStepModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingStep ? 'Edit Step' : 'Add Step'}
                </h3>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title *</label>
                  <input
                    type="text"
                    value={stepFormData.title}
                    onChange={(e) => setStepFormData({ ...stepFormData, title: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description *</label>
                  <textarea
                    value={stepFormData.description}
                    onChange={(e) => setStepFormData({ ...stepFormData, description: e.target.value })}
                    rows={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Effort</label>
                    <select
                      value={stepFormData.effort}
                      onChange={(e) => setStepFormData({ ...stepFormData, effort: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select
                      value={stepFormData.role}
                      onChange={(e) => setStepFormData({ ...stepFormData, role: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="developer">Developer</option>
                      <option value="devops">DevOps</option>
                      <option value="security">Security</option>
                      <option value="architect">Architect</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Est. Minutes</label>
                    <input
                      type="number"
                      min="1"
                      value={stepFormData.estimatedMinutes || ''}
                      onChange={(e) =>
                        setStepFormData({
                          ...stepFormData,
                          estimatedMinutes: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div className="flex items-center pt-6">
                    <input
                      type="checkbox"
                      id="automatable"
                      checked={stepFormData.automatable}
                      onChange={(e) => setStepFormData({ ...stepFormData, automatable: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="automatable" className="ml-2 block text-sm text-gray-900">
                      Automatable
                    </label>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowStepModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStep}
                  disabled={!stepFormData.title || !stepFormData.description}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save Step
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IaC Snippet Modal */}
      {showIacModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowIacModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {iacSnippets.find((s) => s.platform === iacFormData.platform) ? 'Edit' : 'Add'} IaC Snippet
                </h3>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Platform *</label>
                  <select
                    value={iacFormData.platform}
                    onChange={(e) => setIacFormData({ ...iacFormData, platform: e.target.value })}
                    disabled={!!iacSnippets.find((s) => s.platform === iacFormData.platform)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100"
                  >
                    <option value="terraform">Terraform</option>
                    <option value="cloudformation">CloudFormation</option>
                    <option value="kubernetes">Kubernetes</option>
                    <option value="pulumi">Pulumi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <input
                    type="text"
                    value={iacFormData.description}
                    onChange={(e) => setIacFormData({ ...iacFormData, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Brief description of this snippet"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Code *</label>
                  <textarea
                    value={iacFormData.code}
                    onChange={(e) => setIacFormData({ ...iacFormData, code: e.target.value })}
                    rows={15}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm"
                    placeholder="Enter your IaC code here..."
                    required
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowIacModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveIacSnippet}
                  disabled={!iacFormData.code}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save Snippet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewPlaybook && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowPreview(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Preview: {previewPlaybook.title}</h3>
                <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-500">
                  &times;
                </button>
              </div>

              <div className="px-6 py-4 space-y-6">
                <div className="border-b pb-4">
                  <h2 className="text-xl font-bold text-gray-900">{previewPlaybook.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Risk: {previewPlaybook.canonicalRisk?.title}
                    {previewPlaybook.canonicalRisk?.cweId && ` (${previewPlaybook.canonicalRisk.cweId})`}
                  </p>
                  {previewStats && (
                    <div className="flex gap-4 mt-2 text-sm text-gray-500">
                      <span>Effort: {previewPlaybook.totalEffort ? EFFORT_LABELS[previewPlaybook.totalEffort] : '-'}</span>
                      <span>Steps: {previewStats.totalSteps}</span>
                      <span>Time: ~{previewStats.totalMinutes} min</span>
                      <span>Roles: {previewStats.roles.join(', ') || '-'}</span>
                    </div>
                  )}
                </div>

                {previewPlaybook.description && (
                  <p className="text-gray-700">{previewPlaybook.description}</p>
                )}

                {previewPlaybook.steps && previewPlaybook.steps.length > 0 && (
                  <div className="space-y-4">
                    {previewPlaybook.steps.map((step) => (
                      <div key={step.id} className="border-l-4 border-indigo-500 pl-4">
                        <h4 className="font-medium text-gray-900">
                          Step {step.stepNumber}: {step.title}
                          {step.automatable && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                              Automatable
                            </span>
                          )}
                        </h4>
                        <div className="flex gap-4 text-xs text-gray-500 mt-1">
                          {step.effort && <span>Effort: {EFFORT_LABELS[step.effort]}</span>}
                          {step.role && <span>Role: {ROLE_LABELS[step.role]}</span>}
                          {step.estimatedMinutes && <span>{step.estimatedMinutes} min</span>}
                        </div>
                        <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{step.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {previewPlaybook.iacSnippets && previewPlaybook.iacSnippets.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-3">IaC Snippets</h4>
                    {previewPlaybook.iacSnippets.map((snippet) => (
                      <div key={snippet.id} className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-1">
                          {PLATFORM_LABELS[snippet.platform]}
                        </h5>
                        <pre className="bg-gray-800 text-gray-100 p-4 rounded text-sm overflow-x-auto">
                          <code>{snippet.code}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
