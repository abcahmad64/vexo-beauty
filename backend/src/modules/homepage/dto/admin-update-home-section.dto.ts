import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';

import {
  AdminHomeSectionDisplayMode,
  AdminHomeSectionSourceType,
  AdminHomeSectionType,
} from './admin-query-home-section.dto';

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

export class AdminUpdateHomeSectionDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  sectionKey?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(220)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1200)
  description?: string;

  @IsOptional()
  @IsString()
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
  @IsObject()
  sourceConfig?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  actionLabel?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  actionUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(['grid', 'slider', 'carousel', 'banner', 'list'])
  displayMode?: AdminHomeSectionDisplayMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  maxItems?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
