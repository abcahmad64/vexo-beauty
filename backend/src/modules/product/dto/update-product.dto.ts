import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsJSON,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';

import { IsNumber, Min } from 'class-validator';

import { ProductStatus } from '../../../generated/prisma';

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

const normalizeStringArray = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) {
    return value;
  }

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
};

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(220)
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(700)
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  brandId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(128)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  sku?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'price must be a positive decimal string with up to 2 decimal places',
  })
  price?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'comparePrice must be a positive decimal string with up to 2 decimal places',
  })
  comparePrice?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number | null;

  @IsOptional()
  @IsJSON()
  dimensions?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({
    each: true,
  })
  @Transform(normalizeStringArray)
  attributeValueIds?: string[];
}
