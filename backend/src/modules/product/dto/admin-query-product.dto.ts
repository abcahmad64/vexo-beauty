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

export type AdminProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type AdminProductSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'name'
  | 'price'
  | 'salePrice'
  | 'finalPrice'
  | 'status'
  | 'viewCount'
  | 'averageRating';

export type AdminSortDirection = 'asc' | 'desc';

export class AdminQueryProductDto {
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
  brandId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productTypeId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productModelId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  attributeId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  attributeValueId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  sku?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: AdminProductStatus;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  hasDiscount?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  missingSeo?: boolean;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  priceMin?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  priceMax?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  finalPriceMin?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  finalPriceMax?: string;

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
    'name',
    'price',
    'salePrice',
    'finalPrice',
    'status',
    'viewCount',
    'averageRating',
  ])
  sortBy?: AdminProductSortBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['asc', 'desc'])
  sortDirection?: AdminSortDirection;
}
