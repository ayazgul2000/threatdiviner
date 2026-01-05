import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

// Event types for scan streaming
export interface ScannerStartEvent {
  scanner: string;
  phase: 'discovery' | 'deep' | 'single';
}

export interface ScannerProgressEvent {
  scanner: string;
  filesScanned?: number;
  totalFiles?: number;
  endpointsScanned?: number;
  totalEndpoints?: number;
}

export interface ScannerFindingEvent {
  scanner: string;
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
  findingsCount: number;
  duration: number;
  status: 'completed' | 'failed';
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
  status: 'completed' | 'failed';
}

@WebSocketGateway({
  cors: {
    origin: process.env.DASHBOARD_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/scans',
})
export class ScanGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ScanGateway.name);
  private readonly connectedClients = new Map<string, Set<string>>(); // scanId -> clientIds

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
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
  handleSubscribe(
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

    this.logger.debug(`Client ${client.id} subscribed to ${room}`);
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
    const room = `scan:${scanId}`;
    this.server.to(room).emit('scanner:start', event);
    this.logger.debug(`[${scanId}] Scanner ${event.scanner} started (${event.phase})`);
  }

  /**
   * Emit progress updates (file counts, etc.)
   */
  emitScannerProgress(scanId: string, event: ScannerProgressEvent) {
    const room = `scan:${scanId}`;
    this.server.to(room).emit('scanner:progress', event);
  }

  /**
   * Emit individual finding as it's discovered (streaming)
   */
  emitScannerFinding(scanId: string, event: ScannerFindingEvent) {
    const room = `scan:${scanId}`;
    this.server.to(room).emit('scanner:finding', event);
    this.logger.debug(`[${scanId}] Finding from ${event.scanner}: ${event.finding.title}`);
  }

  /**
   * Emit when a scanner completes
   */
  emitScannerComplete(scanId: string, event: ScannerCompleteEvent) {
    const room = `scan:${scanId}`;
    this.server.to(room).emit('scanner:complete', event);
    this.logger.debug(`[${scanId}] Scanner ${event.scanner} completed: ${event.findingsCount} findings`);
  }

  /**
   * Emit when entire scan completes
   */
  emitScanComplete(scanId: string, event: ScanCompleteEvent) {
    const room = `scan:${scanId}`;
    this.server.to(room).emit('scan:complete', event);
    this.logger.log(`[${scanId}] Scan completed: ${event.totalFindings} total findings`);
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
