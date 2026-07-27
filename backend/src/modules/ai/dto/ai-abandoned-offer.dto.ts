import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
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

export class AiAbandonedOfferDto {
  @Transform(trimRequiredString)
  @IsString()
  @Length(1, 128)
  productId!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(128)
  variantId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(128)
  userId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(128)
  visitorId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString()
  viewedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  baseDiscountPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(70)
  maxDiscountPercent?: number;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  createCoupon?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(72)
  expiresInHours?: number;
}
