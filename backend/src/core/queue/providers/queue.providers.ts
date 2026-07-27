import { getQueueToken } from '@nestjs/bullmq';
import type { Provider } from '@nestjs/common';

import { ALL_QUEUE_NAMES } from '../constants/queue.constants';

import { QueueRuntimeService } from '../services/queue-runtime.service';

export const QUEUE_PROVIDER_TOKENS = ALL_QUEUE_NAMES.map((queueName) =>
  getQueueToken(queueName),
);

export const QUEUE_PROVIDERS: Provider[] = ALL_QUEUE_NAMES.map(
  (queueName): Provider => ({
    provide: getQueueToken(queueName),
    inject: [QueueRuntimeService],
    useFactory: (queueRuntimeService: QueueRuntimeService) =>
      queueRuntimeService.getQueue(queueName),
  }),
);
