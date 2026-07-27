import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

const notificationChannels = [
  'database',
  'email',
  'sms',
  'push',
  'websocket',
] as const;

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
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

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  return value;
};

const normalizeChannels = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return ['database'];
  }

  if (Array.isArray(value)) {
    return value.map((channel: unknown) => channel);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((channel) => channel.trim())
      .filter(Boolean);
  }

  return value;
};

export class SendNotificationDto {
  @IsString()
  @Transform(trimString)
  @MaxLength(128)
  userId!: string;

  @IsString()
  @Transform(trimString)
  @MaxLength(180)
  title!: string;

  @IsString()
  @Transform(trimString)
  @MaxLength(3000)
  message!: string;

  @IsString()
  @Transform(trimString)
  @MaxLength(80)
  type!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  actionUrl?: string;

  @IsOptional()
  @Transform(normalizeChannels)
  @IsArray()
  @IsIn(notificationChannels, {
    each: true,
  })
  channels?: Array<(typeof notificationChannels)[number]>;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  saveToDatabase?: boolean;
}
