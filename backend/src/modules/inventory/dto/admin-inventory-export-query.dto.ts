import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

import { Transform } from 'class-transformer';

import { AdminInventoryStockStatus } from './admin-query-inventory.dto';

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

export type AdminInventoryExportFormat = 'csv' | 'json';

export class AdminInventoryExportQueryDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  variantId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  warehouseId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  warehouseCode?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['in_stock', 'low_stock', 'out_of_stock', 'reserved'])
  stockStatus?: AdminInventoryStockStatus;

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
  format?: AdminInventoryExportFormat;
}
