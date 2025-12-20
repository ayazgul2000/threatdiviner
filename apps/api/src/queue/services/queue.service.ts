import { Injectable, Logger, Inject } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES, SCAN_JOB_OPTIONS, NOTIFY_JOB_OPTIONS } from '../queue.constants';
import { ScanJobData, NotifyJobData, CleanupJobData } from '../jobs';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject(`BullQueue_${QUEUE_NAMES.SCAN}`) private readonly scanQueue: Queue,
    @Inject(`BullQueue_${QUEUE_NAMES.NOTIFY}`) private readonly notifyQueue: Queue,
    @Inject(`BullQueue_${QUEUE_NAMES.CLEANUP}`) private readonly cleanupQueue: Queue,
  ) {}

  async enqueueScan(data: ScanJobData): Promise<Job<ScanJobData>> {
    this.logger.log(`Enqueueing scan job for ${data.fullName}@${data.branch}`);

    const job = await this.scanQueue.add(
      JOB_NAMES.PROCESS_SCAN,
      data,
      {
        ...SCAN_JOB_OPTIONS,
        jobId: `scan-${data.scanId}`,
      },
    );

    this.logger.log(`Scan job ${job.id} created for scan ${data.scanId}`);
    return job;
  }

  async enqueueNotification(data: NotifyJobData): Promise<Job<NotifyJobData>> {
    this.logger.log(`Enqueueing notification for scan ${data.scanId}`);

    const job = await this.notifyQueue.add(
      JOB_NAMES.NOTIFY_GITHUB,
      data,
      {
        ...NOTIFY_JOB_OPTIONS,
        jobId: `notify-${data.scanId}`,
      },
    );

    return job;
  }

  async enqueueCleanup(data: CleanupJobData): Promise<Job<CleanupJobData>> {
    const job = await this.cleanupQueue.add(
      JOB_NAMES.CLEANUP_WORKDIR,
      data,
      {
        delay: 60000, // Wait 1 minute before cleanup
        jobId: `cleanup-${data.scanId}`,
      },
    );

    return job;
  }

  async getScanJob(scanId: string): Promise<Job<ScanJobData> | null> {
    const job = await this.scanQueue.getJob(`scan-${scanId}`);
    return job || null;
  }

  async getScanJobState(scanId: string): Promise<string | null> {
    const job = await this.getScanJob(scanId);
    if (!job) return null;
    return job.getState();
  }

  async cancelScan(scanId: string): Promise<boolean> {
    const job = await this.getScanJob(scanId);
    if (!job) return false;

    const state = await job.getState();
    if (state === 'active') {
      // Can't cancel active jobs directly, need to signal the processor
      await job.moveToFailed(new Error('Cancelled by user'), 'cancelled');
      return true;
    } else if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      return true;
    }

    return false;
  }

  async getQueueStats() {
    const [
      scanWaiting,
      scanActive,
      scanCompleted,
      scanFailed,
    ] = await Promise.all([
      this.scanQueue.getWaitingCount(),
      this.scanQueue.getActiveCount(),
      this.scanQueue.getCompletedCount(),
      this.scanQueue.getFailedCount(),
    ]);

    return {
      scan: {
        waiting: scanWaiting,
        active: scanActive,
        completed: scanCompleted,
        failed: scanFailed,
      },
    };
  }
}
