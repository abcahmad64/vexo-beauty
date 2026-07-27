import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import { Transform, Type } from 'class-transformer';

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

const normalizeOptionalSku = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed.toUpperCase() : null;
};

const normalizeOptionalSlug = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug.length > 0 ? slug : null;
};

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalSku)
  @MaxLength(120)
  sku?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(180)
  name?: string | null;

  @IsOptional()
  @IsString()
  @Transform(normalizeOptionalSlug)
  @MaxLength(200)
  slug?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'price must be a decimal string with up to 2 decimal places',
  })
  price?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'comparePrice must be a decimal string with up to 2 decimal places',
  })
  comparePrice?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number | null;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(1200)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
