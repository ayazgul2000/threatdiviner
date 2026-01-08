import { Injectable, Logger, Inject } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { RedisClientType } from 'redis';
import { QUEUE_NAMES, JOB_NAMES, SCAN_JOB_OPTIONS, NOTIFY_JOB_OPTIONS, TARGET_SCAN_JOB_OPTIONS, REDIS_PUBSUB } from '../queue.constants';
import { ScanJobData, NotifyJobData, CleanupJobData, TargetScanJobData } from '../jobs';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject(`BullQueue_${QUEUE_NAMES.SCAN}`) private readonly scanQueue: Queue,
    @Inject(`BullQueue_${QUEUE_NAMES.TARGET_SCAN}`) private readonly targetScanQueue: Queue,
    @Inject(`BullQueue_${QUEUE_NAMES.NOTIFY}`) private readonly notifyQueue: Queue,
    @Inject(`BullQueue_${QUEUE_NAMES.CLEANUP}`) private readonly cleanupQueue: Queue,
    @Inject(REDIS_PUBSUB.SCAN_CANCELLATION) private readonly redisPublisher: RedisClientType,
  ) {}

  async enqueueScan(data: ScanJobData): Promise<Job<ScanJobData>> {
    this.logger.log(`Enqueueing scan job for ${data.fullName}@${data.branch}`);
    this.logger.debug(`Scan config: enableSast=${data.config.enableSast}, enableSca=${data.config.enableSca}, enableSecrets=${data.config.enableSecrets}`);

    try {
      const job = await this.scanQueue.add(
        JOB_NAMES.PROCESS_SCAN,
        data,
        {
          ...SCAN_JOB_OPTIONS,
          jobId: `scan-${data.scanId}`,
        },
      );

      this.logger.log(`Scan job ${job.id} created for scan ${data.scanId}`);

      // Log queue stats for debugging
      const [waiting, active] = await Promise.all([
        this.scanQueue.getWaitingCount(),
        this.scanQueue.getActiveCount(),
      ]);
      this.logger.log(`Queue stats: ${waiting} waiting, ${active} active`);

      return job;
    } catch (error) {
      this.logger.error(`Failed to enqueue scan job: ${error}`);
      throw error;
    }
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

  async enqueueTargetScan(data: TargetScanJobData): Promise<Job<TargetScanJobData>> {
    this.logger.log(`Enqueueing target scan for ${data.targetName} (${data.targetUrl})`);

    try {
      const job = await this.targetScanQueue.add(
        JOB_NAMES.PROCESS_TARGET_SCAN,
        data,
        {
          ...TARGET_SCAN_JOB_OPTIONS,
          jobId: `target-scan-${data.scanId}`,
        },
      );

      this.logger.log(`Target scan job ${job.id} created for scan ${data.scanId}`);

      // Log queue stats for debugging
      const [waiting, active] = await Promise.all([
        this.targetScanQueue.getWaitingCount(),
        this.targetScanQueue.getActiveCount(),
      ]);
      this.logger.log(`Target scan queue stats: ${waiting} waiting, ${active} active`);

      return job;
    } catch (error) {
      this.logger.error(`Failed to enqueue target scan job: ${error}`);
      throw error;
    }
  }

  async getTargetScanJob(scanId: string): Promise<Job<TargetScanJobData> | null> {
    const job = await this.targetScanQueue.getJob(`target-scan-${scanId}`);
    return job || null;
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
      // Signal via Redis Pub/Sub for immediate cancellation
      try {
        await this.redisPublisher.publish(REDIS_PUBSUB.SCAN_CANCELLATION, scanId);
        this.logger.log(`Published cancellation signal for scan ${scanId}`);
      } catch (error) {
        this.logger.error(`Failed to publish cancellation signal: ${error}`);
      }

      // Can't cancel active jobs directly, need to signal the processor
      await job.moveToFailed(new Error('Cancelled by user'), 'cancelled');
      return true;
    } else if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      return true;
    }

    return false;
  }

  async cancelTargetScan(scanId: string): Promise<boolean> {
    const job = await this.getTargetScanJob(scanId);
    if (!job) {
      this.logger.warn(`Target scan job not found for scan ${scanId}`);
      return false;
    }

    const state = await job.getState();
    this.logger.log(`Cancelling target scan job ${job.id}, current state: ${state}`);

    try {
      if (state === 'active') {
        // Signal via Redis Pub/Sub for immediate cancellation
        try {
          await this.redisPublisher.publish(REDIS_PUBSUB.SCAN_CANCELLATION, scanId);
          this.logger.log(`Published cancellation signal for target scan ${scanId}`);
        } catch (error) {
          this.logger.error(`Failed to publish cancellation signal: ${error}`);
        }

        // For active jobs, we can't moveToFailed without the lock
        // The process kill in pentest.service handles stopping the actual scanner
        // Just log that we attempted - the DB status update handles the rest
        this.logger.log(`Job ${job.id} is active - signal sent`);
        return true;
      } else if (state === 'waiting' || state === 'delayed') {
        await job.remove();
        this.logger.log(`Target scan job ${job.id} removed from queue`);
        return true;
      } else if (state === 'completed' || state === 'failed') {
        this.logger.log(`Job ${job.id} already in terminal state: ${state}`);
        return true;
      }
    } catch (error) {
      this.logger.error(`Error cancelling job ${job.id}: ${error}`);
      // Don't throw - the DB status update will still happen
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

  async getQueueHealth(): Promise<{
    connected: boolean;
    queues: {
      scan: { connected: boolean; workers: number };
      notify: { connected: boolean; workers: number };
    };
  }> {
    try {
      // Check if queues are connected by getting their state
      const [scanWorkers, notifyWorkers] = await Promise.all([
        this.scanQueue.getWorkers(),
        this.notifyQueue.getWorkers(),
      ]);

      return {
        connected: true,
        queues: {
          scan: {
            connected: true,
            workers: scanWorkers.length,
          },
          notify: {
            connected: true,
            workers: notifyWorkers.length,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Queue health check failed: ${error}`);
      return {
        connected: false,
        queues: {
          scan: { connected: false, workers: 0 },
          notify: { connected: false, workers: 0 },
        },
      };
    }
  }

  async getWaitingJobs(): Promise<Job<ScanJobData>[]> {
    return this.scanQueue.getWaiting();
  }

  async getActiveJobs(): Promise<Job<ScanJobData>[]> {
    return this.scanQueue.getActive();
  }

  async retryFailedJobs(): Promise<number> {
    const failedJobs = await this.scanQueue.getFailed();
    let retried = 0;
    for (const job of failedJobs) {
      try {
        await job.retry();
        retried++;
      } catch (error) {
        this.logger.warn(`Failed to retry job ${job.id}: ${error}`);
      }
    }
    return retried;
  }
}
