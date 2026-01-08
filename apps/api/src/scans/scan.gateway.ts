import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

// Event types for scan streaming
export interface ScannerStartEvent {
  scanner: string;
  /** Whitelabel display name for UI */
  label?: string;
  phase: 'discovery' | 'crawling' | 'scanning' | 'scoping' | 'assessment' | 'focused' | 'single' | 'full';
}

export interface ScannerProgressEvent {
  scanner: string;
  phase?: string;
  current?: number;
  total?: number;
  percent: number;
  templateStats?: {
    loaded: number;
    completed: number;
    matched: number;
    errors: number;
  };
}

export interface ScannerLogEvent {
  scanner: string;
  line: string;
  stream: 'stdout' | 'stderr';
  timestamp: string;
}

export interface TemplateEvent {
  scanner: string;
  templateId: string;
  status: 'loaded' | 'running' | 'completed' | 'failed' | 'skipped';
  matchCount?: number;
  errorCount?: number;
  errors?: string[];
}

export interface ScanPhaseEvent {
  phase: 'initializing' | 'crawling' | 'scanning' | 'complete';
  /** Phase progress percent (0-100) */
  percent?: number;
  detectedTechnologies?: string[];
  focusedTemplateCount?: number;
}

export interface ScanUrlsEvent {
  /** List of discovered URLs */
  urls: string[];
  /** Total count of URLs */
  total: number;
  /** JS files discovered */
  jsFiles?: string[];
  /** Params discovered */
  paramsCount?: number;
}

export interface ScannerFindingEvent {
  scanner: string;
  /** Whitelabel display name for UI */
  label?: string;
  finding: {
    id: string;
    severity: string;
    title: string;
    filePath?: string;
    url?: string;
    cweIds?: string[];
    cveIds?: string[];
  };
}

export interface ScannerCompleteEvent {
  scanner: string;
  /** Whitelabel display name for UI */
  label?: string;
  findingsCount: number;
  duration: number;
  status: 'completed' | 'failed' | 'skipped';
  exitCode?: number;
  command?: string;
  error?: string;
  /** Truncated verbose output (first 10KB of stdout+stderr) */
  verboseOutput?: string;
  templateStats?: {
    totalTemplates: number;
    completedTemplates: number;
    failedTemplates: number;
    totalErrors: number;
    failedTemplateIds?: string[];
  };
}

export interface ScanCompleteEvent {
  totalFindings: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  duration: number;
  status: 'completed' | 'failed' | 'cancelled';
  /** Number of URLs discovered during crawling */
  crawledUrls?: number;
}

@WebSocketGateway({
  cors: {
    origin: process.env.DASHBOARD_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/scans',
})
@Injectable()
export class ScanGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ScanGateway.name);
  private readonly connectedClients = new Map<string, Set<string>>(); // scanId -> clientIds
  // Track which scanners are currently running for each scan
  private readonly activeScanners = new Map<string, Map<string, { status: string; findingsCount: number }>>();

  // Redis adapter clients for multi-instance scaling
  private pubClient: RedisClientType | null = null;
  private subClient: RedisClientType | null = null;

  // Finding batching to prevent UI flooding (nuclei can emit 50+/sec)
  private readonly findingBuffer: Map<string, ScannerFindingEvent[]> = new Map();
  private readonly BATCH_INTERVAL_MS = 300; // Flush every 300ms
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize Redis adapter for multi-instance WebSocket scaling
   * This allows workers on different machines to emit events that reach
   * all connected clients regardless of which API server they're connected to
   */
  async afterInit(server: Server) {
    const redisHost = this.configService.get('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get('REDIS_PORT', 6379);
    const redisUrl = `redis://${redisHost}:${redisPort}`;

    try {
      this.pubClient = createClient({ url: redisUrl }) as RedisClientType;
      this.subClient = this.pubClient.duplicate() as RedisClientType;

      await Promise.all([
        this.pubClient.connect(),
        this.subClient.connect(),
      ]);

      server.adapter(createAdapter(this.pubClient, this.subClient));
      this.logger.log(`WebSocket Redis adapter connected to ${redisUrl}`);
    } catch (error) {
      this.logger.warn(`Redis adapter setup failed (${error}), falling back to single-instance mode`);
      // Gateway still works without Redis adapter, just won't scale across instances
    }

    // Start the batch flush timer
    this.batchTimer = setInterval(() => this.flushFindingBatch(), this.BATCH_INTERVAL_MS);
    this.logger.log('Finding batch timer started');
  }

  async onModuleDestroy() {
    // Stop batch timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Flush any remaining findings
    this.flushFindingBatch();

    // Close Redis connections
    if (this.pubClient) {
      await this.pubClient.quit();
    }
    if (this.subClient) {
      await this.subClient.quit();
    }
  }

  handleConnection(client: Socket) {
    this.logger.log(`[WebSocket] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
    // Remove client from all scan rooms
    for (const [scanId, clients] of this.connectedClients) {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        if (clients.size === 0) {
          this.connectedClients.delete(scanId);
        }
      }
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { scanId: string },
  ) {
    const room = `scan:${data.scanId}`;
    client.join(room);

    // Track client subscription
    if (!this.connectedClients.has(data.scanId)) {
      this.connectedClients.set(data.scanId, new Set());
    }
    this.connectedClients.get(data.scanId)!.add(client.id);

    this.logger.log(`[WebSocket] Client ${client.id} subscribed to ${room}`);

    // Send current scanner status to newly connected client
    const scannerStatus = this.activeScanners.get(data.scanId);
    if (scannerStatus && scannerStatus.size > 0) {
      this.logger.log(`[WebSocket] Sending current status to client ${client.id}: ${scannerStatus.size} active scanners`);
      for (const [scanner, status] of scannerStatus) {
        client.emit('scanner:start', { scanner, phase: 'single' });
        if (status.status === 'running') {
          // Scanner is running
        } else if (status.status === 'completed' || status.status === 'failed') {
          client.emit('scanner:complete', {
            scanner,
            findingsCount: status.findingsCount,
            duration: 0,
            status: status.status,
          });
        }
      }
    }

    return { success: true, room };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { scanId: string },
  ) {
    const room = `scan:${data.scanId}`;
    client.leave(room);

    // Remove from tracking
    const clients = this.connectedClients.get(data.scanId);
    if (clients) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.connectedClients.delete(data.scanId);
      }
    }

    this.logger.debug(`Client ${client.id} unsubscribed from ${room}`);
    return { success: true };
  }

  // ============ Event Emitters ============

  /**
   * Emit when a scanner starts
   */
  emitScannerStart(scanId: string, event: ScannerStartEvent) {
    // Track scanner as running
    if (!this.activeScanners.has(scanId)) {
      this.activeScanners.set(scanId, new Map());
    }
    this.activeScanners.get(scanId)!.set(event.scanner, { status: 'running', findingsCount: 0 });

    const room = `scan:${scanId}`;
    this.server.to(room).emit('scanner:start', event);
    this.logger.log(`[${scanId}] Scanner ${event.scanner} started (${event.phase})`);
  }

  /**
   * Emit progress updates (file counts, etc.)
   */
  emitScannerProgress(scanId: string, event: ScannerProgressEvent) {
    const room = `scan:${scanId}`;
    this.server.to(room).emit('scanner:progress', event);
  }

  /**
   * Emit real-time log line from scanner execution
   */
  emitScannerLog(scanId: string, event: ScannerLogEvent) {
    const room = `scan:${scanId}`;
    this.server.to(room).emit('scanner:log', event);
  }

  /**
   * Emit individual finding - batched to prevent UI flooding
   * Findings are buffered and sent every BATCH_INTERVAL_MS (300ms)
   */
  emitScannerFinding(scanId: string, event: ScannerFindingEvent) {
    // Add to buffer instead of emitting immediately
    if (!this.findingBuffer.has(scanId)) {
      this.findingBuffer.set(scanId, []);
    }
    this.findingBuffer.get(scanId)!.push(event);
    this.logger.debug(`[${scanId}] Finding buffered from ${event.scanner}: ${event.finding.title}`);
  }

  /**
   * Emit individual finding immediately (bypass batching for critical findings)
   */
  emitScannerFindingImmediate(scanId: string, event: ScannerFindingEvent) {
    const room = `scan:${scanId}`;
    this.server.to(room).emit('scanner:finding', event);
    this.logger.debug(`[${scanId}] Finding (immediate) from ${event.scanner}: ${event.finding.title}`);
  }

  /**
   * Flush all buffered findings to their respective rooms
   * Called periodically by the batch timer
   */
  private flushFindingBatch() {
    for (const [scanId, findings] of this.findingBuffer) {
      if (findings.length === 0) continue;

      const room = `scan:${scanId}`;

      // Send as batch for efficiency
      if (findings.length > 1) {
        this.server.to(room).emit('scanner:findings:batch', { findings });
        this.logger.debug(`[${scanId}] Flushed ${findings.length} findings as batch`);
      } else {
        // Single finding, send normally
        this.server.to(room).emit('scanner:finding', findings[0]);
      }

      // Clear the buffer for this scan
      this.findingBuffer.set(scanId, []);
    }
  }

  /**
   * Emit when a scanner completes
   */
  emitScannerComplete(scanId: string, event: ScannerCompleteEvent) {
    // Update scanner status tracking
    const scanners = this.activeScanners.get(scanId);
    if (scanners) {
      scanners.set(event.scanner, { status: event.status, findingsCount: event.findingsCount });
    }

    const room = `scan:${scanId}`;
    this.server.to(room).emit('scanner:complete', event);
    this.logger.log(`[${scanId}] Scanner ${event.scanner} completed: ${event.findingsCount} findings`);
  }

  /**
   * Emit when entire scan completes
   */
  emitScanComplete(scanId: string, event: ScanCompleteEvent) {
    // Clean up scanner tracking for this scan
    this.activeScanners.delete(scanId);

    const room = `scan:${scanId}`;
    this.server.to(room).emit('scan:complete', event);
    this.logger.log(`[${scanId}] Scan completed: ${event.totalFindings} total findings`);
  }

  /**
   * Emit when scan phase changes (for optimized two-phase scans)
   */
  emitScanPhase(scanId: string, event: ScanPhaseEvent) {
    const room = `scan:${scanId}`;
    this.server.to(room).emit('scan:phase', event);
    this.logger.log(`[${scanId}] Scan phase: ${event.phase}${event.percent !== undefined ? ` (${event.percent}%)` : ''}${event.detectedTechnologies ? ` (${event.detectedTechnologies.length} technologies detected)` : ''}`);
  }

  /**
   * Emit discovered URLs from crawling phase
   */
  emitScanUrls(scanId: string, event: ScanUrlsEvent) {
    const room = `scan:${scanId}`;
    this.server.to(room).emit('scan:urls', event);
    this.logger.log(`[${scanId}] URLs discovered: ${event.total} (${event.jsFiles?.length || 0} JS files, ${event.paramsCount || 0} params)`);
  }

  /**
   * Emit template status event (for tracking individual template execution)
   */
  emitTemplateEvent(scanId: string, event: TemplateEvent) {
    const room = `scan:${scanId}`;
    this.server.to(room).emit('template:status', event);
    if (event.status === 'failed' && event.errors?.length) {
      this.logger.warn(`[${scanId}] Template ${event.templateId} failed: ${event.errors[0]}`);
    } else {
      this.logger.debug(`[${scanId}] Template ${event.templateId}: ${event.status}`);
    }
  }

  /**
   * Emit detected technology in real-time
   */
  emitTechnology(scanId: string, technology: string) {
    const room = `scan:${scanId}`;
    this.server.to(room).emit('scan:technology', { technology });
    this.logger.log(`[${scanId}] Technology detected: ${technology}`);
  }

  /**
   * Check if any clients are subscribed to a scan
   */
  hasSubscribers(scanId: string): boolean {
    const clients = this.connectedClients.get(scanId);
    return clients ? clients.size > 0 : false;
  }

  /**
   * Get count of subscribers for a scan
   */
  getSubscriberCount(scanId: string): number {
    const clients = this.connectedClients.get(scanId);
    return clients ? clients.size : 0;
  }
}
