'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
} from '@/components/ui';
import { repositoriesApi, branchesApi, type Repository, type ScanConfig, type ScmBranch, API_URL } from '@/lib/api';

interface ScannerConfig {
  id: string;
  name: string;
  type: 'sast' | 'sca' | 'secrets' | 'iac' | 'container';
  description: string;
  enabled: boolean;
  isDefault: boolean;
}


interface WebhookConfig {
  url: string;
  secret: string;
  branchIncludes: string;
  branchExcludes: string;
  scannersEnabled: string[];
  blockSeverity: 'none' | 'critical' | 'high' | 'medium';
  diffOnly: boolean;
  inlineComments: boolean;
}

const SCANNERS: ScannerConfig[] = [
  { id: 'semgrep', name: 'Semgrep', type: 'sast', description: 'Static Application Security Testing for code vulnerabilities', enabled: true, isDefault: true },
  { id: 'trivy', name: 'Trivy', type: 'sca', description: 'Software Composition Analysis for dependency vulnerabilities', enabled: true, isDefault: true },
  { id: 'gitleaks', name: 'Gitleaks', type: 'secrets', description: 'Secret detection for API keys, passwords, tokens', enabled: true, isDefault: true },
  { id: 'checkov', name: 'Checkov', type: 'iac', description: 'Infrastructure as Code scanning (Terraform, CloudFormation)', enabled: false, isDefault: false },
  { id: 'container', name: 'Container Scan', type: 'container', description: 'Container image vulnerability scanning for Docker images', enabled: false, isDefault: false },
];

const SCANNER_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  sast: { label: 'SAST', color: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' },
  sca: { label: 'SCA', color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  secrets: { label: 'Secrets', color: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' },
  iac: { label: 'IaC', color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
  container: { label: 'Container', color: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300' },
};

type SettingsTab = 'webhook' | 'cli' | 'scanners';

export default function RepositorySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const repositoryId = params.id as string;

  const [repository, setRepository] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('webhook');
  const [copied, setCopied] = useState<string | null>(null);

  // Scanner configuration
  const [scanners, setScanners] = useState<ScannerConfig[]>(SCANNERS);

  // Webhook configuration
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    url: '',
    secret: '',
    branchIncludes: '',
    branchExcludes: '',
    scannersEnabled: ['semgrep', 'trivy', 'gitleaks'],
    blockSeverity: 'none',
    diffOnly: true,
    inlineComments: true,
  });

  // Schedule configuration
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [customCron, setCustomCron] = useState('0 0 * * *');

  // Branch configuration
  const [branches, setBranches] = useState<ScmBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [defaultBranch, setDefaultBranch] = useState<string>('');
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  // AI Triage
  const [aiTriageEnabled, setAiTriageEnabled] = useState(true);

  // Generate CLI token
  const [cliToken, setCliToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);

  useEffect(() => {
    const fetchRepository = async () => {
      try {
        const repo = await repositoriesApi.get(repositoryId);
        setRepository(repo);
        setDefaultBranch(repo.defaultBranch || '');

        // Generate webhook URL
        const webhookUrl = `${API_URL}/webhooks/github/${repositoryId}`;
        setWebhookConfig(prev => ({
          ...prev,
          url: webhookUrl,
          secret: (repo as any).webhookSecret || generateSecret(),
        }));

        // Load existing scan config if available
        if (repo.scanConfig) {
          if (repo.scanConfig.scanners && repo.scanConfig.scanners.length > 0) {
            setScanners(prevScanners => prevScanners.map(s => ({
              ...s,
              enabled: repo.scanConfig!.scanners.includes(s.id),
            })));
          }
          setScheduleEnabled(repo.scanConfig.scanOnSchedule);
          if (repo.scanConfig.schedulePattern) {
            setCustomCron(repo.scanConfig.schedulePattern);
          }
          if (repo.scanConfig.branches && repo.scanConfig.branches.length > 0) {
            setDefaultBranch(repo.scanConfig.branches[0]);
          }
        }

        // Load webhook config from repository
        const repoWithWebhook = repo as any;
        if (repoWithWebhook.webhookBranchFilters) {
          setWebhookConfig(prev => ({
            ...prev,
            branchIncludes: repoWithWebhook.webhookBranchFilters?.join(', ') || '',
            branchExcludes: repoWithWebhook.webhookBranchExcludes?.join(', ') || '',
            scannersEnabled: repoWithWebhook.webhookScannersEnabled || ['semgrep', 'trivy', 'gitleaks'],
            blockSeverity: repoWithWebhook.webhookBlockSeverity || 'none',
            diffOnly: repoWithWebhook.webhookDiffOnly ?? true,
            inlineComments: repoWithWebhook.webhookInlineComments ?? true,
          }));
        }
      } catch (err) {
        console.error('Failed to fetch repository:', err);
        setError('Failed to load repository');
      } finally {
        setLoading(false);
      }
    };

    fetchRepository();
  }, [repositoryId]);

  useEffect(() => {
    const fetchBranches = async () => {
      setBranchesLoading(true);
      try {
        const branchList = await branchesApi.list(repositoryId);
        const sorted = [...branchList].sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return a.name.localeCompare(b.name);
        });
        setBranches(sorted);
      } catch (err) {
        console.error('Failed to fetch branches:', err);
      } finally {
        setBranchesLoading(false);
      }
    };

    if (repositoryId) {
      fetchBranches();
    }
  }, [repositoryId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setBranchDropdownOpen(false);
      }
    };

    if (branchDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [branchDropdownOpen]);

  const generateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const regenerateSecret = () => {
    setWebhookConfig(prev => ({
      ...prev,
      secret: generateSecret(),
    }));
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleToggleScanner = (scannerId: string) => {
    setScanners(scanners.map(s =>
      s.id === scannerId ? { ...s, enabled: !s.enabled } : s
    ));
  };

  const handleToggleWebhookScanner = (scannerId: string) => {
    setWebhookConfig(prev => ({
      ...prev,
      scannersEnabled: prev.scannersEnabled.includes(scannerId)
        ? prev.scannersEnabled.filter(s => s !== scannerId)
        : [...prev.scannersEnabled, scannerId],
    }));
  };

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(branchSearchQuery.toLowerCase())
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const enabledScanners = scanners.filter(s => s.enabled).map(s => s.id);

      let schedulePattern: string | null = null;
      if (scheduleEnabled) {
        switch (scheduleFrequency) {
          case 'daily':
            schedulePattern = '0 0 * * *';
            break;
          case 'weekly':
            schedulePattern = '0 0 * * 0';
            break;
          case 'monthly':
            schedulePattern = '0 0 1 * *';
            break;
          case 'custom':
            schedulePattern = customCron;
            break;
        }
      }

      await repositoriesApi.updateConfig(repositoryId, {
        enabled: true,
        scanOnPush: true,
        scanOnPr: webhookConfig.inlineComments,
        scanOnSchedule: scheduleEnabled,
        schedulePattern,
        scanners: enabledScanners,
        branches: defaultBranch ? [defaultBranch] : undefined,
      } as any);

      setSuccess('Settings saved successfully');
      setTimeout(() => {
        router.push(`/dashboard/repositories/${repositoryId}`);
      }, 1000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const generateCliToken = async () => {
    setGeneratingToken(true);
    try {
      // In a real implementation, this would call the API
      const token = `td_${generateSecret()}`;
      setCliToken(token);
    } catch (err) {
      console.error('Failed to generate token:', err);
    } finally {
      setGeneratingToken(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading repository settings...</div>
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          Repository not found
        </div>
        <Link href="/dashboard/repositories" className="text-blue-600 hover:text-blue-700">
          Back to Repositories
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/repositories/${repositoryId}`}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Repository Settings
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {repository.fullName}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { id: 'webhook', label: 'Webhook', icon: '🔗' },
            { id: 'cli', label: 'CLI', icon: '💻' },
            { id: 'scanners', label: 'Scan Config', icon: '🔍' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Webhook Tab */}
      {activeTab === 'webhook' && (
        <div className="space-y-6">
          {/* Webhook URL & Secret */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Webhook URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Webhook URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookConfig.url}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(webhookConfig.url, 'url')}
                  >
                    {copied === 'url' ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Add this URL to your GitHub/GitLab repository webhook settings
                </p>
              </div>

              {/* Webhook Secret */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Webhook Secret
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    readOnly
                    value={webhookConfig.secret}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(webhookConfig.secret, 'secret')}
                  >
                    {copied === 'secret' ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={regenerateSecret}
                  >
                    Regenerate
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use this secret to verify webhook payloads (HMAC-SHA256)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Branch Filters */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Branch Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Include Branches (glob patterns)
                  </label>
                  <input
                    type="text"
                    value={webhookConfig.branchIncludes}
                    onChange={(e) => setWebhookConfig(prev => ({ ...prev, branchIncludes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                    placeholder="main, develop, release/*"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to scan all branches</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Exclude Branches (glob patterns)
                  </label>
                  <input
                    type="text"
                    value={webhookConfig.branchExcludes}
                    onChange={(e) => setWebhookConfig(prev => ({ ...prev, branchExcludes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                    placeholder="dependabot/*, renovate/*"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Scanner Selection */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Webhook Scanners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {SCANNERS.slice(0, 5).map((scanner) => (
                  <label
                    key={scanner.id}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      webhookConfig.scannersEnabled.includes(scanner.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={webhookConfig.scannersEnabled.includes(scanner.id)}
                      onChange={() => handleToggleWebhookScanner(scanner.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white text-sm">{scanner.name}</span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${SCANNER_TYPE_LABELS[scanner.type].color}`}>
                          {SCANNER_TYPE_LABELS[scanner.type].label}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* PR Settings */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Pull Request Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Inline Comments</span>
                  <p className="text-sm text-gray-500">Post findings as inline comments on PRs</p>
                </div>
                <button
                  onClick={() => setWebhookConfig(prev => ({ ...prev, inlineComments: !prev.inlineComments }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    webhookConfig.inlineComments ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      webhookConfig.inlineComments ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Diff-Only Mode</span>
                  <p className="text-sm text-gray-500">Only scan changed lines in PRs</p>
                </div>
                <button
                  onClick={() => setWebhookConfig(prev => ({ ...prev, diffOnly: !prev.diffOnly }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    webhookConfig.diffOnly ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      webhookConfig.diffOnly ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Block PR on Severity
                </label>
                <select
                  value={webhookConfig.blockSeverity}
                  onChange={(e) => setWebhookConfig(prev => ({ ...prev, blockSeverity: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                >
                  <option value="none">None (Do not block)</option>
                  <option value="critical">Critical only</option>
                  <option value="high">High and above</option>
                  <option value="medium">Medium and above</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Set commit status to failure if findings of this severity are detected
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CLI Tab */}
      {activeTab === 'cli' && (
        <div className="space-y-6">
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>CLI Access Token</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cliToken ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Your CLI Token
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      readOnly
                      value={cliToken}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 dark:text-white font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(cliToken, 'token')}
                    >
                      {copied === 'token' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <div className="mt-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Important:</strong> Save this token securely. It won&apos;t be shown again.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Generate a token to use ThreatDiviner CLI with this repository
                  </p>
                  <Button onClick={generateCliToken} disabled={generatingToken}>
                    {generatingToken ? 'Generating...' : 'Generate Token'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Example Commands</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Run a scan
                </label>
                <div className="relative">
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
                    <code>{`threatdiviner scan --repo ${repository.fullName} --branch main`}</code>
                  </pre>
                  <button
                    onClick={() => copyToClipboard(`threatdiviner scan --repo ${repository.fullName} --branch main`, 'cmd1')}
                    className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  >
                    {copied === 'cmd1' ? '✓' : '📋'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  View findings
                </label>
                <div className="relative">
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
                    <code>{`threatdiviner findings list --repo ${repository.fullName} --severity high,critical`}</code>
                  </pre>
                  <button
                    onClick={() => copyToClipboard(`threatdiviner findings list --repo ${repository.fullName} --severity high,critical`, 'cmd2')}
                    className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  >
                    {copied === 'cmd2' ? '✓' : '📋'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CI/CD Integration
                </label>
                <div className="relative">
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
                    <code>{`# GitHub Actions
- name: Security Scan
  env:
    THREATDIVINER_TOKEN: \${{ secrets.THREATDIVINER_TOKEN }}
  run: |
    threatdiviner scan --fail-on critical --format sarif`}</code>
                  </pre>
                  <button
                    onClick={() => copyToClipboard(`# GitHub Actions
- name: Security Scan
  env:
    THREATDIVINER_TOKEN: \${{ secrets.THREATDIVINER_TOKEN }}
  run: |
    threatdiviner scan --fail-on critical --format sarif`, 'cmd3')}
                    className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  >
                    {copied === 'cmd3' ? '✓' : '📋'}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scan Config Tab */}
      {activeTab === 'scanners' && (
        <div className="space-y-6">
          {/* Default Branch */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Default Branch</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative" ref={branchDropdownRef}>
                {branchesLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm text-gray-500">Loading branches...</span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                      className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-left"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span>{defaultBranch || 'Select a branch'}</span>
                        {branches.find(b => b.name === defaultBranch)?.isDefault && (
                          <Badge variant="default" size="sm">git default</Badge>
                        )}
                      </div>
                      <svg className={`w-4 h-4 text-gray-500 transition-transform ${branchDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {branchDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-hidden">
                        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                          <input
                            type="text"
                            value={branchSearchQuery}
                            onChange={(e) => setBranchSearchQuery(e.target.value)}
                            placeholder="Search branches..."
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredBranches.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500">No branches found</div>
                          ) : (
                            filteredBranches.map((branch) => (
                              <button
                                key={branch.name}
                                type="button"
                                onClick={() => {
                                  setDefaultBranch(branch.name);
                                  setBranchDropdownOpen(false);
                                  setBranchSearchQuery('');
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                  defaultBranch === branch.name ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-900 dark:text-white">{branch.name}</span>
                                  {branch.isDefault && <Badge variant="default" size="sm">git default</Badge>}
                                </div>
                                {defaultBranch === branch.name && (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Branch used for manual scans and scheduled scans. PR/push scans use the triggered branch.
              </p>
            </CardContent>
          </Card>

          {/* Scanner Toggles */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Default Scanners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {scanners.map((scanner) => (
                  <div
                    key={scanner.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleToggleScanner(scanner.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          scanner.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            scanner.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">{scanner.name}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${SCANNER_TYPE_LABELS[scanner.type].color}`}>
                            {SCANNER_TYPE_LABELS[scanner.type].label}
                          </span>
                          {scanner.isDefault && (
                            <Badge variant="success" size="sm">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{scanner.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Triage */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>AI Triage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Enable AI-powered triage</span>
                  <p className="text-sm text-gray-500">Automatically analyze findings for false positive likelihood and remediation</p>
                </div>
                <button
                  onClick={() => setAiTriageEnabled(!aiTriageEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    aiTriageEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      aiTriageEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
