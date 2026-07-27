import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import {
  trimOptionalString,
  toOptionalInteger,
} from '../../../core/utils/transformer.util';

const adminTimelineSources = [
  'order',
  'payment',
  'refund',
  'invoice',
  'notification',
  'audit',
] as const;

const adminTimelineSeverities = [
  'info',
  'success',
  'warning',
  'error',
  'critical',
] as const;

export class AdminTimelineQueryDto {
  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(10)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(adminTimelineSources)
  source?: (typeof adminTimelineSources)[number];

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(adminTimelineSeverities)
  severity?: (typeof adminTimelineSeverities)[number];

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(adminTimelineSources)
  entityType?: (typeof adminTimelineSources)[number];

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  createdTo?: string;
}
