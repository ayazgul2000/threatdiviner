'use client';

import { useState, useEffect } from 'react';
import { notificationsApi, NotificationConfig } from '@/lib/api';

export default function NotificationsSettingsPage() {
  const [config, setConfig] = useState<NotificationConfig>({
    slackEnabled: false,
    slackWebhookUrl: null,
    slackChannel: null,
    notifyOnScanStart: false,
    notifyOnScanComplete: true,
    notifyOnCritical: true,
    notifyOnHigh: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await notificationsApi.getConfig();
      setConfig(data);
    } catch (error) {
      console.error('Failed to load notification config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await notificationsApi.updateConfig(config);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const result = await notificationsApi.testSlack();
      if (result.success) {
        setMessage({ type: 'success', text: 'Test message sent successfully!' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Test failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to send test message' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Notification Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure how you receive notifications about scans and findings.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Slack Integration</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">Enable Slack Notifications</label>
              <p className="text-sm text-gray-500">Send notifications to a Slack channel</p>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, slackEnabled: !config.slackEnabled })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                config.slackEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  config.slackEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {config.slackEnabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Webhook URL</label>
                <input
                  type="password"
                  value={config.slackWebhookUrl || ''}
                  onChange={(e) => setConfig({ ...config, slackWebhookUrl: e.target.value })}
                  placeholder="https://hooks.slack.com/services/..."
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Create an incoming webhook in your Slack workspace settings
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Channel (optional)</label>
                <input
                  type="text"
                  value={config.slackChannel || ''}
                  onChange={(e) => setConfig({ ...config, slackChannel: e.target.value })}
                  placeholder="#security-alerts"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Override the default channel configured in the webhook
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Notification Events</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.notifyOnScanStart}
                      onChange={(e) => setConfig({ ...config, notifyOnScanStart: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Scan started</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.notifyOnScanComplete}
                      onChange={(e) => setConfig({ ...config, notifyOnScanComplete: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Scan completed</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.notifyOnCritical}
                      onChange={(e) => setConfig({ ...config, notifyOnCritical: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Critical findings detected</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.notifyOnHigh}
                      onChange={(e) => setConfig({ ...config, notifyOnHigh: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">High severity findings detected</span>
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleTest}
                  disabled={testing || !config.slackWebhookUrl}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing ? 'Sending...' : 'Send Test Message'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
