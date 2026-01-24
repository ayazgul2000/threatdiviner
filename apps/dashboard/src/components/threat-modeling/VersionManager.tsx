'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface DiagramVersion {
  id: string;
  versionNumber: number;
  versionName?: string;
  createdBy: string;
  createdByName?: string;
  isAutoSave: boolean;
  createdAt: string;
}

export interface VersionManagerProps {
  threatModelId: string;
  currentXml: string;
  onVersionLoad: (xml: string, version: DiagramVersion) => void;
  onSaveStart?: () => void;
  onSaveComplete?: (version: DiagramVersion) => void;
  onSaveError?: (error: string) => void;
  autoSaveInterval?: number; // ms, default 60000 (1 minute)
  autoSaveEnabled?: boolean;
  apiBaseUrl?: string;
}

const DEFAULT_AUTOSAVE_INTERVAL = 60000; // 1 minute

export default function VersionManager({
  threatModelId,
  currentXml,
  onVersionLoad,
  onSaveStart,
  onSaveComplete,
  onSaveError,
  autoSaveInterval = DEFAULT_AUTOSAVE_INTERVAL,
  autoSaveEnabled = true,
  apiBaseUrl = '/api/threat-modeling',
}: VersionManagerProps) {
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const lastSavedXmlRef = useRef<string>('');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch versions on mount
  useEffect(() => {
    fetchVersions();
  }, [threatModelId]);

  // Track unsaved changes
  useEffect(() => {
    if (currentXml && lastSavedXmlRef.current && currentXml !== lastSavedXmlRef.current) {
      setHasUnsavedChanges(true);
    }
  }, [currentXml]);

  // Auto-save timer
  useEffect(() => {
    if (!autoSaveEnabled || !hasUnsavedChanges) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      saveVersion(true); // isAutoSave = true
    }, autoSaveInterval);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, autoSaveEnabled, autoSaveInterval]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut for save (Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveVersion(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentXml]);

  // Fetch version history
  const fetchVersions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiBaseUrl}/${threatModelId}/versions`);

      if (!response.ok) {
        throw new Error('Failed to fetch versions');
      }

      const data = await response.json();
      setVersions(data.versions || []);

      // Set the latest version as selected if none selected
      if (data.versions?.length > 0 && !selectedVersion) {
        const latest = data.versions[0];
        setSelectedVersion(latest.id);
        lastSavedXmlRef.current = currentXml;
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save new version
  const saveVersion = useCallback(async (isAutoSave: boolean = false) => {
    if (isSaving || !currentXml) return;

    // Don't auto-save if there are no changes
    if (isAutoSave && currentXml === lastSavedXmlRef.current) return;

    try {
      setIsSaving(true);
      onSaveStart?.();

      const response = await fetch(`${apiBaseUrl}/${threatModelId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          xmlContent: currentXml,
          isAutoSave,
          versionName: isAutoSave ? undefined : `Manual save`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save version');
      }

      const newVersion: DiagramVersion = await response.json();

      // Update state
      setVersions((prev) => [newVersion, ...prev]);
      setSelectedVersion(newVersion.id);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      lastSavedXmlRef.current = currentXml;

      onSaveComplete?.(newVersion);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to save version:', message);
      onSaveError?.(message);
    } finally {
      setIsSaving(false);
    }
  }, [currentXml, isSaving, threatModelId, apiBaseUrl, onSaveStart, onSaveComplete, onSaveError]);

  // Load a specific version
  const loadVersion = async (versionId: string) => {
    const version = versions.find((v) => v.id === versionId);
    if (!version) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${apiBaseUrl}/${threatModelId}/versions/${versionId}`);

      if (!response.ok) {
        throw new Error('Failed to load version');
      }

      const data = await response.json();

      setSelectedVersion(versionId);
      setIsDropdownOpen(false);
      lastSavedXmlRef.current = data.xmlContent;
      setHasUnsavedChanges(false);

      onVersionLoad(data.xmlContent, version);
    } catch (error) {
      console.error('Failed to load version:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Get current version info
  const currentVersion = versions.find((v) => v.id === selectedVersion);

  return (
    <div className="flex items-center gap-2">
      {/* Version dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {isLoading ? (
            <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <>
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-gray-700 dark:text-gray-200">
                {currentVersion ? `v${currentVersion.versionNumber}` : 'No versions'}
              </span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>

        {/* Dropdown menu */}
        {isDropdownOpen && versions.length > 0 && (
          <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Version History</p>
            </div>
            <div className="py-1">
              {versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => loadVersion(version.id)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                    ${version.id === selectedVersion ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      v{version.versionNumber}
                      {version.isAutoSave && (
                        <span className="ml-2 text-xs text-gray-400">(auto)</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(version.createdAt)}
                    </span>
                  </div>
                  {version.versionName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {version.versionName}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        onClick={() => saveVersion(false)}
        disabled={isSaving || !hasUnsavedChanges}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors
          ${hasUnsavedChanges && !isSaving
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        title="Save (Ctrl+S)"
      >
        {isSaving ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Saving...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span>Save</span>
          </>
        )}
      </button>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        {hasUnsavedChanges ? (
          <>
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Unsaved changes</span>
          </>
        ) : lastSaved ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>Saved {formatRelativeTime(lastSaved.toISOString())}</span>
          </>
        ) : null}
        {autoSaveEnabled && (
          <span className="ml-2 text-gray-400" title="Auto-save enabled">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}

// Custom hook for version management
export function useVersionManager(threatModelId: string, apiBaseUrl = '/api/threat-modeling') {
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<DiagramVersion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/${threatModelId}/versions`);

      if (!response.ok) throw new Error('Failed to fetch versions');

      const data = await response.json();
      setVersions(data.versions || []);
      if (data.versions?.length > 0) {
        setCurrentVersion(data.versions[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [threatModelId, apiBaseUrl]);

  const saveVersion = useCallback(async (xmlContent: string, isAutoSave = false, versionName?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/${threatModelId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xmlContent, isAutoSave, versionName }),
      });

      if (!response.ok) throw new Error('Failed to save version');

      const newVersion = await response.json();
      setVersions((prev) => [newVersion, ...prev]);
      setCurrentVersion(newVersion);
      return newVersion;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [threatModelId, apiBaseUrl]);

  const loadVersion = useCallback(async (versionId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/${threatModelId}/versions/${versionId}`);

      if (!response.ok) throw new Error('Failed to load version');

      const data = await response.json();
      const version = versions.find((v) => v.id === versionId);
      if (version) setCurrentVersion(version);
      return data.xmlContent;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [threatModelId, apiBaseUrl, versions]);

  return {
    versions,
    currentVersion,
    isLoading,
    error,
    fetchVersions,
    saveVersion,
    loadVersion,
  };
}
