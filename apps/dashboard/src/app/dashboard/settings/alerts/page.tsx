'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { SkeletonList } from '@/components/ui/skeleton';
import { ApiError } from '@/components/ui/api-error';
import { useFetch, useMutation, API_URL } from '@/hooks';

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  eventTypes: string[];
  severities: string[];
  notifySlack: boolean;
  notifyEmail: boolean;
  threshold: number;
  timeWindowMinutes: number;
  enabled: boolean;
  lastTriggeredAt?: string;
  triggerCount?: number;
  createdAt: string;
}

const EVENT_TYPES = [
  { value: 'finding.created', label: 'New Finding Created' },
  { value: 'finding.status_change', label: 'Finding Status Changed' },
  { value: 'scan.completed', label: 'Scan Completed' },
  { value: 'scan.failed', label: 'Scan Failed' },
  { value: 'sla.breach', label: 'SLA Breach' },
  { value: 'sla.warning', label: 'SLA Warning' },
];

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export default function AlertRulesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    eventTypes: ['finding.created'],
    severities: ['CRITICAL', 'HIGH'],
    notifySlack: false,
    notifyEmail: true,
    threshold: 1,
    timeWindowMinutes: 5,
  });

  const { data: rules, loading, error, refetch } = useFetch<AlertRule[]>('/alerts/rules');

  const { mutate: createRule, loading: creating } = useMutation<AlertRule>(
    '/alerts/rules',
    'POST',
    {
      onSuccess: () => {
        setShowCreateModal(false);
        resetForm();
        refetch();
      },
    },
  );

  const { mutate: updateRule, loading: updating } = useMutation<AlertRule>(
    editingRule ? `/alerts/rules/${editingRule.id}` : '/alerts/rules',
    'PUT',
    {
      onSuccess: () => {
        setShowCreateModal(false);
        resetForm();
        refetch();
      },
    },
  );

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      eventTypes: ['finding.created'],
      severities: ['CRITICAL', 'HIGH'],
      notifySlack: false,
      notifyEmail: true,
      threshold: 1,
      timeWindowMinutes: 5,
    });
    setEditingRule(null);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`${API_URL}/alerts/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ enabled }),
    });
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alert rule?')) return;
    await fetch(`${API_URL}/alerts/rules/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    refetch();
  };

  const handleTest = async (id: string) => {
    const res = await fetch(`${API_URL}/alerts/rules/${id}/test`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      alert('Test alert sent successfully!');
    } else {
      alert('Failed to send test alert');
    }
  };

  const handleSave = () => {
    if (editingRule) {
      updateRule(formData);
    } else {
      createRule(formData);
    }
  };

  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      eventTypes: rule.eventTypes || ['finding.created'],
      severities: rule.severities || ['CRITICAL', 'HIGH'],
      notifySlack: rule.notifySlack ?? false,
      notifyEmail: rule.notifyEmail ?? true,
      threshold: rule.threshold || 1,
      timeWindowMinutes: rule.timeWindowMinutes || 5,
    });
    setShowCreateModal(true);
  };

  const toggleEventType = (eventType: string) => {
    setFormData(prev => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(eventType)
        ? prev.eventTypes.filter(e => e !== eventType)
        : [...prev.eventTypes, eventType],
    }));
  };

  const toggleSeverity = (severity: string) => {
    setFormData(prev => ({
      ...prev,
      severities: prev.severities.includes(severity)
        ? prev.severities.filter(s => s !== severity)
        : [...prev.severities, severity],
    }));
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 rounded mt-2 animate-pulse" />
        </div>
        <SkeletonList items={5} />
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
        title="Alert Rules"
        description="Configure notifications for security events"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Rule
          </Button>
        }
      />

      <div className="space-y-4">
        {rules?.map((rule) => (
          <div key={rule.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <svg
                  className={`w-5 h-5 ${rule.enabled ? 'text-green-500' : 'text-gray-400'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{rule.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {rule.description || 'No description'}
                  </p>
                  <div className="flex gap-2 mt-1">
                    {rule.notifyEmail && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Email</span>
                    )}
                    {rule.notifySlack && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Slack</span>
                    )}
                    <span className="text-xs text-gray-500">
                      Cooldown: {rule.timeWindowMinutes}min
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleToggle(rule.id, !rule.enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    rule.enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      rule.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <Button variant="ghost" size="sm" onClick={() => handleTest(rule.id)} title="Test">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {rule.severities?.map((sev) => (
                <span
                  key={sev}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    sev === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                    sev === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                    sev === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {sev}
                </span>
              ))}
              {rule.eventTypes?.map((evt) => (
                <span
                  key={evt}
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                >
                  {evt}
                </span>
              ))}
            </div>

            {(rule.lastTriggeredAt || rule.triggerCount) && (
              <p className="mt-3 text-xs text-gray-400">
                {rule.lastTriggeredAt && `Last triggered: ${new Date(rule.lastTriggeredAt).toLocaleString()}`}
                {rule.triggerCount !== undefined && ` | Total triggers: ${rule.triggerCount}`}
              </p>
            )}
          </div>
        ))}

        {rules?.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
            No alert rules configured. Create one to get notified about security events.
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              {editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Critical Finding Alert"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe when this alert should fire"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Trigger on Events
                </label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map((evt) => (
                    <label
                      key={evt.value}
                      className={`inline-flex items-center px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                        formData.eventTypes.includes(evt.value)
                          ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400'
                          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={formData.eventTypes.includes(evt.value)}
                        onChange={() => toggleEventType(evt.value)}
                      />
                      {evt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Trigger on Severities (for findings)
                </label>
                <div className="flex flex-wrap gap-2">
                  {SEVERITIES.map((sev) => (
                    <label
                      key={sev}
                      className={`inline-flex items-center px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                        formData.severities.includes(sev)
                          ? sev === 'CRITICAL' ? 'bg-red-100 border-red-500 text-red-700' :
                            sev === 'HIGH' ? 'bg-orange-100 border-orange-500 text-orange-700' :
                            sev === 'MEDIUM' ? 'bg-yellow-100 border-yellow-500 text-yellow-700' :
                            'bg-gray-100 border-gray-500 text-gray-700'
                          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={formData.severities.includes(sev)}
                        onChange={() => toggleSeverity(sev)}
                      />
                      {sev}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notification Channels
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.notifyEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, notifyEmail: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Email (sends to tenant admin email)
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.notifySlack}
                      onChange={(e) => setFormData(prev => ({ ...prev, notifySlack: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Slack (configure webhook in Settings &gt; Notifications)
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Threshold
                  </label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.threshold}
                    onChange={(e) => setFormData(prev => ({ ...prev, threshold: parseInt(e.target.value) || 1 }))}
                    min={1}
                  />
                  <p className="text-xs text-gray-500 mt-1">Events before triggering</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cooldown (minutes)
                  </label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={formData.timeWindowMinutes}
                    onChange={(e) => setFormData(prev => ({ ...prev, timeWindowMinutes: parseInt(e.target.value) || 5 }))}
                    min={1}
                  />
                  <p className="text-xs text-gray-500 mt-1">Min time between alerts</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={creating || updating || !formData.name}
              >
                {creating || updating ? 'Saving...' : editingRule ? 'Save Changes' : 'Create Rule'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
