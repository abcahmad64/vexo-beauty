import { ArrayMaxSize, IsArray, IsIn, IsOptional } from 'class-validator';

import { AdminOperationsDigestNotificationChannel } from './notify-admin-operations-digest.dto';

export class RunAdminOperationsWatchdogDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(['database', 'websocket', 'push', 'email'], {
    each: true,
  })
  channels?: AdminOperationsDigestNotificationChannel[];
}
