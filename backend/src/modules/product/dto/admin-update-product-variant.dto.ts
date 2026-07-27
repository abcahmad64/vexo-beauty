import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
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

const trimNullableString = ({ value }: { value: unknown }) => {
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

export class AdminUpdateProductVariantDto {
  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @MaxLength(120)
  sku?: string;

  @IsOptional()
  @IsString()
  @Transform(trimNullableString)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._/+:-]+$/)
  barcode?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimNullableString)
  @Matches(/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/)
  gtin?: string | null;

  @IsOptional()
  @IsString()
  @Transform(trimNullableString)
  @MaxLength(120)
  mpn?: string | null;

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
  @Matches(/^\d+(\.\d{1,2})?$/)
  price?: string;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  @Matches(/^\d+(\.\d{1,2})?$/)
  comparePrice?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsString()
  @Transform(trimOptionalString)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({
    each: true,
  })
  attributeValueIds?: string[];
}
