import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ScannerStatus {
  scanner: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  findingsCount: number;
  duration?: number;
}

export interface StreamedFinding {
  id: string;
  scanner: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  filePath?: string;
  url?: string;
  cweIds?: string[];
  cveIds?: string[];
  timestamp: string;
}

export interface ScanProgress {
  filesScanned?: number;
  totalFiles?: number;
  endpointsScanned?: number;
  totalEndpoints?: number;
}

export interface ScanStreamState {
  connected: boolean;
  scanStatus: 'pending' | 'running' | 'completed' | 'failed' | null;
  scannerStatus: Map<string, ScannerStatus>;
  findings: StreamedFinding[];
  progress: ScanProgress;
  totalFindings: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  error: string | null;
}

export function useScanStream(scanId: string | null) {
  const [state, setState] = useState<ScanStreamState>({
    connected: false,
    scanStatus: null,
    scannerStatus: new Map(),
    findings: [],
    progress: {},
    totalFindings: 0,
    severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    error: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!scanId) return;

    // Clean up existing connection
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(`${API_URL}/scans`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[ScanStream] Connected');
      setState(prev => ({ ...prev, connected: true, error: null }));

      // Subscribe to scan updates
      socket.emit('subscribe', { scanId });
    });

    socket.on('disconnect', (reason) => {
      console.log('[ScanStream] Disconnected:', reason);
      setState(prev => ({ ...prev, connected: false }));

      // Attempt reconnection if not closed intentionally
      if (reason === 'io server disconnect' || reason === 'transport close') {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[ScanStream] Attempting reconnect...');
          socket.connect();
        }, 2000);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[ScanStream] Connection error:', error);
      setState(prev => ({ ...prev, error: 'Connection failed' }));
    });

    // Scanner started
    socket.on('scanner:start', (data: { scanner: string; phase: string }) => {
      console.log('[ScanStream] Scanner started:', data);
      setState(prev => {
        const newStatus = new Map(prev.scannerStatus);
        newStatus.set(data.scanner, {
          scanner: data.scanner,
          status: 'running',
          findingsCount: 0,
        });
        return { ...prev, scanStatus: 'running', scannerStatus: newStatus };
      });
    });

    // Scanner progress
    socket.on('scanner:progress', (data: ScanProgress & { scanner: string }) => {
      setState(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          ...data,
        },
      }));
    });

    // New finding
    socket.on('scanner:finding', (data: { scanner: string; finding: any }) => {
      const newFinding: StreamedFinding = {
        id: data.finding.id,
        scanner: data.scanner,
        severity: data.finding.severity,
        title: data.finding.title,
        filePath: data.finding.filePath,
        url: data.finding.url,
        cweIds: data.finding.cweIds,
        cveIds: data.finding.cveIds,
        timestamp: new Date().toISOString(),
      };

      setState(prev => {
        // Update severity breakdown
        const severity = newFinding.severity.toLowerCase() as keyof typeof prev.severityBreakdown;
        const newBreakdown = { ...prev.severityBreakdown };
        if (severity in newBreakdown) {
          newBreakdown[severity]++;
        }

        // Update scanner findings count
        const newStatus = new Map(prev.scannerStatus);
        const scannerStatus = newStatus.get(data.scanner);
        if (scannerStatus) {
          newStatus.set(data.scanner, {
            ...scannerStatus,
            findingsCount: scannerStatus.findingsCount + 1,
          });
        }

        return {
          ...prev,
          findings: [newFinding, ...prev.findings].slice(0, 100), // Keep last 100
          totalFindings: prev.totalFindings + 1,
          severityBreakdown: newBreakdown,
          scannerStatus: newStatus,
        };
      });
    });

    // Scanner completed
    socket.on('scanner:complete', (data: { scanner: string; findingsCount: number; duration: number; status: string }) => {
      console.log('[ScanStream] Scanner completed:', data);
      setState(prev => {
        const newStatus = new Map(prev.scannerStatus);
        newStatus.set(data.scanner, {
          scanner: data.scanner,
          status: data.status as 'completed' | 'failed',
          findingsCount: data.findingsCount,
          duration: data.duration,
        });
        return { ...prev, scannerStatus: newStatus };
      });
    });

    // Scan completed
    socket.on('scan:complete', (data: { totalFindings: number; severityBreakdown: any; duration: number; status: string }) => {
      console.log('[ScanStream] Scan completed:', data);
      setState(prev => ({
        ...prev,
        scanStatus: data.status as 'completed' | 'failed',
        totalFindings: data.totalFindings,
        severityBreakdown: data.severityBreakdown,
      }));
    });

    return () => {
      socket.emit('unsubscribe', { scanId });
      socket.disconnect();
    };
  }, [scanId]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    const cleanup = connect();

    return () => {
      cleanup?.();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [connect]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    connect();
  }, [connect]);

  return {
    ...state,
    reconnect,
  };
}

export default useScanStream;
