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
  QueueJobName,
  QueueJobResult,
  SmsQueueJobData,
} from '../../../core/queue/types/queue.types';

import { SmsNotificationDelivery } from '../delivery/sms-notification.delivery';

@Processor(QUEUE_NAMES.SMS)
export class SmsQueueProcessor extends WorkerHost {
  constructor(
    private readonly smsDelivery: SmsNotificationDelivery,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<SmsQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    const handler = new SmsQueueProcessorHandler(
      this.smsDelivery,
      this.deadLetterService,
    );

    return handler.process(job);
  }
}

class SmsQueueProcessorHandler extends QueueProcessorBase {
  constructor(
    private readonly smsDelivery: SmsNotificationDelivery,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<SmsQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    this.logJobStarted(QUEUE_NAMES.SMS, job);

    try {
      if (job.name !== QUEUE_JOB_NAMES.SMS_SEND) {
        throw new BadRequestException('نوع Job پیامک معتبر نیست.');
      }

      const result = await this.smsDelivery.sendQueuedSms(job.data);

      if (!result.delivered) {
        throw new BadRequestException(
          result.error ?? 'ارسال پیامک ناموفق بود.',
        );
      }

      this.logJobCompleted(QUEUE_NAMES.SMS, job);

      return this.success('Job پیامک با موفقیت پردازش شد.', {
        to: job.data.to,
        template: job.data.template,
        provider: result.provider,
        messageId: result.messageId,
      });
    } catch (error) {
      this.logJobFailed(QUEUE_NAMES.SMS, job, error);

      await this.deadLetterService.captureFailure(
        this.buildFailureInput(QUEUE_NAMES.SMS, job, error),
      );

      throw error;
    }
  }
}
