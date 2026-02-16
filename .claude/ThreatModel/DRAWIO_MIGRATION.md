# ThreatDiviner: mxGraph to Draw.io Embed Migration

## Executive Summary

**Problem:** The current implementation uses mxGraph directly, which is:
- Deprecated (JGraph stopped development)
- Requires manual shape stencil configuration for 4000+ icons
- Complex to maintain
- Missing features that Draw.io provides out-of-the-box

**Solution:** Replace mxGraph custom editor with Draw.io Embed API, which:
- Is actively maintained
- Includes all 4000+ stencils (AWS, Azure, GCP, etc.)
- Has built-in templates
- Supports custom properties (for Threagile metadata)
- Uses same XML format (backward compatible)

**Effort:** 2-3 days implementation

---

## Architecture Overview

### Current (mxGraph - DELETE)
```
┌─────────────────────────────────────────────────────────────────┐
│ Diagram Page                                                     │
├──────────┬─────────────────────────────────────┬────────────────┤
│          │                                     │                │
│ Shape    │    DiagramCanvas.tsx (1059 lines)   │  Property      │
│ Palette  │    - Custom mxGraph wrapper         │  Panel         │
│ (692 ln) │    - Manual shape registration      │  (1054 lines)  │
│          │    - XML serialization              │                │
│          │    - Event handling                 │                │
│          │                                     │                │
└──────────┴─────────────────────────────────────┴────────────────┘
```

### New (Draw.io Embed - CREATE)
```
┌─────────────────────────────────────────────────────────────────┐
│ Diagram Page                                                     │
├─────────────────────────────────────────────────┬────────────────┤
│                                                 │                │
│         Draw.io Embed (iframe)                  │  Property      │
│         - Official Draw.io editor               │  Panel         │
│         - All 4000+ stencils included           │  (KEEP)        │
│         - Templates included                    │                │
│         - postMessage API for integration       │  Threagile     │
│                                                 │  metadata      │
│              ◄── postMessage ──►                │  fields        │
│                                                 │                │
└─────────────────────────────────────────────────┴────────────────┘
```

---

## Files to DELETE (mxGraph Implementation)

| File | Lines | Reason |
|------|-------|--------|
| `apps/dashboard/src/components/threat-modeling/DiagramCanvas.tsx` | 1059 | Replace with Draw.io embed |
| `apps/dashboard/src/components/threat-modeling/ShapePalette.tsx` | 692 | Draw.io has built-in palette |

**Total lines removed:** ~1,751

---

## Files to CREATE

### 1. DrawioEmbed Component

**File:** `apps/dashboard/src/components/threat-modeling/DrawioEmbed.tsx`

```tsx
'use client';

import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';

export interface DrawioEmbedProps {
  /** Initial XML content to load */
  initialXml?: string;
  /** Called when diagram is modified */
  onXmlChange?: (xml: string) => void;
  /** Called when a cell is selected */
  onSelectionChange?: (cellId: string | null, cellData: DrawioCellData | null) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Called when Draw.io is ready */
  onReady?: () => void;
  /** Called on save action (Ctrl+S) */
  onSave?: (xml: string) => void;
}

export interface DrawioCellData {
  id: string;
  value: string; // Display label
  style: string;
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Threagile custom properties (stored in XML)
  customProperties?: {
    technology?: string;
    criticality?: string;
    internetFacing?: boolean;
    encryption?: string;
    authentication?: string;
    multiTenant?: boolean;
    redundant?: boolean;
    customDevelopment?: boolean;
    outOfScope?: boolean;
    justificationOutOfScope?: string;
    // DataFlow properties
    protocol?: string;
    vpn?: boolean;
    ipFiltered?: boolean;
    dataAssets?: string[];
    // Trust boundary properties
    boundaryType?: string;
  };
}

export interface DrawioEmbedRef {
  getXml: () => Promise<string>;
  setXml: (xml: string) => void;
  exportPng: () => Promise<Blob>;
  exportSvg: () => Promise<string>;
  setCustomProperty: (cellId: string, key: string, value: any) => void;
  getCustomProperties: (cellId: string) => Promise<Record<string, any>>;
}

// Draw.io embed URL - using diagrams.net (official)
const DRAWIO_URL = 'https://embed.diagrams.net';

const DrawioEmbed = forwardRef<DrawioEmbedRef, DrawioEmbedProps>(({
  initialXml,
  onXmlChange,
  onSelectionChange,
  readOnly = false,
  onReady,
  onSave,
}, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const pendingCallbacks = useRef<Map<string, (data: any) => void>>(new Map());

  // Generate unique callback ID
  const generateCallbackId = () => `cb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Send message to Draw.io iframe
  const sendMessage = useCallback((action: string, data?: any, callbackId?: string) => {
    if (!iframeRef.current?.contentWindow) return;
    
    const message: any = { action, ...data };
    if (callbackId) {
      message.callbackId = callbackId;
    }
    
    iframeRef.current.contentWindow.postMessage(JSON.stringify(message), '*');
  }, []);

  // Send message and wait for response
  const sendMessageWithCallback = useCallback(<T,>(action: string, data?: any): Promise<T> => {
    return new Promise((resolve) => {
      const callbackId = generateCallbackId();
      pendingCallbacks.current.set(callbackId, resolve);
      sendMessage(action, data, callbackId);
      
      // Timeout after 10s
      setTimeout(() => {
        if (pendingCallbacks.current.has(callbackId)) {
          pendingCallbacks.current.delete(callbackId);
          resolve(null as T);
        }
      }, 10000);
    });
  }, [sendMessage]);

  // Handle messages from Draw.io
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from diagrams.net
      if (!event.origin.includes('diagrams.net') && !event.origin.includes('draw.io')) {
        return;
      }

      let data: any;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      // Handle callback responses
      if (data.callbackId && pendingCallbacks.current.has(data.callbackId)) {
        const callback = pendingCallbacks.current.get(data.callbackId);
        pendingCallbacks.current.delete(data.callbackId);
        callback?.(data);
        return;
      }

      switch (data.event) {
        case 'init':
          // Draw.io is ready
          setIsReady(true);
          onReady?.();
          
          // Load initial XML if provided
          if (initialXml) {
            sendMessage('load', { xml: initialXml });
          }
          break;

        case 'load':
          // Diagram loaded
          break;

        case 'save':
          // User triggered save (Ctrl+S)
          onSave?.(data.xml);
          break;

        case 'export':
          // Export completed
          break;

        case 'autosave':
          // Auto-save triggered
          onXmlChange?.(data.xml);
          break;

        case 'select':
          // Cell selection changed
          if (data.cells && data.cells.length > 0) {
            const cellId = data.cells[0];
            // Request cell data
            getCellData(cellId).then((cellData) => {
              onSelectionChange?.(cellId, cellData);
            });
          } else {
            onSelectionChange?.(null, null);
          }
          break;

        case 'change':
          // Diagram changed
          // Request current XML
          getXml().then((xml) => {
            onXmlChange?.(xml);
          });
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [initialXml, onXmlChange, onSelectionChange, onReady, onSave, sendMessage]);

  // Get current XML
  const getXml = useCallback(async (): Promise<string> => {
    const result = await sendMessageWithCallback<{ xml: string }>('export', { format: 'xml' });
    return result?.xml || '';
  }, [sendMessageWithCallback]);

  // Set XML content
  const setXml = useCallback((xml: string) => {
    sendMessage('load', { xml });
  }, [sendMessage]);

  // Export as PNG
  const exportPng = useCallback(async (): Promise<Blob> => {
    const result = await sendMessageWithCallback<{ data: string }>('export', { format: 'png' });
    if (result?.data) {
      const base64 = result.data.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: 'image/png' });
    }
    throw new Error('Export failed');
  }, [sendMessageWithCallback]);

  // Export as SVG
  const exportSvg = useCallback(async (): Promise<string> => {
    const result = await sendMessageWithCallback<{ data: string }>('export', { format: 'svg' });
    return result?.data || '';
  }, [sendMessageWithCallback]);

  // Get cell data including custom properties
  const getCellData = useCallback(async (cellId: string): Promise<DrawioCellData | null> => {
    const result = await sendMessageWithCallback<{ cell: DrawioCellData }>('getCell', { id: cellId });
    return result?.cell || null;
  }, [sendMessageWithCallback]);

  // Set custom property on a cell
  const setCustomProperty = useCallback((cellId: string, key: string, value: any) => {
    sendMessage('setCustomProperty', { cellId, key, value });
  }, [sendMessage]);

  // Get custom properties for a cell
  const getCustomProperties = useCallback(async (cellId: string): Promise<Record<string, any>> => {
    const result = await sendMessageWithCallback<{ properties: Record<string, any> }>('getCustomProperties', { cellId });
    return result?.properties || {};
  }, [sendMessageWithCallback]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getXml,
    setXml,
    exportPng,
    exportSvg,
    setCustomProperty,
    getCustomProperties,
  }), [getXml, setXml, exportPng, exportSvg, setCustomProperty, getCustomProperties]);

  // Build Draw.io URL with configuration
  const drawioUrl = new URL(DRAWIO_URL);
  
  // Configure Draw.io embed
  const params = new URLSearchParams({
    embed: '1',
    proto: 'json',
    spin: '1',
    modified: 'unsavedChanges',
    keepmodified: '1',
    libraries: '1',
    noSaveBtn: readOnly ? '1' : '0',
    saveAndExit: '0',
    noExitBtn: '1',
    // Enable all shape libraries
    libs: 'general;aws4;azure;gcp2;network;clipart;flowchart;uml;er;mscae',
    // UI configuration
    ui: 'kennedy', // Modern UI theme
    // Enable dark mode if system prefers
    dark: typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? '1' : '0',
  });

  drawioUrl.search = params.toString();

  return (
    <div className="w-full h-full relative">
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading diagram editor...</span>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={drawioUrl.toString()}
        className="w-full h-full border-0"
        style={{ opacity: isReady ? 1 : 0 }}
        title="Diagram Editor"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
});

DrawioEmbed.displayName = 'DrawioEmbed';

export default DrawioEmbed;
```

### 2. Custom Property Bridge Hook

**File:** `apps/dashboard/src/hooks/useDrawioPropertyBridge.ts`

```tsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { DrawioCellData, DrawioEmbedRef } from '@/components/threat-modeling/DrawioEmbed';

export interface ThreagileProperties {
  // Component properties
  technology?: string;
  criticality?: 'critical' | 'important' | 'operational' | 'archive';
  internetFacing?: boolean;
  encryption?: 'none' | 'transparent' | 'data-with-symmetric-shared-key' | 'data-with-asymmetric-shared-key' | 'data-with-end-user-individual-key';
  authentication?: 'none' | 'credentials' | 'session-id' | 'token' | 'client-certificate' | 'two-factor' | 'externalized';
  multiTenant?: boolean;
  redundant?: boolean;
  customDevelopment?: boolean;
  outOfScope?: boolean;
  justificationOutOfScope?: string;
  
  // DataFlow properties
  protocol?: string;
  authorization?: boolean;
  vpn?: boolean;
  ipFiltered?: boolean;
  readonly?: boolean;
  dataAssets?: string[];
  
  // Trust boundary properties
  boundaryType?: string;
}

export interface SelectedElement {
  id: string;
  type: 'component' | 'dataflow' | 'trust_boundary';
  name: string;
  properties: ThreagileProperties;
}

export function useDrawioPropertyBridge(drawioRef: React.RefObject<DrawioEmbedRef>) {
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Determine element type from Draw.io style
  const getElementType = useCallback((style: string): 'component' | 'dataflow' | 'trust_boundary' => {
    if (style.includes('edgeStyle') || style.includes('endArrow') || style.includes('startArrow')) {
      return 'dataflow';
    }
    if (style.includes('swimlane') || style.includes('group') || style.includes('rounded=0;dashed=1')) {
      return 'trust_boundary';
    }
    return 'component';
  }, []);

  // Parse custom properties from Draw.io cell
  const parseProperties = useCallback((cellData: DrawioCellData): ThreagileProperties => {
    return cellData.customProperties || {};
  }, []);

  // Handle selection change from Draw.io
  const handleSelectionChange = useCallback((cellId: string | null, cellData: DrawioCellData | null) => {
    if (!cellId || !cellData) {
      setSelectedElement(null);
      return;
    }

    const elementType = getElementType(cellData.style);
    const properties = parseProperties(cellData);

    setSelectedElement({
      id: cellId,
      type: elementType,
      name: cellData.value || 'Unnamed',
      properties,
    });
  }, [getElementType, parseProperties]);

  // Update property in Draw.io
  const updateProperty = useCallback(async (key: keyof ThreagileProperties, value: any) => {
    if (!selectedElement || !drawioRef.current) return;

    setIsSyncing(true);
    try {
      drawioRef.current.setCustomProperty(selectedElement.id, key, value);
      
      // Update local state
      setSelectedElement((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          properties: {
            ...prev.properties,
            [key]: value,
          },
        };
      });
    } finally {
      setIsSyncing(false);
    }
  }, [selectedElement, drawioRef]);

  // Update all properties at once
  const updateAllProperties = useCallback(async (properties: ThreagileProperties) => {
    if (!selectedElement || !drawioRef.current) return;

    setIsSyncing(true);
    try {
      for (const [key, value] of Object.entries(properties)) {
        drawioRef.current.setCustomProperty(selectedElement.id, key, value);
      }
      
      setSelectedElement((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          properties,
        };
      });
    } finally {
      setIsSyncing(false);
    }
  }, [selectedElement, drawioRef]);

  return {
    selectedElement,
    isSyncing,
    handleSelectionChange,
    updateProperty,
    updateAllProperties,
  };
}
```

### 3. Updated Diagram Page

**File:** `apps/dashboard/src/app/dashboard/threat-modeling/[id]/diagram/page.tsx`

```tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, useToast } from '@/components/ui';
import DrawioEmbed, { DrawioEmbedRef, DrawioCellData } from '@/components/threat-modeling/DrawioEmbed';
import { PropertyPanel } from '@/components/threat-modeling/PropertyPanel';
import { LockManager, useLockManager } from '@/components/threat-modeling/LockManager';
import { VersionManager, useVersionManager } from '@/components/threat-modeling/VersionManager';
import { GapFillDialog } from '@/components/threat-modeling/GapFillDialog';
import { AnalysisProgressModal } from '@/components/threat-modeling/AnalysisProgressModal';
import { useDrawioPropertyBridge } from '@/hooks/useDrawioPropertyBridge';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useGapDetection } from '@/hooks/useGapDetection';
import { useAuth } from '@/contexts/auth-context';

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
  const [showPropertyPanel, setShowPropertyPanel] = useState(true);
  const [showGapDialog, setShowGapDialog] = useState(false);

  // Hooks
  const {
    lockInfo,
    isLocked,
    isLockedByMe,
    acquireLock,
    releaseLock,
    refreshLock,
  } = useLockManager(modelId, user?.id || '');

  const {
    versions,
    currentVersion,
    loadVersion,
    createVersion,
  } = useVersionManager(modelId);

  const {
    selectedElement,
    isSyncing,
    handleSelectionChange,
    updateAllProperties,
  } = useDrawioPropertyBridge(drawioRef);

  const { startAnalysis, isStarting, analysisRunId, gaps, error: analysisError } = useAnalysis();
  const { checkGaps, isChecking } = useGapDetection();

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
        console.error(err);
        toast.error('Error', 'Failed to load threat model');
        router.push('/dashboard/threat-modeling');
      } finally {
        setLoading(false);
      }
    };
    fetchModel();
  }, [modelId, router, toast]);

  // Acquire lock on mount
  useEffect(() => {
    if (user?.id) {
      acquireLock(user.name || user.email || 'Unknown User');
    }
    return () => {
      releaseLock();
    };
  }, [user, acquireLock, releaseLock]);

  // Auto-refresh lock
  useEffect(() => {
    if (!isLockedByMe) return;
    const interval = setInterval(() => {
      refreshLock();
    }, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [isLockedByMe, refreshLock]);

  // Handle XML changes from Draw.io
  const handleXmlChange = useCallback((xml: string) => {
    setCurrentXml(xml);
    setHasUnsavedChanges(true);
  }, []);

  // Handle selection change from Draw.io
  const handleDrawioSelectionChange = useCallback((cellId: string | null, cellData: DrawioCellData | null) => {
    handleSelectionChange(cellId, cellData);
  }, [handleSelectionChange]);

  // Handle save
  const handleSave = useCallback(async (xml?: string) => {
    const xmlToSave = xml || currentXml;
    
    if (!isLockedByMe) {
      toast.error('Cannot Save', 'You do not have the edit lock');
      return;
    }

    try {
      await createVersion(xmlToSave);
      setHasUnsavedChanges(false);
      toast.success('Saved', 'Diagram saved successfully');
    } catch (err) {
      toast.error('Save Failed', 'Could not save diagram');
    }
  }, [currentXml, isLockedByMe, createVersion, toast]);

  // Handle property panel updates
  const handlePropertyUpdate = useCallback((data: any) => {
    updateAllProperties(data);
    setHasUnsavedChanges(true);
  }, [updateAllProperties]);

  // Handle run analysis
  const handleRunAnalysis = useCallback(async () => {
    // First check for gaps
    const gapResult = await checkGaps(modelId);
    if (gapResult && gapResult.gaps && gapResult.gaps.length > 0) {
      setShowGapDialog(true);
      return;
    }

    // Save before analysis
    if (hasUnsavedChanges) {
      await handleSave();
    }

    // Start analysis
    await startAnalysis(modelId);
  }, [modelId, checkGaps, hasUnsavedChanges, handleSave, startAnalysis]);

  // Handle gap fill complete
  const handleGapFillComplete = useCallback(async () => {
    setShowGapDialog(false);
    await handleSave();
    await startAnalysis(modelId, { skipGapCheck: true });
  }, [modelId, handleSave, startAnalysis]);

  // Handle version load
  const handleLoadVersion = useCallback(async (versionId: string) => {
    const version = await loadVersion(versionId);
    if (version?.xmlContent) {
      drawioRef.current?.setXml(version.xmlContent);
      setCurrentXml(version.xmlContent);
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
      toast.success('Exported', `Diagram exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error('Export Failed', 'Could not export diagram');
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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPropertyPanel(!showPropertyPanel)}
          >
            {showPropertyPanel ? 'Hide Properties' : 'Show Properties'}
          </Button>
        </div>
      </div>

      {/* Lock Banner */}
      {isViewOnly && lockInfo && (
        <div className="bg-amber-100 dark:bg-amber-900/30 px-4 py-2 text-amber-800 dark:text-amber-200 text-sm">
          <span className="font-medium">View-only mode:</span> This model is being edited by{' '}
          {lockInfo.lockedByName || 'another user'}.
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Draw.io Editor */}
        <div className="flex-1 relative">
          <DrawioEmbed
            ref={drawioRef}
            initialXml={currentXml}
            onXmlChange={handleXmlChange}
            onSelectionChange={handleDrawioSelectionChange}
            onSave={handleSave}
            readOnly={isViewOnly}
          />
        </div>

        {/* Property Panel */}
        {showPropertyPanel && (
          <div className="w-80 border-l bg-white dark:bg-gray-900 overflow-y-auto">
            <PropertyPanel
              selectedType={selectedElement?.type || null}
              selectedData={selectedElement ? {
                id: selectedElement.id,
                name: selectedElement.name,
                type: selectedElement.type,
                ...selectedElement.properties,
              } : null}
              onUpdate={handlePropertyUpdate}
              isLoading={isSyncing}
              isSaving={isSyncing}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="h-10 border-t flex items-center justify-between px-4 bg-white dark:bg-gray-900 text-sm">
        <LockManager lockInfo={lockInfo} />
        <VersionManager
          versions={versions}
          currentVersion={currentVersion}
          onLoadVersion={handleLoadVersion}
        />
      </div>

      {/* Gap Fill Dialog */}
      {showGapDialog && gaps && (
        <GapFillDialog
          gaps={gaps.gaps}
          onComplete={handleGapFillComplete}
          onClose={() => setShowGapDialog(false)}
        />
      )}

      {/* Analysis Progress Modal */}
      {analysisRunId && (
        <AnalysisProgressModal
          analysisRunId={analysisRunId}
          isOpen={!!analysisRunId}
          onClose={() => {}}
        />
      )}
    </div>
  );
}
```

---

## Files to MODIFY

### 1. Update Component Exports

**File:** `apps/dashboard/src/components/threat-modeling/index.ts`

```tsx
// REMOVE these exports:
// export { default as DiagramCanvas } from './DiagramCanvas';
// export type { DiagramCanvasProps, DiagramComponent, DiagramDataFlow } from './DiagramCanvas';
// export { default as ShapePalette } from './ShapePalette';
// export type { ShapePaletteProps, ShapeItem } from './ShapePalette';

// ADD these exports:
export { default as DrawioEmbed } from './DrawioEmbed';
export type { DrawioEmbedProps, DrawioEmbedRef, DrawioCellData } from './DrawioEmbed';

// KEEP these exports (unchanged):
export { default as PropertyPanel } from './PropertyPanel';
export type {
  PropertyPanelProps,
  ComponentFormData,
  DataFlowFormData,
  TrustBoundaryFormData,
} from './PropertyPanel';

export { default as VersionManager, useVersionManager } from './VersionManager';
export type { VersionManagerProps, DiagramVersion } from './VersionManager';

export { default as LockManager, useLockManager } from './LockManager';
export type { LockManagerProps, LockInfo } from './LockManager';

export { GapFillDialog } from './GapFillDialog';
export type { Gap, GapDetectionResult } from './GapFillDialog';

export { AnalysisProgressModal } from './AnalysisProgressModal';
export type { AnalysisStage, AnalysisProgress } from './AnalysisProgressModal';
```

### 2. Update Hooks Exports

**File:** `apps/dashboard/src/hooks/index.ts`

Add:
```tsx
export { useDrawioPropertyBridge } from './useDrawioPropertyBridge';
export type { ThreagileProperties, SelectedElement } from './useDrawioPropertyBridge';
```

### 3. Remove mxGraph Dependency

**File:** `apps/dashboard/package.json`

Remove:
```json
{
  "dependencies": {
    "mxgraph": "^4.x.x"  // REMOVE THIS LINE
  }
}
```

---

## Database Changes

### NO SCHEMA CHANGES REQUIRED

The database schema remains unchanged because:
1. `diagramXml` field already stores Draw.io XML format
2. Custom properties are stored IN the XML (Draw.io native feature)
3. `DiagramVersion`, `ThreatModelLock` tables work with any editor

### XML Format (Compatible)

Both mxGraph and Draw.io use the same XML format:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="embed.diagrams.net">
  <diagram id="..." name="Page-1">
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <!-- Component with Threagile custom properties -->
        <mxCell id="api-server" value="API Server" 
                style="shape=mxgraph.aws4.ec2;..."
                vertex="1" parent="1">
          <mxGeometry x="100" y="200" width="120" height="60" />
          <!-- Custom properties stored here -->
          <Object 
            technology="web-application"
            criticality="critical"
            internetFacing="true"
            authentication="token"
            encryption="transparent"
            as="customData" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

---

## API Changes

### NO API CHANGES REQUIRED

The API endpoints remain unchanged:
- `GET /threat-modeling/:id/diagram` → Returns `{ xml, version, lockedBy }`
- `PUT /threat-modeling/:id/diagram` → Accepts `{ xml, versionName? }`
- Lock endpoints unchanged
- Version endpoints unchanged

---

## Migration Steps

### Step 1: Create New Files
1. Create `apps/dashboard/src/components/threat-modeling/DrawioEmbed.tsx`
2. Create `apps/dashboard/src/hooks/useDrawioPropertyBridge.ts`

### Step 2: Replace Diagram Page
1. Replace `apps/dashboard/src/app/dashboard/threat-modeling/[id]/diagram/page.tsx`

### Step 3: Update Exports
1. Modify `apps/dashboard/src/components/threat-modeling/index.ts`
2. Modify `apps/dashboard/src/hooks/index.ts`

### Step 4: Delete Old Files
1. Delete `apps/dashboard/src/components/threat-modeling/DiagramCanvas.tsx`
2. Delete `apps/dashboard/src/components/threat-modeling/ShapePalette.tsx`

### Step 5: Remove Dependencies
1. Run `pnpm remove mxgraph` in `apps/dashboard`

### Step 6: Test
1. Verify diagram loads
2. Verify selection syncs to PropertyPanel
3. Verify save works
4. Verify lock works
5. Verify version history works
6. Verify Run Analysis works

---

## Benefits of This Migration

| Aspect | Before (mxGraph) | After (Draw.io Embed) |
|--------|------------------|----------------------|
| **Lines of Code** | ~2,800 (DiagramCanvas + ShapePalette + custom) | ~400 (DrawioEmbed + bridge) |
| **Shape Library** | 9 basic shapes | 4000+ shapes (AWS, Azure, GCP, etc.) |
| **Templates** | None | 100+ built-in |
| **Maintenance** | We maintain | Draw.io maintains |
| **Features** | Basic | Full (layers, find/replace, etc.) |
| **Updates** | Manual | Automatic (embed always current) |
| **File Format** | Draw.io XML | Draw.io XML (same) |
| **Custom Properties** | Manual sync | Native support |

---

## Rollback Plan

If issues arise:
1. Files are only deleted/replaced, not modified in complex ways
2. Git history preserves old implementation
3. `diagramXml` format unchanged, no data migration needed
4. Can revert to mxGraph by restoring deleted files

---

## Testing Checklist

- [ ] Draw.io embed loads in iframe
- [ ] Initial XML loads correctly
- [ ] Shape palette shows all AWS/Azure/GCP icons
- [ ] Drag shapes onto canvas
- [ ] Connect shapes with edges
- [ ] Select component → PropertyPanel shows data
- [ ] Edit property → syncs to diagram XML
- [ ] Save (Ctrl+S) → creates version
- [ ] Load previous version → diagram updates
- [ ] Lock acquired on open
- [ ] Lock released on close
- [ ] View-only mode when locked by another
- [ ] Export PNG works
- [ ] Export SVG works
- [ ] Export XML works
- [ ] Run Analysis → detects gaps
- [ ] Fill gaps → analysis runs
- [ ] Dark mode support
