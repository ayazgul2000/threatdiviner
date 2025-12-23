'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  SeverityBadge,
  Button,
} from '@/components/ui';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SecurityEvent {
  id: string;
  timestamp: string;
  eventType: string;
  source: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

interface EventStats {
  totalEvents: number;
  criticalEvents: number;
  activeAlerts: number;
  eventsBySource: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsTimeline: Array<{ date: string; count: number }>;
}

export default function SiemPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    severity: '',
    source: '',
    timeRange: '24h',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        if (filters.severity) params.append('severity', filters.severity);
        if (filters.source) params.append('source', filters.source);
        params.append('timeRange', filters.timeRange);

        const [eventsRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/siem/events?${params.toString()}`, { credentials: 'include' }),
          fetch(`${API_URL}/siem/stats?${params.toString()}`, { credentials: 'include' }),
        ]);

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setEvents(eventsData.events || []);
        } else {
          setEvents([]);
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        } else {
          // Mock stats
          setStats({
            totalEvents: 0,
            criticalEvents: 0,
            activeAlerts: 0,
            eventsBySource: {},
            eventsBySeverity: {},
            eventsTimeline: [],
          });
        }
      } catch (err) {
        console.error('Failed to fetch SIEM data:', err);
        setEvents([]);
        setStats({
          totalEvents: 0,
          criticalEvents: 0,
          activeAlerts: 0,
          eventsBySource: {},
          eventsBySeverity: {},
          eventsTimeline: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      scan: 'info',
      cspm: 'warning',
      auth: 'success',
      api: 'default',
      webhook: 'default',
      system: 'danger',
    };
    return <Badge variant={colors[source] as any || 'default'}>{source}</Badge>;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading SIEM dashboard...</div>
      </div>
    );
  }

  const severityData = stats ? Object.entries(stats.eventsBySeverity).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count: value,
  })) : [];

  const sourceData = stats ? Object.entries(stats.eventsBySource).map(([name, value]) => ({
    name,
    count: value,
  })) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Events</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Monitor and analyze security events in real-time
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/siem/alerts">
            <Button variant="outline">
              View Alerts
            </Button>
          </Link>
          <Link href="/dashboard/siem/rules">
            <Button variant="outline">
              Manage Rules
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Events</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
              {stats?.totalEvents || 0}
            </p>
            <p className="text-xs text-gray-500 mt-2">Last {filters.timeRange}</p>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">Critical Events</p>
            <p className="text-3xl font-bold text-red-600 mt-1">
              {stats?.criticalEvents || 0}
            </p>
            <p className="text-xs text-gray-500 mt-2">Require attention</p>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">Active Alerts</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">
              {stats?.activeAlerts || 0}
            </p>
            <Link href="/dashboard/siem/alerts" className="text-xs text-blue-600 hover:underline mt-2 block">
              View all alerts
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      {stats && (severityData.length > 0 || sourceData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Events by Severity */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Events by Severity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" name="Events" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Events by Source */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Events by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" name="Events" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Time Range
          </label>
          <select
            value={filters.timeRange}
            onChange={(e) => setFilters({ ...filters, timeRange: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Severity
          </label>
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Source
          </label>
          <select
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All Sources</option>
            <option value="scan">Scan</option>
            <option value="cspm">CSPM</option>
            <option value="auth">Auth</option>
            <option value="api">API</option>
            <option value="webhook">Webhook</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>

      {/* Events Timeline */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Events Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No events found for the selected filters.
            </p>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div
                    className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                      event.severity === 'critical' ? 'bg-red-500' :
                      event.severity === 'high' ? 'bg-orange-500' :
                      event.severity === 'medium' ? 'bg-yellow-500' :
                      event.severity === 'low' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SeverityBadge severity={event.severity} />
                      {getSourceBadge(event.source)}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white mt-1">
                      {event.title}
                    </p>
                    {event.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {event.description}
                      </p>
                    )}
                    {event.tags && event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {event.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
