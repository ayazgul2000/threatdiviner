'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import { useScanStream, TemplateStats, LogLine, DiscoveredUrls, ScanPhase } from '@/hooks/use-scan-stream';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Activity,
  Shield,
  Globe,
  Radar,
  Zap,
  FileSearch,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Info,
  X,
  Terminal,
  RotateCcw,
  FileText,
} from 'lucide-react';

interface ScanResult {
  id: string;
  status: 'pending' | 'queued' | 'scanning' | 'running' | 'completed' | 'failed' | 'cancelled';
  target: {
    id: string;
    name: string;
    url: string;
    type: string;
  };
  scanMode: 'quick' | 'standard' | 'comprehensive';
  scanners: string[];
  startedAt?: string;
  completedAt?: string;
  progress?: number;
  currentPhase?: ScanPhase;
  phaseProgress?: Record<string, number>;
  detectedTechnologies?: string[];
  discoveredUrls?: DiscoveredUrls | null;
  duration?: number;
  scannerResults: {
    scanner: string;
    status: string;
    progress?: number;
    findingsCount?: number;
    error?: string;
    startedAt?: string;
    completedAt?: string;
    duration?: number;
    exitCode?: number;
    command?: string;
    output?: string;
    verboseOutput?: string;
    templateStats?: TemplateStats;
  }[];
  findingsCount?: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings?: {
    id: string;
    title: string;
    severity: string;
    scanner: string;
    url?: string;
    description?: string;
  }[];
}

// Whitelabeled scanner labels
const SCANNER_LABELS: Record<string, { name: string; coverage: string }> = {
  katana: { name: 'URL Discovery', coverage: 'Endpoints, Parameters' },
  nuclei: { name: 'Vulnerability Detection', coverage: 'CVEs, Misconfigs' },
  zap: { name: 'Web Application Testing', coverage: 'OWASP Top 10' },
  nikto: { name: 'Web Server Analysis', coverage: 'Server Issues' },
  sqlmap: { name: 'SQL Injection Testing', coverage: 'SQL Injection' },
  sslyze: { name: 'SSL/TLS Analysis', coverage: 'Certificates' },
};

const SCANNER_ICONS: Record<string, any> = {
  katana: Globe,
  nuclei: Radar,
  zap: Zap,
  nikto: FileSearch,
  sqlmap: Shield,
  sslyze: Shield,
};

// Technology display info
const TECH_INFO: Record<string, { abbr: string; color: string; category: string }> = {
  'node.js': { abbr: 'N', color: 'green', category: 'Runtime' },
  'nodejs': { abbr: 'N', color: 'green', category: 'Runtime' },
  'express': { abbr: 'Ex', color: 'gray', category: 'Framework' },
  'nginx': { abbr: 'Ng', color: 'emerald', category: 'Web Server' },
  'apache': { abbr: 'Ap', color: 'red', category: 'Web Server' },
  'jquery': { abbr: 'jQ', color: 'blue', category: 'Library' },
  'react': { abbr: 'Re', color: 'cyan', category: 'Framework' },
  'vue': { abbr: 'Vu', color: 'green', category: 'Framework' },
  'angular': { abbr: 'Ng', color: 'red', category: 'Framework' },
  'mysql': { abbr: 'My', color: 'orange', category: 'Database' },
  'postgresql': { abbr: 'Pg', color: 'blue', category: 'Database' },
  'mongodb': { abbr: 'Mo', color: 'green', category: 'Database' },
  'php': { abbr: 'Ph', color: 'purple', category: 'Language' },
  'python': { abbr: 'Py', color: 'yellow', category: 'Language' },
  'wordpress': { abbr: 'Wp', color: 'blue', category: 'CMS' },
  'bootstrap': { abbr: 'Bs', color: 'purple', category: 'CSS' },
  'tailwind': { abbr: 'Tw', color: 'cyan', category: 'CSS' },
};

const SCAN_PHASES = [
  { id: 'initializing', label: 'INITIALIZING' },
  { id: 'crawling', label: 'CRAWLING' },
  { id: 'scanning', label: 'SCANNING' },
  { id: 'complete', label: 'COMPLETE' },
];

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-cyan-400" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'scanning':
    case 'running':
      return <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />;
    default:
      return <Clock className="w-4 h-4 text-gray-500" />;
  }
}

// Elapsed Time Display
function ElapsedTime({ startedAt, isRunning }: { startedAt?: string; isRunning: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const update = () => {
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    };
    update();
    if (isRunning) {
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [startedAt, isRunning]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return <span>{formatTime(elapsed)}</span>;
}

export default function TargetScanCockpitPage() {
  const params = useParams();
  const router = useRouter();
  const targetId = params.id as string;
  const scanId = params.scanId as string;

  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedFindings, setExpandedFindings] = useState<string[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [completionAcknowledged, setCompletionAcknowledged] = useState(false);
  const [initialPhase, setInitialPhase] = useState<string>('initializing'); // Start at initializing
  const previousStatusRef = useRef<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [selectedScannerDetails, setSelectedScannerDetails] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const stream = useScanStream(scanId);

  const fetchScan = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/targets/${targetId}/scans/${scanId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setScan(data);
      }
    } catch (error) {
      console.error('Failed to fetch scan:', error);
    } finally {
      setLoading(false);
    }
  }, [targetId, scanId]);

  const handleRetryTemplates = useCallback(async (templateIds: string[]) => {
    if (retrying || templateIds.length === 0) return;
    setRetrying(true);
    try {
      const res = await fetch(`${API_URL}/pentest/scans/${scanId}/retry-templates`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateIds }),
      });
      if (res.ok) {
        fetchScan();
      }
    } catch (error) {
      console.error('Error retrying templates:', error);
    } finally {
      setRetrying(false);
    }
  }, [scanId, retrying, fetchScan]);

  const handleCancelScan = useCallback(async () => {
    if (cancelling) return;
    if (!confirm('Are you sure you want to cancel this scan?')) return;
    setCancelling(true);
    try {
      const res = await fetch(`${API_URL}/pentest/scans/${scanId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        fetchScan();
      }
    } catch (error) {
      console.error('Error cancelling scan:', error);
    } finally {
      setCancelling(false);
    }
  }, [scanId, cancelling, fetchScan]);

  useEffect(() => {
    fetchScan();
  }, [fetchScan]);

  // Merge WebSocket stream with initial scan data
  const liveScan = useMemo<ScanResult | null>(() => {
    if (!scan) return null;
    if (['completed', 'failed'].includes(scan.status) && !stream.scanStatus) {
      return scan;
    }

    const selectedScanners = (scan.scanners && scan.scanners.length > 0)
      ? scan.scanners
      : Array.from(stream.scannerStatus.keys());
    const existingResults = scan.scannerResults || [];

    const updatedScannerResults = selectedScanners.map(scannerName => {
      const existingResult = existingResults.find(r => r.scanner === scannerName);
      const streamStatus = stream.scannerStatus.get(scannerName);

      if (streamStatus) {
        const progress = streamStatus.percent !== undefined ? streamStatus.percent :
                        streamStatus.status === 'completed' ? 100 : 0;
        return {
          scanner: scannerName,
          status: streamStatus.status,
          findingsCount: streamStatus.findingsCount,
          progress,
          duration: streamStatus.duration,
          exitCode: streamStatus.exitCode,
          error: streamStatus.error,
          verboseOutput: streamStatus.verboseOutput,
          templateStats: streamStatus.templateStats,
        };
      } else if (existingResult) {
        return existingResult;
      } else {
        return { scanner: scannerName, status: 'pending', progress: 0, findingsCount: 0 };
      }
    });

    const streamedFindings = stream.findings.map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      scanner: f.scanner,
      url: f.url,
      description: '',
    }));

    const existingIds = new Set((scan.findings || []).map(f => f.id));
    const newFindings = streamedFindings.filter(f => !existingIds.has(f.id));
    const mergedFindings = [...newFindings, ...(scan.findings || [])];
    const liveStatus = stream.scanStatus || scan.status;

    return {
      ...scan,
      status: liveStatus,
      scannerResults: updatedScannerResults,
      findings: mergedFindings,
      findingsCount: {
        total: stream.totalFindings || scan.findingsCount?.total || 0,
        critical: stream.severityBreakdown.critical || scan.findingsCount?.critical || 0,
        high: stream.severityBreakdown.high || scan.findingsCount?.high || 0,
        medium: stream.severityBreakdown.medium || scan.findingsCount?.medium || 0,
        low: stream.severityBreakdown.low || scan.findingsCount?.low || 0,
        info: stream.severityBreakdown.info || scan.findingsCount?.info || 0,
      },
      currentPhase: stream.currentPhase || scan.currentPhase || 'initializing',
      phaseProgress: stream.phaseProgress,
      detectedTechnologies: stream.detectedTechnologies,
      discoveredUrls: stream.discoveredUrls,
    };
  }, [scan, stream]);

  useEffect(() => {
    if (stream.scanStatus === 'completed' || stream.scanStatus === 'failed') {
      fetchScan();
    }
  }, [stream.scanStatus, fetchScan]);

  useEffect(() => {
    if (!liveScan) return;
    const currentStatus = liveScan.status;
    const prevStatus = previousStatusRef.current;
    if (prevStatus && !['completed', 'failed', 'cancelled'].includes(prevStatus) &&
        ['completed', 'failed', 'cancelled'].includes(currentStatus) &&
        !completionAcknowledged) {
      setShowCompletionPopup(true);
    }
    previousStatusRef.current = currentStatus;
  }, [liveScan?.status, completionAcknowledged]);

  const toggleFinding = (findingId: string) => {
    setExpandedFindings(prev =>
      prev.includes(findingId)
        ? prev.filter(id => id !== findingId)
        : [...prev, findingId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-[#0a0f1a]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!liveScan) {
    return (
      <div className="p-6 text-center py-12 bg-[#0a0f1a] min-h-screen">
        <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Scan Not Found</h3>
        <Link href={`/dashboard/targets/${targetId}`} className="text-cyan-400 hover:text-cyan-300">
          <ArrowLeft className="w-4 h-4 inline mr-2" />
          Back to Target
        </Link>
      </div>
    );
  }

  const isRunning = !['completed', 'failed', 'cancelled'].includes(liveScan.status);
  const isComplete = liveScan.status === 'completed';
  const scannerResults = liveScan.scannerResults || [];
  const overallProgress = liveScan.progress ??
    (scannerResults.length > 0
      ? Math.round(scannerResults.reduce((sum, r) => sum + (r.progress || 0), 0) / scannerResults.length)
      : 0);

  const currentPhaseIdx = SCAN_PHASES.findIndex(p => p.id === liveScan.currentPhase);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1a] via-[#0d1525] to-[#0a1628] p-6 text-white">
      {/* Background Grid */}
      <div className="fixed inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }} />

      <div className="relative max-w-7xl mx-auto space-y-6">
        {/* Top Header Bar */}
        <div className="relative bg-[rgba(13,25,45,0.7)] backdrop-blur-xl border border-cyan-500/20 rounded-xl p-4 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500/50 rounded-tl" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-500/50 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-500/50 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500/50 rounded-br" />

          <div className="flex items-center justify-between">
            {/* Left: Branding + Status + Cancel */}
            <div className="flex items-center gap-4">
              <Link href={`/dashboard/targets/${targetId}`} className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="font-['Orbitron',sans-serif] text-xl text-cyan-400 tracking-wider" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.5)' }}>
                THREATDIVINER
              </h1>
              <div className="h-6 w-px bg-gray-700" />
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-cyan-400 animate-pulse' : isComplete ? 'bg-green-400' : 'bg-red-400'}`}
                     style={{ filter: 'drop-shadow(0 0 5px rgba(6, 182, 212, 0.8))' }} />
                <span className="text-sm text-gray-300">{isRunning ? 'SCAN ACTIVE' : isComplete ? 'COMPLETE' : liveScan.status.toUpperCase()}</span>
              </div>
              {/* Cancel Button */}
              {isRunning && (
                <button
                  onClick={handleCancelScan}
                  disabled={cancelling}
                  className="ml-2 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 transition-all disabled:opacity-50"
                >
                  ✕ {cancelling ? 'Cancelling...' : 'Cancel Scan'}
                </button>
              )}
              {/* View Report Button - Only shown when complete */}
              {isComplete && (
                <Link
                  href={`/dashboard/reports?scanId=${scanId}`}
                  className="ml-2 px-4 py-1.5 rounded-lg text-xs font-medium text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 transition-all flex items-center gap-2"
                  style={{ boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
                >
                  <FileText className="w-4 h-4" />
                  View Report
                </Link>
              )}
            </div>

            {/* Center: Timer */}
            <div className="font-['Orbitron',sans-serif] text-3xl text-cyan-400 tracking-wider" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.5)' }}>
              <ElapsedTime startedAt={liveScan.startedAt} isRunning={isRunning} />
            </div>

            {/* Right: Target URL + Mode */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 bg-black/40 backdrop-blur rounded-lg px-4 py-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-400 font-mono text-sm">{liveScan.target.url}</span>
              </div>
              <span className="px-3 py-2 rounded-lg text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-medium uppercase">
                {liveScan.scanMode} Mode
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT COLUMN (8 cols) */}
          <div className="col-span-8 space-y-6">
            {/* Progress Section */}
            <div className="relative bg-[rgba(13,25,45,0.7)] backdrop-blur-xl border border-cyan-500/20 rounded-xl p-5 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500/50" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-500/50" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-500/50" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500/50" />

              {/* Scan line effect */}
              <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-[scan-line_3s_ease-in-out_infinite]"
                     style={{ animation: 'scan-line 3s ease-in-out infinite' }} />
              </div>

              <div className="flex items-center gap-6">
                {/* Circular Progress */}
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(6, 182, 212, 0.1)" strokeWidth="6" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="url(#progressGrad)" strokeWidth="6"
                      strokeDasharray="264"
                      strokeDashoffset={264 - (264 * overallProgress / 100)}
                      strokeLinecap="round"
                      style={{ filter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.8))' }}
                    />
                    <defs>
                      <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#0ea5e9" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-['Orbitron',sans-serif] text-xl text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.5)' }}>
                      {overallProgress}%
                    </span>
                  </div>
                </div>

                {/* Phase Progress Boxes */}
                <div className="flex-1 flex gap-2">
                  {SCAN_PHASES.map((phase, idx) => {
                    const phaseProgress = liveScan.phaseProgress?.[phase.id] ?? 0;
                    const isActive = phase.id === liveScan.currentPhase;
                    const isComplete = idx < currentPhaseIdx || (idx === currentPhaseIdx && phaseProgress >= 100);
                    const isPending = idx > currentPhaseIdx;

                    return (
                      <div
                        key={phase.id}
                        className={`flex-1 bg-black/40 backdrop-blur rounded-lg px-3 py-2.5 border transition-all ${
                          isActive ? 'border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]' :
                          isComplete ? 'border-cyan-500/30' : 'border-gray-700/50 opacity-50'
                        }`}
                      >
                        <div className={`text-xs mb-1.5 ${isComplete ? 'text-cyan-400' : isActive ? 'text-cyan-400 font-medium' : 'text-gray-500'}`}>
                          {isComplete ? '✓' : isActive ? '●' : ''} {phase.label}
                        </div>
                        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isComplete || isActive ? 'bg-gradient-to-r from-cyan-500 to-cyan-400' : 'bg-gray-600'
                            }`}
                            style={{
                              width: `${isComplete ? 100 : isActive ? phaseProgress : 0}%`,
                              ...(isActive && {
                                background: 'linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.5), transparent)',
                                backgroundSize: '200% 100%',
                                animation: 'data-flow 2s linear infinite'
                              })
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Scanner Table */}
            <div className="bg-[rgba(13,25,45,0.7)] backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-cyan-500/20 bg-black/20">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Active Scanners</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800/50">
                    <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase">Scanner</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase">Coverage</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase">Progress</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scannerResults.map((result) => {
                    const info = SCANNER_LABELS[result.scanner] || { name: result.scanner, coverage: 'Security Testing' };
                    const isActive = result.status === 'running' || result.status === 'scanning';
                    const isDone = result.status === 'completed';
                    const isPending = result.status === 'pending' || result.status === 'queued';

                    return (
                      <tr key={result.scanner} className={`border-b border-gray-800/50 ${isActive ? 'bg-cyan-500/5' : ''}`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`${isDone ? 'text-cyan-400' : isActive ? 'text-cyan-400 animate-pulse' : 'text-gray-600'}`}>
                              {isDone ? '⬡' : isActive ? '◉' : '○'}
                            </span>
                            <span className={isActive ? 'text-cyan-400' : isDone ? 'text-white' : 'text-gray-500'}>
                              {info.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{info.coverage}</td>
                        <td className="px-5 py-3">
                          <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isActive
                                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-400'
                                  : isDone
                                    ? 'bg-gradient-to-r from-cyan-500/30 to-cyan-400/30'
                                    : 'bg-gray-800'
                              }`}
                              style={{
                                width: `${result.progress || 0}%`,
                                ...(isActive && {
                                  background: 'linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.5), transparent)',
                                  backgroundSize: '200% 100%',
                                  animation: 'data-flow 2s linear infinite'
                                })
                              }}
                            />
                          </div>
                          {isActive && (
                            <div className="text-xs text-gray-500 mt-1">
                              {result.templateStats ? `${result.templateStats.completedTemplates} / ${result.templateStats.totalTemplates}` : `${result.progress || 0}%`}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {isDone ? (
                            <span className="text-cyan-400 text-xs flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              {result.scanner === 'katana'
                                ? `${liveScan.discoveredUrls?.total ?? 0} URLs`
                                : `${result.findingsCount ?? 0} findings`}
                            </span>
                          ) : isActive ? (
                            <span className="text-cyan-400 text-xs font-mono">{result.progress || 0}%</span>
                          ) : result.status === 'failed' ? (
                            <span className="text-red-400 text-xs">Failed</span>
                          ) : (
                            <span className="text-gray-600 text-xs">Queued</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Findings Section */}
            <div className="bg-[rgba(13,25,45,0.7)] backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden">
              {/* Findings Header with Stats */}
              <div className="px-5 py-3 border-b border-gray-800 bg-black/20 flex items-center justify-between">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Live Findings</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/20 border border-red-500/30">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-red-400 font-mono font-bold">{liveScan.findingsCount?.critical || 0}</span>
                    <span className="text-xs text-red-400/70">Critical</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/20 border border-orange-500/30">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-xs text-orange-400 font-mono font-bold">{liveScan.findingsCount?.high || 0}</span>
                    <span className="text-xs text-orange-400/70">High</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/20 border border-yellow-500/30">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-xs text-yellow-400 font-mono font-bold">{liveScan.findingsCount?.medium || 0}</span>
                    <span className="text-xs text-yellow-400/70">Medium</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/20 border border-cyan-500/30">
                    <div className="w-2 h-2 rounded-full bg-cyan-500" />
                    <span className="text-xs text-cyan-400 font-mono font-bold">{liveScan.findingsCount?.info || 0}</span>
                    <span className="text-xs text-cyan-400/70">Info</span>
                  </div>
                </div>
              </div>

              {/* Findings List */}
              <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                {(liveScan.findings || []).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Radar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No findings detected yet...</p>
                  </div>
                ) : (
                  (liveScan.findings || []).slice(0, 10).map((finding) => {
                    const severityColors: Record<string, { border: string; bg: string; badge: string; badgeText: string }> = {
                      critical: { border: 'border-red-500/30', bg: 'bg-red-500/20', badge: 'bg-red-500', badgeText: 'text-white' },
                      high: { border: 'border-orange-500/30', bg: 'bg-orange-500/20', badge: 'bg-orange-500', badgeText: 'text-white' },
                      medium: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/20', badge: 'bg-yellow-500', badgeText: 'text-black' },
                      low: { border: 'border-blue-500/30', bg: 'bg-blue-500/20', badge: 'bg-blue-500', badgeText: 'text-white' },
                      info: { border: 'border-cyan-500/30', bg: 'bg-cyan-500/20', badge: 'bg-cyan-500', badgeText: 'text-white' },
                    };
                    const colors = severityColors[finding.severity.toLowerCase()] || severityColors.info;
                    const isCritical = finding.severity.toLowerCase() === 'critical';

                    return (
                      <div
                        key={finding.id}
                        className={`bg-black/40 backdrop-blur rounded-lg p-3 border ${colors.border} flex items-center gap-3 ${
                          isCritical ? 'shadow-[0_0_15px_rgba(239,68,68,0.4)]' : ''
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                          <AlertTriangle className={`w-5 h-5 ${
                            finding.severity.toLowerCase() === 'critical' ? 'text-red-500' :
                            finding.severity.toLowerCase() === 'high' ? 'text-orange-500' :
                            finding.severity.toLowerCase() === 'medium' ? 'text-yellow-500' :
                            'text-cyan-500'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors.badge} ${colors.badgeText}`}>
                              {finding.severity.toUpperCase()}
                            </span>
                            <span className="text-sm truncate text-white">{finding.title}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{finding.url || 'No URL'}</div>
                        </div>
                        <Link
                          href={`/dashboard/findings/${finding.id}`}
                          className="text-cyan-400 hover:text-cyan-300 p-1"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    );
                  })
                )}
                {(liveScan.findings || []).length > 10 && (
                  <div className="text-center py-2">
                    <Link href={`/dashboard/findings?scanId=${scanId}`} className="text-cyan-400 hover:text-cyan-300 text-sm">
                      View all {liveScan.findings?.length} findings →
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Terminal (Whitelabeled) */}
            <details
              className="bg-[rgba(13,25,45,0.7)] backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden"
              open={terminalOpen}
              onToggle={(e) => setTerminalOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="flex items-center gap-2 px-5 py-3 text-xs text-gray-500 cursor-pointer hover:text-gray-400 bg-black/20">
                <Terminal className="w-4 h-4" />
                <span className="uppercase tracking-wider">Live Scan Output</span>
              </summary>
              <div className="bg-black/80 p-4 font-mono text-xs max-h-48 overflow-y-auto">
                <div className="space-y-1">
                  {stream.logs.length === 0 ? (
                    <div className="text-gray-600">Waiting for output...</div>
                  ) : (
                    stream.logs.slice(-30).map((log, idx) => (
                      <div key={idx} className={log.stream === 'stderr' ? 'text-yellow-400' : 'text-gray-400'}>
                        <span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span>{' '}
                        {log.line}
                      </div>
                    ))
                  )}
                  <div className="text-cyan-400 animate-pulse">█</div>
                </div>
              </div>
            </details>
          </div>

          {/* RIGHT COLUMN (4 cols) */}
          <div className="col-span-4 space-y-6">
            {/* Scanner Animation */}
            <div className="bg-[rgba(13,25,45,0.7)] backdrop-blur-xl border border-cyan-500/20 rounded-xl p-3 overflow-hidden" style={{ height: '140px' }}>
              <svg className="w-full h-full" viewBox="0 0 260 110">
                {/* Scanner Device */}
                <g>
                  <rect x="5" y="30" width="55" height="50" rx="6" fill="rgba(6, 182, 212, 0.15)" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="1" />
                  <rect x="12" y="38" width="41" height="22" rx="2" fill="rgba(0,0,0,0.5)" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="0.5" />
                  <line x1="16" y1="44" x2="48" y2="44" stroke="rgba(6, 182, 212, 0.6)" strokeWidth="1.5">
                    <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
                  </line>
                  <line x1="16" y1="50" x2="38" y2="50" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="1">
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="0.8s" repeatCount="indefinite" />
                  </line>
                  <line x1="16" y1="55" x2="44" y2="55" stroke="rgba(6, 182, 212, 0.5)" strokeWidth="1">
                    <animate attributeName="opacity" values="0.6;1;0.6" dur="1s" repeatCount="indefinite" />
                  </line>
                  <line x1="32" y1="25" x2="32" y2="30" stroke="rgba(6, 182, 212, 0.6)" strokeWidth="2" />
                  <circle cx="32" cy="20" r="5" fill="rgba(6, 182, 212, 0.3)" stroke="rgba(6, 182, 212, 0.8)" strokeWidth="1">
                    <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <text x="32" y="95" textAnchor="middle" fill="#06b6d4" fontSize="7" fontWeight="600">SCANNER</text>
                </g>

                {/* Data streams */}
                <g>
                  <line x1="195" y1="45" x2="65" y2="45" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="1" strokeDasharray="8 12">
                    <animate attributeName="stroke-dashoffset" values="100;0" dur="1.5s" repeatCount="indefinite" />
                  </line>
                  <line x1="195" y1="55" x2="65" y2="55" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="1" strokeDasharray="8 12">
                    <animate attributeName="stroke-dashoffset" values="100;0" dur="1.5s" repeatCount="indefinite" begin="0.3s" />
                  </line>
                  <line x1="195" y1="65" x2="65" y2="65" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="1" strokeDasharray="8 12">
                    <animate attributeName="stroke-dashoffset" values="100;0" dur="1.5s" repeatCount="indefinite" begin="0.6s" />
                  </line>
                  <rect x="180" y="42" width="8" height="6" rx="1" fill="rgba(6, 182, 212, 0.8)">
                    <animate attributeName="x" values="180;60" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite" />
                  </rect>
                </g>

                {/* Target Server */}
                <g>
                  <rect x="195" y="25" width="60" height="60" rx="4" fill="rgba(239, 68, 68, 0.1)" stroke="rgba(239, 68, 68, 0.4)" strokeWidth="1" />
                  <rect x="202" y="32" width="46" height="12" rx="2" fill="rgba(239, 68, 68, 0.15)" stroke="rgba(239, 68, 68, 0.3)" strokeWidth="0.5" />
                  <rect x="202" y="48" width="46" height="12" rx="2" fill="rgba(239, 68, 68, 0.15)" stroke="rgba(239, 68, 68, 0.3)" strokeWidth="0.5" />
                  <rect x="202" y="64" width="46" height="12" rx="2" fill="rgba(239, 68, 68, 0.15)" stroke="rgba(239, 68, 68, 0.3)" strokeWidth="0.5" />
                  <circle cx="210" cy="38" r="2.5" fill="#22c55e">
                    <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="218" cy="38" r="2.5" fill="#22c55e">
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="210" cy="54" r="2.5" fill="#f59e0b">
                    <animate attributeName="opacity" values="1;0.5;1" dur="0.6s" repeatCount="indefinite" />
                  </circle>
                  <text x="225" y="100" textAnchor="middle" fill="#ef4444" fontSize="7" fontWeight="600">TARGET</text>
                </g>
              </svg>
            </div>

            {/* Target Information */}
            <div className="bg-[rgba(13,25,45,0.7)] backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-transparent">
                <span className="text-xs text-cyan-400 uppercase tracking-wider font-medium">Target Information</span>
              </div>
              <div className="p-4 space-y-0">
                <div className="flex items-center justify-between py-3 border-b border-gray-800/50">
                  <span className="text-gray-500 text-sm">URL</span>
                  <span className="text-cyan-400 text-sm font-mono truncate max-w-[180px]">{liveScan.target.url.replace(/^https?:\/\//, '')}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-800/50">
                  <span className="text-gray-500 text-sm">Status</span>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
                    <span className="text-green-400 text-sm font-medium">Online</span>
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-800/50">
                  <span className="text-gray-500 text-sm">Response</span>
                  <span className="text-gray-300 text-sm font-mono">--ms</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-gray-500 text-sm">Type</span>
                  <span className="text-gray-300 text-sm">{liveScan.target.type || 'Web Application'}</span>
                </div>
              </div>
            </div>

            {/* Discovery Statistics */}
            <div className="bg-[rgba(13,25,45,0.7)] backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-transparent">
                <span className="text-xs text-cyan-400 uppercase tracking-wider font-medium">Discovery Statistics</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Endpoints', value: liveScan.discoveredUrls?.total || 0 },
                    { label: 'Parameters', value: liveScan.discoveredUrls?.paramsCount || 0 },
                    { label: 'JS Files', value: liveScan.discoveredUrls?.jsFiles?.length || 0 },
                    { label: 'Forms', value: 0 },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl p-4 text-center transition-all bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                    >
                      <div className="font-['Orbitron',sans-serif] text-3xl text-cyan-400" style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.5)' }}>
                        {stat.value}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                      <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full"
                          style={{ width: `${Math.min((stat.value / 100) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Detected Technologies */}
            <div className="bg-[rgba(13,25,45,0.7)] backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-transparent">
                <span className="text-xs text-cyan-400 uppercase tracking-wider font-medium">Detected Technologies</span>
              </div>
              <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                {(!liveScan.detectedTechnologies || liveScan.detectedTechnologies.length === 0) ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Detecting technologies...
                  </div>
                ) : (
                  liveScan.detectedTechnologies.map((tech) => {
                    const techKey = tech.toLowerCase();
                    const info = TECH_INFO[techKey] || { abbr: tech.substring(0, 2).toUpperCase(), color: 'gray', category: 'Unknown' };
                    const colorClasses: Record<string, string> = {
                      green: 'bg-green-500/20 border-green-500/30 text-green-400',
                      gray: 'bg-gray-500/20 border-gray-500/30 text-gray-300',
                      emerald: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
                      red: 'bg-red-500/20 border-red-500/30 text-red-400',
                      blue: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
                      cyan: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
                      orange: 'bg-orange-500/20 border-orange-500/30 text-orange-400',
                      purple: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
                      yellow: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
                    };
                    const dotColors: Record<string, string> = {
                      green: 'bg-green-400',
                      gray: 'bg-gray-400',
                      emerald: 'bg-emerald-400',
                      red: 'bg-red-400',
                      blue: 'bg-blue-400',
                      cyan: 'bg-cyan-400',
                      orange: 'bg-orange-400',
                      purple: 'bg-purple-400',
                      yellow: 'bg-yellow-400',
                    };

                    return (
                      <div key={tech} className="flex items-center gap-3 p-2.5 bg-black/40 backdrop-blur rounded-lg border border-transparent hover:border-cyan-500/30 transition-all">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${colorClasses[info.color] || colorClasses.gray}`}>
                          <span className="text-xs font-bold">{info.abbr}</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-gray-200">{tech}</div>
                          <div className="text-xs text-gray-500">{info.category}</div>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${dotColors[info.color] || dotColors.gray}`} />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Popup */}
      {showCompletionPopup && liveScan && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[rgba(13,25,45,0.95)] backdrop-blur-xl border border-cyan-500/30 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className={`p-6 text-center ${
              liveScan.status === 'completed' ? 'bg-gradient-to-b from-green-500/20 to-transparent' :
              liveScan.status === 'cancelled' ? 'bg-gradient-to-b from-amber-500/20 to-transparent' :
              'bg-gradient-to-b from-red-500/20 to-transparent'
            }`}>
              {liveScan.status === 'completed' ? (
                <CheckCircle className="w-16 h-16 mx-auto text-green-400" />
              ) : liveScan.status === 'cancelled' ? (
                <XCircle className="w-16 h-16 mx-auto text-amber-400" />
              ) : (
                <AlertTriangle className="w-16 h-16 mx-auto text-red-400" />
              )}
            </div>

            <div className="p-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">
                {liveScan.status === 'completed' ? 'Scan Completed!' :
                 liveScan.status === 'cancelled' ? 'Scan Cancelled' :
                 'Scan Failed'}
              </h2>
              <p className="text-gray-400 mb-4">
                {liveScan.status === 'completed' ? (
                  <>Found <span className="font-bold text-lg text-cyan-400">{liveScan.findingsCount?.total || 0}</span> security issues</>
                ) : liveScan.status === 'cancelled' ? (
                  <>The scan was cancelled.</>
                ) : (
                  <>The scan encountered an error.</>
                )}
              </p>

              {liveScan.status === 'completed' && liveScan.findingsCount && liveScan.findingsCount.total > 0 && (
                <div className="flex justify-center gap-3 mb-6">
                  {liveScan.findingsCount.critical > 0 && (
                    <span className="px-2 py-1 text-xs font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                      {liveScan.findingsCount.critical} Critical
                    </span>
                  )}
                  {liveScan.findingsCount.high > 0 && (
                    <span className="px-2 py-1 text-xs font-bold rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      {liveScan.findingsCount.high} High
                    </span>
                  )}
                  {liveScan.findingsCount.medium > 0 && (
                    <span className="px-2 py-1 text-xs font-bold rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      {liveScan.findingsCount.medium} Medium
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={() => {
                  setShowCompletionPopup(false);
                  setCompletionAcknowledged(true);
                }}
                className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                  liveScan.status === 'completed' ? 'bg-cyan-600 hover:bg-cyan-700' :
                  liveScan.status === 'cancelled' ? 'bg-amber-600 hover:bg-amber-700' :
                  'bg-red-600 hover:bg-red-700'
                }`}
              >
                View Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes scan-line {
          0% { transform: translateY(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes data-flow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </div>
  );
}
