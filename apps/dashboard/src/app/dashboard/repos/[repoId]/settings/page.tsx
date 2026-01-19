'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  type: 'sast' | 'sca' | 'secrets' | 'iac';
  description: string;
  enabled: boolean;
  isDefault: boolean;
}

const SCANNERS: ScannerConfig[] = [
  { id: 'semgrep', name: 'Semgrep', type: 'sast', description: 'Static Application Security Testing for code vulnerabilities', enabled: true, isDefault: true },
  { id: 'trivy', name: 'Trivy', type: 'sca', description: 'Software Composition Analysis for dependency vulnerabilities', enabled: true, isDefault: true },
  { id: 'gitleaks', name: 'Gitleaks', type: 'secrets', description: 'Secret detection for API keys, passwords, tokens', enabled: true, isDefault: true },
  { id: 'checkov', name: 'Checkov', type: 'iac', description: 'Infrastructure as Code scanning (Terraform, CloudFormation)', enabled: false, isDefault: false },
];

const SCANNER_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  sast: { label: 'SAST', color: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' },
  sca: { label: 'SCA', color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  secrets: { label: 'Secrets', color: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' },
  iac: { label: 'IaC', color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
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
  const searchParams = useSearchParams();
  const repoId = params.repoId as string;
  const fromBranch = searchParams.get('from') === 'branch';
  const branchId = searchParams.get('branchId');

  const [repository, setRepository] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Scanner configuration
  const [scanners, setScanners] = useState<ScannerConfig[]>(SCANNERS);

  // Schedule configuration
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [scheduleTime, setScheduleTime] = useState('00:00');
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState('0'); // 0 = Sunday
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState('1');
  const [customCron, setCustomCron] = useState('0 0 * * *');
  const [timezone, setTimezone] = useState('UTC');

  // Branch configuration
  const [autoScanBranches, setAutoScanBranches] = useState<string[]>(['main', 'master', 'develop']);
  const [newBranch, setNewBranch] = useState('');

  // AI Triage
  const [aiTriageEnabled, setAiTriageEnabled] = useState(true);
  const [triageMode, setTriageMode] = useState<'snippet' | 'full-file' | 'none'>('snippet');

  // PR Settings
  const [prSettings, setPrSettings] = useState({
    inlineComments: true,
    diffOnlyMode: true,
    blockOnSeverity: 'critical' as 'none' | 'critical' | 'high' | 'medium',
  });

  // GitHub Write-back Settings
  const [writebackSettings, setWritebackSettings] = useState({
    enabled: true,
    checkRunEnabled: true,
    prCommentsEnabled: true,
    inlineAnnotations: true,
    sarifUploadEnabled: false,
    blockPrOnSeverity: 'none' as 'none' | 'critical' | 'high' | 'medium',
  });

  // CLI/Pipeline Settings
  const [cliSettings, setCliSettings] = useState({
    applySettingsForCLI: false,
    writeBackPRComments: true,
    writeBackPRSummary: true,
    writeBackCheckStatus: true,
    writeBackAnnotations: false,
    writeBackSarif: false,
    commentSeverities: ['critical', 'high'] as string[],
    maxComments: 20,
    failOnSeverity: 'critical' as 'none' | 'critical' | 'high' | 'medium' | 'low',
    failOnCount: 0,
  });

  useEffect(() => {
    const fetchRepository = async () => {
      try {
        const repo = await repositoriesApi.get(repoId);
        setRepository(repo);

        // Load existing scan config if available
        if (repo.scanConfig) {
          // Update scanner toggles based on saved config
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
          // Load write-back settings
          const config = repo.scanConfig as any;
          setWritebackSettings({
            enabled: config.checkRunEnabled ?? true,
            checkRunEnabled: config.checkRunEnabled ?? true,
            prCommentsEnabled: config.prCommentsEnabled ?? true,
            inlineAnnotations: config.inlineAnnotations ?? true,
            sarifUploadEnabled: config.sarifUploadEnabled ?? false,
            blockPrOnSeverity: config.blockPrOnSeverity ?? 'none',
          });
          // Load CLI settings
          setCliSettings({
            applySettingsForCLI: config.applySettingsForCLI ?? false,
            writeBackPRComments: config.cliWriteBackPRComments ?? true,
            writeBackPRSummary: config.cliWriteBackPRSummary ?? true,
            writeBackCheckStatus: config.cliWriteBackCheckStatus ?? true,
            writeBackAnnotations: config.cliWriteBackAnnotations ?? false,
            writeBackSarif: config.cliWriteBackSarif ?? false,
            commentSeverities: config.cliCommentSeverities ?? ['critical', 'high'],
            maxComments: config.cliMaxComments ?? 20,
            failOnSeverity: config.cliFailOnSeverity ?? 'critical',
            failOnCount: config.cliFailOnCount ?? 0,
          });
          // Load triage mode
          if (config.triageMode) {
            setTriageMode(config.triageMode as 'snippet' | 'full-file' | 'none');
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
  }, [repoId]);

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
        const [hour, minute] = scheduleTime.split(':').map(Number);
        switch (scheduleFrequency) {
          case 'daily':
            schedulePattern = `${minute} ${hour} * * *`;
            break;
          case 'weekly':
            schedulePattern = `${minute} ${hour} * * ${scheduleDayOfWeek}`;
            break;
          case 'monthly':
            schedulePattern = `${minute} ${hour} ${scheduleDayOfMonth} * *`;
            break;
          case 'custom':
            schedulePattern = customCron;
            break;
        }
      }

      await repositoriesApi.updateConfig(repoId, {
        enabled: true,
        scanOnPush: true,
        scanOnPr: prSettings.inlineComments,
        scanOnSchedule: scheduleEnabled,
        schedulePattern,
        scanners: enabledScanners,
        // Write-back settings
        checkRunEnabled: writebackSettings.enabled && writebackSettings.checkRunEnabled,
        prCommentsEnabled: writebackSettings.enabled && writebackSettings.prCommentsEnabled,
        inlineAnnotations: writebackSettings.enabled && writebackSettings.inlineAnnotations,
        sarifUploadEnabled: writebackSettings.enabled && writebackSettings.sarifUploadEnabled,
        blockPrOnSeverity: writebackSettings.enabled ? writebackSettings.blockPrOnSeverity : 'none',
        // CLI/Pipeline settings
        applySettingsForCLI: cliSettings.applySettingsForCLI,
        cliWriteBackPRComments: cliSettings.writeBackPRComments,
        cliWriteBackPRSummary: cliSettings.writeBackPRSummary,
        cliWriteBackCheckStatus: cliSettings.writeBackCheckStatus,
        cliWriteBackAnnotations: cliSettings.writeBackAnnotations,
        cliWriteBackSarif: cliSettings.writeBackSarif,
        cliCommentSeverities: cliSettings.commentSeverities,
        cliMaxComments: cliSettings.maxComments,
        cliFailOnSeverity: cliSettings.failOnSeverity,
        cliFailOnCount: cliSettings.failOnCount,
        // Triage mode
        triageMode,
      });

      setSuccess('Settings saved successfully');
      // Navigate back to the page we came from after short delay
      setTimeout(() => {
        if (fromBranch && branchId) {
          router.push(`/dashboard/repos/${repoId}/branch/${branchId}`);
        } else {
          router.push(`/dashboard/repos/${repoId}`);
        }
      }, 1000);
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
        <Link href="/dashboard/repos" className="text-blue-600 hover:text-blue-700">
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
              href={fromBranch && branchId ? `/dashboard/repos/${repoId}/branch/${branchId}` : `/dashboard/repos/${repoId}`}
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

                {scheduleFrequency !== 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                )}

                {scheduleFrequency === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Day of Week
                    </label>
                    <select
                      value={scheduleDayOfWeek}
                      onChange={(e) => setScheduleDayOfWeek(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </div>
                )}

                {scheduleFrequency === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Day of Month
                    </label>
                    <select
                      value={scheduleDayOfMonth}
                      onChange={(e) => setScheduleDayOfMonth(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day.toString()}>{day}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Days 1-28 to ensure consistency across months</p>
                  </div>
                )}

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

      {/* Branch Configuration - only show for repo settings, not branch settings */}
      {!fromBranch && (
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
      )}

      {/* AI Triage */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>AI Triage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Triage Mode
              </label>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="triageMode"
                    value="snippet"
                    checked={triageMode === 'snippet'}
                    onChange={() => setTriageMode('snippet')}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Snippet-only</span>
                    <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">Default</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Fast and cost-effective. AI analyzes only the code snippets flagged by scanners. Best for CI/CD pipelines where speed matters.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="triageMode"
                    value="full-file"
                    checked={triageMode === 'full-file'}
                    onChange={() => setTriageMode('full-file')}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Full-file context</span>
                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">Better fixes</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      AI reads the entire file for each finding. Provides better context for accurate triage and generates more complete code fixes. Slightly slower than snippet-only.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="triageMode"
                    value="none"
                    checked={triageMode === 'none'}
                    onChange={() => setTriageMode('none')}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Disabled</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Skip AI triage entirely. Findings will be stored without AI analysis or code fix generation.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {triageMode !== 'none' && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> AI triage runs on high and critical severity findings. It analyzes each finding to determine false positive likelihood, suggests remediation, and generates code fixes where possible.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* GitHub Write-back Settings */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>GitHub Write-back</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Master toggle */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <label className="flex items-center gap-3">
                <button
                  onClick={() => setWritebackSettings({ ...writebackSettings, enabled: !writebackSettings.enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    writebackSettings.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      writebackSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Enable GitHub Write-back</span>
                  <p className="text-xs text-gray-500">Post scan results back to GitHub (check runs, comments, annotations)</p>
                </div>
              </label>
            </div>

            {/* Sub-options (disabled when master toggle is off) */}
            <div className={`space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700 ${!writebackSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={writebackSettings.checkRunEnabled}
                  onChange={(e) => setWritebackSettings({ ...writebackSettings, checkRunEnabled: e.target.checked })}
                  disabled={!writebackSettings.enabled}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Post Check Run</span>
                  <p className="text-xs text-gray-500">Show pass/fail status on commits</p>
                </div>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={writebackSettings.prCommentsEnabled}
                  onChange={(e) => setWritebackSettings({ ...writebackSettings, prCommentsEnabled: e.target.checked })}
                  disabled={!writebackSettings.enabled}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Post PR Comments</span>
                  <p className="text-xs text-gray-500">Post summary comment on open pull requests</p>
                </div>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={writebackSettings.inlineAnnotations}
                  onChange={(e) => setWritebackSettings({ ...writebackSettings, inlineAnnotations: e.target.checked })}
                  disabled={!writebackSettings.enabled}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Inline Annotations</span>
                  <p className="text-xs text-gray-500">Show findings on specific code lines in PR diff</p>
                </div>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={writebackSettings.sarifUploadEnabled}
                  onChange={(e) => setWritebackSettings({ ...writebackSettings, sarifUploadEnabled: e.target.checked })}
                  disabled={!writebackSettings.enabled}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Upload SARIF</span>
                  <p className="text-xs text-gray-500">Upload results to GitHub Security tab (requires GitHub Advanced Security)</p>
                </div>
              </label>

              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Block PR on Severity
                </label>
                <select
                  value={writebackSettings.blockPrOnSeverity}
                  onChange={(e) => setWritebackSettings({ ...writebackSettings, blockPrOnSeverity: e.target.value as typeof writebackSettings.blockPrOnSeverity })}
                  disabled={!writebackSettings.enabled}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                >
                  <option value="none">None (Do not block)</option>
                  <option value="critical">Critical only</option>
                  <option value="high">High and above</option>
                  <option value="medium">Medium and above</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Set check run to failure if findings of this severity or higher are detected
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CLI/Pipeline Settings */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>CLI/Pipeline Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Master toggle */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <label className="flex items-center gap-3">
                <button
                  onClick={() => setCliSettings({ ...cliSettings, applySettingsForCLI: !cliSettings.applySettingsForCLI })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    cliSettings.applySettingsForCLI ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      cliSettings.applySettingsForCLI ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Apply these settings for CLI/Pipeline scans</span>
                  <p className="text-xs text-gray-500">When enabled, scans triggered via CLI will use these settings. Otherwise, minimal defaults apply.</p>
                </div>
              </label>
            </div>

            {/* Default settings info (when toggle is off) */}
            {!cliSettings.applySettingsForCLI && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">Minimal Defaults (currently active for CLI scans)</p>
                <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                  <li>• <strong>Scanners:</strong> Semgrep, Trivy, Gitleaks</li>
                  <li>• <strong>Write-back:</strong> PR Summary, Check Status</li>
                  <li>• <strong>Pipeline Gate:</strong> Fail on Critical severity</li>
                </ul>
                <p className="text-xs text-blue-500 mt-2">
                  CLI flags can always override these settings when triggering scans.
                </p>
              </div>
            )}

            {/* CLI Settings (enabled when master toggle is on) */}
            {cliSettings.applySettingsForCLI && (
              <div className="space-y-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                {/* Write-back options */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Write-back Options</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cliSettings.writeBackPRComments}
                        onChange={(e) => setCliSettings({ ...cliSettings, writeBackPRComments: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Inline PR comments</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cliSettings.writeBackPRSummary}
                        onChange={(e) => setCliSettings({ ...cliSettings, writeBackPRSummary: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">PR summary comment</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cliSettings.writeBackCheckStatus}
                        onChange={(e) => setCliSettings({ ...cliSettings, writeBackCheckStatus: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Check run status</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cliSettings.writeBackAnnotations}
                        onChange={(e) => setCliSettings({ ...cliSettings, writeBackAnnotations: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Code annotations</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cliSettings.writeBackSarif}
                        onChange={(e) => setCliSettings({ ...cliSettings, writeBackSarif: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Upload SARIF to Security tab</span>
                    </label>
                  </div>
                </div>

                {/* Comment settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Comment on Severities
                    </label>
                    <div className="space-y-1">
                      {['critical', 'high', 'medium', 'low'].map((sev) => (
                        <label key={sev} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={cliSettings.commentSeverities.includes(sev)}
                            onChange={(e) => {
                              const newSeverities = e.target.checked
                                ? [...cliSettings.commentSeverities, sev]
                                : cliSettings.commentSeverities.filter(s => s !== sev);
                              setCliSettings({ ...cliSettings, commentSeverities: newSeverities });
                            }}
                            className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{sev}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Comments
                    </label>
                    <input
                      type="number"
                      value={cliSettings.maxComments}
                      onChange={(e) => setCliSettings({ ...cliSettings, maxComments: parseInt(e.target.value) || 20 })}
                      min={1}
                      max={100}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Pipeline gate settings */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Pipeline Gate</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Fail on Severity
                      </label>
                      <select
                        value={cliSettings.failOnSeverity}
                        onChange={(e) => setCliSettings({ ...cliSettings, failOnSeverity: e.target.value as typeof cliSettings.failOnSeverity })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="none">None (never fail)</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Fail on Count
                      </label>
                      <input
                        type="number"
                        value={cliSettings.failOnCount}
                        onChange={(e) => setCliSettings({ ...cliSettings, failOnCount: parseInt(e.target.value) || 0 })}
                        min={0}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">0 = disabled (severity-based only)</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  Note: CLI command flags can override these settings when triggering scans.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* PR Settings - only show for repo settings, not branch settings */}
      {!fromBranch && (
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
