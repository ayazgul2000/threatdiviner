'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/contexts/project-context';
import { API_URL } from '@/lib/api';
import {
  Crosshair,
  Plus,
  Search,
  ExternalLink,
  MoreHorizontal,
  Play,
  Settings,
  Trash2,
  Globe,
  Server,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
} from 'lucide-react';

interface Target {
  id: string;
  name: string;
  url: string;
  type: 'web_application' | 'api_endpoint' | 'network_service';
  lastScan?: {
    id: string;
    status: string;
    completedAt?: string;
    findingsCount?: number;
  };
  riskScore?: number;
  createdAt: string;
}

const TARGET_TYPE_ICONS = {
  web_application: Globe,
  api_endpoint: Server,
  network_service: Shield,
};

const TARGET_TYPE_LABELS = {
  web_application: 'Web Application',
  api_endpoint: 'API Endpoint',
  network_service: 'Network Service',
};

function getRiskScoreColor(score?: number) {
  if (score === undefined || score === null) return 'text-slate-400';
  if (score >= 80) return 'text-red-500';
  if (score >= 60) return 'text-orange-500';
  if (score >= 40) return 'text-yellow-500';
  if (score >= 20) return 'text-blue-500';
  return 'text-green-500';
}

function getRiskScoreLabel(score?: number) {
  if (score === undefined || score === null) return 'Not Scanned';
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Minimal';
}

export default function TargetsPage() {
  const router = useRouter();
  const { currentProject } = useProject();
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionMenuTarget, setActionMenuTarget] = useState<string | null>(null);

  // Add Target form state
  const [newTarget, setNewTarget] = useState({
    name: '',
    url: '',
    type: 'web_application' as Target['type'],
    description: '',
  });
  const [addingTarget, setAddingTarget] = useState(false);

  useEffect(() => {
    if (currentProject?.id) {
      loadTargets();
    }
  }, [currentProject?.id]);

  const loadTargets = async () => {
    if (!currentProject?.id) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/targets?projectId=${currentProject.id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTargets(data || []);
      } else {
        setTargets([]);
      }
    } catch (error) {
      console.error('Failed to load targets:', error);
      // For now, show empty state - API endpoint may not exist yet
      setTargets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject?.id) return;

    setAddingTarget(true);
    try {
      const res = await fetch(`${API_URL}/targets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTarget,
          projectId: currentProject.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTargets([data, ...targets]);
        setShowAddModal(false);
        setNewTarget({ name: '', url: '', type: 'web_application', description: '' });
      } else {
        throw new Error('Failed to add target');
      }
    } catch (error) {
      console.error('Failed to add target:', error);
      alert('Failed to add target. Please try again.');
    } finally {
      setAddingTarget(false);
    }
  };

  const handleDeleteTarget = async (targetId: string) => {
    if (!confirm('Are you sure you want to delete this target? This action cannot be undone.')) {
      return;
    }

    try {
      await fetch(`${API_URL}/targets/${targetId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setTargets(targets.filter(t => t.id !== targetId));
    } catch (error) {
      console.error('Failed to delete target:', error);
      alert('Failed to delete target. Please try again.');
    }
    setActionMenuTarget(null);
  };

  const handleStartScan = (targetId: string) => {
    router.push(`/dashboard/targets/${targetId}?action=scan`);
    setActionMenuTarget(null);
  };

  const filteredTargets = targets.filter(target =>
    target.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    target.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Targets</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage web applications, APIs, and network services for DAST scanning
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Target
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search targets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Targets Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredTargets.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
          <Crosshair className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            {searchQuery ? 'No targets found' : 'No targets yet'}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4 max-w-md mx-auto">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Add your first target to start scanning web applications, APIs, and network services for vulnerabilities.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Your First Target
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Last Scan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Risk Score
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredTargets.map((target) => {
                const TypeIcon = TARGET_TYPE_ICONS[target.type];
                return (
                  <tr
                    key={target.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                    onClick={() => router.push(`/dashboard/targets/${target.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {target.name}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                          <span className="truncate max-w-xs">{target.url}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                          {TARGET_TYPE_LABELS[target.type]}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {target.lastScan ? (
                        <div className="flex items-center gap-2">
                          {target.lastScan.status === 'completed' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : target.lastScan.status === 'failed' ? (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          ) : (
                            <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
                          )}
                          <span className="text-sm text-slate-600 dark:text-slate-300">
                            {target.lastScan.completedAt
                              ? new Date(target.lastScan.completedAt).toLocaleDateString()
                              : 'In Progress'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Never</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`font-medium ${getRiskScoreColor(target.riskScore)}`}>
                        {target.riskScore !== undefined ? (
                          <>
                            {target.riskScore}
                            <span className="text-xs ml-1 text-slate-400">
                              ({getRiskScoreLabel(target.riskScore)})
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActionMenuTarget(actionMenuTarget === target.id ? null : target.id)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600"
                        >
                          <MoreHorizontal className="w-5 h-5 text-slate-400" />
                        </button>
                        {actionMenuTarget === target.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10">
                            <button
                              onClick={() => handleStartScan(target.id)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              <Play className="w-4 h-4" />
                              Start Scan
                            </button>
                            <button
                              onClick={() => {
                                router.push(`/dashboard/targets/${target.id}/settings`);
                                setActionMenuTarget(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              <Settings className="w-4 h-4" />
                              Settings
                            </button>
                            <hr className="my-1 border-slate-200 dark:border-slate-700" />
                            <button
                              onClick={() => handleDeleteTarget(target.id)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Target Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add Target</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddTarget} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={newTarget.name}
                  onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
                  placeholder="My Web App"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  URL *
                </label>
                <input
                  type="url"
                  required
                  value={newTarget.url}
                  onChange={(e) => setNewTarget({ ...newTarget, url: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Type *
                </label>
                <select
                  value={newTarget.type}
                  onChange={(e) => setNewTarget({ ...newTarget, type: e.target.value as Target['type'] })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="web_application">Web Application</option>
                  <option value="api_endpoint">API Endpoint</option>
                  <option value="network_service">Network Service</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newTarget.description}
                  onChange={(e) => setNewTarget({ ...newTarget, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTarget}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {addingTarget ? 'Adding...' : 'Add Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
