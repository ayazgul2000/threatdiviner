'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  Microscope,
  Network,
  Zap,
  Package,
  TestTube,
  Building2,
  Link2,
  Database,
  Play,
} from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useProject } from '@/contexts/project-context';

interface DeepAnalysisOptions {
  similarVulns: boolean;
  callChain: boolean;
  fixPropagation: boolean;
  secureAlternatives: boolean;
  securityTests: boolean;
  architecture: boolean;
  attackChain: boolean;
}

interface Repository {
  id: string;
  name: string;
  fullName: string;
}

interface Branch {
  id: string;
  name: string;
  isDefault?: boolean;
  isProtected?: boolean;
}

interface Scan {
  id: string;
  branch: string;
  status: string;
  startedAt?: string;
  createdAt: string;
  findingsCount?: { total: number };
}

interface DeepAnalysisModalProps {
  onClose: () => void;
  onSuccess: () => void;
  repositories: Repository[];
  preselectedRepoId?: string;
  preselectedBranch?: string;
}

export function DeepAnalysisModal({
  onClose,
  onSuccess,
  repositories,
  preselectedRepoId,
  preselectedBranch,
}: DeepAnalysisModalProps) {
  const { currentProject } = useProject();
  const [selectedRepoId, setSelectedRepoId] = useState(preselectedRepoId || '');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState(preselectedBranch || '');
  const [existingScans, setExistingScans] = useState<Scan[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingScans, setLoadingScans] = useState(false);

  // Scan source option
  const [scanSource, setScanSource] = useState<'existing' | 'new'>('existing');
  const [selectedScanId, setSelectedScanId] = useState('');

  const [options, setOptions] = useState<DeepAnalysisOptions>({
    similarVulns: true,
    callChain: true,
    fixPropagation: true,
    secureAlternatives: false,
    securityTests: false,
    architecture: false,
    attackChain: false,
  });
  const [isStarting, setIsStarting] = useState(false);

  // Load branches when repository changes
  useEffect(() => {
    if (!selectedRepoId) {
      setBranches([]);
      setSelectedBranch('');
      return;
    }

    const fetchBranches = async () => {
      setLoadingBranches(true);
      try {
        const res = await fetch(`${API_URL}/scm/repositories/${selectedRepoId}/branches`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const branchList = Array.isArray(data) ? data : data.branches || [];
          setBranches(branchList);
          // Select default branch or first branch
          const defaultBranch = branchList.find((b: Branch) => b.isDefault);
          setSelectedBranch(defaultBranch?.name || branchList[0]?.name || 'main');
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [selectedRepoId]);

  // Load existing scans when branch changes
  useEffect(() => {
    if (!selectedRepoId || !selectedBranch) {
      setExistingScans([]);
      return;
    }

    const fetchScans = async () => {
      setLoadingScans(true);
      try {
        const res = await fetch(
          `${API_URL}/scm/scans?repositoryId=${selectedRepoId}&branch=${encodeURIComponent(selectedBranch)}&status=completed`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          const scanList = (Array.isArray(data) ? data : data.scans || [])
            .filter((s: Scan) => s.status === 'completed' && (s.findingsCount?.total ?? 0) > 0);
          setExistingScans(scanList);
          // Auto-select latest scan if available
          if (scanList.length > 0) {
            setSelectedScanId(scanList[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load scans:', err);
      } finally {
        setLoadingScans(false);
      }
    };

    fetchScans();
  }, [selectedRepoId, selectedBranch]);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const payload: any = {
        repositoryId: selectedRepoId,
        branch: selectedBranch,
        scanType: 'deep-analysis',
        deepAnalysisOptions: options,
      };

      // If using existing scan, include the scan ID
      if (scanSource === 'existing' && selectedScanId) {
        payload.baseScanId = selectedScanId;
      }

      const response = await fetch(`${API_URL}/scm/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to start deep analysis');
      }

      onSuccess();
    } catch (error) {
      console.error('Failed to start deep analysis:', error);
      alert('Failed to start deep analysis. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const selectedCount = Object.values(options).filter(Boolean).length;

  const ANALYSIS_OPTIONS = [
    {
      key: 'similarVulns' as keyof DeepAnalysisOptions,
      icon: Microscope,
      title: 'Similar Vulnerability Detection',
      description: 'Find similar vulnerable patterns across the entire codebase',
      recommended: true,
    },
    {
      key: 'callChain' as keyof DeepAnalysisOptions,
      icon: Network,
      title: 'Call Chain Analysis',
      description: 'Trace data flow to determine public vs internal exposure',
      recommended: true,
    },
    {
      key: 'fixPropagation' as keyof DeepAnalysisOptions,
      icon: Zap,
      title: 'Fix Propagation',
      description: 'Apply fixes to all similar vulnerable usages found',
      recommended: true,
    },
    {
      key: 'secureAlternatives' as keyof DeepAnalysisOptions,
      icon: Package,
      title: 'Secure Alternatives',
      description: 'Suggest import/dependency-aware secure replacements',
      recommended: false,
    },
    {
      key: 'securityTests' as keyof DeepAnalysisOptions,
      icon: TestTube,
      title: 'Security Test Generation',
      description: 'Generate test cases for discovered vulnerabilities',
      recommended: false,
    },
    {
      key: 'architecture' as keyof DeepAnalysisOptions,
      icon: Building2,
      title: 'Architecture Recommendations',
      description: 'Suggest architectural improvements for better security',
      recommended: false,
    },
    {
      key: 'attackChain' as keyof DeepAnalysisOptions,
      icon: Link2,
      title: 'Attack Chain Mapping',
      description: 'Correlate findings into potential attack chains',
      recommended: false,
    },
  ];

  const canStart = selectedRepoId && selectedBranch && selectedCount > 0 &&
    (scanSource === 'new' || (scanSource === 'existing' && selectedScanId));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[650px] max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
              <Microscope className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">New Deep Analysis</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">Comprehensive security analysis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Repository Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Repository
            </label>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select a repository...</option>
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.fullName || repo.name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Selection */}
          {selectedRepoId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Branch
              </label>
              {loadingBranches ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading branches...
                </div>
              ) : (
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.name}>
                      {branch.name}
                      {branch.isDefault ? ' (default)' : ''}
                      {branch.isProtected ? ' (protected)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Scan Source Selection */}
          {selectedBranch && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Findings Source
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    scanSource === 'existing'
                      ? 'border-purple-300 bg-purple-50 dark:bg-purple-900/30 dark:border-purple-500'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="scanSource"
                    checked={scanSource === 'existing'}
                    onChange={() => setScanSource('existing')}
                    className="mt-1 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-900 dark:text-white">Use Existing Scan</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Analyze findings from a previous scan
                    </p>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    scanSource === 'new'
                      ? 'border-purple-300 bg-purple-50 dark:bg-purple-900/30 dark:border-purple-500'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="scanSource"
                    checked={scanSource === 'new'}
                    onChange={() => setScanSource('new')}
                    className="mt-1 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-900 dark:text-white">Run New Scan</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Run a snippet scan first, then analyze
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Existing Scan Selection */}
          {scanSource === 'existing' && selectedBranch && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Scan
              </label>
              {loadingScans ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading scans...
                </div>
              ) : existingScans.length === 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    No completed scans with findings found for this branch. Consider running a new scan.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedScanId}
                  onChange={(e) => setSelectedScanId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                >
                  {existingScans.map((scan) => (
                    <option key={scan.id} value={scan.id}>
                      {new Date(scan.startedAt || scan.createdAt).toLocaleString()} - {scan.findingsCount?.total || 0} findings
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Analysis Options */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Analysis Features
              </label>
              <span className="text-xs text-gray-500">{selectedCount} selected</span>
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {ANALYSIS_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <label
                    key={opt.key}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      options[opt.key]
                        ? 'border-purple-300 bg-purple-50 dark:bg-purple-900/30 dark:border-purple-500'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={options[opt.key]}
                      onChange={(e) => setOptions({ ...options, [opt.key]: e.target.checked })}
                      className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <Icon
                      className={`w-5 h-5 mt-0.5 ${
                        options[opt.key] ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium ${
                            options[opt.key] ? 'text-purple-900 dark:text-purple-100' : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {opt.title}
                        </span>
                        {opt.recommended && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Note:</strong> Deep analysis is AI-intensive and may take several minutes depending on
              repository size and selected options. This runs a comprehensive security review beyond standard
              scanning.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={() =>
              setOptions({
                similarVulns: true,
                callChain: true,
                fixPropagation: true,
                secureAlternatives: false,
                securityTests: false,
                architecture: false,
                attackChain: false,
              })
            }
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Reset to Recommended
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={isStarting || !canStart}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Microscope className="w-4 h-4" />
                  Start Deep Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
