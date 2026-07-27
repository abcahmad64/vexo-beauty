import { Transform } from 'class-transformer';
import {
  IsBoolean,
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
  toOptionalBoolean,
  toOptionalInteger,
} from '../../../core/utils/transformer.util';

export const ADMIN_OPERATIONS_ALERT_SOURCES = [
  'operations_watchdog',
  'operations_digest',
  'operations_alert_escalation',
  'operations_queue_health',
] as const;

const adminOperationsAlertSeverities = [
  'info',
  'warning',
  'error',
  'critical',
] as const;

export type AdminOperationsAlertSource =
  (typeof ADMIN_OPERATIONS_ALERT_SOURCES)[number];

export type AdminOperationsAlertSeverity =
  (typeof adminOperationsAlertSeverities)[number];

export class AdminOperationsAlertQueryDto {
  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(10)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(ADMIN_OPERATIONS_ALERT_SOURCES)
  source?: AdminOperationsAlertSource;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(adminOperationsAlertSeverities)
  severity?: AdminOperationsAlertSeverity;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  createdTo?: string;
}
