import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
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

export class QueryWishlistDto {
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(300)
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(128)
  brandId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(160)
  brandSlug?: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(128)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(160)
  categorySlug?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  hasDiscount?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
