import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsJSON,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';

import { ProductStatus } from '../../../generated/prisma';

import { CreateProductImageDto } from './create-product-image.dto';

import { CreateProductVariantDto } from './create-product-variant.dto';

const trimRequiredString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

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

const normalizeStringArray = ({ value }: { value: unknown }): unknown => {
  if (!Array.isArray(value)) {
    return value;
  }

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ];
};

const toOptionalBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value === true || value === false) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes' ||
    normalized === 'on'
  ) {
    return true;
  }

  if (
    normalized === 'false' ||
    normalized === '0' ||
    normalized === 'no' ||
    normalized === 'off'
  ) {
    return false;
  }

  return value;
};

export class CreateProductDto {
  @Transform(trimRequiredString)
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(700)
  shortDescription?: string;

  @Transform(trimRequiredString)
  @IsString()
  @MaxLength(128)
  brandId!: string;

  @Transform(trimRequiredString)
  @IsString()
  @MaxLength(128)
  categoryId!: string;

  @Transform(trimRequiredString)
  @IsString()
  @MaxLength(120)
  sku!: string;

  @Transform(trimRequiredString)
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'price must be a positive decimal string with up to 2 decimal places',
  })
  price!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'comparePrice must be a positive decimal string with up to 2 decimal places',
  })
  comparePrice?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsJSON()
  dimensions?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @Transform(normalizeStringArray)
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({
    each: true,
  })
  attributeValueIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({
    each: true,
  })
  @Type(() => CreateProductImageDto)
  images?: CreateProductImageDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({
    each: true,
  })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];
}
