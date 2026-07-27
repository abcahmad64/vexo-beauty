import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

import { toOptionalInteger } from '../../../core/utils/transformer.util';

import { AdminOperationsDigestNotificationChannel } from './notify-admin-operations-digest.dto';

const adminOperationsDigestNotificationChannels = [
  'database',
  'websocket',
  'push',
  'email',
] as const;

const adminOperationsAlertEscalationSeverities = [
  'warning',
  'error',
  'critical',
] as const;

export class RunAdminOperationsAlertEscalationDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(adminOperationsDigestNotificationChannels, {
    each: true,
  })
  channels?: AdminOperationsDigestNotificationChannel[];

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(5)
  @Max(1440)
  minAgeMinutes?: number;

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  maxAlerts?: number;

  @IsOptional()
  @IsIn(adminOperationsAlertEscalationSeverities)
  minSeverity?: (typeof adminOperationsAlertEscalationSeverities)[number];
}
