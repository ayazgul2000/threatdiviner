'use client';

import { useEffect, useState } from 'react';
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
import { repositoriesApi, type Repository, type ScanConfig } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ScannerConfig {
  id: string;
  name: string;
  type: 'sast' | 'sca' | 'secrets' | 'iac' | 'dast';
  description: string;
  enabled: boolean;
  isDefault: boolean;
}

interface DastConfig {
  targetUrl: string;
  scanType: 'baseline' | 'full' | 'api';
  authEnabled: boolean;
  authType?: 'basic' | 'bearer' | 'form';
  authConfig?: Record<string, string>;
}

const SCANNERS: ScannerConfig[] = [
  { id: 'semgrep', name: 'Semgrep', type: 'sast', description: 'Static Application Security Testing for code vulnerabilities', enabled: true, isDefault: true },
  { id: 'trivy', name: 'Trivy', type: 'sca', description: 'Software Composition Analysis for dependency vulnerabilities', enabled: true, isDefault: true },
  { id: 'gitleaks', name: 'Gitleaks', type: 'secrets', description: 'Secret detection for API keys, passwords, tokens', enabled: true, isDefault: true },
  { id: 'trufflehog', name: 'TruffleHog', type: 'secrets', description: 'Advanced secret scanning with entropy analysis', enabled: false, isDefault: false },
  { id: 'checkov', name: 'Checkov', type: 'iac', description: 'Infrastructure as Code scanning (Terraform, CloudFormation)', enabled: false, isDefault: false },
  { id: 'nuclei', name: 'Nuclei', type: 'dast', description: 'Dynamic vulnerability scanning with templates', enabled: false, isDefault: false },
  { id: 'zap', name: 'OWASP ZAP', type: 'dast', description: 'Web application security scanner', enabled: false, isDefault: false },
];

const SCANNER_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  sast: { label: 'SAST', color: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' },
  sca: { label: 'SCA', color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  secrets: { label: 'Secrets', color: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' },
  iac: { label: 'IaC', color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
  dast: { label: 'DAST', color: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' },
};

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

export default function RepositorySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const repositoryId = params.id as string;

  const [repository, setRepository] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Scanner configuration
  const [scanners, setScanners] = useState<ScannerConfig[]>(SCANNERS);

  // DAST configuration
  const [dastConfig, setDastConfig] = useState<DastConfig>({
    targetUrl: '',
    scanType: 'baseline',
    authEnabled: false,
  });

  // Schedule configuration
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [customCron, setCustomCron] = useState('0 0 * * *');
  const [timezone, setTimezone] = useState('UTC');

  // Branch configuration
  const [autoScanBranches, setAutoScanBranches] = useState<string[]>(['main', 'master', 'develop']);
  const [newBranch, setNewBranch] = useState('');

  // AI Triage
  const [aiTriageEnabled, setAiTriageEnabled] = useState(true);

  // PR Settings
  const [prSettings, setPrSettings] = useState({
    inlineComments: true,
    diffOnlyMode: true,
    blockOnSeverity: 'critical' as 'none' | 'critical' | 'high' | 'medium',
  });

  useEffect(() => {
    const fetchRepository = async () => {
      try {
        const repo = await repositoriesApi.get(repositoryId);
        setRepository(repo);

        // Load existing scan config if available
        if (repo.scanConfig) {
          // Update scanner toggles based on saved config
          if (repo.scanConfig.scanners) {
            setScanners(scanners.map(s => ({
              ...s,
              enabled: repo.scanConfig!.scanners.includes(s.id),
            })));
          }
          setScheduleEnabled(repo.scanConfig.scanOnSchedule);
          if (repo.scanConfig.schedulePattern) {
            setCustomCron(repo.scanConfig.schedulePattern);
          }
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

  const handleToggleScanner = (scannerId: string) => {
    setScanners(scanners.map(s =>
      s.id === scannerId ? { ...s, enabled: !s.enabled } : s
    ));
  };

  const handleAddBranch = () => {
    if (newBranch && !autoScanBranches.includes(newBranch)) {
      setAutoScanBranches([...autoScanBranches, newBranch]);
      setNewBranch('');
    }
  };

  const handleRemoveBranch = (branch: string) => {
    setAutoScanBranches(autoScanBranches.filter(b => b !== branch));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const enabledScanners = scanners.filter(s => s.enabled).map(s => s.id);

      // Determine schedule pattern
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
        scanOnPr: prSettings.inlineComments,
        scanOnSchedule: scheduleEnabled,
        schedulePattern,
        scanners: enabledScanners,
      });

      setSuccess('Settings saved successfully');
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
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
              Scanner Settings
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

      {/* Scanner Toggles */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Security Scanners</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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

      {/* DAST Configuration */}
      {scanners.some(s => s.type === 'dast' && s.enabled) && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>DAST Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target URL *
                </label>
                <input
                  type="url"
                  value={dastConfig.targetUrl}
                  onChange={(e) => setDastConfig({ ...dastConfig, targetUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  placeholder="https://staging.example.com"
                />
                <p className="text-xs text-gray-500 mt-1">URL of your staging environment to scan</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Scan Type
                </label>
                <select
                  value={dastConfig.scanType}
                  onChange={(e) => setDastConfig({ ...dastConfig, scanType: e.target.value as DastConfig['scanType'] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                >
                  <option value="baseline">Baseline (Quick scan)</option>
                  <option value="full">Full Scan (Comprehensive)</option>
                  <option value="api">API Scan (OpenAPI/Swagger)</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dastConfig.authEnabled}
                    onChange={(e) => setDastConfig({ ...dastConfig, authEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Enable Authentication</span>
                </label>
              </div>

              {dastConfig.authEnabled && (
                <div className="pl-6 space-y-4 border-l-2 border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Auth Type
                    </label>
                    <select
                      value={dastConfig.authType || 'basic'}
                      onChange={(e) => setDastConfig({ ...dastConfig, authType: e.target.value as DastConfig['authType'] })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="basic">Basic Auth</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="form">Form Login</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Configuration */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Scheduled Scans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable scheduled scans</span>
              </label>
            </div>

            {scheduleEnabled && (
              <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={scheduleFrequency}
                    onChange={(e) => setScheduleFrequency(e.target.value as typeof scheduleFrequency)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom (cron)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                {scheduleFrequency === 'custom' && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cron Expression
                    </label>
                    <input
                      type="text"
                      value={customCron}
                      onChange={(e) => setCustomCron(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white font-mono"
                      placeholder="0 0 * * *"
                    />
                    <p className="text-xs text-gray-500 mt-1">Format: minute hour day-of-month month day-of-week</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Branch Configuration */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Branch Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Default Branch</p>
              <code className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                {repository.defaultBranch}
              </code>
            </div>

            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Auto-scan Branches</p>
              <p className="text-xs text-gray-500 mb-2">Automatically scan these branches on push</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {autoScanBranches.map((branch) => (
                  <span
                    key={branch}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm"
                  >
                    {branch}
                    <button
                      onClick={() => handleRemoveBranch(branch)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddBranch()}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                  placeholder="Add branch name"
                />
                <Button variant="outline" onClick={handleAddBranch}>Add</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Triage */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>AI Triage</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={aiTriageEnabled}
              onChange={(e) => setAiTriageEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Enable AI-powered triage for findings in this repository
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-2">
            When enabled, findings will be automatically analyzed by AI to determine false positive likelihood,
            severity accuracy, and remediation suggestions.
          </p>
        </CardContent>
      </Card>

      {/* PR Settings */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Pull Request Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prSettings.inlineComments}
                onChange={(e) => setPrSettings({ ...prSettings, inlineComments: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Post inline comments on PRs</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prSettings.diffOnlyMode}
                onChange={(e) => setPrSettings({ ...prSettings, diffOnlyMode: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Diff-only mode (only scan changed lines)</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Block PR on Severity
              </label>
              <select
                value={prSettings.blockOnSeverity}
                onChange={(e) => setPrSettings({ ...prSettings, blockOnSeverity: e.target.value as typeof prSettings.blockOnSeverity })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              >
                <option value="none">None (Do not block)</option>
                <option value="critical">Critical only</option>
                <option value="high">High and above</option>
                <option value="medium">Medium and above</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Prevent PR merge if findings of this severity or higher are detected
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
