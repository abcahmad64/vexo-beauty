import { BadRequestException } from '@nestjs/common';

import { Processor, WorkerHost } from '@nestjs/bullmq';

import type { Job } from 'bullmq';

import {
  QUEUE_JOB_NAMES,
  QUEUE_NAMES,
} from '../../../core/queue/constants/queue.constants';

import { QueueProcessorBase } from '../../../core/queue/processors/queue-processor.base';

import { QueueDeadLetterService } from '../../../core/queue/services/queue-dead-letter.service';

import type {
  OrderQueueJobData,
  QueueJobName,
  QueueJobResult,
} from '../../../core/queue/types/queue.types';

import { OrderOrchestrationService } from '../services/order-orchestration.service';

@Processor(QUEUE_NAMES.ORDER)
export class OrderQueueProcessor extends WorkerHost {
  constructor(
    private readonly orderOrchestrationService: OrderOrchestrationService,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<OrderQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    const handler = new OrderQueueProcessorHandler(
      this.orderOrchestrationService,
      this.deadLetterService,
    );

    return handler.process(job);
  }
}

class OrderQueueProcessorHandler extends QueueProcessorBase {
  constructor(
    private readonly orderOrchestrationService: OrderOrchestrationService,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<OrderQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    this.logJobStarted(QUEUE_NAMES.ORDER, job);

    try {
      const result = await this.processOrderJob(job);

      this.logJobCompleted(QUEUE_NAMES.ORDER, job);

      return result;
    } catch (error) {
      this.logJobFailed(QUEUE_NAMES.ORDER, job, error);

      await this.deadLetterService.captureFailure(
        this.buildFailureInput(QUEUE_NAMES.ORDER, job, error),
      );

      throw error;
    }
  }

  private async processOrderJob(
    job: Job<OrderQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    if (job.name === QUEUE_JOB_NAMES.ORDER_POST_CREATED) {
      const result = await this.orderOrchestrationService.processPostCreated(
        job.data,
      );

      return this.success('Job پس از ایجاد سفارش با موفقیت پردازش شد.', {
        action: result.action,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        currentStatus: result.currentStatus,
        customerNotified: result.customerNotified,
        adminRecipients: result.adminRecipients,
      });
    }

    if (job.name === QUEUE_JOB_NAMES.ORDER_POST_PAID) {
      const result = await this.orderOrchestrationService.processPostPaid(
        job.data,
      );

      return this.success('Job پس از پرداخت سفارش با موفقیت پردازش شد.', {
        action: result.action,
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        previousStatus: result.previousStatus,
        currentStatus: result.currentStatus,
        customerNotified: result.customerNotified,
        adminRecipients: result.adminRecipients,
      });
    }

    throw new BadRequestException('نوع Job سفارش معتبر نیست.');
  }
}
