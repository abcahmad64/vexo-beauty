import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Transform } from 'class-transformer';

import {
  AdminStoreSettingGroup,
  AdminStoreSettingType,
} from './admin-query-store-setting.dto';

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

export class AdminUpdateStoreSettingDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  key?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(250)
  label?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'GENERAL',
    'BUSINESS',
    'SEO',
    'PAYMENT',
    'SHIPPING',
    'NOTIFICATION',
    'SECURITY',
    'INTEGRATION',
    'THEME',
    'LEGAL',
    'AI',
    'ANALYTICS',
  ])
  group?: AdminStoreSettingGroup;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'STRING',
    'TEXT',
    'NUMBER',
    'BOOLEAN',
    'JSON',
    'ARRAY',
    'URL',
    'EMAIL',
  ])
  type?: AdminStoreSettingType;

  @IsOptional()
  value?: unknown;

  @IsOptional()
  defaultValue?: unknown;

  @IsOptional()
  @IsObject()
  validation?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isReadonly?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  reason?: string;
}
