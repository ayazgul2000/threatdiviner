'use client';

import { useState, useEffect } from 'react';
import { useProject } from '@/contexts/project-context';
import {
  Cloud,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings,
  Play,
  Eye,
  Shield,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type CloudProvider = 'aws' | 'azure' | 'gcp';
type AccountStatus = 'connected' | 'error' | 'scanning' | 'pending';

interface CloudAccount {
  id: string;
  name: string;
  provider: CloudProvider;
  accountId: string;
  region?: string;
  status: AccountStatus;
  lastScan?: string;
  resourceCount?: number;
  findingsCount?: number;
  criticalCount?: number;
  createdAt: string;
}

interface CloudFinding {
  id: string;
  cloudAccountId: string;
  resourceType: string;
  resourceId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  description: string;
  remediation?: string;
  compliance?: string[];
  createdAt: string;
}

const providerConfig: Record<CloudProvider, { name: string; color: string; bgColor: string }> = {
  aws: { name: 'AWS', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  azure: { name: 'Azure', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  gcp: { name: 'GCP', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
};

const statusConfig: Record<AccountStatus, { icon: React.ReactNode; color: string; label: string }> = {
  connected: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600', label: 'Connected' },
  error: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-600', label: 'Error' },
  scanning: { icon: <RefreshCw className="w-4 h-4 animate-spin" />, color: 'text-blue-600', label: 'Scanning' },
  pending: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-yellow-600', label: 'Pending Setup' },
};

const severityColors = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  info: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
};

export default function CloudAccountsPage() {
  const { currentProject } = useProject();
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [findings, setFindings] = useState<CloudFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'accounts' | 'findings'>('accounts');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<CloudAccount | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    accountId: '',
    region: '',
    accessKeyId: '',
    secretAccessKey: '',
    roleArn: '',
    subscriptionId: '',
    tenantId: '',
    clientId: '',
    clientSecret: '',
    projectId: '',
    serviceAccountKey: '',
  });

  useEffect(() => {
    if (currentProject) {
      fetchAccounts();
    } else {
      setLoading(false);
    }
  }, [currentProject]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${API_URL}/cspm/accounts`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || data || []);
      } else {
        setAccounts([]);
      }
    } catch (err) {
      console.error('Failed to fetch cloud accounts:', err);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFindings = async () => {
    try {
      const res = await fetch(`${API_URL}/cspm/findings`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setFindings(data.findings || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch findings:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'findings' && currentProject) {
      fetchFindings();
    }
  }, [activeTab, currentProject]);

  const handleConnect = async () => {
    if (!selectedProvider || !currentProject) return;

    setConnecting(true);

    try {
      const payload: Record<string, unknown> = {
        provider: selectedProvider,
        name: formData.name,
        projectId: currentProject.id,
      };

      if (selectedProvider === 'aws') {
        payload.accountId = formData.accountId;
        payload.region = formData.region || 'us-east-1';
        if (formData.roleArn) {
          payload.credentials = { roleArn: formData.roleArn };
        } else {
          payload.credentials = {
            accessKeyId: formData.accessKeyId,
            secretAccessKey: formData.secretAccessKey,
          };
        }
      } else if (selectedProvider === 'azure') {
        payload.subscriptionId = formData.subscriptionId;
        payload.credentials = {
          tenantId: formData.tenantId,
          clientId: formData.clientId,
          clientSecret: formData.clientSecret,
        };
      } else if (selectedProvider === 'gcp') {
        payload.projectId = formData.projectId;
        payload.credentials = {
          serviceAccountKey: formData.serviceAccountKey,
        };
      }

      const res = await fetch(`${API_URL}/cspm/accounts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newAccount = await res.json();
        setAccounts([...accounts, newAccount]);
        closeModal();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to connect account');
      }
    } catch (err) {
      console.error('Failed to connect:', err);
      alert('Failed to connect cloud account');
    } finally {
      setConnecting(false);
    }
  };

  const handleScan = async (accountId: string) => {
    setScanning(accountId);

    try {
      const res = await fetch(`${API_URL}/cspm/accounts/${accountId}/scan`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        // Update account status
        setAccounts(accounts.map(a =>
          a.id === accountId ? { ...a, status: 'scanning' as AccountStatus } : a
        ));
      }
    } catch (err) {
      console.error('Failed to start scan:', err);
    } finally {
      setScanning(null);
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this cloud account?')) return;

    try {
      await fetch(`${API_URL}/cspm/accounts/${accountId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      setAccounts(accounts.filter(a => a.id !== accountId));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const closeModal = () => {
    setShowConnectModal(false);
    setSelectedProvider(null);
    setFormData({
      name: '',
      accountId: '',
      region: '',
      accessKeyId: '',
      secretAccessKey: '',
      roleArn: '',
      subscriptionId: '',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      projectId: '',
      serviceAccountKey: '',
    });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cloud Accounts</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Connect and scan AWS, Azure, and GCP accounts
            </p>
          </div>
        </div>
        <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
          <Cloud className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            No Project Selected
          </h3>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Select a project from the sidebar to connect and manage cloud accounts.
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cloud Accounts</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Connect and scan AWS, Azure, and GCP accounts for misconfigurations
          </p>
        </div>
        <button
          onClick={() => setShowConnectModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Connect Account
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{accounts.length}</div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Connected Accounts</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {accounts.reduce((sum, a) => sum + (a.resourceCount || 0), 0)}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Cloud Resources</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {accounts.reduce((sum, a) => sum + (a.findingsCount || 0), 0)}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Total Findings</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-red-600">
            {accounts.reduce((sum, a) => sum + (a.criticalCount || 0), 0)}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Critical Issues</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === 'accounts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Accounts ({accounts.length})
        </button>
        <button
          onClick={() => setActiveTab('findings')}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === 'findings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Findings ({findings.length})
        </button>
      </div>

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <>
          {accounts.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
              <Cloud className="w-16 h-16 mx-auto text-slate-400 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                No Cloud Accounts Connected
              </h3>
              <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
                Connect your cloud accounts to scan for misconfigurations and security risks.
              </p>
              <button
                onClick={() => setShowConnectModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Connect Your First Account
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="p-5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${providerConfig[account.provider].bgColor}`}>
                        <Cloud className={`w-5 h-5 ${providerConfig[account.provider].color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {account.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {providerConfig[account.provider].name} • {account.accountId}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 ${statusConfig[account.status].color}`}>
                      {statusConfig[account.status].icon}
                      <span className="text-sm">{statusConfig[account.status].label}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        {account.resourceCount || 0}
                      </div>
                      <div className="text-xs text-slate-500">Resources</div>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        {account.findingsCount || 0}
                      </div>
                      <div className="text-xs text-slate-500">Findings</div>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="text-lg font-semibold text-red-600">
                        {account.criticalCount || 0}
                      </div>
                      <div className="text-xs text-slate-500">Critical</div>
                    </div>
                  </div>

                  {account.lastScan && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Last scan: {new Date(account.lastScan).toLocaleString()}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleScan(account.id)}
                      disabled={scanning === account.id || account.status === 'scanning'}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {scanning === account.id || account.status === 'scanning' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Scan
                    </button>
                    <button
                      onClick={() => setSelectedAccount(account)}
                      className="px-3 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      className="px-3 py-2 border border-red-300 dark:border-red-800 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Findings Tab */}
      {activeTab === 'findings' && (
        <>
          {findings.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <Shield className="w-16 h-16 mx-auto text-slate-400 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                No Cloud Findings
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                {accounts.length === 0
                  ? 'Connect a cloud account and run a scan to find misconfigurations.'
                  : 'Run a scan on your cloud accounts to discover security issues.'}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                      Finding
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                      Discovered
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {findings.map((finding) => (
                    <tr
                      key={finding.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {finding.title}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                          {finding.description}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                          {finding.resourceType}
                        </div>
                        <div className="text-xs text-slate-500 font-mono truncate max-w-[200px]">
                          {finding.resourceId}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${severityColors[finding.severity]}`}>
                          {finding.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                        {finding.category}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(finding.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Connect Account Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {selectedProvider
                  ? `Connect ${providerConfig[selectedProvider].name} Account`
                  : 'Connect Cloud Account'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {!selectedProvider ? (
                <div className="grid grid-cols-3 gap-4">
                  {(['aws', 'azure', 'gcp'] as CloudProvider[]).map((provider) => (
                    <button
                      key={provider}
                      onClick={() => setSelectedProvider(provider)}
                      className="flex flex-col items-center gap-3 p-6 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <div className={`p-3 rounded-lg ${providerConfig[provider].bgColor}`}>
                        <Cloud className={`w-8 h-8 ${providerConfig[provider].color}`} />
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {providerConfig[provider].name}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedProvider(null)}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                  >
                    ← Back to providers
                  </button>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Production AWS"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>

                  {selectedProvider === 'aws' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          AWS Account ID
                        </label>
                        <input
                          type="text"
                          value={formData.accountId}
                          onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                          placeholder="123456789012"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Region
                        </label>
                        <select
                          value={formData.region}
                          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        >
                          <option value="">All Regions</option>
                          <option value="us-east-1">US East (N. Virginia)</option>
                          <option value="us-west-2">US West (Oregon)</option>
                          <option value="eu-west-1">EU (Ireland)</option>
                          <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          IAM Role ARN (recommended)
                        </label>
                        <input
                          type="text"
                          value={formData.roleArn}
                          onChange={(e) => setFormData({ ...formData, roleArn: e.target.value })}
                          placeholder="arn:aws:iam::123456789012:role/ThreatDivinerRole"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Use cross-account IAM role assumption for better security
                        </p>
                      </div>
                      <div className="text-center text-sm text-slate-500">— or —</div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Access Key ID
                        </label>
                        <input
                          type="text"
                          value={formData.accessKeyId}
                          onChange={(e) => setFormData({ ...formData, accessKeyId: e.target.value })}
                          placeholder="AKIA..."
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Secret Access Key
                        </label>
                        <input
                          type="password"
                          value={formData.secretAccessKey}
                          onChange={(e) => setFormData({ ...formData, secretAccessKey: e.target.value })}
                          placeholder="••••••••••••••••"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    </>
                  )}

                  {selectedProvider === 'azure' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Subscription ID
                        </label>
                        <input
                          type="text"
                          value={formData.subscriptionId}
                          onChange={(e) => setFormData({ ...formData, subscriptionId: e.target.value })}
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Tenant ID
                        </label>
                        <input
                          type="text"
                          value={formData.tenantId}
                          onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Client ID (App Registration)
                        </label>
                        <input
                          type="text"
                          value={formData.clientId}
                          onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          value={formData.clientSecret}
                          onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                          placeholder="••••••••••••••••"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    </>
                  )}

                  {selectedProvider === 'gcp' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          GCP Project ID
                        </label>
                        <input
                          type="text"
                          value={formData.projectId}
                          onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                          placeholder="my-project-123456"
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Service Account Key (JSON)
                        </label>
                        <textarea
                          value={formData.serviceAccountKey}
                          onChange={(e) => setFormData({ ...formData, serviceAccountKey: e.target.value })}
                          placeholder='{"type": "service_account", ...}'
                          rows={4}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono text-sm"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Paste the contents of your service account JSON key file
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {selectedProvider && (
              <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnect}
                  disabled={connecting || !formData.name}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {connecting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Connect Account
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Details Modal */}
      {selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${providerConfig[selectedAccount.provider].bgColor}`}>
                  <Cloud className={`w-6 h-6 ${providerConfig[selectedAccount.provider].color}`} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {selectedAccount.name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {providerConfig[selectedAccount.provider].name} • {selectedAccount.accountId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAccount(null)}
                className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {selectedAccount.resourceCount || 0}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Cloud Resources</div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {selectedAccount.findingsCount || 0}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Security Findings</div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-slate-900 dark:text-white mb-3">Account Details</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                    <dt className="text-slate-500">Status</dt>
                    <dd className={`flex items-center gap-1 ${statusConfig[selectedAccount.status].color}`}>
                      {statusConfig[selectedAccount.status].icon}
                      {statusConfig[selectedAccount.status].label}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                    <dt className="text-slate-500">Provider</dt>
                    <dd className="text-slate-900 dark:text-white">
                      {providerConfig[selectedAccount.provider].name}
                    </dd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                    <dt className="text-slate-500">Account ID</dt>
                    <dd className="text-slate-900 dark:text-white font-mono">
                      {selectedAccount.accountId}
                    </dd>
                  </div>
                  {selectedAccount.region && (
                    <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                      <dt className="text-slate-500">Region</dt>
                      <dd className="text-slate-900 dark:text-white">{selectedAccount.region}</dd>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                    <dt className="text-slate-500">Connected</dt>
                    <dd className="text-slate-900 dark:text-white">
                      {new Date(selectedAccount.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                  {selectedAccount.lastScan && (
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-500">Last Scan</dt>
                      <dd className="text-slate-900 dark:text-white">
                        {new Date(selectedAccount.lastScan).toLocaleString()}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => {
                  setSelectedAccount(null);
                  handleDelete(selectedAccount.id);
                }}
                className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Disconnect
              </button>
              <button
                onClick={() => {
                  handleScan(selectedAccount.id);
                  setSelectedAccount(null);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                Run Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
