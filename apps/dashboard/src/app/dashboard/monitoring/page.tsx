'use client';

import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Settings, Activity, Plus, Trash2, Edit, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import { useProject } from '@/contexts/project-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  severity: string[];
  scanners?: string[];
  conditions: any;
  actions: AlertAction[];
  createdAt: string;
  lastTriggeredAt?: string;
  triggerCount: number;
}

interface AlertAction {
  type: 'email' | 'slack' | 'webhook' | 'pagerduty';
  config: any;
}

interface AlertHistory {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: string;
  message: string;
  status: 'sent' | 'failed' | 'acknowledged';
  createdAt: string;
  acknowledgedAt?: string;
}

export default function MonitoringPage() {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState<'rules' | 'history' | 'settings'>('rules');
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
    severities: ['critical', 'high'],
    actionType: 'email' as 'email' | 'slack' | 'webhook' | 'pagerduty',
    actionConfig: '',
  });

  useEffect(() => {
    if (currentProject) {
      fetchData();
    }
  }, [currentProject]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/alerts/rules?projectId=${currentProject?.id}`, { credentials: 'include' }),
        fetch(`${API_URL}/alerts/history?projectId=${currentProject?.id}&limit=50`, { credentials: 'include' }),
      ]);

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(Array.isArray(rulesData) ? rulesData : rulesData.rules || []);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(Array.isArray(historyData) ? historyData : historyData.alerts || []);
      }
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    try {
      const res = await fetch(`${API_URL}/alerts/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: currentProject?.id,
          name: formData.name,
          description: formData.description,
          enabled: formData.enabled,
          severity: formData.severities,
          conditions: { severityIn: formData.severities },
          actions: [{
            type: formData.actionType,
            config: formData.actionType === 'email'
              ? { recipients: formData.actionConfig.split(',').map(e => e.trim()) }
              : formData.actionType === 'slack'
              ? { webhookUrl: formData.actionConfig }
              : { url: formData.actionConfig }
          }],
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        resetForm();
        fetchData();
      }
    } catch (err) {
      console.error('Failed to create rule:', err);
    }
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;
    try {
      const res = await fetch(`${API_URL}/alerts/rules/${editingRule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          enabled: formData.enabled,
          severity: formData.severities,
          conditions: { severityIn: formData.severities },
          actions: [{
            type: formData.actionType,
            config: formData.actionType === 'email'
              ? { recipients: formData.actionConfig.split(',').map(e => e.trim()) }
              : formData.actionType === 'slack'
              ? { webhookUrl: formData.actionConfig }
              : { url: formData.actionConfig }
          }],
        }),
      });

      if (res.ok) {
        setEditingRule(null);
        resetForm();
        fetchData();
      }
    } catch (err) {
      console.error('Failed to update rule:', err);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      const res = await fetch(`${API_URL}/alerts/rules/${ruleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleToggleRule = async (rule: AlertRule) => {
    try {
      const res = await fetch(`${API_URL}/alerts/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !rule.enabled }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      const res = await fetch(`${API_URL}/alerts/history/${alertId}/acknowledge`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      enabled: true,
      severities: ['critical', 'high'],
      actionType: 'email',
      actionConfig: '',
    });
  };

  const openEditModal = (rule: AlertRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      enabled: rule.enabled,
      severities: rule.severity,
      actionType: rule.actions[0]?.type || 'email',
      actionConfig: rule.actions[0]?.type === 'email'
        ? (rule.actions[0]?.config?.recipients || []).join(', ')
        : rule.actions[0]?.config?.webhookUrl || rule.actions[0]?.config?.url || '',
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'acknowledged': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const filteredHistory = severityFilter === 'all'
    ? history
    : history.filter(h => h.severity === severityFilter);

  if (!currentProject) {
    return (
      <div className="p-6">
        <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
          <Bell className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Select a Project
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Please select a project to view monitoring settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Monitoring</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Real-time security monitoring, alerts, and automated responses
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Alert Rule
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex space-x-8">
          {[
            { id: 'rules', label: 'Alert Rules', icon: Settings },
            { id: 'history', label: 'Alert History', icon: Bell },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-slate-100 dark:bg-slate-800 h-24 rounded-lg" />
          ))}
        </div>
      ) : activeTab === 'rules' ? (
        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
              <AlertTriangle className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                No Alert Rules
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Create your first alert rule to get notified about security findings
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Alert Rule
              </button>
            </div>
          ) : (
            rules.map(rule => (
              <div
                key={rule.id}
                className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleToggleRule(rule)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        rule.enabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">{rule.name}</h4>
                      {rule.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">{rule.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openEditModal(rule)}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-2 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <span className="text-slate-500 dark:text-slate-400">Severities:</span>
                    {rule.severity.map(sev => (
                      <span key={sev} className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(sev)}`}>
                        {sev}
                      </span>
                    ))}
                  </div>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-slate-500 dark:text-slate-400">Actions:</span>
                    {rule.actions.map((action, i) => (
                      <span key={i} className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {action.type}
                      </span>
                    ))}
                  </div>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Triggered {rule.triggerCount} times
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center space-x-4">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
              <Activity className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                No Alert History
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Alert history will appear here when alerts are triggered
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Severity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rule</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Message</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredHistory.map(alert => (
                    <tr key={alert.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {getStatusIcon(alert.status)}
                          <span className="ml-2 text-sm text-slate-600 dark:text-slate-400 capitalize">
                            {alert.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">
                        {alert.ruleName}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {alert.message}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                        {new Date(alert.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {alert.status !== 'acknowledged' && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          >
                            Acknowledge
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingRule) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  placeholder="Critical vulnerability alert"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  placeholder="Alert when critical vulnerabilities are found"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Trigger on Severities
                </label>
                <div className="flex flex-wrap gap-2">
                  {['critical', 'high', 'medium', 'low'].map(sev => (
                    <button
                      key={sev}
                      onClick={() => {
                        const newSeverities = formData.severities.includes(sev)
                          ? formData.severities.filter(s => s !== sev)
                          : [...formData.severities, sev];
                        setFormData({ ...formData, severities: newSeverities });
                      }}
                      className={`px-3 py-1 rounded-lg text-sm capitalize transition-colors ${
                        formData.severities.includes(sev)
                          ? getSeverityColor(sev)
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notification Type
                </label>
                <select
                  value={formData.actionType}
                  onChange={(e) => setFormData({ ...formData, actionType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="email">Email</option>
                  <option value="slack">Slack Webhook</option>
                  <option value="webhook">Custom Webhook</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {formData.actionType === 'email' ? 'Email Recipients' : 'Webhook URL'}
                </label>
                <input
                  type="text"
                  value={formData.actionConfig}
                  onChange={(e) => setFormData({ ...formData, actionConfig: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  placeholder={formData.actionType === 'email' ? 'user@example.com, admin@example.com' : 'https://...'}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="enabled" className="ml-2 text-sm text-slate-700 dark:text-slate-300">
                  Enable this rule
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingRule(null);
                  resetForm();
                }}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={editingRule ? handleUpdateRule : handleCreateRule}
                disabled={!formData.name || formData.severities.length === 0 || !formData.actionConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
