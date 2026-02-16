'use client';

import { useState, useEffect } from 'react';
import { platformStatsApi, PlatformStats, SystemHealth } from '@/lib/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // In production these would be real API calls
      // For now, we'll use placeholder data
      setStats({
        totalTenants: 12,
        activeTenants: 10,
        totalUsers: 145,
        totalRepositories: 89,
        totalScans: 1247,
        totalFindings: 3892,
        scansToday: 23,
        findingsToday: 156,
      });

      setHealth({
        api: { status: 'healthy', latency: 45 },
        database: { status: 'healthy', latency: 12 },
        redis: { status: 'healthy', latency: 3 },
        storage: { status: 'healthy', usage: 0.34 },
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'down':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Platform Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Overview of platform health and usage metrics.
        </p>
      </div>

      {/* System Health */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">System Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {health && (
            <>
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(health.api.status)}`} />
                <div>
                  <p className="text-sm font-medium text-white">API</p>
                  <p className="text-xs text-gray-400">{health.api.latency}ms</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(health.database.status)}`} />
                <div>
                  <p className="text-sm font-medium text-white">Database</p>
                  <p className="text-xs text-gray-400">{health.database.latency}ms</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(health.redis.status)}`} />
                <div>
                  <p className="text-sm font-medium text-white">Redis</p>
                  <p className="text-xs text-gray-400">{health.redis.latency}ms</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(health.storage.status)}`} />
                <div>
                  <p className="text-sm font-medium text-white">Storage</p>
                  <p className="text-xs text-gray-400">{Math.round(health.storage.usage * 100)}% used</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-400">Total Tenants</p>
          <p className="mt-2 text-3xl font-semibold text-white">{stats?.totalTenants || 0}</p>
          <p className="mt-1 text-sm text-green-400">{stats?.activeTenants || 0} active</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-400">Total Users</p>
          <p className="mt-2 text-3xl font-semibold text-white">{stats?.totalUsers || 0}</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-400">Repositories</p>
          <p className="mt-2 text-3xl font-semibold text-white">{stats?.totalRepositories || 0}</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-400">Total Scans</p>
          <p className="mt-2 text-3xl font-semibold text-white">{stats?.totalScans || 0}</p>
          <p className="mt-1 text-sm text-blue-400">+{stats?.scansToday || 0} today</p>
        </div>
      </div>

      {/* Findings Overview */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">Findings Overview</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-400">Total Findings</p>
            <p className="mt-2 text-3xl font-semibold text-white">{stats?.totalFindings || 0}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400">Findings Today</p>
            <p className="mt-2 text-3xl font-semibold text-yellow-400">+{stats?.findingsToday || 0}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="/tenants"
            className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            Manage Tenants
          </a>
          <a
            href="/settings"
            className="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-md transition-colors"
          >
            Platform Settings
          </a>
        </div>
      </div>
    </div>
  );
}
