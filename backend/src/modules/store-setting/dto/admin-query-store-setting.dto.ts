import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

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

const toOptionalInt = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return Math.trunc(parsed);
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

export type AdminStoreSettingGroup =
  | 'GENERAL'
  | 'BUSINESS'
  | 'SEO'
  | 'PAYMENT'
  | 'SHIPPING'
  | 'NOTIFICATION'
  | 'SECURITY'
  | 'INTEGRATION'
  | 'THEME'
  | 'LEGAL'
  | 'AI'
  | 'ANALYTICS';

export type AdminStoreSettingType =
  'STRING' | 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'ARRAY' | 'URL' | 'EMAIL';

export type AdminStoreSettingSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'key'
  | 'group'
  | 'type'
  | 'label'
  | 'isPublic'
  | 'isReadonly'
  | 'isActive';

export type AdminStoreSettingSortDirection = 'asc' | 'desc';

export class AdminQueryStoreSettingDto {
  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  settingId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  key?: string;

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
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isReadonly?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsDateString()
  updatedFrom?: string;

  @IsOptional()
  @IsDateString()
  updatedTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'createdAt',
    'updatedAt',
    'key',
    'group',
    'type',
    'label',
    'isPublic',
    'isReadonly',
    'isActive',
  ])
  sortBy?: AdminStoreSettingSortBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['asc', 'desc'])
  sortDirection?: AdminStoreSettingSortDirection;
}
