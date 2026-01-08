import { Module, DynamicModule, Global, Provider, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { QUEUE_NAMES, REDIS_PUBSUB } from './queue.constants';

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
  private static redisPublisher: RedisClientType | null = null;

  static forRoot(): DynamicModule {
    const connectionProvider: Provider = {
      provide: BULL_CONNECTION,
      useFactory: (configService: ConfigService): BullConnection => ({
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
      }),
      inject: [ConfigService],
    };

    // Redis publisher for Pub/Sub (used for scan cancellation signals)
    const redisPublisherProvider: Provider = {
      provide: REDIS_PUBSUB.SCAN_CANCELLATION,
      useFactory: async (configService: ConfigService): Promise<RedisClientType> => {
        const host = configService.get('REDIS_HOST', 'localhost');
        const port = configService.get('REDIS_PORT', 6379);
        const client = createClient({ url: `redis://${host}:${port}` }) as RedisClientType;
        await client.connect();
        CustomBullModule.redisPublisher = client;
        console.log('[CustomBullModule] Redis publisher connected for cancellation signals');
        return client;
      },
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
      providers: [connectionProvider, redisPublisherProvider, ...queueProviders, allQueuesProvider],
      exports: [BULL_CONNECTION, REDIS_PUBSUB.SCAN_CANCELLATION, BULL_QUEUES, ...queueNames.map((name) => `BullQueue_${name}`)],
    };
  }

  async onModuleDestroy() {
    // Close Redis publisher
    if (CustomBullModule.redisPublisher) {
      try {
        await CustomBullModule.redisPublisher.quit();
      } catch (error) {
        console.error('Error closing Redis publisher:', error);
      }
    }

    // Close queues
    for (const { queue, name } of CustomBullModule.queues) {
      try {
        await queue.close();
      } catch (error) {
        console.error(`Error closing queue ${name}:`, error);
      }
    }
  }
}
