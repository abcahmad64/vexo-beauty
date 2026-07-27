import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminSupportChatStatus } from './admin-query-support-chat.dto';

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export class AdminUpdateSupportChatStatusDto {
  @IsString()
  @Transform(trimRequiredString)
  @IsIn(['OPEN', 'WAITING', 'ASSIGNED', 'CLOSED', 'ARCHIVED'])
  status!: AdminSupportChatStatus;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}
