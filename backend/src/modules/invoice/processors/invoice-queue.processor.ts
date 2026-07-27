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
  InvoiceQueueJobData,
  QueueJobName,
  QueueJobResult,
} from '../../../core/queue/types/queue.types';

import { InvoicePdfService } from '../services/invoice-pdf.service';

@Processor(QUEUE_NAMES.INVOICE)
export class InvoiceQueueProcessor extends WorkerHost {
  constructor(
    private readonly invoicePdfService: InvoicePdfService,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<InvoiceQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    const handler = new InvoiceQueueProcessorHandler(
      this.invoicePdfService,
      this.deadLetterService,
    );

    return handler.process(job);
  }
}

class InvoiceQueueProcessorHandler extends QueueProcessorBase {
  constructor(
    private readonly invoicePdfService: InvoicePdfService,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<InvoiceQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    this.logJobStarted(QUEUE_NAMES.INVOICE, job);

    try {
      if (job.name !== QUEUE_JOB_NAMES.INVOICE_GENERATE) {
        throw new BadRequestException('نوع Job فاکتور معتبر نیست.');
      }

      const result = await this.invoicePdfService.generateForQueue(job.data);

      this.logJobCompleted(QUEUE_NAMES.INVOICE, job);

      return this.success('Job تولید PDF فاکتور با موفقیت پردازش شد.', {
        action: result.action,
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        orderId: result.orderId,
        paymentId: result.paymentId,
        pdfUrl: result.pdfUrl,
        filePath: result.filePath,
      });
    } catch (error) {
      this.logJobFailed(QUEUE_NAMES.INVOICE, job, error);

      await this.deadLetterService.captureFailure(
        this.buildFailureInput(QUEUE_NAMES.INVOICE, job, error),
      );

      throw error;
    }
  }
}
