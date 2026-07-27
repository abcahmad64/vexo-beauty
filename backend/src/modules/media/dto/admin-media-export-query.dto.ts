import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminMediaEntityType } from './admin-query-media.dto';

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

export type AdminMediaExportFormat = 'csv' | 'json';

export class AdminMediaExportQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  entityId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'PRODUCT_IMAGE',
    'BRAND_LOGO',
    'CATEGORY_IMAGE',
    'VARIANT_IMAGE',
    'USER_AVATAR',
  ])
  entityType?: AdminMediaEntityType;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['csv', 'json'])
  format?: AdminMediaExportFormat;
}
