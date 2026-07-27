import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

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

export class CreateNotificationDto {
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
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  sendNow?: boolean;
}
