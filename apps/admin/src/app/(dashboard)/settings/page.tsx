'use client';

import { useState, useEffect } from 'react';
import { platformConfigApi, PlatformConfig } from '@/lib/api';

export default function SettingsPage() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [aiApiKey, setAiApiKey] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // Placeholder data for now
      setConfig({
        id: '1',
        aiProvider: 'anthropic',
        aiModel: 'claude-sonnet-4-20250514',
        aiApiKeySet: true,
        defaultPlan: 'free',
        defaultMaxUsers: 5,
        defaultMaxRepositories: 10,
        maintenanceMode: false,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      await platformConfigApi.update(config);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAiKey = async () => {
    if (!aiApiKey) return;
    setSaving(true);
    setMessage(null);
    try {
      await platformConfigApi.updateAiKey(aiApiKey);
      setAiApiKey('');
      setConfig((prev) => prev ? { ...prev, aiApiKeySet: true } : null);
      setMessage({ type: 'success', text: 'AI API key updated successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update AI API key' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Platform Settings</h1>
        <p className="mt-1 text-sm text-gray-400">
          Configure global platform settings and AI integration.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md ${
            message.type === 'success'
              ? 'bg-green-900/50 text-green-200 border border-green-800'
              : 'bg-red-900/50 text-red-200 border border-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* AI Configuration */}
      <div className="bg-gray-900 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-medium text-white">AI Configuration</h2>
          <p className="text-sm text-gray-400">Configure AI-powered triage settings.</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">AI Provider</label>
            <select
              value={config.aiProvider}
              onChange={(e) => setConfig({ ...config, aiProvider: e.target.value })}
              className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">AI Model</label>
            <select
              value={config.aiModel}
              onChange={(e) => setConfig({ ...config, aiModel: e.target.value })}
              className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {config.aiProvider === 'anthropic' ? (
                <>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</option>
                  <option value="claude-opus-4-20250514">Claude Opus 4</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                </>
              ) : (
                <>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">
              API Key {config.aiApiKeySet && <span className="text-green-400">(Set)</span>}
            </label>
            <div className="mt-1 flex space-x-2">
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={config.aiApiKeySet ? '••••••••••••••••' : 'Enter API key'}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleUpdateAiKey}
                disabled={!aiApiKey || saving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
              >
                Update Key
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Default Tenant Settings */}
      <div className="bg-gray-900 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-medium text-white">Default Tenant Settings</h2>
          <p className="text-sm text-gray-400">Configure defaults for new tenants.</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Default Plan</label>
            <select
              value={config.defaultPlan}
              onChange={(e) => setConfig({ ...config, defaultPlan: e.target.value })}
              className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">Default Max Users</label>
              <input
                type="number"
                value={config.defaultMaxUsers}
                onChange={(e) => setConfig({ ...config, defaultMaxUsers: parseInt(e.target.value) })}
                className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300">Default Max Repositories</label>
              <input
                type="number"
                value={config.defaultMaxRepositories}
                onChange={(e) => setConfig({ ...config, defaultMaxRepositories: parseInt(e.target.value) })}
                className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Mode */}
      <div className="bg-gray-900 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-medium text-white">Maintenance Mode</h2>
          <p className="text-sm text-gray-400">Enable maintenance mode to prevent user access.</p>
        </div>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-300">Maintenance Mode</p>
              <p className="text-sm text-gray-500">
                When enabled, only platform admins can access the system.
              </p>
            </div>
            <button
              onClick={() => setConfig({ ...config, maintenanceMode: !config.maintenanceMode })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                config.maintenanceMode ? 'bg-red-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  config.maintenanceMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
