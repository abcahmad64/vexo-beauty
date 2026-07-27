import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  ADMIN_OPERATIONS_ALERT_SOURCES,
  AdminOperationsAlertSource,
} from './admin-operations-alert-query.dto';

export class AcknowledgeAdminOperationsAlertsDto {
  @IsOptional()
  @IsString()
  @IsIn(ADMIN_OPERATIONS_ALERT_SOURCES)
  source?: AdminOperationsAlertSource;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({
    each: true,
  })
  notificationIds?: string[];

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
