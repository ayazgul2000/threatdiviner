'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import DrawioEmbed, { DrawioEmbedRef } from '@/components/threat-modeling/DrawioEmbed';
import LockManager, { useLockManager } from '@/components/threat-modeling/LockManager';
import VersionManager, { useVersionManager } from '@/components/threat-modeling/VersionManager';
import { GapFillDialog } from '@/components/threat-modeling/GapFillDialog';
import { AnalysisProgressModal } from '@/components/threat-modeling/AnalysisProgressModal';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useGapDetection } from '@/hooks/useGapDetection';
import { useAuth } from '@/lib/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ThreatModel {
  id: string;
  name: string;
  description?: string;
  methodology: string;
  status: string;
  diagramXml?: string;
}

export default function DiagramEditorPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const modelId = params.id as string;

  // Refs
  const drawioRef = useRef<DrawioEmbedRef>(null);

  // State
  const [model, setModel] = useState<ThreatModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentXml, setCurrentXml] = useState<string>('');
  const [showGapDialog, setShowGapDialog] = useState(false);

  // Hooks
  const {
    lockInfo,
    isLocked,
    isLockedByCurrentUser: isLockedByMe,
    acquireLock,
    releaseLock,
    checkLock: refreshLock,
    forceTakeLock,
  } = useLockManager(modelId, user?.id || '', `${API_URL}/threat-modeling`);

  const {
    versions,
    currentVersion,
    loadVersion,
    saveVersion: createVersion,
    fetchVersions,
  } = useVersionManager(modelId, `${API_URL}/threat-modeling`);

  const { startAnalysis, analysisRunId, gaps, error: analysisError, clearAnalysis } = useAnalysis();
  const { detectGaps: checkGaps, gaps: detectedGaps } = useGapDetection();

  const [isStarting, setIsStarting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Load model data
  useEffect(() => {
    const fetchModel = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/threat-modeling/${modelId}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch model');
        const data = await res.json();
        setModel(data);
        setCurrentXml(data.diagramXml || '');
      } catch (err) {
        toast.error('Failed to load threat model');
        router.push('/dashboard/threat-modeling');
      } finally {
        setLoading(false);
      }
    };
    fetchModel();
  }, [modelId, router, toast]);

  // Acquire lock on mount
  useEffect(() => {
    const tryAcquireLock = async () => {
      if (user?.id) {
        const lock = await acquireLock(user.name || user.email || 'Unknown User');
        if (!lock) {
          await refreshLock();
        }
      }
    };
    tryAcquireLock();

    return () => {
      if (isLockedByMe) {
        releaseLock();
      }
    };
  }, [user?.id]);

  // Auto-refresh lock
  useEffect(() => {
    if (!isLockedByMe || !user) return;
    const interval = setInterval(() => {
      acquireLock(user.name || user.email || 'Unknown User');
    }, 60000);
    return () => clearInterval(interval);
  }, [isLockedByMe, user, acquireLock]);

  // Fetch versions on mount
  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  // Handle XML changes from Draw.io
  const handleXmlChange = useCallback((xml: string) => {
    setCurrentXml(xml);
    setHasUnsavedChanges(true);
  }, []);

  // Handle save
  const handleSave = useCallback(async (xml?: string) => {
    const xmlToSave = xml || currentXml;

    if (!isLockedByMe) {
      toast.error('You do not have the edit lock');
      return;
    }

    try {
      await createVersion(xmlToSave, false, 'Manual save');
      setHasUnsavedChanges(false);
      toast.success('Diagram saved successfully');
    } catch (err) {
      toast.error('Could not save diagram');
    }
  }, [currentXml, isLockedByMe, createVersion, toast]);

  // Handle run analysis
  const handleRunAnalysis = useCallback(async () => {
    if (!isLockedByMe) {
      toast.error('You do not have the edit lock. Please refresh the page.');
      return;
    }

    setIsChecking(true);
    const gapResult = await checkGaps(modelId);
    setIsChecking(false);

    if (gapResult && gapResult.gaps && gapResult.gaps.length > 0) {
      setShowGapDialog(true);
      return;
    }

    if (hasUnsavedChanges) {
      await handleSave();
    }

    setIsStarting(true);
    const result = await startAnalysis(modelId);
    setIsStarting(false);

    if (!result.success && result.error) {
      toast.error(result.error);
    }
  }, [modelId, checkGaps, hasUnsavedChanges, handleSave, startAnalysis, isLockedByMe, toast]);

  // Handle gap fill complete
  const handleGapFillComplete = useCallback(async () => {
    setShowGapDialog(false);
    await handleSave();
    setIsStarting(true);
    await startAnalysis(modelId);
    setIsStarting(false);
  }, [modelId, handleSave, startAnalysis]);

  // Handle version load
  const handleLoadVersion = useCallback(async (versionId: string) => {
    const xml = await loadVersion(versionId);
    if (xml) {
      drawioRef.current?.setXml(xml);
      setCurrentXml(xml);
      setHasUnsavedChanges(false);
    }
  }, [loadVersion]);

  // Handle export
  const handleExport = useCallback(async (format: 'png' | 'svg' | 'xml') => {
    if (!drawioRef.current) return;

    try {
      if (format === 'png') {
        const blob = await drawioRef.current.exportPng();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${model?.name || 'diagram'}.png`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'svg') {
        const svg = await drawioRef.current.exportSvg();
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${model?.name || 'diagram'}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const xml = await drawioRef.current.getXml();
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${model?.name || 'diagram'}.drawio`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`Diagram exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error('Could not export diagram');
    }
  }, [model?.name, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isViewOnly = isLocked && !isLockedByMe;

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-950">
      {/* Toolbar */}
      <div className="h-14 border-b flex items-center justify-between px-4 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/threat-modeling/${modelId}`}>
            <Button variant="ghost" size="sm">
              ← Back
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {model?.name}
          </h1>
          {hasUnsavedChanges && (
            <span className="text-sm text-amber-600 dark:text-amber-400">
              • Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative group">
            <Button variant="ghost" size="sm">
              Export ▼
            </Button>
            <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border hidden group-hover:block z-10">
              <button
                onClick={() => handleExport('png')}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                PNG
              </button>
              <button
                onClick={() => handleExport('svg')}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                SVG
              </button>
              <button
                onClick={() => handleExport('xml')}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Draw.io XML
              </button>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleSave()}
            disabled={isViewOnly || !hasUnsavedChanges}
          >
            Save
          </Button>

          <Button
            size="sm"
            onClick={handleRunAnalysis}
            disabled={isViewOnly || isStarting || isChecking}
          >
            {isStarting || isChecking ? 'Analyzing...' : '▶ Run Analysis'}
          </Button>
        </div>
      </div>

      {/* Lock Banner */}
      {isViewOnly && lockInfo && (
        <div className="bg-amber-100 dark:bg-amber-900/30 px-4 py-2 text-amber-800 dark:text-amber-200 text-sm flex items-center justify-between">
          <span>
            <span className="font-medium">View-only mode:</span> This model is being edited by{' '}
            {lockInfo.lockedByName || 'another user'}.
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => forceTakeLock(user?.name || user?.email || 'Unknown User')}
          >
            Take Over Lock
          </Button>
        </div>
      )}

      {/* Main Content - Full width Draw.io editor */}
      <div className="flex-1 overflow-hidden">
        <DrawioEmbed
          ref={drawioRef}
          initialXml={currentXml}
          onXmlChange={handleXmlChange}
          onSave={handleSave}
          readOnly={isViewOnly}
        />
      </div>

      {/* Footer */}
      <div className="h-10 border-t flex items-center justify-between px-4 bg-white dark:bg-gray-900 text-sm">
        <LockManager
          threatModelId={modelId}
          currentUserId={user?.id || ''}
          currentUserName={user?.name}
          apiBaseUrl={`${API_URL}/threat-modeling`}
        />
        <VersionManager
          threatModelId={modelId}
          currentXml={currentXml}
          onVersionLoad={(xml) => {
            drawioRef.current?.setXml(xml);
            setCurrentXml(xml);
            setHasUnsavedChanges(false);
          }}
          autoSaveEnabled={isLockedByMe}
          apiBaseUrl={`${API_URL}/threat-modeling`}
        />
      </div>

      {/* Gap Fill Dialog */}
      {showGapDialog && detectedGaps && (
        <GapFillDialog
          isOpen={showGapDialog}
          onClose={() => setShowGapDialog(false)}
          gaps={detectedGaps}
          threatModelId={modelId}
          onComplete={handleGapFillComplete}
          onSkip={() => {
            setShowGapDialog(false);
          }}
        />
      )}

      {/* Analysis Progress Modal */}
      {analysisRunId && (
        <AnalysisProgressModal
          isOpen={!!analysisRunId}
          onClose={() => clearAnalysis()}
          threatModelId={modelId}
          analysisRunId={analysisRunId}
          onComplete={(riskCount) => {
            clearAnalysis();
            toast.success(`Analysis complete: ${riskCount} risks identified`);
          }}
          onError={(error) => {
            clearAnalysis();
            toast.error(`Analysis failed: ${error}`);
          }}
        />
      )}
    </div>
  );
}
