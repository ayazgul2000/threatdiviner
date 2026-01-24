'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface LockInfo {
  id: string;
  threatModelId: string;
  lockedBy: string;
  lockedByName?: string;
  lockedAt: string;
  expiresAt: string;
}

export interface LockManagerProps {
  threatModelId: string;
  currentUserId: string;
  currentUserName?: string;
  onLockAcquired?: (lock: LockInfo) => void;
  onLockReleased?: () => void;
  onLockError?: (error: string) => void;
  onLockStatusChange?: (isLocked: boolean, lockInfo: LockInfo | null) => void;
  lockRefreshInterval?: number; // ms, default 60000 (1 minute)
  apiBaseUrl?: string;
}

const DEFAULT_LOCK_REFRESH_INTERVAL = 60000; // 1 minute
const LOCK_DURATION_MINUTES = 5;

export default function LockManager({
  threatModelId,
  currentUserId,
  currentUserName,
  onLockAcquired,
  onLockReleased,
  onLockError,
  onLockStatusChange,
  lockRefreshInterval = DEFAULT_LOCK_REFRESH_INTERVAL,
  apiBaseUrl = '/api/threat-modeling',
}: LockManagerProps) {
  const [lockInfo, setLockInfo] = useState<LockInfo | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current user has the lock
  const isLockedByCurrentUser = lockInfo?.lockedBy === currentUserId;

  // Check if lock is expired
  const isLockExpired = lockInfo ? new Date(lockInfo.expiresAt) < new Date() : false;

  // Check lock status on mount
  useEffect(() => {
    checkLockStatus();
    return () => {
      // Clean up timer on unmount
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      // Release lock if we have it
      if (isLockedByCurrentUser) {
        releaseLock();
      }
    };
  }, [threatModelId]);

  // Set up refresh timer when we have the lock
  useEffect(() => {
    if (isLockedByCurrentUser && !isLockExpired) {
      refreshTimerRef.current = setInterval(() => {
        refreshLock();
      }, lockRefreshInterval);

      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
        }
      };
    }
  }, [isLockedByCurrentUser, isLockExpired, lockRefreshInterval]);

  // Notify parent of lock status changes
  useEffect(() => {
    const isLocked = !!lockInfo && !isLockExpired && !isLockedByCurrentUser;
    onLockStatusChange?.(isLocked, lockInfo);
  }, [lockInfo, isLockExpired, isLockedByCurrentUser]);

  // Handle page unload - release lock
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isLockedByCurrentUser) {
        // Use sendBeacon for reliable lock release on page close
        navigator.sendBeacon(
          `${apiBaseUrl}/${threatModelId}/lock/release`,
          JSON.stringify({ userId: currentUserId })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLockedByCurrentUser, threatModelId, currentUserId, apiBaseUrl]);

  // Check lock status
  const checkLockStatus = async () => {
    try {
      setIsChecking(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/${threatModelId}/lock`);

      if (response.status === 404) {
        // No lock exists
        setLockInfo(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to check lock status');
      }

      const data = await response.json();
      setLockInfo(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      onLockError?.(message);
    } finally {
      setIsChecking(false);
    }
  };

  // Acquire lock
  const acquireLock = useCallback(async () => {
    try {
      setIsLocking(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/${threatModelId}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lockedBy: currentUserId,
          lockedByName: currentUserName,
          durationMinutes: LOCK_DURATION_MINUTES,
        }),
      });

      if (response.status === 409) {
        // Lock already held by someone else
        const data = await response.json();
        setLockInfo(data.existingLock);
        throw new Error(`Locked by ${data.existingLock.lockedByName || 'another user'}`);
      }

      if (!response.ok) {
        throw new Error('Failed to acquire lock');
      }

      const newLock = await response.json();
      setLockInfo(newLock);
      onLockAcquired?.(newLock);
      return newLock;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      onLockError?.(message);
      throw err;
    } finally {
      setIsLocking(false);
    }
  }, [threatModelId, currentUserId, currentUserName, apiBaseUrl, onLockAcquired, onLockError]);

  // Release lock
  const releaseLock = useCallback(async () => {
    if (!isLockedByCurrentUser) return;

    try {
      setIsLocking(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/${threatModelId}/lock`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUserId }),
      });

      if (!response.ok && response.status !== 404) {
        throw new Error('Failed to release lock');
      }

      setLockInfo(null);
      onLockReleased?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      onLockError?.(message);
    } finally {
      setIsLocking(false);
    }
  }, [threatModelId, currentUserId, isLockedByCurrentUser, apiBaseUrl, onLockReleased, onLockError]);

  // Refresh/extend lock
  const refreshLock = useCallback(async () => {
    if (!isLockedByCurrentUser) return;

    try {
      const response = await fetch(`${apiBaseUrl}/${threatModelId}/lock/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUserId,
          durationMinutes: LOCK_DURATION_MINUTES,
        }),
      });

      if (!response.ok) {
        // Lock was lost
        setLockInfo(null);
        onLockReleased?.();
        return;
      }

      const updatedLock = await response.json();
      setLockInfo(updatedLock);
    } catch (err) {
      console.error('Failed to refresh lock:', err);
    }
  }, [threatModelId, currentUserId, isLockedByCurrentUser, apiBaseUrl, onLockReleased]);

  // Force take lock (admin action)
  const forceTakeLock = useCallback(async () => {
    try {
      setIsLocking(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/${threatModelId}/lock/force`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lockedBy: currentUserId,
          lockedByName: currentUserName,
          durationMinutes: LOCK_DURATION_MINUTES,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to force acquire lock');
      }

      const newLock = await response.json();
      setLockInfo(newLock);
      onLockAcquired?.(newLock);
      return newLock;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      onLockError?.(message);
      throw err;
    } finally {
      setIsLocking(false);
    }
  }, [threatModelId, currentUserId, currentUserName, apiBaseUrl, onLockAcquired, onLockError]);

  // Format remaining time
  const formatRemainingTime = () => {
    if (!lockInfo) return '';
    const expires = new Date(lockInfo.expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (isChecking) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-md">
        <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm text-gray-500 dark:text-gray-400">Checking lock status...</span>
      </div>
    );
  }

  // Locked by another user
  if (lockInfo && !isLockedByCurrentUser && !isLockExpired) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Locked by {lockInfo.lockedByName || 'another user'}
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              View-only mode • Expires in {formatRemainingTime()}
            </p>
          </div>
        </div>
        <button
          onClick={checkLockStatus}
          className="px-2 py-1 text-xs text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-800/50 rounded"
        >
          Refresh
        </button>
      </div>
    );
  }

  // Current user has lock
  if (isLockedByCurrentUser) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              You have edit access
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              Lock expires in {formatRemainingTime()}
            </p>
          </div>
        </div>
        <button
          onClick={releaseLock}
          disabled={isLocking}
          className="px-3 py-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-700 rounded transition-colors"
        >
          {isLocking ? 'Releasing...' : 'Release Lock'}
        </button>
      </div>
    );
  }

  // No lock - can acquire
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {error || 'Diagram is available for editing'}
        </p>
      </div>
      <button
        onClick={acquireLock}
        disabled={isLocking}
        className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
      >
        {isLocking ? 'Acquiring...' : 'Start Editing'}
      </button>
    </div>
  );
}

// Custom hook for lock management
export function useLockManager(
  threatModelId: string,
  currentUserId: string,
  apiBaseUrl = '/api/threat-modeling'
) {
  const [lockInfo, setLockInfo] = useState<LockInfo | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLockedByCurrentUser = lockInfo?.lockedBy === currentUserId;
  const isLocked = !!lockInfo && lockInfo.lockedBy !== currentUserId && new Date(lockInfo.expiresAt) > new Date();

  const checkLock = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/${threatModelId}/lock`);
      if (response.status === 404) {
        setLockInfo(null);
        return null;
      }
      if (!response.ok) throw new Error('Failed to check lock');
      const data = await response.json();
      setLockInfo(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [threatModelId, apiBaseUrl]);

  const acquireLock = useCallback(async (lockedByName?: string) => {
    try {
      setIsLocking(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/${threatModelId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockedBy: currentUserId, lockedByName, durationMinutes: 5 }),
      });
      if (!response.ok) throw new Error('Failed to acquire lock');
      const data = await response.json();
      setLockInfo(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsLocking(false);
    }
  }, [threatModelId, currentUserId, apiBaseUrl]);

  const releaseLock = useCallback(async () => {
    try {
      setIsLocking(true);
      await fetch(`${apiBaseUrl}/${threatModelId}/lock`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      setLockInfo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLocking(false);
    }
  }, [threatModelId, currentUserId, apiBaseUrl]);

  return {
    lockInfo,
    isLocked,
    isLockedByCurrentUser,
    isLocking,
    error,
    checkLock,
    acquireLock,
    releaseLock,
  };
}
