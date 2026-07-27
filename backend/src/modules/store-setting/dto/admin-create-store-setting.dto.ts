import {
  IsBoolean,
  IsDefined,
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

export class AdminCreateStoreSettingDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(180)
  key!: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(250)
  label!: string;

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

  @IsString()
  @Transform(trimRequiredString)
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
  type!: AdminStoreSettingType;

  @IsDefined()
  value!: unknown;

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
}
