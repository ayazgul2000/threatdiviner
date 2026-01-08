import {
  Controller,
  Get,
  Param,
  Sse,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Observable, Subject, interval, takeUntil } from 'rxjs';
import { filter } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

interface SseMessage {
  data: string;
}

interface ScanEvent {
  type: 'scanner:start' | 'scanner:progress' | 'scanner:finding' | 'scanner:complete' | 'scan:complete';
  scanId: string;
  payload: any;
}

// Global event bus for SSE streaming
export const scanEventBus = new Subject<ScanEvent>();

@Controller('scans')
export class ScansController {
  private readonly logger = new Logger(ScansController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * SSE endpoint for scan streaming (CLI integration)
   * GET /scans/:id/stream
   */
  @Get(':id/stream')
  @Sse()
  streamScan(@Param('id') scanId: string): Observable<SseMessage> {
    this.logger.log(`SSE stream opened for scan ${scanId}`);

    const stopPolling = new Subject<void>();

    // Return observable that streams scan events
    return new Observable<SseMessage>((subscriber) => {
      // Subscribe to the event bus, filtering for this scan
      const eventSubscription = scanEventBus
        .pipe(filter((event) => event.scanId === scanId))
        .subscribe({
          next: (event) => {
            subscriber.next({
              data: JSON.stringify({
                type: event.type,
                ...event.payload,
                timestamp: new Date().toISOString(),
              }),
            });

            // Complete the stream when scan is done
            if (event.type === 'scan:complete') {
              setTimeout(() => {
                stopPolling.next();
                stopPolling.complete();
                subscriber.complete();
              }, 1000);
            }
          },
          error: (err) => subscriber.error(err),
        });

      // Also poll for status changes every 2 seconds
      const pollSubscription = interval(2000)
        .pipe(takeUntil(stopPolling))
        .subscribe(async () => {
          try {
            const scan = await this.prisma.scan.findUnique({
              where: { id: scanId },
              select: {
                status: true,
                _count: { select: { findings: true } },
              },
            });

            if (!scan) {
              subscriber.next({
                data: JSON.stringify({
                  type: 'error',
                  message: 'Scan not found',
                }),
              });
              subscriber.complete();
              return;
            }

            // Send heartbeat with current status
            subscriber.next({
              data: JSON.stringify({
                type: 'heartbeat',
                status: scan.status,
                findingsCount: scan._count.findings,
                timestamp: new Date().toISOString(),
              }),
            });

            // Stop polling if scan is done
            if (['completed', 'failed', 'cancelled'].includes(scan.status)) {
              stopPolling.next();
              stopPolling.complete();
              subscriber.complete();
            }
          } catch (err) {
            this.logger.error(`Error polling scan ${scanId}: ${err}`);
          }
        });

      // Cleanup on unsubscribe
      return () => {
        this.logger.log(`SSE stream closed for scan ${scanId}`);
        stopPolling.next();
        stopPolling.complete();
        eventSubscription.unsubscribe();
        pollSubscription.unsubscribe();
      };
    });
  }

  /**
   * Get current scan status (REST endpoint)
   * GET /scans/:id/status
   */
  @Get(':id/status')
  async getScanStatus(@Param('id') scanId: string) {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        scannerResults: true,
        _count: { select: { findings: true } },
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    return {
      id: scan.id,
      status: scan.status,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      duration: scan.duration,
      findingsCount: scan._count.findings,
      scannerResults: scan.scannerResults.map((r) => ({
        scanner: r.scanner,
        status: r.status,
        findingsCount: r.findingsCount,
        duration: r.duration,
      })),
    };
  }
}

// Helper function to emit events to SSE clients
export function emitScanEvent(event: ScanEvent) {
  scanEventBus.next(event);
}
