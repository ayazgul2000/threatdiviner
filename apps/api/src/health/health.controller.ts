import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { QueueService } from '../queue/services/queue.service';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
  queue?: {
    connected: boolean;
    queues: {
      scan: { connected: boolean; workers: number };
      notify: { connected: boolean; workers: number };
    };
  };
}

@Controller('health')
export class HealthController {
  constructor(
    @Optional() @Inject(QueueService) private readonly queueService?: QueueService,
  ) {}

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'threatdiviner-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('detailed')
  async detailedCheck(): Promise<HealthResponse & {
    queue?: { connected: boolean; stats?: any };
  }> {
    const base: HealthResponse = {
      status: 'ok',
      service: 'threatdiviner-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    if (this.queueService) {
      try {
        const [health, stats] = await Promise.all([
          this.queueService.getQueueHealth(),
          this.queueService.getQueueStats(),
        ]);
        return {
          ...base,
          queue: {
            ...health,
            stats,
          },
        };
      } catch (error) {
        return {
          ...base,
          queue: {
            connected: false,
            queues: {
              scan: { connected: false, workers: 0 },
              notify: { connected: false, workers: 0 },
            },
          },
        };
      }
    }

    return base;
  }
}
