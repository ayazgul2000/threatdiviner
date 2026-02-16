'use client';

import { useState, useEffect, useCallback } from 'react';
import { shapeMappingsApi, ShapeMapping, CreateShapeMappingData } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type StatusFilter = 'all' | 'pending' | 'review' | 'live';

const CATEGORIES = ['aws', 'azure', 'gcp', 'generic', 'kubernetes', 'network'];
const MACHINE_TYPES = ['physical', 'virtual', 'container', 'serverless'];
const ENCRYPTION_OPTIONS = ['none', 'transparent', 'data-with-symmetric-shared-key', 'data-with-asymmetric-shared-key', 'data-with-end-user-individual-key'];
const AUTH_OPTIONS = ['none', 'credentials', 'session-id', 'token', 'client-certificate', 'two-factor', 'externalized'];

interface EditModalProps {
  isOpen: boolean;
  mapping: ShapeMapping | null;
  onClose: () => void;
  onSave: (data: CreateShapeMappingData) => Promise<void>;
}

function EditModal({ isOpen, mapping, onClose, onSave }: EditModalProps): JSX.Element | null {
  const [formData, setFormData] = useState<CreateShapeMappingData>({
    drawioStyle: '',
    stylePattern: '',
    threagileType: '',
    machineType: 'virtual',
    defaultInternetFacing: false,
    defaultEncryption: 'none',
    defaultAuthentication: 'none',
    defaultMultiTenant: false,
    displayName: '',
    category: 'generic',
    iconUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mapping) {
      setFormData({
        drawioStyle: mapping.drawioStyle,
        stylePattern: mapping.stylePattern || '',
        threagileType: mapping.threagileType,
        machineType: mapping.machineType,
        defaultInternetFacing: mapping.defaultInternetFacing,
        defaultEncryption: mapping.defaultEncryption,
        defaultAuthentication: mapping.defaultAuthentication,
        defaultMultiTenant: mapping.defaultMultiTenant,
        displayName: mapping.displayName,
        category: mapping.category,
        iconUrl: mapping.iconUrl || '',
      });
    } else {
      setFormData({
        drawioStyle: '',
        stylePattern: '',
        threagileType: '',
        machineType: 'virtual',
        defaultInternetFacing: false,
        defaultEncryption: 'none',
        defaultAuthentication: 'none',
        defaultMultiTenant: false,
        displayName: '',
        category: 'generic',
        iconUrl: '',
      });
    }
    setError(null);
  }, [mapping, isOpen]);

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
      <div className="bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            {mapping ? 'Edit Shape Mapping' : 'Add Shape Mapping'}
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
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Draw.io Style *</label>
              <input
                type="text"
                value={formData.drawioStyle}
                onChange={(e) => setFormData({ ...formData, drawioStyle: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="mxgraph.aws4.ec2"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Style Pattern (regex)</label>
              <input
                type="text"
                value={formData.stylePattern}
                onChange={(e) => setFormData({ ...formData, stylePattern: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="mxgraph\.aws4\.ec2.*"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Display Name *</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="AWS EC2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                required
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Threagile Type *</label>
              <input
                type="text"
                value={formData.threagileType}
                onChange={(e) => setFormData({ ...formData, threagileType: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="web-server"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Machine Type</label>
              <select
                value={formData.machineType}
                onChange={(e) => setFormData({ ...formData, machineType: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
              >
                {MACHINE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Default Encryption</label>
              <select
                value={formData.defaultEncryption}
                onChange={(e) => setFormData({ ...formData, defaultEncryption: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
              >
                {ENCRYPTION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Default Authentication</label>
              <select
                value={formData.defaultAuthentication}
                onChange={(e) => setFormData({ ...formData, defaultAuthentication: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
              >
                {AUTH_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Icon URL</label>
              <input
                type="text"
                value={formData.iconUrl}
                onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-purple-500"
                placeholder="https://cdn.example.com/icons/ec2.svg"
              />
            </div>

            <div className="col-span-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.defaultInternetFacing}
                  onChange={(e) => setFormData({ ...formData, defaultInternetFacing: e.target.checked })}
                  className="rounded border-gray-700 bg-gray-800 text-purple-500 focus:ring-purple-500"
                />
                Internet Facing
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.defaultMultiTenant}
                  onChange={(e) => setFormData({ ...formData, defaultMultiTenant: e.target.checked })}
                  className="rounded border-gray-700 bg-gray-800 text-purple-500 focus:ring-purple-500"
                />
                Multi-Tenant
              </label>
            </div>
          </div>

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
  onImport: (mappings: CreateShapeMappingData[]) => Promise<void>;
}

function ImportModal({ isOpen, onClose, onImport }: ImportModalProps): JSX.Element | null {
  const [fileContent, setFileContent] = useState<CreateShapeMappingData[]>([]);
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
          const mappings = lines.slice(1).map((line) => {
            const values = line.split(',');
            const obj: Record<string, string | boolean> = {};
            headers.forEach((h, i) => {
              const val = values[i]?.trim() || '';
              if (h === 'defaultInternetFacing' || h === 'defaultMultiTenant') {
                obj[h] = val.toLowerCase() === 'true';
              } else {
                obj[h] = val;
              }
            });
            return obj as unknown as CreateShapeMappingData;
          });
          setFileContent(mappings);
          setError(null);
        } else {
          setError('Unsupported file format. Use .json or .csv');
        }
      } catch (err) {
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
          <h2 className="text-lg font-semibold text-white">Import Shape Mappings</h2>
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
                <span className="text-green-400">{fileContent.length}</span> mappings ready to import
              </p>
              <div className="mt-2 max-h-32 overflow-y-auto text-xs text-gray-400">
                {fileContent.slice(0, 5).map((m, i) => (
                  <div key={i}>{m.drawioStyle} → {m.threagileType}</div>
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
              {importing ? 'Importing...' : `Import ${fileContent.length} Mappings`}
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
    pending: '🔴',
    review: '🟡',
    live: '🟢',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${colors[status as keyof typeof colors] || colors.pending}`}>
      {icons[status as keyof typeof icons]} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function ShapeMappingsPage(): JSX.Element {
  const { admin } = useAuth();
  const [mappings, setMappings] = useState<ShapeMapping[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<ShapeMapping | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await shapeMappingsApi.list({
        search: search || undefined,
        category: categoryFilter || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setMappings(result.mappings);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load mappings:', err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const handleCreate = () => {
    setSelectedMapping(null);
    setEditModalOpen(true);
  };

  const handleEdit = (mapping: ShapeMapping) => {
    setSelectedMapping(mapping);
    setEditModalOpen(true);
  };

  const handleSave = async (data: CreateShapeMappingData) => {
    if (selectedMapping) {
      await shapeMappingsApi.update(selectedMapping.id, data);
    } else {
      await shapeMappingsApi.create(data);
    }
    loadMappings();
  };

  const handleDelete = async (id: string) => {
    await shapeMappingsApi.delete(id);
    setDeleteConfirm(null);
    loadMappings();
  };

  const handleSubmitForReview = async (id: string) => {
    await shapeMappingsApi.submitForReview(id);
    loadMappings();
  };

  const handleApprove = async (id: string) => {
    await shapeMappingsApi.approve(id);
    loadMappings();
  };

  const handleImport = async (data: CreateShapeMappingData[]) => {
    await shapeMappingsApi.bulkImport(data);
    loadMappings();
  };

  // Group mappings by category
  const groupedMappings = mappings.reduce<Record<string, ShapeMapping[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Shape Mappings</h1>
          <p className="mt-1 text-sm text-gray-400">
            Map Draw.io shape styles to Threagile technology types and default properties.
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
            Add Mapping
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
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat.toUpperCase()}</option>
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
          Showing {mappings.length} of {total}
        </div>
      </div>

      {/* Mappings List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading...</div>
        </div>
      ) : mappings.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-white">No shape mappings found</h3>
          <p className="mt-2 text-sm text-gray-400">
            Get started by adding a new mapping or importing from a file.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedMappings).map(([category, catMappings]) => (
            <div key={category} className="bg-gray-900 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
                <h3 className="text-sm font-medium text-gray-300">{category.toUpperCase()}</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-2">Draw.io Style</th>
                    <th className="px-4 py-2">Display Name</th>
                    <th className="px-4 py-2">Technology</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {catMappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm text-gray-300 font-mono">{mapping.drawioStyle}</td>
                      <td className="px-4 py-3 text-sm text-white">{mapping.displayName}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{mapping.threagileType}</td>
                      <td className="px-4 py-3"><StatusBadge status={mapping.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {mapping.status === 'pending' && (
                            <button
                              onClick={() => handleSubmitForReview(mapping.id)}
                              className="text-yellow-400 hover:text-yellow-300 text-xs"
                              title="Submit for Review"
                            >
                              Submit
                            </button>
                          )}
                          {mapping.status === 'review' && admin?.isSuperAdmin && (
                            <button
                              onClick={() => handleApprove(mapping.id)}
                              className="text-green-400 hover:text-green-300 text-xs"
                              title="Approve"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(mapping)}
                            className="text-gray-400 hover:text-white"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {deleteConfirm === mapping.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(mapping.id)}
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
                              onClick={() => setDeleteConfirm(mapping.id)}
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
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <EditModal
        isOpen={editModalOpen}
        mapping={selectedMapping}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSave}
      />
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImport}
      />
    </div>
  );
}
