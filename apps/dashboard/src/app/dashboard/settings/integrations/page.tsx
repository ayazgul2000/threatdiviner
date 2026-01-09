'use client';

import { useState, useEffect } from 'react';
import {
  Plug,
  Github,
  GitBranch,
  MessageSquare,
  Bell,
  Webhook,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  Trash2,
  ExternalLink,
  Plus,
  AlertTriangle,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type IntegrationType = 'github' | 'gitlab' | 'bitbucket' | 'azure-devops' | 'slack' | 'pagerduty' | 'webhook' | 'jira';
type IntegrationCategory = 'scm' | 'notification' | 'ticketing' | 'cicd';
type IntegrationStatus = 'connected' | 'error' | 'pending' | 'disabled';

interface Integration {
  id: string;
  type: IntegrationType;
  name: string;
  status: IntegrationStatus;
  config?: Record<string, unknown>;
  lastSync?: string;
  errorMessage?: string;
  createdAt: string;
}

interface IntegrationTemplate {
  type: IntegrationType;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: IntegrationCategory;
  available: boolean;
  configFields: ConfigField[];
}

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select' | 'textarea';
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  helpText?: string;
}

const templates: IntegrationTemplate[] = [
  // SCM
  {
    type: 'github',
    name: 'GitHub',
    description: 'Connect repositories and scan code for vulnerabilities',
    icon: <Github className="w-6 h-6" />,
    category: 'scm',
    available: true,
    configFields: [
      { key: 'installationId', label: 'Installation ID', type: 'text', placeholder: 'GitHub App Installation ID', required: true },
      { key: 'appId', label: 'App ID', type: 'text', placeholder: 'GitHub App ID', required: true },
      { key: 'privateKey', label: 'Private Key', type: 'textarea', placeholder: '-----BEGIN RSA PRIVATE KEY-----...', required: true },
    ],
  },
  {
    type: 'gitlab',
    name: 'GitLab',
    description: 'Scan GitLab repositories for security issues',
    icon: <GitBranch className="w-6 h-6" />,
    category: 'scm',
    available: true,
    configFields: [
      { key: 'url', label: 'GitLab URL', type: 'url', placeholder: 'https://gitlab.com', required: true },
      { key: 'accessToken', label: 'Personal Access Token', type: 'password', placeholder: 'glpat-...', required: true, helpText: 'Requires api, read_repository scopes' },
    ],
  },
  {
    type: 'bitbucket',
    name: 'Bitbucket',
    description: 'Connect Bitbucket Cloud repositories',
    icon: <GitBranch className="w-6 h-6" />,
    category: 'scm',
    available: true,
    configFields: [
      { key: 'workspace', label: 'Workspace', type: 'text', placeholder: 'your-workspace', required: true },
      { key: 'appPassword', label: 'App Password', type: 'password', placeholder: 'App password with repository read access', required: true },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'Bitbucket username', required: true },
    ],
  },
  {
    type: 'azure-devops',
    name: 'Azure DevOps',
    description: 'Integrate with Azure DevOps repositories',
    icon: <GitBranch className="w-6 h-6" />,
    category: 'scm',
    available: true,
    configFields: [
      { key: 'organization', label: 'Organization', type: 'text', placeholder: 'your-org', required: true },
      { key: 'project', label: 'Project', type: 'text', placeholder: 'your-project', required: true },
      { key: 'pat', label: 'Personal Access Token', type: 'password', placeholder: 'Azure DevOps PAT', required: true },
    ],
  },
  // Notifications
  {
    type: 'slack',
    name: 'Slack',
    description: 'Receive security alerts in Slack channels',
    icon: <MessageSquare className="w-6 h-6" />,
    category: 'notification',
    available: true,
    configFields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'url', placeholder: 'https://hooks.slack.com/services/...', required: true },
      { key: 'channel', label: 'Default Channel', type: 'text', placeholder: '#security-alerts', required: false },
      {
        key: 'notifyOn',
        label: 'Notify On',
        type: 'select',
        options: [
          { label: 'All Findings', value: 'all' },
          { label: 'Critical & High Only', value: 'high' },
          { label: 'Critical Only', value: 'critical' },
        ],
      },
    ],
  },
  {
    type: 'pagerduty',
    name: 'PagerDuty',
    description: 'Escalate critical vulnerabilities to PagerDuty',
    icon: <Bell className="w-6 h-6" />,
    category: 'notification',
    available: true,
    configFields: [
      { key: 'routingKey', label: 'Routing Key', type: 'password', placeholder: 'PagerDuty integration key', required: true },
      { key: 'severity', label: 'Minimum Severity', type: 'select', options: [
        { label: 'Critical', value: 'critical' },
        { label: 'High', value: 'high' },
        { label: 'Medium', value: 'medium' },
      ], required: true },
    ],
  },
  {
    type: 'webhook',
    name: 'Webhooks',
    description: 'Send scan results to custom endpoints',
    icon: <Webhook className="w-6 h-6" />,
    category: 'notification',
    available: true,
    configFields: [
      { key: 'url', label: 'Webhook URL', type: 'url', placeholder: 'https://your-server.com/webhook', required: true },
      { key: 'secret', label: 'Signing Secret', type: 'password', placeholder: 'HMAC signing secret (optional)' },
      { key: 'events', label: 'Events', type: 'select', options: [
        { label: 'All Events', value: 'all' },
        { label: 'Scan Complete', value: 'scan.complete' },
        { label: 'New Findings', value: 'finding.new' },
      ] },
    ],
  },
  // Ticketing
  {
    type: 'jira',
    name: 'Jira',
    description: 'Create tickets for findings automatically',
    icon: <MessageSquare className="w-6 h-6" />,
    category: 'ticketing',
    available: true,
    configFields: [
      { key: 'url', label: 'Jira URL', type: 'url', placeholder: 'https://your-org.atlassian.net', required: true },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'user@example.com', required: true },
      { key: 'apiToken', label: 'API Token', type: 'password', placeholder: 'Jira API token', required: true },
      { key: 'projectKey', label: 'Project Key', type: 'text', placeholder: 'SEC', required: true },
      { key: 'issueType', label: 'Issue Type', type: 'text', placeholder: 'Bug', required: true },
    ],
  },
];

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  scm: 'Source Code Management',
  notification: 'Notifications',
  ticketing: 'Ticketing & Issue Tracking',
  cicd: 'CI/CD Pipelines',
};

const statusConfig: Record<IntegrationStatus, { icon: React.ReactNode; color: string; label: string }> = {
  connected: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600', label: 'Connected' },
  error: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-600', label: 'Error' },
  pending: { icon: <RefreshCw className="w-4 h-4 animate-spin" />, color: 'text-blue-600', label: 'Connecting...' },
  disabled: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-yellow-600', label: 'Disabled' },
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<IntegrationTemplate | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const res = await fetch(`${API_URL}/integrations`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      } else {
        setIntegrations([]);
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    setError(null);

    try {
      const endpoint = selectedIntegration
        ? `${API_URL}/integrations/${selectedIntegration.id}`
        : `${API_URL}/integrations`;

      const res = await fetch(endpoint, {
        method: selectedIntegration ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedTemplate.type,
          name: configValues.name || selectedTemplate.name,
          config: configValues,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (selectedIntegration) {
          setIntegrations(integrations.map(i => i.id === selectedIntegration.id ? result : i));
        } else {
          setIntegrations([...integrations, result]);
        }
        closeModal();
      } else {
        const data = await res.json();
        setError(data.message || 'Failed to save integration');
      }
    } catch (err) {
      setError('Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (integrationId: string) => {
    setTesting(integrationId);

    try {
      const res = await fetch(`${API_URL}/integrations/${integrationId}/test`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        // Update status to connected
        setIntegrations(integrations.map(i =>
          i.id === integrationId ? { ...i, status: 'connected' as IntegrationStatus, errorMessage: undefined } : i
        ));
      } else {
        const data = await res.json();
        setIntegrations(integrations.map(i =>
          i.id === integrationId ? { ...i, status: 'error' as IntegrationStatus, errorMessage: data.message } : i
        ));
      }
    } catch (err) {
      console.error('Failed to test integration:', err);
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (integrationId: string) => {
    if (!confirm('Are you sure you want to remove this integration?')) return;

    try {
      await fetch(`${API_URL}/integrations/${integrationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      setIntegrations(integrations.filter(i => i.id !== integrationId));
    } catch (err) {
      console.error('Failed to delete integration:', err);
    }
  };

  const handleToggle = async (integrationId: string, enabled: boolean) => {
    try {
      const res = await fetch(`${API_URL}/integrations/${integrationId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: enabled ? 'connected' : 'disabled' }),
      });

      if (res.ok) {
        setIntegrations(integrations.map(i =>
          i.id === integrationId ? { ...i, status: enabled ? 'connected' : 'disabled' } : i
        ));
      }
    } catch (err) {
      console.error('Failed to toggle integration:', err);
    }
  };

  const openConfigModal = (template: IntegrationTemplate, integration?: Integration) => {
    setSelectedTemplate(template);
    setSelectedIntegration(integration || null);
    setConfigValues(integration?.config as Record<string, string> || {});
    setError(null);
    setShowConfigModal(true);
  };

  const closeModal = () => {
    setShowConfigModal(false);
    setSelectedTemplate(null);
    setSelectedIntegration(null);
    setConfigValues({});
    setError(null);
  };

  const getIntegrationForType = (type: IntegrationType): Integration | undefined => {
    return integrations.find(i => i.type === type);
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<IntegrationCategory, IntegrationTemplate[]>);

  if (loading) {
    return (
      <div className="p-6 space-y-8">
        <div>
          <div className="h-8 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-36 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Integrations</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Connect ThreatDiviner with your development and security tools
        </p>
      </div>

      {/* Connected Integrations Summary */}
      {integrations.length > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium text-blue-900 dark:text-blue-100">
                {integrations.filter(i => i.status === 'connected').length} of {integrations.length} integrations connected
              </h2>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {integrations.filter(i => i.status === 'error').length > 0 &&
                  `${integrations.filter(i => i.status === 'error').length} integration(s) have errors`}
              </p>
            </div>
            <Plug className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      )}

      {/* Integration Categories */}
      {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
        <div key={category}>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            {CATEGORY_LABELS[category as IntegrationCategory]}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryTemplates.map((template) => {
              const integration = getIntegrationForType(template.type);
              const isConnected = integration && integration.status === 'connected';
              const hasError = integration && integration.status === 'error';

              return (
                <div
                  key={template.type}
                  className={`p-5 bg-white dark:bg-slate-800 rounded-lg border transition-all ${
                    isConnected
                      ? 'border-green-300 dark:border-green-700'
                      : hasError
                      ? 'border-red-300 dark:border-red-700'
                      : 'border-slate-200 dark:border-slate-700 hover:border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isConnected
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                          : hasError
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {template.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {template.name}
                          </h3>
                          {integration && (
                            <div className={`flex items-center gap-1 ${statusConfig[integration.status].color}`}>
                              {statusConfig[integration.status].icon}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {template.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {hasError && integration.errorMessage && (
                    <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                      {integration.errorMessage}
                    </div>
                  )}

                  {integration?.lastSync && (
                    <p className="mt-3 text-xs text-slate-500">
                      Last sync: {new Date(integration.lastSync).toLocaleString()}
                    </p>
                  )}

                  <div className="mt-4 flex gap-2">
                    {integration ? (
                      <>
                        <button
                          onClick={() => openConfigModal(template, integration)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
                        >
                          <Settings className="w-4 h-4" />
                          Configure
                        </button>
                        <button
                          onClick={() => handleTest(integration.id)}
                          disabled={testing === integration.id}
                          className="px-3 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                          {testing === integration.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(integration.id)}
                          className="px-3 py-2 border border-red-300 dark:border-red-800 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openConfigModal(template)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Configuration Modal */}
      {showConfigModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-400">
                  {selectedTemplate.icon}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {selectedIntegration ? 'Configure' : 'Connect'} {selectedTemplate.name}
                  </h2>
                  <p className="text-sm text-slate-500">{selectedTemplate.description}</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Integration Name
                </label>
                <input
                  type="text"
                  value={configValues.name || ''}
                  onChange={(e) => setConfigValues({ ...configValues, name: e.target.value })}
                  placeholder={selectedTemplate.name}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {selectedTemplate.configFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={configValues[field.key] || ''}
                      onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={configValues[field.key] || ''}
                      onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono text-sm"
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={configValues[field.key] || ''}
                      onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  )}
                  {field.helpText && (
                    <p className="text-xs text-slate-500 mt-1">{field.helpText}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
              <a
                href={`https://docs.threatdiviner.com/integrations/${selectedTemplate.type}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <ExternalLink className="w-4 h-4" />
                Setup Guide
              </a>
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {selectedIntegration ? 'Save Changes' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
