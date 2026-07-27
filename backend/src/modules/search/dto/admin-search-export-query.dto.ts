import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

import { Transform } from 'class-transformer';

const trimOptionalString = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

const toOptionalBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true' || normalized === '1') {
      return true;
    }

    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  return value;
};

export type AdminSearchExportEntity =
  'logs' | 'synonyms' | 'redirects' | 'boost-rules' | 'index-snapshots';

export type AdminSearchExportFormat = 'csv' | 'json';

export class AdminSearchExportQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['logs', 'synonyms', 'redirects', 'boost-rules', 'index-snapshots'])
  entity?: AdminSearchExportEntity;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  language?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['csv', 'json'])
  format?: AdminSearchExportFormat;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;
}
