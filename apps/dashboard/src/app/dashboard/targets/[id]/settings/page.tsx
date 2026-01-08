'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import {
  ArrowLeft,
  Save,
  Globe,
  Server,
  Shield,
  Trash2,
  AlertTriangle,
  Lock,
  Key,
  Cookie,
} from 'lucide-react';

interface Target {
  id: string;
  name: string;
  url: string;
  type: 'web_application' | 'api_endpoint' | 'network_service';
  description?: string;
  defaultScanMode?: 'quick' | 'standard' | 'comprehensive';
  scanConfig?: {
    scanners: string[];
    scanMode: 'quick' | 'standard' | 'comprehensive';
    authentication?: {
      type: 'none' | 'basic' | 'bearer' | 'cookie' | 'form';
      credentials?: Record<string, string>;
    };
    rateLimitPreset?: 'low' | 'medium' | 'high';
    excludePaths?: string[];
  };
}

const RATE_LIMIT_PRESETS = [
  { id: 'low', label: 'Low (Production Safe)', description: '50 RPS - Safe for production environments' },
  { id: 'medium', label: 'Medium (Staging)', description: '150 RPS - For staging/testing environments' },
  { id: 'high', label: 'High (Local Dev)', description: '300 RPS - For local development and isolated targets' },
];

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

// Scan mode configurations with capabilities
const SCAN_MODES = [
  {
    id: 'quick' as const,
    name: 'Quick Scan',
    time: '2-5 minutes',
    description: 'Fast discovery and critical vulnerability detection',
    capabilities: ['URL Discovery', 'Vulnerability Detection', 'SSL/TLS Analysis'],
  },
  {
    id: 'standard' as const,
    name: 'Standard Scan',
    time: '10-20 minutes',
    description: 'Thorough crawling with vulnerability scanning and passive analysis',
    capabilities: ['URL Discovery', 'Vulnerability Detection', 'SSL/TLS Analysis', 'Web Application Testing'],
    recommended: true,
  },
  {
    id: 'comprehensive' as const,
    name: 'Comprehensive Scan',
    time: '30+ minutes',
    description: 'Full security assessment with deep crawling and active testing',
    capabilities: ['URL Discovery', 'Vulnerability Detection', 'SSL/TLS Analysis', 'Web Application Testing', 'SQL Injection Testing', 'Web Server Analysis'],
  },
];

const AUTH_TYPES = [
  { id: 'none', label: 'No Authentication', icon: Globe, description: 'Scan without authentication' },
  { id: 'basic', label: 'Basic Auth', icon: Key, description: 'HTTP Basic authentication' },
  { id: 'bearer', label: 'Bearer Token', icon: Lock, description: 'JWT or API token' },
  { id: 'cookie', label: 'Session Cookie', icon: Cookie, description: 'Cookie-based authentication' },
];

export default function TargetSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const targetId = params.id as string;

  const [target, setTarget] = useState<Target | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<Target['type']>('web_application');
  const [description, setDescription] = useState('');
  const [scanMode, setScanMode] = useState<'quick' | 'standard' | 'comprehensive'>('standard');
  const [authType, setAuthType] = useState<'none' | 'basic' | 'bearer' | 'cookie'>('none');
  const [authCredentials, setAuthCredentials] = useState<Record<string, string>>({});
  const [rateLimitPreset, setRateLimitPreset] = useState<'low' | 'medium' | 'high'>('medium');
  const [excludePaths, setExcludePaths] = useState('');

  useEffect(() => {
    if (targetId) {
      loadTarget();
    }
  }, [targetId]);

  const loadTarget = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/targets/${targetId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTarget(data);

        // Populate form from API data
        setName(data.name);
        setUrl(data.url);
        setType(data.type);
        setDescription(data.description || '');
        // Map legacy values to new modes
        const mode = data.defaultScanMode === 'optimized' ? 'standard' :
                     data.defaultScanMode === 'full' ? 'comprehensive' :
                     data.defaultScanMode || 'standard';
        if (['quick', 'standard', 'comprehensive'].includes(mode)) {
          setScanMode(mode as 'quick' | 'standard' | 'comprehensive');
        }
        setAuthType(data.authType || 'none');
        setAuthCredentials(data.authCredentials || {});
        setRateLimitPreset(data.rateLimitPreset || 'medium');
        setExcludePaths((data.excludePaths || []).join('\n'));
      }
    } catch (error) {
      console.error('Failed to load target:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/targets/${targetId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          type,
          description,
          defaultScanMode: scanMode,
          authType,
          authCredentials: authType !== 'none' ? authCredentials : undefined,
          rateLimitPreset,
          excludePaths: excludePaths.split('\n').filter(p => p.trim()),
        }),
      });

      if (res.ok) {
        alert('Settings saved successfully!');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this target? All scan history will be lost.')) {
      return;
    }

    setDeleting(true);
    try {
      await fetch(`${API_URL}/targets/${targetId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      router.push('/dashboard/targets');
    } catch (error) {
      console.error('Failed to delete target:', error);
      alert('Failed to delete target. Please try again.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Target Not Found</h3>
          <Link
            href="/dashboard/targets"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Targets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/targets/${targetId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Target
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Target Settings</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Configure scanning options for {target.name}
        </p>
      </div>

      {/* General Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">General</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Target['type'])}
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      </div>

      {/* Scan Mode Configuration */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Default Scan Mode</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Select the default scan mode for this target. You can override this when starting a scan.
        </p>
        <div className="space-y-3">
          {SCAN_MODES.map((mode) => (
            <label
              key={mode.id}
              className={`flex items-start gap-3 cursor-pointer p-4 rounded-lg border transition-all ${
                scanMode === mode.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <input
                type="radio"
                name="scanMode"
                value={mode.id}
                checked={scanMode === mode.id}
                onChange={() => setScanMode(mode.id)}
                className="text-blue-600 mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-white">{mode.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">({mode.time})</span>
                  {mode.recommended && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{mode.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {mode.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Authentication */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Authentication</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {AUTH_TYPES.map((auth) => (
              <button
                key={auth.id}
                type="button"
                onClick={() => setAuthType(auth.id as any)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  authType === auth.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <auth.icon className={`w-5 h-5 mb-2 ${authType === auth.id ? 'text-blue-600' : 'text-slate-400'}`} />
                <div className="font-medium text-sm text-slate-900 dark:text-white">{auth.label}</div>
              </button>
            ))}
          </div>

          {authType === 'basic' && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={authCredentials.username || ''}
                  onChange={(e) => setAuthCredentials({ ...authCredentials, username: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={authCredentials.password || ''}
                  onChange={(e) => setAuthCredentials({ ...authCredentials, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {authType === 'bearer' && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Token
              </label>
              <input
                type="password"
                value={authCredentials.token || ''}
                onChange={(e) => setAuthCredentials({ ...authCredentials, token: e.target.value })}
                placeholder="Bearer token or API key"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {authType === 'cookie' && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cookie Value
              </label>
              <input
                type="text"
                value={authCredentials.cookie || ''}
                onChange={(e) => setAuthCredentials({ ...authCredentials, cookie: e.target.value })}
                placeholder="session=abc123; auth=xyz789"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Advanced</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Rate Limit Preset
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {RATE_LIMIT_PRESETS.map((preset) => (
                <label
                  key={preset.id}
                  className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-colors ${
                    rateLimitPreset === preset.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="rateLimitPreset"
                    checked={rateLimitPreset === preset.id}
                    onChange={() => setRateLimitPreset(preset.id as 'low' | 'medium' | 'high')}
                    className="text-blue-600 mt-1"
                  />
                  <div>
                    <span className="font-medium text-slate-900 dark:text-white">{preset.label}</span>
                    <p className="text-xs text-slate-500 mt-1">{preset.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Exclude Paths (one per line)
            </label>
            <textarea
              value={excludePaths}
              onChange={(e) => setExcludePaths(e.target.value)}
              rows={4}
              placeholder="/logout&#10;/admin/*&#10;*.pdf"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          {deleting ? 'Deleting...' : 'Delete Target'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
