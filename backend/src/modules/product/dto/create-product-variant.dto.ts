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

export class CreateProductVariantDto {
  @Transform(trimRequiredString)
  @IsString()
  @MaxLength(120)
  sku!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'price must be a positive decimal string with up to 2 decimal places',
  })
  price?: string;

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
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;
}
