'use client';

import { useState, useEffect } from 'react';
import { tenantsApi, Tenant } from '@/lib/api';

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-700 text-gray-300',
  pro: 'bg-blue-900 text-blue-200',
  enterprise: 'bg-purple-900 text-purple-200',
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    plan: 'free' as 'free' | 'pro' | 'enterprise',
    maxUsers: 5,
    maxRepositories: 10,
    aiTriageEnabled: false,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      // Placeholder data for now
      setTenants([
        {
          id: '1',
          name: 'Acme Corp',
          slug: 'acme',
          plan: 'enterprise',
          maxUsers: 50,
          maxRepositories: 100,
          aiTriageEnabled: true,
          isActive: true,
          createdAt: '2024-01-15T00:00:00Z',
          stats: { userCount: 23, repositoryCount: 45, scanCount: 567, findingCount: 1234 },
        },
        {
          id: '2',
          name: 'StartupXYZ',
          slug: 'startupxyz',
          plan: 'pro',
          maxUsers: 20,
          maxRepositories: 50,
          aiTriageEnabled: true,
          isActive: true,
          createdAt: '2024-03-20T00:00:00Z',
          stats: { userCount: 8, repositoryCount: 12, scanCount: 234, findingCount: 890 },
        },
        {
          id: '3',
          name: 'Demo Tenant',
          slug: 'demo',
          plan: 'free',
          maxUsers: 5,
          maxRepositories: 10,
          aiTriageEnabled: false,
          isActive: true,
          createdAt: '2024-06-01T00:00:00Z',
          stats: { userCount: 2, repositoryCount: 3, scanCount: 45, findingCount: 123 },
        },
      ]);
    } catch (error) {
      console.error('Failed to load tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingTenant(null);
    setFormData({
      name: '',
      slug: '',
      plan: 'free',
      maxUsers: 5,
      maxRepositories: 10,
      aiTriageEnabled: false,
      isActive: true,
    });
    setShowModal(true);
  };

  const openEditModal = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      maxUsers: tenant.maxUsers,
      maxRepositories: tenant.maxRepositories,
      aiTriageEnabled: tenant.aiTriageEnabled,
      isActive: tenant.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingTenant) {
        // Update tenant
        await tenantsApi.update(editingTenant.id, formData);
      } else {
        // Create tenant
        await tenantsApi.create(formData);
      }
      setShowModal(false);
      loadTenants();
    } catch (error) {
      console.error('Failed to save tenant:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tenant: Tenant) => {
    if (!confirm(`Are you sure you want to delete "${tenant.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await tenantsApi.delete(tenant.id);
      loadTenants();
    } catch (error) {
      console.error('Failed to delete tenant:', error);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading tenants...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Tenants</h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage tenant organizations and their settings.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          Create Tenant
        </button>
      </div>

      {/* Tenants Table */}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-800">
          <thead>
            <tr className="bg-gray-800/50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Tenant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Usage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                AI Triage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-gray-800/30">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-white">{tenant.name}</div>
                    <div className="text-sm text-gray-400">{tenant.slug}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[tenant.plan]}`}>
                    {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  <div>{tenant.stats?.userCount || 0}/{tenant.maxUsers} users</div>
                  <div className="text-gray-500">{tenant.stats?.repositoryCount || 0}/{tenant.maxRepositories} repos</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {tenant.aiTriageEnabled ? (
                    <span className="text-green-400">Enabled</span>
                  ) : (
                    <span className="text-gray-500">Disabled</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {tenant.isActive ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-200">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-200">
                      Suspended
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => openEditModal(tenant)}
                    className="text-purple-400 hover:text-purple-300 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(tenant)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-lg font-medium text-white">
                {editingTenant ? 'Edit Tenant' : 'Create Tenant'}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      name: e.target.value,
                      slug: editingTenant ? formData.slug : generateSlug(e.target.value),
                    });
                  }}
                  className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  disabled={!!editingTenant}
                  className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Plan</label>
                <select
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
                  className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Max Users</label>
                  <input
                    type="number"
                    value={formData.maxUsers}
                    onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) })}
                    className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">Max Repositories</label>
                  <input
                    type="number"
                    value={formData.maxRepositories}
                    onChange={(e) => setFormData({ ...formData, maxRepositories: parseInt(e.target.value) })}
                    className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.aiTriageEnabled}
                    onChange={(e) => setFormData({ ...formData, aiTriageEnabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500 bg-gray-800"
                  />
                  <span className="ml-2 text-sm text-gray-300">AI Triage Enabled</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500 bg-gray-800"
                  />
                  <span className="ml-2 text-sm text-gray-300">Active</span>
                </label>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-800/50 flex justify-end space-x-3 rounded-b-lg">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.slug}
                className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingTenant ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
