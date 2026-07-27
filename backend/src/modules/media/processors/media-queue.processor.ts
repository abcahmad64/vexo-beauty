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
  MediaCleanupQueueJobData,
  QueueJobName,
  QueueJobResult,
} from '../../../core/queue/types/queue.types';

import { MediaStorageService } from '../services/media-storage.service';

@Processor(QUEUE_NAMES.MEDIA)
export class MediaQueueProcessor extends WorkerHost {
  constructor(
    private readonly mediaStorageService: MediaStorageService,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<MediaCleanupQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    const handler = new MediaQueueProcessorHandler(
      this.mediaStorageService,
      this.deadLetterService,
    );

    return handler.process(job);
  }
}

class MediaQueueProcessorHandler extends QueueProcessorBase {
  constructor(
    private readonly mediaStorageService: MediaStorageService,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<MediaCleanupQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    this.logJobStarted(QUEUE_NAMES.MEDIA, job);

    try {
      if (job.name !== QUEUE_JOB_NAMES.MEDIA_CLEANUP_TEMPORARY) {
        throw new BadRequestException('نوع Job رسانه معتبر نیست.');
      }

      const cleanupResult =
        await this.mediaStorageService.cleanupTemporaryFiles({
          olderThanMinutes: job.data.olderThanMinutes,
          dryRun: job.data.dryRun,
        });

      this.logJobCompleted(QUEUE_NAMES.MEDIA, job);

      return this.success(
        'Job پاک‌سازی فایل‌های موقت رسانه با موفقیت پردازش شد.',
        {
          driver: cleanupResult.driver,
          dryRun: cleanupResult.dryRun,
          olderThanMinutes: cleanupResult.olderThanMinutes,
          scannedFiles: cleanupResult.scannedFiles,
          deletedFiles: cleanupResult.deletedFiles,
          skippedFiles: cleanupResult.skippedFiles,
          candidateFolders: cleanupResult.candidateFolders,
          deletedKeys: cleanupResult.deletedKeys,
          skippedReason: cleanupResult.skippedReason,
        },
      );
    } catch (error) {
      this.logJobFailed(QUEUE_NAMES.MEDIA, job, error);

      await this.deadLetterService.captureFailure(
        this.buildFailureInput(QUEUE_NAMES.MEDIA, job, error),
      );

      throw error;
    }
  }
}
