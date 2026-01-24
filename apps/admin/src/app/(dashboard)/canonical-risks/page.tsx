'use client';

import { useState, useEffect, useCallback } from 'react';
import { canonicalRisksApi, CanonicalRisk, CanonicalRiskSource, CreateCanonicalRiskData, AddSourceData } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type StatusFilter = 'all' | 'pending' | 'review' | 'live';

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const SOURCES = ['threagile', 'cis', 'prowler', 'trivy', 'semgrep'];

interface EditModalProps {
  isOpen: boolean;
  risk: CanonicalRisk | null;
  onClose: () => void;
  onSave: (data: CreateCanonicalRiskData) => Promise<void>;
  onAddSource: (riskId: string, data: AddSourceData) => Promise<void>;
  onRemoveSource: (riskId: string, sourceId: string) => Promise<void>;
}

function EditModal({ isOpen, risk, onClose, onSave, onAddSource, onRemoveSource }: EditModalProps): JSX.Element | null {
  const [formData, setFormData] = useState<CreateCanonicalRiskData>({
    canonicalId: '',
    title: '',
    description: '',
    defaultSeverity: 'medium',
    cweId: '',
    cweName: '',
    capecIds: [],
    attackIds: [],
  });
  const [capecInput, setCapecInput] = useState('');
  const [attackInput, setAttackInput] = useState('');
  const [newSource, setNewSource] = useState<AddSourceData>({ source: 'threagile', sourceRuleId: '', sourceTitle: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (risk) {
      setFormData({
        canonicalId: risk.canonicalId,
        title: risk.title,
        description: risk.description || '',
        defaultSeverity: risk.defaultSeverity,
        cweId: risk.cweId || '',
        cweName: risk.cweName || '',
        capecIds: risk.capecIds || [],
        attackIds: risk.attackIds || [],
      });
      setCapecInput((risk.capecIds || []).join(', '));
      setAttackInput((risk.attackIds || []).join(', '));
    } else {
      setFormData({
        canonicalId: '',
        title: '',
        description: '',
        defaultSeverity: 'medium',
        cweId: '',
        cweName: '',
        capecIds: [],
        attackIds: [],
      });
      setCapecInput('');
      setAttackInput('');
    }
    setNewSource({ source: 'threagile', sourceRuleId: '', sourceTitle: '' });
    setError(null);
  }, [risk, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = {
        ...formData,
        capecIds: capecInput.split(',').map(s => s.trim()).filter(Boolean),
        attackIds: attackInput.split(',').map(s => s.trim()).filter(Boolean),
      };
      await onSave(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSource = async () => {
    if (!risk || !newSource.sourceRuleId) return;
    try {
      await onAddSource(risk.id, newSource);
      setNewSource({ source: 'threagile', sourceRuleId: '', sourceTitle: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source');
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    if (!risk) return;
    try {
      await onRemoveSource(risk.id, sourceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove source');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            {risk ? 'Edit Canonical Risk' : 'Add Canonical Risk'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Canonical ID *</label>
              <input
                type="text"
                value={formData.canonicalId}
                onChange={(e) => setFormData({ ...formData, canonicalId: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="public-storage-exposure"
                required
                disabled={!!risk}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="Public Cloud Storage Exposure"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="Detailed description of the canonical risk..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Default Severity *</label>
              <select
                value={formData.defaultSeverity}
                onChange={(e) => setFormData({ ...formData, defaultSeverity: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                required
              >
                {SEVERITIES.map((sev) => (
                  <option key={sev} value={sev}>{sev.charAt(0).toUpperCase() + sev.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">CWE ID</label>
              <input
                type="text"
                value={formData.cweId}
                onChange={(e) => setFormData({ ...formData, cweId: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="732"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">CWE Name</label>
              <input
                type="text"
                value={formData.cweName}
                onChange={(e) => setFormData({ ...formData, cweName: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="Incorrect Permission Assignment for Critical Resource"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">CAPEC IDs (comma-separated)</label>
              <input
                type="text"
                value={capecInput}
                onChange={(e) => setCapecInput(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="1, 122"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">ATT&CK Techniques (comma-separated)</label>
              <input
                type="text"
                value={attackInput}
                onChange={(e) => setAttackInput(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="T1530, T1567"
              />
            </div>
          </div>

          {/* Source Mappings Section - only for editing existing risks */}
          {risk && (
            <div className="border-t border-gray-800 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Source Mappings</h3>
              </div>

              {risk.sources && risk.sources.length > 0 && (
                <div className="bg-gray-800 rounded mb-3 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-400 uppercase">
                        <th className="px-3 py-2">Source</th>
                        <th className="px-3 py-2">Rule ID</th>
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {risk.sources.map((source) => (
                        <tr key={source.id}>
                          <td className="px-3 py-2 text-gray-300">{source.source}</td>
                          <td className="px-3 py-2 text-gray-300 font-mono text-xs">{source.sourceRuleId}</td>
                          <td className="px-3 py-2 text-gray-400">{source.sourceTitle || '-'}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveSource(source.id)}
                              className="text-red-400 hover:text-red-300"
                            >
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

              <div className="flex gap-2 items-end">
                <div className="w-32">
                  <label className="block text-xs text-gray-400 mb-1">Source</label>
                  <select
                    value={newSource.source}
                    onChange={(e) => setNewSource({ ...newSource, source: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    {SOURCES.map((src) => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Rule ID</label>
                  <input
                    type="text"
                    value={newSource.sourceRuleId}
                    onChange={(e) => setNewSource({ ...newSource, sourceRuleId: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                    placeholder="s3_bucket_public_access"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Title (optional)</label>
                  <input
                    type="text"
                    value={newSource.sourceTitle}
                    onChange={(e) => setNewSource({ ...newSource, sourceTitle: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                    placeholder="S3 Bucket Public Access"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddSource}
                  disabled={!newSource.sourceRuleId}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (risks: CreateCanonicalRiskData[]) => Promise<void>;
}

function ImportModal({ isOpen, onClose, onImport }: ImportModalProps): JSX.Element | null {
  const [fileContent, setFileContent] = useState<CreateCanonicalRiskData[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          setFileContent(Array.isArray(parsed) ? parsed : [parsed]);
          setError(null);
        } else if (file.name.endsWith('.csv')) {
          const lines = content.split('\n').filter(Boolean);
          const headers = lines[0].split(',').map((h) => h.trim());
          const risks = lines.slice(1).map((line) => {
            const values = line.split(',');
            const obj: Record<string, string | string[]> = {};
            headers.forEach((h, i) => {
              const val = values[i]?.trim() || '';
              if (h === 'capecIds' || h === 'attackIds') {
                obj[h] = val ? val.split(';').map(s => s.trim()) : [];
              } else {
                obj[h] = val;
              }
            });
            return obj as unknown as CreateCanonicalRiskData;
          });
          setFileContent(risks);
          setError(null);
        } else {
          setError('Unsupported file format. Use .json or .csv');
        }
      } catch {
        setError('Failed to parse file');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (fileContent.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      await onImport(fileContent);
      onClose();
      setFileContent([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 rounded-lg w-full max-w-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Import Canonical Risks</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".json,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="import-file"
            />
            <label htmlFor="import-file" className="cursor-pointer">
              <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mt-2 text-sm text-gray-400">Drop file here or click to browse</p>
              <p className="text-xs text-gray-500">Supported: .csv, .json</p>
            </label>
          </div>

          {fileContent.length > 0 && (
            <div className="bg-gray-800 rounded p-3">
              <p className="text-sm text-gray-300">
                <span className="text-green-400">{fileContent.length}</span> risks ready to import
              </p>
              <div className="mt-2 max-h-32 overflow-y-auto text-xs text-gray-400">
                {fileContent.slice(0, 5).map((r, i) => (
                  <div key={i}>{r.canonicalId}: {r.title}</div>
                ))}
                {fileContent.length > 5 && <div>...and {fileContent.length - 5} more</div>}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={() => { onClose(); setFileContent([]); }}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || fileContent.length === 0}
              className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${fileContent.length} Risks`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const colors = {
    pending: 'bg-red-900/50 text-red-400 border-red-700',
    review: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
    live: 'bg-green-900/50 text-green-400 border-green-700',
  };
  const icons = {
    pending: '',
    review: '',
    live: '',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${colors[status as keyof typeof colors] || colors.pending}`}>
      {icons[status as keyof typeof icons]} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }): JSX.Element {
  const colors = {
    low: 'bg-blue-900/50 text-blue-400 border-blue-700',
    medium: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
    high: 'bg-orange-900/50 text-orange-400 border-orange-700',
    critical: 'bg-red-900/50 text-red-400 border-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${colors[severity as keyof typeof colors] || colors.medium}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

export default function CanonicalRisksPage(): JSX.Element {
  const { admin } = useAuth();
  const [risks, setRisks] = useState<CanonicalRisk[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<CanonicalRisk | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);

  const loadRisks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await canonicalRisksApi.list({
        search: search || undefined,
        source: sourceFilter || undefined,
        severity: severityFilter || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setRisks(result.risks);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load risks:', err);
    } finally {
      setLoading(false);
    }
  }, [search, sourceFilter, severityFilter, statusFilter]);

  useEffect(() => {
    loadRisks();
  }, [loadRisks]);

  const handleCreate = () => {
    setSelectedRisk(null);
    setEditModalOpen(true);
  };

  const handleEdit = async (risk: CanonicalRisk) => {
    // Fetch full risk data with sources
    try {
      const result = await canonicalRisksApi.get(risk.id);
      setSelectedRisk(result.risk);
      setEditModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch risk:', err);
    }
  };

  const handleSave = async (data: CreateCanonicalRiskData) => {
    if (selectedRisk) {
      await canonicalRisksApi.update(selectedRisk.id, data);
    } else {
      await canonicalRisksApi.create(data);
    }
    loadRisks();
  };

  const handleAddSource = async (riskId: string, data: AddSourceData) => {
    await canonicalRisksApi.addSource(riskId, data);
    // Refresh the selected risk
    const result = await canonicalRisksApi.get(riskId);
    setSelectedRisk(result.risk);
    loadRisks();
  };

  const handleRemoveSource = async (riskId: string, sourceId: string) => {
    await canonicalRisksApi.removeSource(riskId, sourceId);
    // Refresh the selected risk
    const result = await canonicalRisksApi.get(riskId);
    setSelectedRisk(result.risk);
    loadRisks();
  };

  const handleDelete = async (id: string) => {
    await canonicalRisksApi.delete(id);
    setDeleteConfirm(null);
    loadRisks();
  };

  const handleSubmitForReview = async (id: string) => {
    await canonicalRisksApi.submitForReview(id);
    loadRisks();
  };

  const handleApprove = async (id: string) => {
    await canonicalRisksApi.approve(id);
    loadRisks();
  };

  const handleImport = async (data: CreateCanonicalRiskData[]) => {
    await canonicalRisksApi.bulkImport(data);
    loadRisks();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Canonical Risks</h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage deduplication rules that consolidate overlapping risks from different sources.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-md"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import
          </button>
          <button
            onClick={handleCreate}
            className="inline-flex items-center px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Risk
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500 w-64"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="">All Sources</option>
          {SOURCES.map((src) => (
            <option key={src} value={src}>{src}</option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="">All Severities</option>
          {SEVERITIES.map((sev) => (
            <option key={sev} value={sev}>{sev.charAt(0).toUpperCase() + sev.slice(1)}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="review">Review</option>
          <option value="live">Live</option>
        </select>
        <div className="text-sm text-gray-400 flex items-center">
          Showing {risks.length} of {total}
        </div>
      </div>

      {/* Risks List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading...</div>
        </div>
      ) : risks.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-white">No canonical risks found</h3>
          <p className="mt-2 text-sm text-gray-400">
            Get started by adding a new canonical risk or importing from a file.
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-800">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Canonical ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">CWE</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Sources</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {risks.map((risk) => (
                <>
                  <tr key={risk.id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedRisk(expandedRisk === risk.id ? null : risk.id)}
                        className="text-gray-400 hover:text-white"
                      >
                        <svg className={`w-4 h-4 transition-transform ${expandedRisk === risk.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300 font-mono">{risk.canonicalId}</td>
                    <td className="px-4 py-3 text-sm text-white">{risk.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{risk.cweId || '-'}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={risk.defaultSeverity} /></td>
                    <td className="px-4 py-3 text-sm text-gray-400">{risk._count?.sources || 0}</td>
                    <td className="px-4 py-3"><StatusBadge status={risk.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {risk.status === 'pending' && (
                          <button
                            onClick={() => handleSubmitForReview(risk.id)}
                            className="text-yellow-400 hover:text-yellow-300 text-xs"
                            title="Submit for Review"
                          >
                            Submit
                          </button>
                        )}
                        {risk.status === 'review' && admin?.isSuperAdmin && (
                          <button
                            onClick={() => handleApprove(risk.id)}
                            className="text-green-400 hover:text-green-300 text-xs"
                            title="Approve"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(risk)}
                          className="text-gray-400 hover:text-white"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {deleteConfirm === risk.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(risk.id)}
                              className="text-red-400 hover:text-red-300 text-xs"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-gray-400 hover:text-white text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(risk.id)}
                            className="text-gray-400 hover:text-red-400"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Expanded row showing sources */}
                  {expandedRisk === risk.id && (
                    <tr key={`${risk.id}-expanded`}>
                      <td colSpan={8} className="px-4 py-3 bg-gray-800/50">
                        <div className="pl-8">
                          {risk.description && (
                            <p className="text-sm text-gray-400 mb-3">{risk.description}</p>
                          )}
                          <div className="flex gap-4 text-xs text-gray-400 mb-3">
                            {risk.cweId && <span>CWE: {risk.cweId} - {risk.cweName}</span>}
                            {risk.capecIds.length > 0 && <span>CAPEC: {risk.capecIds.join(', ')}</span>}
                            {risk.attackIds.length > 0 && <span>ATT&CK: {risk.attackIds.join(', ')}</span>}
                          </div>
                          {risk.sources && risk.sources.length > 0 ? (
                            <div>
                              <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">Source Mappings</h4>
                              <div className="flex flex-wrap gap-2">
                                {risk.sources.map((src) => (
                                  <span key={src.id} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                                    {src.source}: {src.sourceRuleId}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">No source mappings configured</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <EditModal
        isOpen={editModalOpen}
        risk={selectedRisk}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSave}
        onAddSource={handleAddSource}
        onRemoveSource={handleRemoveSource}
      />
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImport}
      />
    </div>
  );
}
