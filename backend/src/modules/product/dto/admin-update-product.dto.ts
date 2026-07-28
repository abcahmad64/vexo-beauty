import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';

import { AdminProductStatus } from './admin-query-product.dto';
import { AdminProductAttributeValueDto } from './admin-product-attribute-value.dto';

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

/* ADMIN_PRODUCT_NULLABLE_SEO_V1 */

const trimNullableOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

const decimalPattern = /^\d+(\.\d{1,4})?$/;
const moneyPattern = /^\d+(\.\d{1,2})?$/;

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

export class AdminUpdateProductDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  description?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  shortDescription?: string;

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
  @MaxLength(120)
  sku?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(moneyPattern)
  price?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(moneyPattern)
  comparePrice?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(moneyPattern)
  purchasePrice?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(moneyPattern)
  salePrice?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(decimalPattern)
  discountPercent?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(moneyPattern)
  finalPrice?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(moneyPattern)
  minAllowedPrice?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsObject()
  dimensions?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  defaultWarehouseId?: string;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @Transform(toOptionalInt)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  @Transform(trimNullableOptionalString)
  @MaxLength(180)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimNullableOptionalString)
  @MaxLength(500)
  seoDescription?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimNullableOptionalString)
  canonicalUrl?: string | null;

  @IsOptional()
  @IsObject()
  schemaJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(decimalPattern)
  aiQualityScore?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminProductAttributeValueDto)
  attributes?: AdminProductAttributeValueDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: AdminProductStatus;
}
