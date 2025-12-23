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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'acknowledged' | 'resolved';
  matchedEvents: number;
  threshold: number;
  timeWindow: number;
  message: string;
  triggeredAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.append('status', statusFilter);

        const res = await fetch(`${API_URL}/siem/alerts?${params.toString()}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setAlerts(data.alerts || []);
        } else {
          setAlerts([]);
        }
      } catch (err) {
        console.error('Failed to fetch alerts:', err);
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [statusFilter]);

  const handleAcknowledge = async (alertId: string) => {
    setUpdating(alertId);
    try {
      await fetch(`${API_URL}/siem/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        credentials: 'include',
      });
      setAlerts(alerts.map(a =>
        a.id === alertId ? { ...a, status: 'acknowledged', acknowledgedAt: new Date().toISOString() } : a
      ));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setUpdating(null);
    }
  };

  const handleResolve = async (alertId: string) => {
    setUpdating(alertId);
    try {
      await fetch(`${API_URL}/siem/alerts/${alertId}/resolve`, {
        method: 'POST',
        credentials: 'include',
      });
      setAlerts(alerts.map(a =>
        a.id === alertId ? { ...a, status: 'resolved', resolvedAt: new Date().toISOString() } : a
      ));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="danger">Open</Badge>;
      case 'acknowledged':
        return <Badge variant="warning">Acknowledged</Badge>;
      case 'resolved':
        return <Badge variant="success">Resolved</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading alerts...</div>
      </div>
    );
  }

  const openCount = alerts.filter(a => a.status === 'open').length;
  const acknowledgedCount = alerts.filter(a => a.status === 'acknowledged').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/siem"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alerts</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage triggered security alerts
          </p>
        </div>
        <Link href="/dashboard/siem/rules">
          <Button variant="outline">
            Configure Rules
          </Button>
        </Link>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setStatusFilter('open')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            statusFilter === 'open'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Open ({openCount})
        </button>
        <button
          onClick={() => setStatusFilter('acknowledged')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            statusFilter === 'acknowledged'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Acknowledged ({acknowledgedCount})
        </button>
        <button
          onClick={() => setStatusFilter('resolved')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            statusFilter === 'resolved'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Resolved
        </button>
        <button
          onClick={() => setStatusFilter('')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            statusFilter === ''
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          All
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <Card variant="bordered">
          <CardContent className="py-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="mt-4 text-gray-500 dark:text-gray-400">No alerts found</p>
            <p className="text-sm text-gray-400">Alerts will appear here when rules are triggered</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card key={alert.id} variant="bordered">
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-lg ${
                        alert.severity === 'critical' ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400' :
                        alert.severity === 'high' ? 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400' :
                        alert.severity === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400' :
                        'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={alert.severity} />
                        {getStatusBadge(alert.status)}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mt-1">
                        {alert.ruleName}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>
                          <strong>{alert.matchedEvents}</strong> events matched
                        </span>
                        <span>
                          Threshold: {alert.threshold} in {alert.timeWindow}m
                        </span>
                        <span>
                          Triggered: {formatTime(alert.triggeredAt)}
                        </span>
                      </div>
                      {alert.acknowledgedAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Acknowledged at {formatTime(alert.acknowledgedAt)}
                          {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
                        </p>
                      )}
                      {alert.resolvedAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Resolved at {formatTime(alert.resolvedAt)}
                          {alert.resolvedBy && ` by ${alert.resolvedBy}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.status === 'open' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={updating === alert.id}
                      >
                        {updating === alert.id ? 'Updating...' : 'Acknowledge'}
                      </Button>
                    )}
                    {(alert.status === 'open' || alert.status === 'acknowledged') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResolve(alert.id)}
                        disabled={updating === alert.id}
                      >
                        {updating === alert.id ? 'Updating...' : 'Resolve'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
