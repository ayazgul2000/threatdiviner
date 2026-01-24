'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  feedsApi,
  FeedConfig,
  FeedSyncRun,
  FeedStats,
  SchedulePreset,
  CreateFeedConfigData,
  UpdateFeedConfigData,
  SetScheduleData,
} from '@/lib/api';

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  healthy: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  error: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
  disabled: { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-400' },
};

const SYNC_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '-';
  const durationMs = new Date(end).getTime() - new Date(start).getTime();
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function getFeedStatus(feed: FeedConfig): { status: string; message: string } {
  if (!feed.isEnabled) {
    return { status: 'disabled', message: 'Disabled' };
  }
  if (!feed.lastRun) {
    return { status: 'warning', message: 'Not synced yet' };
  }
  if (feed.lastRun.status === 'failed') {
    return { status: 'error', message: 'Last sync failed' };
  }
  if (feed.lastRun.status === 'running') {
    return { status: 'warning', message: 'Syncing...' };
  }
  return { status: 'healthy', message: 'Healthy' };
}

export default function FeedsPage() {
  const [feeds, setFeeds] = useState<FeedConfig[]>([]);
  const [stats, setStats] = useState<FeedStats | null>(null);
  const [presets, setPresets] = useState<SchedulePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [enabledFilter, setEnabledFilter] = useState('');

  // Modal states
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingFeed, setEditingFeed] = useState<FeedConfig | null>(null);
  const [formData, setFormData] = useState<CreateFeedConfigData>({
    feedId: '',
    name: '',
    description: '',
    sourceUrl: '',
    schedule: '0 0 * * 0',
    isEnabled: true,
  });

  // Schedule modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleFeedId, setScheduleFeedId] = useState<string | null>(null);
  const [schedulePreset, setSchedulePreset] = useState<string>('weekly');
  const [customCron, setCustomCron] = useState('');

  // Sync log modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<FeedConfig | null>(null);
  const [syncRuns, setSyncRuns] = useState<FeedSyncRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  // Test connection
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Syncing state
  const [syncingFeedId, setSyncingFeedId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchFeeds = useCallback(async () => {
    try {
      setLoading(true);
      const result = await feedsApi.list({
        search: search || undefined,
        isEnabled: enabledFilter || undefined,
      });
      setFeeds(result.feeds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feeds');
    } finally {
      setLoading(false);
    }
  }, [search, enabledFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const result = await feedsApi.getStats();
      setStats(result.stats);
    } catch {
      // Silently fail
    }
  }, []);

  const fetchPresets = useCallback(async () => {
    try {
      const result = await feedsApi.getSchedulePresets();
      setPresets(result.presets);
    } catch {
      // Silently fail - use default presets
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
    fetchStats();
    fetchPresets();
  }, [fetchFeeds, fetchStats, fetchPresets]);

  const handleCreate = () => {
    setEditingFeed(null);
    setFormData({
      feedId: '',
      name: '',
      description: '',
      sourceUrl: '',
      schedule: '0 0 * * 0',
      isEnabled: true,
    });
    setTestResult(null);
    setShowConfigModal(true);
  };

  const handleEdit = (feed: FeedConfig) => {
    setEditingFeed(feed);
    setFormData({
      feedId: feed.feedId,
      name: feed.name,
      description: feed.description || '',
      sourceUrl: feed.sourceUrl,
      schedule: feed.schedule,
      isEnabled: feed.isEnabled,
    });
    setTestResult(null);
    setShowConfigModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingFeed) {
        const updateData: UpdateFeedConfigData = {
          name: formData.name,
          description: formData.description,
          sourceUrl: formData.sourceUrl,
          schedule: formData.schedule,
          isEnabled: formData.isEnabled,
        };
        await feedsApi.update(editingFeed.id, updateData);
      } else {
        await feedsApi.create(formData);
      }
      setShowConfigModal(false);
      fetchFeeds();
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await feedsApi.delete(id);
      setDeletingId(null);
      fetchFeeds();
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feed');
    }
  };

  const handleTestConnection = async () => {
    if (!formData.sourceUrl) return;

    setTestingConnection(true);
    setTestResult(null);

    try {
      const result = await feedsApi.testConnection(formData.sourceUrl);
      setTestResult({
        success: result.success,
        message: `${result.message}${result.responseTime ? ` (${result.responseTime}ms)` : ''}`,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTriggerSync = async (feedId: string) => {
    try {
      setSyncingFeedId(feedId);
      await feedsApi.triggerSync(feedId);
      // Refresh to show running status
      await fetchFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger sync');
    } finally {
      setSyncingFeedId(null);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncingAll(true);
      await feedsApi.triggerSyncAll();
      await fetchFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger sync all');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleViewLog = async (feed: FeedConfig) => {
    setSelectedFeed(feed);
    setLoadingRuns(true);
    setShowLogModal(true);

    try {
      const result = await feedsApi.listSyncRuns(feed.id, { limit: 20 });
      setSyncRuns(result.syncRuns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sync history');
    } finally {
      setLoadingRuns(false);
    }
  };

  const handleOpenSchedule = (feed: FeedConfig) => {
    setScheduleFeedId(feed.id);
    // Determine current preset from cron
    const currentPreset = presets.find(p => p.cron === feed.schedule);
    setSchedulePreset(currentPreset?.value || 'custom');
    setCustomCron(feed.schedule);
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleFeedId) return;

    try {
      const data: SetScheduleData = {
        preset: schedulePreset as SetScheduleData['preset'],
        customCron: schedulePreset === 'custom' ? customCron : undefined,
      };
      await feedsApi.setSchedule(scheduleFeedId, data);
      setShowScheduleModal(false);
      fetchFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
    }
  };

  const handleToggleEnabled = async (feed: FeedConfig) => {
    try {
      await feedsApi.update(feed.id, { isEnabled: !feed.isEnabled });
      fetchFeeds();
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Feed Synchronization</h1>
          <p className="mt-1 text-sm text-gray-400">
            Monitor and manage synchronization of external security data feeds.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSyncAll}
            disabled={syncingAll || feeds.filter(f => f.isEnabled).length === 0}
            className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
          >
            {syncingAll ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync All
              </>
            )}
          </button>
          <button
            onClick={handleCreate}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            + Add Feed
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-900/50 border border-red-700 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium text-red-200">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-200 hover:text-red-100">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Total Feeds</p>
            <p className="text-2xl font-semibold text-white">{stats.totalFeeds}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Enabled</p>
            <p className="text-2xl font-semibold text-green-400">{stats.enabledFeeds}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Disabled</p>
            <p className="text-2xl font-semibold text-gray-400">{stats.disabledFeeds}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Syncs (24h)</p>
            <p className="text-2xl font-semibold text-white">{stats.recentRuns}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400">Failed (24h)</p>
            <p className="text-2xl font-semibold text-red-400">{stats.failedRuns}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Search feeds..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-md bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <select
            value={enabledFilter}
            onChange={(e) => setEnabledFilter(e.target.value)}
            className="block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">All Feeds</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
          <div className="text-sm text-gray-400 self-center">
            Showing {feeds.length} feeds
          </div>
        </div>
      </div>

      {/* Feed Cards */}
      {loading ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">Loading...</div>
      ) : feeds.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-white">No feed configurations</h3>
          <p className="mt-2 text-sm text-gray-400">
            Click &quot;+ Add Feed&quot; to configure your first data feed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {feeds.map((feed) => {
            const { status, message } = getFeedStatus(feed);
            const statusColors = STATUS_COLORS[status];

            return (
              <div key={feed.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-white">{feed.name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
                        <span className={`w-1.5 h-1.5 mr-1.5 rounded-full ${statusColors.dot}`} />
                        {message}
                      </span>
                      {!feed.isEnabled && (
                        <span className="text-xs text-gray-500">(Disabled)</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-400">
                      Source: <span className="text-gray-300">{feed.sourceUrl}</span>
                    </p>
                    {feed.description && (
                      <p className="mt-1 text-sm text-gray-500">{feed.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={feed.isEnabled}
                        onChange={() => handleToggleEnabled(feed)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-gray-500">Last Sync</p>
                    <p className="text-sm text-gray-300">{formatDate(feed.lastSyncAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Next Sync</p>
                    <p className="text-sm text-gray-300">{feed.isEnabled ? formatDate(feed.nextSyncAt) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Schedule</p>
                    <p className="text-sm text-gray-300 font-mono">{feed.schedule}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Runs</p>
                    <p className="text-sm text-gray-300">{feed.totalRuns || 0}</p>
                  </div>
                </div>

                {feed.lastRun && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-xs text-gray-500 mb-2">Last Run</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${SYNC_STATUS_COLORS[feed.lastRun.status]}`}>
                        {feed.lastRun.status}
                      </span>
                      {feed.lastRun.status === 'completed' && (
                        <>
                          <span className="text-green-400">+{feed.lastRun.recordsAdded} added</span>
                          <span className="text-blue-400">{feed.lastRun.recordsUpdated} updated</span>
                          {feed.lastRun.recordsDeleted > 0 && (
                            <span className="text-red-400">-{feed.lastRun.recordsDeleted} deleted</span>
                          )}
                        </>
                      )}
                      {feed.lastRun.status === 'failed' && feed.lastRun.errorMessage && (
                        <span className="text-red-400 text-xs">{feed.lastRun.errorMessage}</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end gap-3">
                  {deletingId === feed.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 text-xs">Delete feed?</span>
                      <button
                        onClick={() => handleDelete(feed.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="text-gray-400 hover:text-gray-300 text-sm"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleViewLog(feed)}
                        className="px-3 py-1.5 text-sm text-gray-300 hover:text-white"
                      >
                        View Log
                      </button>
                      <button
                        onClick={() => handleTriggerSync(feed.id)}
                        disabled={syncingFeedId === feed.id || feed.lastRun?.status === 'running'}
                        className="px-3 py-1.5 text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                      >
                        {syncingFeedId === feed.id || feed.lastRun?.status === 'running' ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <button
                        onClick={() => handleOpenSchedule(feed)}
                        className="px-3 py-1.5 text-sm text-gray-300 hover:text-white"
                      >
                        Schedule
                      </button>
                      <button
                        onClick={() => handleEdit(feed)}
                        className="px-3 py-1.5 text-sm text-gray-300 hover:text-white"
                      >
                        Configure
                      </button>
                      <button
                        onClick={() => setDeletingId(feed.id)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-black bg-opacity-75" onClick={() => setShowConfigModal(false)} />
            <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
              <div className="px-6 py-4 border-b border-gray-700">
                <h3 className="text-lg font-medium text-white">
                  {editingFeed ? `Configure Feed: ${editingFeed.name}` : 'Add New Feed'}
                </h3>
              </div>

              <div className="px-6 py-4 space-y-4">
                {!editingFeed && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Feed ID *</label>
                    <input
                      type="text"
                      value={formData.feedId}
                      onChange={(e) => setFormData({ ...formData, feedId: e.target.value })}
                      placeholder="e.g., cwe, capec, nist, attack"
                      className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">Unique identifier for this feed (lowercase, no spaces)</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300">Feed Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., CWE (Common Weakness Enumeration)"
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">Source URL *</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="url"
                      value={formData.sourceUrl}
                      onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                      placeholder="https://cwe.mitre.org/data/xml/cwec_latest.xml.zip"
                      className="flex-1 rounded-md bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                    <button
                      onClick={handleTestConnection}
                      disabled={!formData.sourceUrl || testingConnection}
                      className="px-3 py-2 text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-500 disabled:opacity-50"
                    >
                      {testingConnection ? 'Testing...' : 'Test'}
                    </button>
                  </div>
                  {testResult && (
                    <p className={`mt-1 text-xs ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                      {testResult.success ? '✓' : '✗'} {testResult.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">Schedule (Cron)</label>
                  <input
                    type="text"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    placeholder="0 3 * * 0"
                    className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white placeholder-gray-400 font-mono focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Cron expression (minute hour day month weekday). Default: Weekly Sunday at midnight.
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isEnabled"
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-600 rounded bg-gray-700"
                  />
                  <label htmlFor="isEnabled" className="ml-2 block text-sm text-gray-300">
                    Enable automatic synchronization
                  </label>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.name || !formData.sourceUrl || (!editingFeed && !formData.feedId)}
                  className="px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {editingFeed ? 'Save Changes' : 'Create Feed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-black bg-opacity-75" onClick={() => setShowScheduleModal(false)} />
            <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b border-gray-700">
                <h3 className="text-lg font-medium text-white">Set Schedule</h3>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Frequency</label>
                  <div className="space-y-2">
                    {presets.map((preset) => (
                      <label key={preset.value} className="flex items-center">
                        <input
                          type="radio"
                          name="schedule"
                          value={preset.value}
                          checked={schedulePreset === preset.value}
                          onChange={(e) => setSchedulePreset(e.target.value)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-600 bg-gray-700"
                        />
                        <span className="ml-2 text-sm text-gray-300">{preset.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {schedulePreset === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Custom Cron Expression</label>
                    <input
                      type="text"
                      value={customCron}
                      onChange={(e) => setCustomCron(e.target.value)}
                      placeholder="0 3 * * *"
                      className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white placeholder-gray-400 font-mono focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">Format: minute hour day month weekday</p>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSchedule}
                  disabled={schedulePreset === 'custom' && !customCron}
                  className="px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Log Modal */}
      {showLogModal && selectedFeed && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-black bg-opacity-75" onClick={() => setShowLogModal(false)} />
            <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Sync History: {selectedFeed.name}</h3>
                <button onClick={() => setShowLogModal(false)} className="text-gray-400 hover:text-white">
                  &times;
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {loadingRuns ? (
                  <div className="text-center text-gray-400 py-8">Loading...</div>
                ) : syncRuns.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">No sync runs yet</div>
                ) : (
                  <div className="space-y-3">
                    {syncRuns.map((run) => (
                      <div key={run.id} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${SYNC_STATUS_COLORS[run.status]}`}>
                            {run.status}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(run.createdAt)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Duration:</span>{' '}
                            <span className="text-gray-300">{formatDuration(run.startedAt, run.completedAt)}</span>
                          </div>
                          {run.status === 'completed' && (
                            <>
                              <div>
                                <span className="text-gray-500">Added:</span>{' '}
                                <span className="text-green-400">{run.recordsAdded}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Updated:</span>{' '}
                                <span className="text-blue-400">{run.recordsUpdated}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Deleted:</span>{' '}
                                <span className="text-red-400">{run.recordsDeleted}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {run.errorMessage && (
                          <div className="mt-2 p-2 bg-red-900/30 rounded text-xs text-red-300">
                            {run.errorMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-700 flex justify-end">
                <button
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md text-gray-300 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
