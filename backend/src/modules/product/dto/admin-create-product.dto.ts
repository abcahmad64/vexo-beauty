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
import { AdminAddProductMediaDto } from './admin-product-media.dto';

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

const trimRequiredString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
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

const decimalPattern = /^\d+(\.\d{1,4})?$/;
const moneyPattern = /^\d+(\.\d{1,2})?$/;

export class AdminCreateProductDto {
  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(180)
  name!: string;

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

  @IsString()
  @Transform(trimRequiredString)
  brandId!: string;

  @IsString()
  @Transform(trimRequiredString)
  categoryId!: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productTypeId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  productModelId?: string;

  @IsString()
  @Transform(trimRequiredString)
  @MaxLength(120)
  sku!: string;

  @IsString()
  @Transform(trimRequiredString)
  @Matches(moneyPattern)
  price!: string;

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
  @Transform(trimOptionalString)
  @MaxLength(180)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(500)
  seoDescription?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  canonicalUrl?: string;

  @IsOptional()
  @IsObject()
  schemaJson?: Record<string, unknown>;

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminAddProductMediaDto)
  media?: AdminAddProductMediaDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: AdminProductStatus;
}
