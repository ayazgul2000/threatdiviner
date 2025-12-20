import { Module, DynamicModule, Global, Provider, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';

export const BULL_QUEUES = Symbol('BULL_QUEUES');
export const BULL_CONNECTION = Symbol('BULL_CONNECTION');

interface BullConnection {
  host: string;
  port: number;
}

interface QueueInstance {
  queue: Queue;
  name: string;
}

@Global()
@Module({})
export class CustomBullModule implements OnModuleDestroy {
  private static queues: QueueInstance[] = [];

  static forRoot(): DynamicModule {
    const connectionProvider: Provider = {
      provide: BULL_CONNECTION,
      useFactory: (configService: ConfigService): BullConnection => ({
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
      }),
      inject: [ConfigService],
    };

    const queueNames = Object.values(QUEUE_NAMES);
    const queueProviders: Provider[] = queueNames.map((name) => ({
      provide: `BullQueue_${name}`,
      useFactory: (connection: BullConnection) => {
        const queue = new Queue(name, { connection });
        CustomBullModule.queues.push({ queue, name });
        return queue;
      },
      inject: [BULL_CONNECTION],
    }));

    const allQueuesProvider: Provider = {
      provide: BULL_QUEUES,
      useFactory: (...queues: Queue[]) => queues,
      inject: queueNames.map((name) => `BullQueue_${name}`),
    };

    return {
      module: CustomBullModule,
      providers: [connectionProvider, ...queueProviders, allQueuesProvider],
      exports: [BULL_CONNECTION, BULL_QUEUES, ...queueNames.map((name) => `BullQueue_${name}`)],
    };
  }

  async onModuleDestroy() {
    for (const { queue, name } of CustomBullModule.queues) {
      try {
        await queue.close();
      } catch (error) {
        console.error(`Error closing queue ${name}:`, error);
      }
    }
  }
}
