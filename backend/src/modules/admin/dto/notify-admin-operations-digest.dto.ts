import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { trimOptionalString } from '../../../core/utils/transformer.util';

export type AdminOperationsDigestNotificationChannel =
  'database' | 'websocket' | 'push' | 'email';

const adminOperationsDigestNotificationChannels = [
  'database',
  'websocket',
  'push',
  'email',
] as const;

export class NotifyAdminOperationsDigestDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['compact', 'full'])
  mode?: 'compact' | 'full';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(adminOperationsDigestNotificationChannels, {
    each: true,
  })
  channels?: AdminOperationsDigestNotificationChannel[];
}
