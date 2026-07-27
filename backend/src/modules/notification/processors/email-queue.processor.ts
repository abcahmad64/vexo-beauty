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
  EmailQueueJobData,
  QueueJobName,
  QueueJobResult,
} from '../../../core/queue/types/queue.types';

import { EmailNotificationDelivery } from '../delivery/email-notification.delivery';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailQueueProcessor extends WorkerHost {
  constructor(
    private readonly emailDelivery: EmailNotificationDelivery,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<EmailQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    const handler = new EmailQueueProcessorHandler(
      this.emailDelivery,
      this.deadLetterService,
    );

    return handler.process(job);
  }
}

class EmailQueueProcessorHandler extends QueueProcessorBase {
  constructor(
    private readonly emailDelivery: EmailNotificationDelivery,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<EmailQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    this.logJobStarted(QUEUE_NAMES.EMAIL, job);

    try {
      if (job.name !== QUEUE_JOB_NAMES.EMAIL_SEND) {
        throw new BadRequestException('نوع Job ایمیل معتبر نیست.');
      }

      const result = await this.emailDelivery.sendQueuedEmail(job.data);

      if (!result.delivered) {
        throw new BadRequestException(
          result.error ?? 'ارسال ایمیل ناموفق بود.',
        );
      }

      this.logJobCompleted(QUEUE_NAMES.EMAIL, job);

      return this.success('Job ایمیل با موفقیت پردازش شد.', {
        to: job.data.to,
        template: job.data.template,
        provider: result.provider,
        messageId: result.messageId,
      });
    } catch (error) {
      this.logJobFailed(QUEUE_NAMES.EMAIL, job, error);

      await this.deadLetterService.captureFailure(
        this.buildFailureInput(QUEUE_NAMES.EMAIL, job, error),
      );

      throw error;
    }
  }
}
