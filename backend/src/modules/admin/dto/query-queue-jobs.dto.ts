import { Transform } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

import { toOptionalInteger } from '../../../core/utils/transformer.util';

export const QUEUE_JOB_STATUS_FILTERS = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
  'prioritized',
  'waiting-children',
  'all',
] as const;

export type QueueJobStatusFilterDto = (typeof QUEUE_JOB_STATUS_FILTERS)[number];

export class QueryQueueJobsDto {
  @IsOptional()
  @IsIn(QUEUE_JOB_STATUS_FILTERS, {
    message: 'وضعیت Job معتبر نیست.',
  })
  status?: QueueJobStatusFilterDto;

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt({
    message: 'شروع محدوده باید عدد صحیح باشد.',
  })
  @Min(0, {
    message: 'شروع محدوده نمی‌تواند منفی باشد.',
  })
  start?: number;

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt({
    message: 'پایان محدوده باید عدد صحیح باشد.',
  })
  @Min(0, {
    message: 'پایان محدوده نمی‌تواند منفی باشد.',
  })
  @Max(1000, {
    message: 'حداکثر پایان محدوده ۱۰۰۰ است.',
  })
  end?: number;

  @IsOptional()
  @IsBooleanString({
    message: 'مرتب‌سازی صعودی باید مقدار boolean معتبر باشد.',
  })
  asc?: string;
}
