import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  QUEUE_PROVIDERS,
  QUEUE_PROVIDER_TOKENS,
} from './providers/queue.providers';
import { DeadLetterProcessor } from './processors/dead-letter.processor';
import { QueueConfigService } from './services/queue-config.service';
import { QueueDeadLetterService } from './services/queue-dead-letter.service';
import { QueueMonitorService } from './services/queue-monitor.service';
import { QueueProducerService } from './services/queue-producer.service';
import { QueueRuntimeService } from './services/queue-runtime.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      extraOptions: {
        manualRegistration: true,
      },
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const queueConfigService = new QueueConfigService(configService);

        return {
          connection: queueConfigService.createBullConnectionOptions(),
          prefix: queueConfigService.getConfig().prefix,
          defaultJobOptions: queueConfigService.createDefaultJobOptions(),
        };
      },
    }),
    BullModule.registerQueue(),
  ],
  providers: [
    QueueConfigService,
    QueueRuntimeService,
    ...QUEUE_PROVIDERS,
    QueueProducerService,
    QueueDeadLetterService,
    QueueMonitorService,
    DeadLetterProcessor,
  ],
  exports: [
    BullModule,
    ...QUEUE_PROVIDER_TOKENS,
    QueueConfigService,
    QueueProducerService,
    QueueDeadLetterService,
    QueueMonitorService,
  ],
})
export class CoreQueueModule {}
