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

export type AdminHomeSectionType =
  | 'hero'
  | 'banner'
  | 'product_grid'
  | 'category_grid'
  | 'brand_grid'
  | 'collection_grid'
  | 'custom';

export type AdminHomeSectionSourceType =
  | 'manual'
  | 'latest_products'
  | 'featured_products'
  | 'category_products'
  | 'brand_products'
  | 'collection_products'
  | 'custom';

export type AdminHomeSectionDisplayMode =
  'grid' | 'slider' | 'carousel' | 'banner' | 'list';

export type AdminHomeSectionSortBy =
  | 'createdAt'
  | 'updatedAt'
  | 'title'
  | 'sectionKey'
  | 'sectionType'
  | 'sourceType'
  | 'sortOrder'
  | 'productCount'
  | 'isActive';

export type AdminHomeSectionSortDirection = 'asc' | 'desc';

export class AdminQueryHomeSectionDto {
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
  sectionKey?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'hero',
    'banner',
    'product_grid',
    'category_grid',
    'brand_grid',
    'collection_grid',
    'custom',
  ])
  sectionType?: AdminHomeSectionType;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'manual',
    'latest_products',
    'featured_products',
    'category_products',
    'brand_products',
    'collection_products',
    'custom',
  ])
  sourceType?: AdminHomeSectionSourceType;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  activeNow?: boolean;

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
  @IsString()
  @Transform(trimOptionalString)
  @IsIn([
    'createdAt',
    'updatedAt',
    'title',
    'sectionKey',
    'sectionType',
    'sourceType',
    'sortOrder',
    'productCount',
    'isActive',
  ])
  sortBy?: AdminHomeSectionSortBy;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @IsIn(['asc', 'desc'])
  sortDirection?: AdminHomeSectionSortDirection;
}
