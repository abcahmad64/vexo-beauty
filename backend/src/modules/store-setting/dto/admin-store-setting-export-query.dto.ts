import { IsIn, IsOptional, IsString } from 'class-validator';

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

export type AdminStoreSettingExportFormat = 'csv' | 'json';

export class AdminStoreSettingExportQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

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
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['csv', 'json'])
  format?: AdminStoreSettingExportFormat;
}
