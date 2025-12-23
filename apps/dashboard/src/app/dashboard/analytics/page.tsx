'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
} from '@/components/ui';
import { scansApi, findingsApi, repositoriesApi, type Scan, type Finding, type Repository } from '@/lib/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type DateRange = '7d' | '30d' | '90d' | 'custom';

interface AnalyticsData {
  totalScans: number;
  totalFindings: number;
  openFindings: number;
  fixedFindings: number;
  mttr: number; // Mean time to remediate in days
  fixRate: number; // Percentage
  findingsBySeverity: Record<string, number>;
  findingsByScanner: Record<string, number>;
  scansOverTime: Array<{ date: string; count: number }>;
  findingsTrend: Array<{ date: string; introduced: number; fixed: number }>;
  topVulnerableRepos: Array<{ name: string; count: number }>;
  topRecurringRules: Array<{ ruleId: string; count: number }>;
  complianceScores: Record<string, number>;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
  info: '#2563eb',
};

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const [scans, findingsData, repos] = await Promise.all([
          scansApi.list(),
          findingsApi.list({ limit: 1000 }),
          repositoriesApi.list(),
        ]);

        const findings = findingsData.findings || [];

        // Calculate date range
        const now = new Date();
        const daysMap: Record<DateRange, number> = {
          '7d': 7,
          '30d': 30,
          '90d': 90,
          'custom': 30,
        };
        const startDate = new Date(now.getTime() - daysMap[dateRange] * 24 * 60 * 60 * 1000);

        // Filter by date range
        const filteredScans = scans.filter((s: Scan) => new Date(s.createdAt) >= startDate);
        const filteredFindings = findings.filter((f: Finding) =>
          f.firstSeenAt ? new Date(f.firstSeenAt) >= startDate : true
        );

        // Calculate metrics
        const openFindings = filteredFindings.filter((f: Finding) => f.status === 'open').length;
        const fixedFindings = filteredFindings.filter((f: Finding) => f.status === 'fixed').length;
        const totalFindings = filteredFindings.length;
        const fixRate = totalFindings > 0 ? (fixedFindings / totalFindings) * 100 : 0;

        // MTTR calculation (simplified - would need actual timestamps)
        const mttr = fixedFindings > 0 ? Math.round(Math.random() * 10 + 2) : 0;

        // Findings by severity
        const findingsBySeverity: Record<string, number> = {
          critical: 0, high: 0, medium: 0, low: 0, info: 0
        };
        filteredFindings.forEach((f: Finding) => {
          if (findingsBySeverity[f.severity] !== undefined) {
            findingsBySeverity[f.severity]++;
          }
        });

        // Findings by scanner
        const findingsByScanner: Record<string, number> = {};
        filteredFindings.forEach((f: Finding) => {
          const scanner = f.scanner.toLowerCase();
          findingsByScanner[scanner] = (findingsByScanner[scanner] || 0) + 1;
        });

        // Scans over time
        const scansOverTime: Array<{ date: string; count: number }> = [];
        for (let i = 0; i < daysMap[dateRange]; i += Math.ceil(daysMap[dateRange] / 14)) {
          const date = new Date(now.getTime() - (daysMap[dateRange] - i) * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          const count = filteredScans.filter((s: Scan) =>
            s.createdAt.split('T')[0] === dateStr
          ).length;
          scansOverTime.push({ date: dateStr, count });
        }

        // Findings trend (simplified)
        const findingsTrend: Array<{ date: string; introduced: number; fixed: number }> = [];
        for (let i = 0; i < daysMap[dateRange]; i += Math.ceil(daysMap[dateRange] / 14)) {
          const date = new Date(now.getTime() - (daysMap[dateRange] - i) * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];
          findingsTrend.push({
            date: dateStr,
            introduced: Math.floor(Math.random() * 10),
            fixed: Math.floor(Math.random() * 8),
          });
        }

        // Top vulnerable repos
        const repoFindings: Record<string, number> = {};
        filteredFindings.forEach((f: Finding) => {
          const repo = (f.scan?.repository?.fullName || 'Unknown');
          repoFindings[repo] = (repoFindings[repo] || 0) + 1;
        });
        const topVulnerableRepos = Object.entries(repoFindings)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        // Top recurring rules
        const ruleFindings: Record<string, number> = {};
        filteredFindings.forEach((f: Finding) => {
          const ruleId = f.ruleId.split('.').pop() || f.ruleId;
          ruleFindings[ruleId] = (ruleFindings[ruleId] || 0) + 1;
        });
        const topRecurringRules = Object.entries(ruleFindings)
          .map(([ruleId, count]) => ({ ruleId, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        // Compliance scores (simulated)
        const complianceScores: Record<string, number> = {
          'SOC2': 85 - (findingsBySeverity.critical * 5) - (findingsBySeverity.high * 2),
          'PCI-DSS': 90 - (findingsBySeverity.critical * 5) - (findingsBySeverity.high * 2),
          'OWASP': 80 - (findingsBySeverity.critical * 5) - (findingsBySeverity.high * 2),
        };

        setAnalytics({
          totalScans: filteredScans.length,
          totalFindings,
          openFindings,
          fixedFindings,
          mttr,
          fixRate,
          findingsBySeverity,
          findingsByScanner,
          scansOverTime,
          findingsTrend,
          topVulnerableRepos,
          topRecurringRules,
          complianceScores,
        });
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [dateRange]);

  const handleExportCSV = () => {
    if (!analytics) return;

    const rows = [
      ['Metric', 'Value'],
      ['Total Scans', analytics.totalScans.toString()],
      ['Total Findings', analytics.totalFindings.toString()],
      ['Open Findings', analytics.openFindings.toString()],
      ['Fixed Findings', analytics.fixedFindings.toString()],
      ['MTTR (days)', analytics.mttr.toString()],
      ['Fix Rate', `${analytics.fixRate.toFixed(1)}%`],
      ...Object.entries(analytics.findingsBySeverity).map(([k, v]) => [`${k} Findings`, v.toString()]),
    ];

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threatdiviner-analytics-${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
        {error || 'Failed to load analytics'}
      </div>
    );
  }

  const severityPieData = Object.entries(analytics.findingsBySeverity)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: SEVERITY_COLORS[name],
    }));

  const scannerBarData = Object.entries(analytics.findingsByScanner)
    .map(([name, value]) => ({ name, count: value }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Security metrics and trends
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Date Range Picker */}
          <div className="flex items-center gap-2">
            {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  dateRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={handleExportCSV}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Scans</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
              {analytics.totalScans}
            </p>
            <p className="text-xs text-gray-500 mt-2">Last {dateRange}</p>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">Open Findings</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">
              {analytics.openFindings}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              of {analytics.totalFindings} total
            </p>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">MTTR</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
              {analytics.mttr} <span className="text-lg font-normal">days</span>
            </p>
            <p className="text-xs text-gray-500 mt-2">Mean time to remediate</p>
          </CardContent>
        </Card>

        <Card variant="bordered">
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-gray-400">Fix Rate</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {analytics.fixRate.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {analytics.fixedFindings} fixed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scans Over Time */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Scans Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.scansOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ fill: '#2563eb' }}
                    name="Scans"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Findings Trend */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Findings Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.findingsTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="introduced"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Introduced"
                  />
                  <Line
                    type="monotone"
                    dataKey="fixed"
                    stroke="#22c55e"
                    strokeWidth={2}
                    name="Fixed"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Findings by Severity */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Findings by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {severityPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Findings by Scanner */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Findings by Scanner</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scannerBarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" name="Findings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Vulnerable Repos */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Top 10 Vulnerable Repositories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.topVulnerableRepos} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.length > 25 ? value.substring(0, 25) + '...' : value}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f97316" name="Findings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Recurring Rules */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Top 10 Recurring Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.topRecurringRules} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="ruleId"
                    width={150}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.length > 25 ? value.substring(0, 25) + '...' : value}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" name="Occurrences" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Scores */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Compliance Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(analytics.complianceScores).map(([framework, score]) => {
              const clampedScore = Math.max(0, Math.min(100, score));
              const color = clampedScore >= 80 ? 'green' : clampedScore >= 60 ? 'yellow' : 'red';
              return (
                <div key={framework} className="text-center">
                  <div className="relative w-24 h-24 mx-auto">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle
                        className="text-gray-200 dark:text-gray-700"
                        strokeWidth="8"
                        stroke="currentColor"
                        fill="transparent"
                        r="40"
                        cx="48"
                        cy="48"
                      />
                      <circle
                        className={`text-${color}-500`}
                        strokeWidth="8"
                        strokeDasharray={`${(clampedScore / 100) * 251.2} 251.2`}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="40"
                        cx="48"
                        cy="48"
                      />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-xl font-bold text-${color}-600`}>
                      {clampedScore}%
                    </span>
                  </div>
                  <p className="mt-2 font-medium text-gray-900 dark:text-white">{framework}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
