import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
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

const toOptionalNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : value;
};

const normalizeChannels = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
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

export class AdminNotificationAiSmsDraftDto {
  @IsString()
  @Transform(trimString)
  @MaxLength(220)
  campaignGoal!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  audience?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  userId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(40)
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  productName?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(80)
  couponCode?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  actionUrl?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  extraInstruction?: string;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  @Min(60)
  @Max(500)
  maxLength?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AdminNotificationAiSmsSendDto extends AdminNotificationAiSmsDraftDto {
  @IsString()
  @Transform(trimString)
  @MaxLength(128)
  declare userId: string;

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

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  approved?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  approvalReason?: string;
}
