'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardContent, Button, useToast } from '@/components/ui';
import { settingsApi } from '@/lib/api';

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  plan: string;
  aiTriageEnabled: boolean;
  auditRetentionDays: number;
  findingRetentionDays: number;
  scanRetentionDays: number;
  maxRepositories: number;
  maxUsers: number;
  allowProjectConnections: boolean;
}

export default function OrgGeneralSettingsPage() {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toastCtx = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await settingsApi.tenant();
        setSettings(data);
      } catch (err) {
        toastCtx.error('Error', 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleToggle = async (field: keyof TenantSettings, value: boolean) => {
    if (!settings) return;

    setSaving(true);
    try {
      const updated = await settingsApi.updateTenant({ [field]: value });
      setSettings(updated);
      toastCtx.success('Saved', 'Settings updated successfully');
    } catch (err) {
      toastCtx.error('Error', 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="General Settings"
          breadcrumbs={[
            { label: 'Settings', href: '/dashboard/settings' },
            { label: 'Organization', href: '/dashboard/settings/org' },
            { label: 'General' },
          ]}
        />
        <div className="animate-pulse">
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="General Settings"
          breadcrumbs={[
            { label: 'Settings', href: '/dashboard/settings' },
            { label: 'Organization', href: '/dashboard/settings/org' },
            { label: 'General' },
          ]}
        />
        <Card variant="bordered">
          <CardContent className="p-6 text-center text-gray-500">
            Failed to load settings
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="General Settings"
        description="Configure organization-wide settings"
        breadcrumbs={[
          { label: 'Settings', href: '/dashboard/settings' },
          { label: 'Organization', href: '/dashboard/settings/org' },
          { label: 'General' },
        ]}
      />

      {/* Organization Info */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Organization Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Organization Name
              </label>
              <p className="text-gray-900 dark:text-white">{settings.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Slug
              </label>
              <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                {settings.slug}
              </code>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Plan
              </label>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
                {settings.plan}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Settings */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Project Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  Allow Projects to Create SCM Connections
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  When enabled, project members can add their own SCM connections within projects.
                  When disabled, only organization admins can manage SCM connections.
                </p>
              </div>
              <button
                onClick={() => handleToggle('allowProjectConnections', !settings.allowProjectConnections)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.allowProjectConnections ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.allowProjectConnections ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>AI Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">
                  AI Auto-Triage
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Automatically analyze findings using AI to identify false positives and prioritize vulnerabilities.
                </p>
              </div>
              <button
                onClick={() => handleToggle('aiTriageEnabled', !settings.aiTriageEnabled)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.aiTriageEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.aiTriageEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Limits */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{settings.maxRepositories}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Max Repositories</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{settings.maxUsers}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Max Users</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{settings.scanRetentionDays}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Scan Retention (days)</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{settings.findingRetentionDays}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Finding Retention (days)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
