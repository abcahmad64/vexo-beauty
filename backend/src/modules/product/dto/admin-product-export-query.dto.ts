import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminProductStatus } from './admin-query-product.dto';

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

export type AdminProductExportFormat = 'csv' | 'json';

export class AdminProductExportQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  brandId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: AdminProductStatus;

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
  format?: AdminProductExportFormat;
}
