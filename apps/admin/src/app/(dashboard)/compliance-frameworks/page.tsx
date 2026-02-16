'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  complianceFrameworksApi,
  canonicalRisksApi,
  ComplianceFramework,
  ComplianceControl,
  RiskControlMapping,
  CreateComplianceFrameworkData,
  CreateComplianceControlData,
  CanonicalRisk,
} from '@/lib/api';

// Framework Edit Modal
interface FrameworkModalProps {
  isOpen: boolean;
  framework: ComplianceFramework | null;
  onClose: () => void;
  onSave: (data: CreateComplianceFrameworkData) => Promise<void>;
}

function FrameworkModal({ isOpen, framework, onClose, onSave }: FrameworkModalProps): JSX.Element | null {
  const [formData, setFormData] = useState<CreateComplianceFrameworkData>({
    id: '',
    name: '',
    version: '',
    description: '',
    sourceUrl: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (framework) {
      setFormData({
        id: framework.id,
        name: framework.name,
        version: framework.version,
        description: framework.description || '',
        sourceUrl: framework.sourceUrl || '',
        isActive: framework.isActive,
      });
    } else {
      setFormData({ id: '', name: '', version: '', description: '', sourceUrl: '', isActive: true });
    }
    setError(null);
  }, [framework, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 rounded-lg w-full max-w-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            {framework ? 'Edit Framework' : 'Add Framework'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Framework ID *</label>
              <input
                type="text"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="iso-27001-2022"
                required
                disabled={!!framework}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Version *</label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="2022"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="ISO/IEC 27001:2022"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Source URL</label>
              <input
                type="url"
                value={formData.sourceUrl}
                onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="https://iso.org/..."
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-700 bg-gray-800 text-purple-500 focus:ring-purple-500"
                />
                Active
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Control Edit Modal
interface ControlModalProps {
  isOpen: boolean;
  frameworkId: string;
  control: ComplianceControl | null;
  parentControls: ComplianceControl[];
  onClose: () => void;
  onSave: (data: CreateComplianceControlData) => Promise<void>;
}

function ControlModal({ isOpen, frameworkId, control, parentControls, onClose, onSave }: ControlModalProps): JSX.Element | null {
  const [formData, setFormData] = useState<CreateComplianceControlData>({
    controlId: '',
    parentId: '',
    category: '',
    name: '',
    description: '',
    guidance: '',
    level: 1,
  });
  const [riskMappings, setRiskMappings] = useState<RiskControlMapping[]>([]);
  const [availableRisks, setAvailableRisks] = useState<CanonicalRisk[]>([]);
  const [selectedRiskId, setSelectedRiskId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (control) {
      setFormData({
        controlId: control.controlId,
        parentId: control.parentId || '',
        category: control.category,
        name: control.name,
        description: control.description || '',
        guidance: control.guidance || '',
        level: control.level,
      });
      setRiskMappings(control.riskMappings || []);
    } else {
      setFormData({ controlId: '', parentId: '', category: '', name: '', description: '', guidance: '', level: 1 });
      setRiskMappings([]);
    }
    setError(null);
  }, [control, isOpen]);

  useEffect(() => {
    const loadRisks = async () => {
      try {
        const result = await canonicalRisksApi.list({ status: 'live', limit: 100 });
        setAvailableRisks(result.risks);
      } catch {
        console.error('Failed to load risks');
      }
    };
    if (isOpen && control) {
      loadRisks();
    }
  }, [isOpen, control]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMapping = async () => {
    if (!control || !selectedRiskId) return;
    try {
      const result = await complianceFrameworksApi.addRiskMapping(control.id, { canonicalRiskId: selectedRiskId });
      setRiskMappings([...riskMappings, result.mapping]);
      setSelectedRiskId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add mapping');
    }
  };

  const handleRemoveMapping = async (mappingId: string) => {
    if (!control) return;
    try {
      await complianceFrameworksApi.removeRiskMapping(control.id, mappingId);
      setRiskMappings(riskMappings.filter((m) => m.id !== mappingId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove mapping');
    }
  };

  if (!isOpen) return null;

  const mappedRiskIds = riskMappings.map((m) => m.canonicalRiskId);
  const unmappedRisks = availableRisks.filter((r) => !mappedRiskIds.includes(r.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            {control ? `Edit Control: ${control.controlId}` : 'Add Control'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Control ID *</label>
              <input
                type="text"
                value={formData.controlId}
                onChange={(e) => setFormData({ ...formData, controlId: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="A.5.1"
                required
                disabled={!!control}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Level</label>
              <select
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
              >
                <option value={1}>1 - Category</option>
                <option value={2}>2 - Control</option>
                <option value={3}>3 - Sub-control</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Parent Control</label>
              <select
                value={formData.parentId}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">None (Root)</option>
                {parentControls.filter((c) => c.id !== control?.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.controlId} - {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Category *</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="Organizational controls"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="Policies for information security"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Guidance</label>
              <textarea
                value={formData.guidance}
                onChange={(e) => setFormData({ ...formData, guidance: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                rows={2}
              />
            </div>
          </div>

          {/* Risk Mappings - only for existing controls */}
          {control && (
            <div className="border-t border-gray-800 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Mapped Risks</h3>
              </div>

              {riskMappings.length > 0 && (
                <div className="bg-gray-800 rounded mb-3 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-400 uppercase">
                        <th className="px-3 py-2">Canonical Risk</th>
                        <th className="px-3 py-2">Relevance</th>
                        <th className="px-3 py-2">AI Conf.</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {riskMappings.map((mapping) => (
                        <tr key={mapping.id}>
                          <td className="px-3 py-2 text-gray-300">{mapping.canonicalRisk?.canonicalId || mapping.canonicalRiskId}</td>
                          <td className="px-3 py-2 text-gray-400">{mapping.relevance}</td>
                          <td className="px-3 py-2 text-gray-400">{mapping.aiConfidence ? `${Math.round(mapping.aiConfidence * 100)}%` : '-'}</td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => handleRemoveMapping(mapping.id)} className="text-red-400 hover:text-red-300">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-2">
                <select
                  value={selectedRiskId}
                  onChange={(e) => setSelectedRiskId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select a risk to add...</option>
                  {unmappedRisks.map((risk) => (
                    <option key={risk.id} value={risk.id}>{risk.canonicalId} - {risk.title}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddMapping}
                  disabled={!selectedRiskId}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Control Tree Item
interface ControlTreeItemProps {
  control: ComplianceControl;
  level: number;
  onEdit: (control: ComplianceControl) => void;
  onDelete: (control: ComplianceControl) => void;
}

function ControlTreeItem({ control, level, onEdit, onDelete }: ControlTreeItemProps): JSX.Element {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = control.children && control.children.length > 0;

  return (
    <div className={`${level > 0 ? 'ml-6' : ''}`}>
      <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-800/50 rounded group">
        <button
          onClick={() => setExpanded(!expanded)}
          className={`text-gray-400 hover:text-white ${!hasChildren ? 'invisible' : ''}`}
        >
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <span className="text-sm font-mono text-purple-400">{control.controlId}</span>
        <span className="text-sm text-white flex-1">{control.name}</span>
        <span className="text-xs text-gray-500">
          {control._count?.riskMappings || 0} mappings
        </span>
        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
          <button onClick={() => onEdit(control)} className="text-gray-400 hover:text-white p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => onDelete(control)} className="text-gray-400 hover:text-red-400 p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {control.children!.map((child) => (
            <ControlTreeItem key={child.id} control={child} level={level + 1} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComplianceFrameworksPage(): JSX.Element {
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFramework, setSelectedFramework] = useState<ComplianceFramework | null>(null);
  const [controlTree, setControlTree] = useState<ComplianceControl[]>([]);
  const [allControls, setAllControls] = useState<ComplianceControl[]>([]);
  const [frameworkModalOpen, setFrameworkModalOpen] = useState(false);
  const [controlModalOpen, setControlModalOpen] = useState(false);
  const [editingFramework, setEditingFramework] = useState<ComplianceFramework | null>(null);
  const [editingControl, setEditingControl] = useState<ComplianceControl | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'framework' | 'control'; id: string } | null>(null);
  const [mappingsCount, setMappingsCount] = useState<Record<string, number>>({});

  const loadFrameworks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await complianceFrameworksApi.list({ search: search || undefined });
      setFrameworks(result.frameworks);
      setTotal(result.total);

      // Load mappings count for each framework
      const counts: Record<string, number> = {};
      for (const fw of result.frameworks) {
        try {
          const countResult = await complianceFrameworksApi.getMappingsCount(fw.id);
          counts[fw.id] = countResult.count;
        } catch {
          counts[fw.id] = 0;
        }
      }
      setMappingsCount(counts);
    } catch (err) {
      console.error('Failed to load frameworks:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadFrameworks();
  }, [loadFrameworks]);

  const loadControlTree = async (frameworkId: string) => {
    try {
      const [treeResult, listResult] = await Promise.all([
        complianceFrameworksApi.getControlTree(frameworkId),
        complianceFrameworksApi.listControls(frameworkId, { limit: 500 }),
      ]);
      setControlTree(treeResult.controls);
      setAllControls(listResult.controls);
    } catch (err) {
      console.error('Failed to load controls:', err);
    }
  };

  const handleSelectFramework = async (framework: ComplianceFramework) => {
    setSelectedFramework(framework);
    await loadControlTree(framework.id);
  };

  const handleCreateFramework = () => {
    setEditingFramework(null);
    setFrameworkModalOpen(true);
  };

  const handleEditFramework = (framework: ComplianceFramework) => {
    setEditingFramework(framework);
    setFrameworkModalOpen(true);
  };

  const handleSaveFramework = async (data: CreateComplianceFrameworkData) => {
    if (editingFramework) {
      await complianceFrameworksApi.update(editingFramework.id, data);
    } else {
      await complianceFrameworksApi.create(data);
    }
    loadFrameworks();
  };

  const handleDeleteFramework = async (id: string) => {
    await complianceFrameworksApi.delete(id);
    setDeleteConfirm(null);
    if (selectedFramework?.id === id) {
      setSelectedFramework(null);
      setControlTree([]);
    }
    loadFrameworks();
  };

  const handleCreateControl = () => {
    setEditingControl(null);
    setControlModalOpen(true);
  };

  const handleEditControl = async (control: ComplianceControl) => {
    // Fetch full control with mappings
    try {
      const result = await complianceFrameworksApi.getControl(selectedFramework!.id, control.id);
      setEditingControl(result.control);
      setControlModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch control:', err);
    }
  };

  const handleSaveControl = async (data: CreateComplianceControlData) => {
    if (editingControl) {
      await complianceFrameworksApi.updateControl(selectedFramework!.id, editingControl.id, data);
    } else {
      await complianceFrameworksApi.createControl(selectedFramework!.id, data);
    }
    loadControlTree(selectedFramework!.id);
  };

  const handleDeleteControl = async (control: ComplianceControl) => {
    setDeleteConfirm({ type: 'control', id: control.id });
  };

  const confirmDeleteControl = async () => {
    if (deleteConfirm?.type === 'control') {
      await complianceFrameworksApi.deleteControl(selectedFramework!.id, deleteConfirm.id);
      setDeleteConfirm(null);
      loadControlTree(selectedFramework!.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Compliance Frameworks</h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage compliance frameworks, controls, and risk-to-control mappings.
          </p>
        </div>
        <button
          onClick={handleCreateFramework}
          className="inline-flex items-center px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Framework
        </button>
      </div>

      <div className="flex gap-6">
        {/* Framework List */}
        <div className="w-1/3">
          <input
            type="text"
            placeholder="Search frameworks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 mb-4 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
          />

          {loading ? (
            <div className="text-gray-400 text-center py-8">Loading...</div>
          ) : frameworks.length === 0 ? (
            <div className="text-gray-400 text-center py-8">No frameworks found</div>
          ) : (
            <div className="space-y-2">
              {frameworks.map((framework) => (
                <div
                  key={framework.id}
                  onClick={() => handleSelectFramework(framework)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedFramework?.id === framework.id
                      ? 'bg-purple-900/50 border border-purple-700'
                      : 'bg-gray-900 border border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white">{framework.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditFramework(framework); }}
                        className="text-gray-400 hover:text-white p-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'framework', id: framework.id }); }}
                        className="text-gray-400 hover:text-red-400 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 flex gap-3">
                    <span>v{framework.version}</span>
                    <span>{framework._count?.controls || 0} controls</span>
                    <span>{mappingsCount[framework.id] || 0} mappings</span>
                  </div>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded ${framework.isActive ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                      {framework.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Control Tree */}
        <div className="w-2/3">
          {selectedFramework ? (
            <div className="bg-gray-900 rounded-lg">
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <h2 className="text-lg font-medium text-white">{selectedFramework.name} Controls</h2>
                <button
                  onClick={handleCreateControl}
                  className="inline-flex items-center px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Control
                </button>
              </div>
              <div className="p-4 max-h-[600px] overflow-y-auto">
                {controlTree.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    No controls yet. Click &quot;Add Control&quot; to create one.
                  </div>
                ) : (
                  controlTree.map((control) => (
                    <ControlTreeItem
                      key={control.id}
                      control={control}
                      level={0}
                      onEdit={handleEditControl}
                      onDelete={handleDeleteControl}
                    />
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-white">Select a Framework</h3>
              <p className="mt-2 text-sm text-gray-400">Choose a framework from the list to view and manage its controls.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <FrameworkModal
        isOpen={frameworkModalOpen}
        framework={editingFramework}
        onClose={() => setFrameworkModalOpen(false)}
        onSave={handleSaveFramework}
      />
      {selectedFramework && (
        <ControlModal
          isOpen={controlModalOpen}
          frameworkId={selectedFramework.id}
          control={editingControl}
          parentControls={allControls}
          onClose={() => setControlModalOpen(false)}
          onSave={handleSaveControl}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-medium text-white mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-400 mb-4">
              Are you sure you want to delete this {deleteConfirm.type}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'framework') {
                    handleDeleteFramework(deleteConfirm.id);
                  } else {
                    confirmDeleteControl();
                  }
                }}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
