'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useProject } from '@/contexts/project-context';
import { API_URL } from '@/lib/api';
import {
  ArrowLeft,
  Globe,
  Server,
  Shield,
  Play,
  Settings,
  ExternalLink,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  FileText,
  BarChart3,
  Scan,
  X,
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
      type: string;
      credentials?: Record<string, string>;
    };
  };
  lastScan?: {
    id: string;
    status: string;
    completedAt?: string;
    findingsCount?: number;
  };
  riskScore?: number;
  createdAt: string;
  updatedAt: string;
}

interface ScanHistory {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  findingsCount?: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  scanners: string[];
}

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

// Scan mode descriptions with estimated times and included capabilities
const SCAN_MODES = [
  {
    id: 'quick' as const,
    name: 'Quick Scan',
    time: '2-5 minutes',
    description: 'Fast discovery and critical vulnerability detection',
    capabilities: ['URL Discovery', 'Vulnerability Detection', 'SSL/TLS Analysis'],
    recommended: false,
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
    recommended: false,
  },
];

function getRiskScoreColor(score?: number) {
  if (score === undefined || score === null) return 'text-slate-400';
  if (score >= 80) return 'text-red-500';
  if (score >= 60) return 'text-orange-500';
  if (score >= 40) return 'text-yellow-500';
  if (score >= 20) return 'text-blue-500';
  return 'text-green-500';
}

function getRiskScoreBg(score?: number) {
  if (score === undefined || score === null) return 'bg-slate-100';
  if (score >= 80) return 'bg-red-100 dark:bg-red-900/30';
  if (score >= 60) return 'bg-orange-100 dark:bg-orange-900/30';
  if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900/30';
  if (score >= 20) return 'bg-blue-100 dark:bg-blue-900/30';
  return 'bg-green-100 dark:bg-green-900/30';
}

export default function TargetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject } = useProject();
  const targetId = params.id as string;

  const [target, setTarget] = useState<Target | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'scans' | 'findings'>('overview');

  // Scan modal state
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanMode, setScanMode] = useState<'quick' | 'standard' | 'comprehensive'>('standard');
  const [startingScan, setStartingScan] = useState(false);

  useEffect(() => {
    // Check if opened with scan action
    if (searchParams.get('action') === 'scan') {
      setShowScanModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (targetId) {
      loadTarget();
      loadScanHistory();
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
        // Load default scan mode from target settings
        if (data.defaultScanMode) {
          // Map legacy values to new modes
          const mode = data.defaultScanMode;
          const mappedMode = mode === 'optimized' ? 'standard' :
                            mode === 'full' ? 'comprehensive' :
                            mode || 'standard';
          if (['quick', 'standard', 'comprehensive'].includes(mappedMode)) {
            setScanMode(mappedMode as 'quick' | 'standard' | 'comprehensive');
          }
        }
      }
    } catch (error) {
      console.error('Failed to load target:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadScanHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/targets/${targetId}/scans`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setScanHistory(data || []);
      } else {
        setScanHistory([]);
      }
    } catch (error) {
      console.error('Failed to load scan history:', error);
      setScanHistory([]);
    }
  };

  const handleStartScan = async () => {
    setStartingScan(true);
    try {
      const res = await fetch(`${API_URL}/targets/${targetId}/scan`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanMode }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowScanModal(false);
        // Navigate to scan cockpit
        router.push(`/dashboard/targets/${targetId}/scans/${data.id}`);
      } else {
        throw new Error('Failed to start scan');
      }
    } catch (error) {
      console.error('Failed to start scan:', error);
      alert('Failed to start scan. Please try again.');
    } finally {
      setStartingScan(false);
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
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            The target you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
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

  const TypeIcon = TARGET_TYPE_ICONS[target.type];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/targets"
            className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Targets
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
              <TypeIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{target.name}</h1>
              <a
                href={target.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                {target.url}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/targets/${targetId}/settings`}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          <button
            onClick={() => setShowScanModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Scan
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg ${getRiskScoreBg(target.riskScore)}`}>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
            <Activity className="w-4 h-4" />
            Risk Score
          </div>
          <div className={`text-2xl font-bold ${getRiskScoreColor(target.riskScore)}`}>
            {target.riskScore ?? '-'}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
            <Scan className="w-4 h-4" />
            Total Scans
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {scanHistory.length}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
            <AlertTriangle className="w-4 h-4" />
            Total Findings
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {target.lastScan?.findingsCount ?? 0}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
            <Calendar className="w-4 h-4" />
            Last Scan
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {target.lastScan?.completedAt
              ? new Date(target.lastScan.completedAt).toLocaleDateString()
              : 'Never'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'scans', label: 'Scan History', icon: Clock },
            { id: 'findings', label: 'Findings', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Target Details */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Target Details</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400">Type</dt>
                <dd className="mt-1 text-slate-900 dark:text-white">{TARGET_TYPE_LABELS[target.type]}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400">URL</dt>
                <dd className="mt-1">
                  <a href={target.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                    {target.url}
                  </a>
                </dd>
              </div>
              {target.description && (
                <div>
                  <dt className="text-sm text-slate-500 dark:text-slate-400">Description</dt>
                  <dd className="mt-1 text-slate-900 dark:text-white">{target.description}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400">Created</dt>
                <dd className="mt-1 text-slate-900 dark:text-white">
                  {new Date(target.createdAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Recent Scans */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Recent Scans</h3>
            {scanHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Scan className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No scans yet</p>
                <button
                  onClick={() => setShowScanModal(true)}
                  className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                >
                  Run your first scan
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {scanHistory.slice(0, 5).map((scan) => (
                  <Link
                    key={scan.id}
                    href={`/dashboard/targets/${targetId}/scans/${scan.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {scan.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : scan.status === 'failed' ? (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-blue-500 animate-pulse" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {new Date(scan.startedAt).toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {scan.scanners.join(', ')}
                        </div>
                      </div>
                    </div>
                    {scan.findingsCount && (
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        {scan.findingsCount.total} findings
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'scans' && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {scanHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Scan className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Scans Yet</h3>
              <p className="mb-4">Start your first scan to see results here.</p>
              <button
                onClick={() => setShowScanModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                Start Scan
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Started</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Scanners</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {scanHistory.map((scan) => (
                  <tr
                    key={scan.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                    onClick={() => router.push(`/dashboard/targets/${targetId}/scans/${scan.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {scan.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : scan.status === 'failed' ? (
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-blue-500 animate-pulse" />
                        )}
                        <span className="capitalize text-slate-900 dark:text-white">{scan.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {new Date(scan.startedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {scan.duration ? `${Math.round(scan.duration / 1000)}s` : '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {scan.scanners.join(', ')}
                    </td>
                    <td className="px-6 py-4">
                      {scan.findingsCount ? (
                        <div className="flex items-center gap-2 text-sm">
                          {scan.findingsCount.critical > 0 && (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              {scan.findingsCount.critical} Critical
                            </span>
                          )}
                          {scan.findingsCount.high > 0 && (
                            <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                              {scan.findingsCount.high} High
                            </span>
                          )}
                          <span className="text-slate-500">
                            {scan.findingsCount.total} total
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'findings' && (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
          <FileText className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            Findings View Coming Soon
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Aggregated findings from all scans will be displayed here.
          </p>
        </div>
      )}

      {/* Start Scan Modal */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Start Security Scan</h2>
              <button
                onClick={() => setShowScanModal(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Scan Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Select Scan Mode
                </label>
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
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowScanModal(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartScan}
                disabled={startingScan}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Play className="w-4 h-4" />
                {startingScan ? 'Starting...' : 'Start Scan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
