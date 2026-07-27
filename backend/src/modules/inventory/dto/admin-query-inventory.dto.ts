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

export type AdminInventoryStockStatus =
  'in_stock' | 'low_stock' | 'out_of_stock' | 'reserved';

export type AdminInventorySortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'quantity'
  | 'reservedQuantity'
  | 'availableQuantity'
  | 'lowStockThreshold'
  | 'warehouseCode'
  | 'variantSku'
  | 'productName';

export type AdminInventorySortDirection = 'asc' | 'desc';

export class AdminQueryInventoryDto {
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
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeInactiveWarehouse?: boolean;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'createdAt',
    'updatedAt',
    'quantity',
    'reservedQuantity',
    'availableQuantity',
    'lowStockThreshold',
    'warehouseCode',
    'variantSku',
    'productName',
  ])
  sortBy?: AdminInventorySortBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['asc', 'desc'])
  sortDirection?: AdminInventorySortDirection;
}
