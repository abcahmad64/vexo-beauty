import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

import {
  ADMIN_OPERATIONS_ALERT_SOURCES,
  AdminOperationsAlertSource,
} from './admin-operations-alert-query.dto';

export class AdminOperationsAlertAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(ADMIN_OPERATIONS_ALERT_SOURCES)
  source?: AdminOperationsAlertSource;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
